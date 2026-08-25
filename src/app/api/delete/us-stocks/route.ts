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
    const docRef = db.collection("users").doc(user.uid).collection("us_stock_transactions").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await docRef.delete();
    return NextResponse.json({ success: true, message: "Transaction deleted" });
  } catch (err) {
    console.error("Delete US stock transaction error:", err);
    return NextResponse.json({ error: `Delete failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
