import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase/admin";

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyIdToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Transaction ID required" }, { status: 400 });

    const db = getAdminFirestore();
    const txRef = db.collection("users").doc(user.uid).collection("crypto_transactions").doc(id);
    const txDoc = await txRef.get();

    if (!txDoc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const tx = txDoc.data()!;

    // Revert holding if this transaction was linked to one
    if (tx.holding_id && typeof tx.applied_qty === "number" && typeof tx.applied_amount === "number") {
      const holdingRef = db.collection("users").doc(user.uid).collection("crypto_holdings").doc(tx.holding_id);
      const holdingDoc = await holdingRef.get();
      if (holdingDoc.exists) {
        const h = holdingDoc.data()!;
        const oldQty      = Number(h.quantity       ?? 0);
        const oldInvested = Number(h.invested_amount ?? 0);
        const isBuy       = tx.trade_type === "BUY";

        // Revert: BUY → subtract back; SELL → add back
        const newQty      = isBuy ? Math.max(0, oldQty - tx.applied_qty)      : oldQty + tx.applied_qty;
        const newInvested = isBuy ? Math.max(0, oldInvested - tx.applied_amount) : oldInvested + tx.applied_amount;
        const newAvgPrice = newQty > 0 ? newInvested / newQty : Number(h.avg_buy_price ?? 0);

        await holdingRef.update({
          quantity:        newQty,
          invested_amount: newInvested,
          avg_buy_price:   newAvgPrice,
        });
      }
    }

    await txRef.delete();
    return NextResponse.json({ success: true, message: "Transaction deleted" });
  } catch (err) {
    console.error("Delete crypto transaction error:", err);
    return NextResponse.json({ error: `Delete failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
