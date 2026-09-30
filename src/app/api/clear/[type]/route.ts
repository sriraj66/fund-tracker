import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase/admin";

type RouteParams = { params: Promise<{ type: string }> };

const typeToCollection: Record<string, string> = {
  snapshots: "portfolio_snapshots",
  expenses: "expenses",
};

export async function DELETE(request: NextRequest, props: RouteParams) {
  try {
    const user = await verifyIdToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { type } = await props.params;
    const col = typeToCollection[type];
    if (!col) return NextResponse.json({ error: "Invalid data type" }, { status: 400 });

    const db = getAdminFirestore();
    const snap = await db.collection("users").doc(user.uid).collection(col).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${snap.size} records from ${type}`,
      count: snap.size,
    });
  } catch (error) {
    console.error("Clear data error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clear data" },
      { status: 500 }
    );
  }
}