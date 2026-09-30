import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase/admin";

export async function DELETE(request: NextRequest) {
  try {
    const user = await verifyIdToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = getAdminFirestore();
    const collections = ["portfolio_snapshots", "expenses"];

    let totalDeleted = 0;
    const errors: string[] = [];

    for (const col of collections) {
      try {
        const snap = await db.collection("users").doc(user.uid).collection(col).get();
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        totalDeleted += snap.size;
      } catch (err) {
        errors.push(`${col}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    // Also delete the settings doc
    try {
      await db.collection("users").doc(user.uid).collection("settings").doc("data").delete();
    } catch { /* ignore if not exists */ }

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, message: `Partially cleared. Deleted ${totalDeleted} records.`, errors, count: totalDeleted },
        { status: 207 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted all data (${totalDeleted} records)`,
      count: totalDeleted,
    });
  } catch (error) {
    console.error("Clear all data error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clear all data" },
      { status: 500 }
    );
  }
}