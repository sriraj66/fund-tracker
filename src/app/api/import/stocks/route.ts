import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

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
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    // Find header row: look for "Stock name"
    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      if (row.some((cell) => typeof cell === "string" && cell.toString().toLowerCase().includes("stock name"))) {
        headerIdx = i;
        break;
      }
    }

    if (headerIdx === -1) {
      return NextResponse.json({ error: "Could not find header row with 'Stock name'" }, { status: 422 });
    }

    const headers = (rows[headerIdx] as unknown[]).map((h) => (h ? h.toString().trim().toLowerCase() : ""));
    const nameIdx = headers.findIndex((h) => h.includes("stock name"));
    const symbolIdx = headers.findIndex((h) => h === "symbol");
    const isinIdx = headers.findIndex((h) => h === "isin");
    const typeIdx = headers.findIndex((h) => h === "type");
    const qtyIdx = headers.findIndex((h) => h.includes("quantity") || h === "qty");
    const valueIdx = headers.findIndex((h) => h === "value");
    const exchangeIdx = headers.findIndex((h) => h === "exchange");
    const dateIdx = headers.findIndex((h) => h.includes("execution date") || h.includes("date"));
    const statusIdx = headers.findIndex((h) => h.includes("status"));

    const records = [];
    const skipped = [];

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      if (!row || row.every((cell) => cell === null || cell === "")) continue;

      const stockName = row[nameIdx]?.toString().trim();
      const symbol = row[symbolIdx]?.toString().trim();
      const txType = row[typeIdx]?.toString().trim().toUpperCase();
      const valueRaw = row[valueIdx]?.toString().replace(/,/g, "").trim();
      const qtyRaw = row[qtyIdx]?.toString().replace(/,/g, "").trim();
      const dateRaw = row[dateIdx]?.toString().trim();

      if (!stockName || !symbol || !txType || !valueRaw || !qtyRaw) {
        skipped.push(i + 1);
        continue;
      }

      const value = parseFloat(valueRaw);
      const qty = parseFloat(qtyRaw);
      if (isNaN(value) || isNaN(qty)) { skipped.push(i + 1); continue; }

      // Parse datetime like "01-07-2026 11:55 AM"
      let execDate: string | null = null;
      if (dateRaw) {
        // Try standard parse first
        const d = new Date(dateRaw);
        if (!isNaN(d.getTime())) {
          execDate = d.toISOString();
        } else {
          // Try "DD-MM-YYYY HH:MM AM/PM" format
          const match = dateRaw.match(/^(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
          if (match) {
            const [, dd, mm, yyyy, hh, min, ampm] = match;
            let hour = parseInt(hh);
            if (ampm?.toUpperCase() === "PM" && hour < 12) hour += 12;
            if (ampm?.toUpperCase() === "AM" && hour === 12) hour = 0;
            execDate = new Date(`${yyyy}-${mm}-${dd}T${String(hour).padStart(2, "0")}:${min}:00+05:30`).toISOString();
          }
        }
      }

      const isin = isinIdx >= 0 ? row[isinIdx]?.toString().trim() || null : null;
      const exchange = exchangeIdx >= 0 ? row[exchangeIdx]?.toString().trim() || null : null;
      const status = statusIdx >= 0 ? row[statusIdx]?.toString().trim() || "Executed" : "Executed";

      records.push({
        user_id: user.id,
        stock_name: stockName,
        symbol,
        isin,
        transaction_type: txType === "SELL" ? "SELL" : "BUY",
        quantity: qty,
        price: qty > 0 ? value / qty : null,
        value,
        exchange,
        execution_date: execDate,
        order_status: status,
      });
    }

    if (records.length === 0) {
      return NextResponse.json({ error: "No valid stock orders found in file", skipped }, { status: 422 });
    }

    const { error: dbError } = await supabase
      .from("stock_transactions")
      .insert(records);

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      imported: records.length,
      skipped: skipped.length,
      message: `Imported ${records.length} stock orders${skipped.length > 0 ? `, skipped ${skipped.length} rows` : ""}`,
    });
  } catch (err) {
    console.error("Stocks import error:", err);
    return NextResponse.json({ error: "Failed to parse file. Make sure it is the Stocks Order History XLSX." }, { status: 500 });
  }
}