import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx");

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
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
      if (!dateStr || dateStr.toLowerCase() === "date" || !dateStr.match(/\d{2}\/\d{2}\/\d{4}/)) {
        continue;
      }

      const [day, month, year] = dateStr.split("/");
      const snapshotDate = `${year}-${month}-${day}`;

      const goldInv = Number(row[2]) || 0;
      const goldVal = Number(row[3]) || 0;
      const goldRet = Number(row[4]) || 0;
      
      const cryptoInv = Number(row[6]) || 0;
      const cryptoVal = Number(row[7]) || 0;
      const cryptoRet = Number(row[8]) || 0;
      
      const mfInv = Number(row[10]) || 0;
      const mfVal = Number(row[11]) || 0;
      const mfRet = Number(row[12]) || 0;
      
      const inStocksInv = Number(row[14]) || 0;
      const inStocksVal = Number(row[15]) || 0;
      const inStocksRet = Number(row[16]) || 0;
      
      const usStocksInv = Number(row[18]) || 0;
      const usStocksVal = Number(row[19]) || 0;
      const usStocksRet = Number(row[20]) || 0;
      
      const totalInv = Number(row[21]) || 0;
      const totalVal = Number(row[22]) || 0;
      const totalRet = Number(row[23]) || 0;
      const profit = Number(row[24]) || 0;

      if (totalInv > 0 || totalVal > 0) {
        records.push({
          user_id: user.id,
          snapshot_date: snapshotDate,
          gold_invested: goldInv,
          gold_value: goldVal,
          gold_return_pct: goldRet,
          crypto_invested: cryptoInv,
          crypto_value: cryptoVal,
          crypto_return_pct: cryptoRet,
          mf_invested: mfInv,
          mf_value: mfVal,
          mf_return_pct: mfRet,
          in_stocks_invested: inStocksInv,
          in_stocks_value: inStocksVal,
          in_stocks_return_pct: inStocksRet,
          us_stocks_invested: usStocksInv,
          us_stocks_value: usStocksVal,
          us_stocks_return_pct: usStocksRet,
          total_invested: totalInv,
          total_value: totalVal,
          total_return_pct: totalRet,
          profit: profit,
        });
      } else {
        skipped.push(dateStr);
      }
    }

    if (records.length === 0) {
      return NextResponse.json({
        error: "No valid snapshot data found.",
      }, { status: 422 });
    }

    const { error: dbError } = await supabase
      .from("portfolio_snapshots")
      .upsert(records, { onConflict: "user_id,snapshot_date" });

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      imported: records.length,
      skipped: skipped.length,
      message: `Imported ${records.length} portfolio snapshots${skipped.length > 0 ? `, ${skipped.length} skipped` : ""}`,
    });
  } catch (err) {
    console.error("Portfolio snapshot import error:", err);
    return NextResponse.json({
      error: `Import failed: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 500 });
  }
}
