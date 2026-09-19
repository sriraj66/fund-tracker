import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase/admin";

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyIdToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Entry ID required" }, { status: 400 });

    const db = getAdminFirestore();
    // Try stock_monthly_entries first (new model), fallback to stock_transactions (legacy)
    const monthlyRef = db
      .collection("users")
      .doc(user.uid)
      .collection("stock_monthly_entries")
      .doc(id);

    const monthlyDoc = await monthlyRef.get();
    if (monthlyDoc.exists) {
      await monthlyRef.delete();
      return NextResponse.json({ success: true, message: "Monthly entry deleted" });
    }

    // Legacy fallback
    const txRef = db
      .collection("users")
      .doc(user.uid)
      .collection("stock_transactions")
      .doc(id);
    const txDoc = await txRef.get();
    if (!txDoc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await txRef.delete();
    return NextResponse.json({ success: true, message: "Transaction deleted" });
  } catch (err) {
    console.error("Delete stock entry error:", err);
    return NextResponse.json(
      { error: `Delete failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
