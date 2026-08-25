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

    const records = [];
    const skipped: string[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i] as (string | number)[];
      if (!row || row.length < 22) continue;

      const dateStr = row[0]?.toString().trim();
      if (!dateStr || dateStr.toLowerCase() === "date" || !dateStr.match(/\d{2}\/\d{2}\/\d{4}/)) continue;

      const [day, month, year] = dateStr.split("/");
      const snapshotDate = `${year}-${month}-${day}`;

      const totalInv = Number(row[21]) || 0;
      const totalVal = Number(row[22]) || 0;

      if (totalInv > 0 || totalVal > 0) {
        records.push({
          snapshot_date: snapshotDate,
          gold_invested: Number(row[2]) || 0,
          gold_value: Number(row[3]) || 0,
          gold_return_pct: Number(row[4]) || 0,
          crypto_invested: Number(row[6]) || 0,
          crypto_value: Number(row[7]) || 0,
          crypto_return_pct: Number(row[8]) || 0,
          mf_invested: Number(row[10]) || 0,
          mf_value: Number(row[11]) || 0,
          mf_return_pct: Number(row[12]) || 0,
          in_stocks_invested: Number(row[14]) || 0,
          in_stocks_value: Number(row[15]) || 0,
          in_stocks_return_pct: Number(row[16]) || 0,
          us_stocks_invested: Number(row[18]) || 0,
          us_stocks_value: Number(row[19]) || 0,
          us_stocks_return_pct: Number(row[20]) || 0,
          total_invested: totalInv,
          total_value: totalVal,
          total_return_pct: Number(row[23]) || 0,
          profit: Number(row[24]) || 0,
          created_at: new Date().toISOString(),
        });
      } else {
        skipped.push(dateStr);
      }
    }

    if (records.length === 0) return NextResponse.json({ error: "No valid snapshot data found." }, { status: 422 });

    const db = getAdminFirestore();
    const col = db.collection("users").doc(user.uid).collection("portfolio_snapshots");

    // Upsert: delete existing docs for same date, then insert
    for (const rec of records) {
      const existing = await col.where("snapshot_date", "==", rec.snapshot_date).get();
      const batch = db.batch();
      existing.docs.forEach((d) => batch.delete(d.ref));
      batch.set(col.doc(), rec);
      await batch.commit();
    }

    return NextResponse.json({
      success: true, imported: records.length, skipped: skipped.length,
      message: `Imported ${records.length} portfolio snapshots${skipped.length > 0 ? `, ${skipped.length} skipped` : ""}`,
    });
  } catch (err) {
    return NextResponse.json({ error: `Import failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
