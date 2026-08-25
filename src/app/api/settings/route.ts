import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  try {
    const user = await verifyIdToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = getAdminFirestore();
    const settingsRef = db.collection("users").doc(user.uid).collection("settings").doc("data");
    const doc = await settingsRef.get();

    if (!doc.exists) {
      // Create default settings
      await settingsRef.set({ usd_to_inr_rate: 83.50, updated_at: new Date().toISOString() });
      return NextResponse.json({ usd_to_inr_rate: 83.50 });
    }

    const data = doc.data()!;
    return NextResponse.json({ usd_to_inr_rate: data.usd_to_inr_rate ?? 83.50 });
  } catch (err) {
    console.error("Get settings error:", err);
    return NextResponse.json({ error: `Failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyIdToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { usd_to_inr_rate } = body;

    if (!usd_to_inr_rate || usd_to_inr_rate <= 0) {
      return NextResponse.json({ error: "Invalid exchange rate" }, { status: 400 });
    }

    const db = getAdminFirestore();
    await db.collection("users").doc(user.uid).collection("settings").doc("data").set(
      { usd_to_inr_rate: parseFloat(usd_to_inr_rate), updated_at: new Date().toISOString() },
      { merge: true }
    );

    return NextResponse.json({ success: true, usd_to_inr_rate: parseFloat(usd_to_inr_rate) });
  } catch (err) {
    console.error("Update settings error:", err);
    return NextResponse.json({ error: `Failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}