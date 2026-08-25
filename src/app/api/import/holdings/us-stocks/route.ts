import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase/admin";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx");

export async function POST(request: NextRequest) {
  try {
    const user = await verifyIdToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    let headerRowIndex = -1;
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i] as string[];
      if (row[0]?.toString().toLowerCase().includes("stock symbol")) { headerRowIndex = i; break; }
    }
    if (headerRowIndex === -1) return NextResponse.json({ error: "Invalid holdings statement format." }, { status: 422 });

    let asOfDate = new Date().toISOString().split("T")[0];
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i] as (string | number)[];
      if (row[0]?.toString().toLowerCase() === "holdings as on" && row[1]) { asOfDate = row[1].toString(); break; }
    }

    const records = [];
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i] as (string | number)[];
      if (!row || row.length < 5) continue;
      const [symbol, , quantity, avgPrice, totalValue] = row;
      if (!symbol || !quantity || typeof quantity !== "number" || quantity <= 0) continue;

      const symbolStr = symbol.toString().trim().toUpperCase();
      const qty = Number(quantity);
      const price = Number(avgPrice) || 0;
      records.push({
        symbol: symbolStr,
        description: null,
        side: "buy",
        quantity: qty,
        price,
        amount: Number(totalValue) || qty * price,
        transaction_date: asOfDate,
        notes: `Imported from holdings statement as of ${asOfDate}`,
        created_at: new Date().toISOString(),
      });
    }

    if (records.length === 0) return NextResponse.json({ error: "No holdings found in the statement." }, { status: 422 });

    const db = getAdminFirestore();
    const batch = db.batch();
    const col = db.collection("users").doc(user.uid).collection("us_stock_transactions");
    records.forEach((rec) => batch.set(col.doc(), rec));
    await batch.commit();

    return NextResponse.json({ success: true, imported: records.length, skipped: 0, message: `Imported ${records.length} US stock holdings`, asOfDate });
  } catch (err) {
    return NextResponse.json({ error: `Import failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}