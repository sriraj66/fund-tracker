import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase/admin";
import * as XLSX from "xlsx";
import { extractCoin } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyIdToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("spot")) ?? wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      if (
        row.some((cell) => typeof cell === "string" && cell.toString().toLowerCase().includes("transaction id")) &&
        row.some((cell) => typeof cell === "string" && cell.toString().toLowerCase().includes("market"))
      ) { headerIdx = i; break; }
    }
    if (headerIdx === -1) return NextResponse.json({ error: "Could not find header row. Make sure this is the CoinSwitch transaction XLSX." }, { status: 422 });

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

      if (!dateRaw || !market || !tradeType) { skipped.push(i + 1); continue; }

      const parseNum = (val: unknown): number | null => {
        if (val === null || val === undefined) return null;
        const n = parseFloat(val.toString().replace(/,/g, "").replace(/\s*INR\s*/i, "").trim());
        return isNaN(n) ? null : n;
      };

      const coin = extractCoin(market);
      const d = new Date(dateRaw);
      const txDate = !isNaN(d.getTime()) ? d.toISOString() : dateRaw;

      records.push({
        transaction_ref: txRef,
        market,
        coin,
        trade_type: tradeType === "SELL" ? "SELL" : "BUY",
        price: parseNum(priceIdx >= 0 ? row[priceIdx] : null),
        volume: volumeIdx >= 0 && row[volumeIdx] !== null ? parseFloat(row[volumeIdx]!.toString()) : null,
        total_inr: parseNum(totalIdx >= 0 ? row[totalIdx] : null),
        tds_amount: tdsAmtIdx >= 0 && row[tdsAmtIdx] !== null ? parseFloat(row[tdsAmtIdx]!.toString()) || 0 : 0,
        fee_amount: feeAmtIdx >= 0 && row[feeAmtIdx] !== null ? parseFloat(row[feeAmtIdx]!.toString()) || 0 : 0,
        transaction_date: txDate,
        created_at: new Date().toISOString(),
      });
    }

    if (records.length === 0) return NextResponse.json({ error: "No spot trades found.", skipped }, { status: 422 });

    const db = getAdminFirestore();
    const batch = db.batch();
    const col = db.collection("users").doc(user.uid).collection("crypto_transactions");
    records.forEach((rec) => batch.set(col.doc(), rec));
    await batch.commit();

    return NextResponse.json({
      success: true, imported: records.length, skipped: skipped.length,
      message: `Imported ${records.length} crypto trades${skipped.length > 0 ? `, skipped ${skipped.length} rows` : ""}`,
    });
  } catch (err) {
    console.error("Crypto import error:", err);
    return NextResponse.json({ error: "Failed to parse file. Make sure it is the CoinSwitch Transaction Statement XLSX." }, { status: 500 });
  }
}
