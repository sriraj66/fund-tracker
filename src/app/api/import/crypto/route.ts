import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";
import { extractCoin } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });

    // Use "Spot Trades" sheet
    const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("spot")) ?? wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    // Find header row: look for "Transaction Id" and "Market"
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      if (
        row.some((cell) => typeof cell === "string" && cell.toString().toLowerCase().includes("transaction id")) &&
        row.some((cell) => typeof cell === "string" && cell.toString().toLowerCase().includes("market"))
      ) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) {
      return NextResponse.json({ error: "Could not find header row. Make sure this is the CoinSwitch transaction XLSX (Spot Trades sheet)." }, { status: 422 });
    }

    const headers = (rows[headerIdx] as unknown[]).map((h) => (h ? h.toString().trim().toLowerCase() : ""));
    const txIdIdx = headers.findIndex((h) => h.includes("transaction id"));
    const dateIdx = headers.findIndex((h) => h === "date");
    const marketIdx = headers.findIndex((h) => h === "market");
    const priceIdx = headers.findIndex((h) => h === "price");
    const volumeIdx = headers.findIndex((h) => h === "volume");
    const totalIdx = headers.findIndex((h) => h === "total");
    const tradeTypeIdx = headers.findIndex((h) => h.includes("trade type"));
    const tdsAmtIdx = headers.findIndex((h) => h.includes("tds amount"));
    const feeAmtIdx = headers.findIndex((h) => h.includes("fee amount"));

    const records = [];
    const skipped = [];

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      if (!row || row.every((cell) => cell === null || cell === "")) continue;

      const txRef = row[txIdIdx]?.toString().trim() || null;
      const dateRaw = row[dateIdx]?.toString().trim();
      const market = row[marketIdx]?.toString().trim().toUpperCase();
      const tradeType = row[tradeTypeIdx]?.toString().trim().toUpperCase();

      if (!dateRaw || !market || !tradeType) {
        skipped.push(i + 1);
        continue;
      }

      // Parse price: "6,410,689.812699862951 INR" → 6410689.81
      const parsePriceField = (val: unknown): number | null => {
        if (val === null || val === undefined) return null;
        const str = val.toString().replace(/,/g, "").replace(/\s*INR\s*/i, "").trim();
        const n = parseFloat(str);
        return isNaN(n) ? null : n;
      };

      // Parse total: "140.33 INR" → 140.33
      const parseTotalField = (val: unknown): number | null => {
        if (val === null || val === undefined) return null;
        const str = val.toString().replace(/,/g, "").replace(/\s*INR\s*/i, "").trim();
        const n = parseFloat(str);
        return isNaN(n) ? null : n;
      };

      const price = parsePriceField(priceIdx >= 0 ? row[priceIdx] : null);
      const volume = volumeIdx >= 0 && row[volumeIdx] !== null ? parseFloat(row[volumeIdx]!.toString()) : null;
      const totalInr = parseTotalField(totalIdx >= 0 ? row[totalIdx] : null);
      const tdsAmount = tdsAmtIdx >= 0 && row[tdsAmtIdx] !== null ? parseFloat(row[tdsAmtIdx]!.toString()) || 0 : 0;
      const feeAmount = feeAmtIdx >= 0 && row[feeAmtIdx] !== null ? parseFloat(row[feeAmtIdx]!.toString()) || 0 : 0;

      const coin = extractCoin(market);

      // Parse date: "2026-07-02 18:38:13"
      let txDate: string;
      const d = new Date(dateRaw);
      txDate = !isNaN(d.getTime()) ? d.toISOString() : dateRaw;

      records.push({
        user_id: user.id,
        transaction_ref: txRef,
        market,
        coin,
        trade_type: tradeType === "SELL" ? "SELL" : "BUY",
        price,
        volume,
        total_inr: totalInr,
        tds_amount: tdsAmount,
        fee_amount: feeAmount,
        transaction_date: txDate,
      });
    }

    if (records.length === 0) {
      return NextResponse.json({ error: "No spot trades found. Make sure this is the CoinSwitch Transaction Statement XLSX.", skipped }, { status: 422 });
    }

    // Use upsert to avoid duplicates by transaction_ref
    const { error: dbError } = await supabase
      .from("crypto_transactions")
      .insert(records);

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      imported: records.length,
      skipped: skipped.length,
      message: `Imported ${records.length} crypto trades${skipped.length > 0 ? `, skipped ${skipped.length} rows` : ""}`,
    });
  } catch (err) {
    console.error("Crypto import error:", err);
    return NextResponse.json({ error: "Failed to parse file. Make sure it is the CoinSwitch Transaction Statement XLSX." }, { status: 500 });
  }
}