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

    // Find header row (contains "Stock Name")
    let headerRowIndex = -1;
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i] as string[];
      if (row[0]?.toString().toLowerCase().includes("stock name")) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return NextResponse.json({ 
        error: "Invalid holdings statement format. Could not find stock holdings table." 
      }, { status: 422 });
    }

    // Extract as-of date (usually in row 3: "Holdings statement for stocks as on 01-08-2026")
    let asOfDate = new Date().toISOString().split("T")[0];
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i] as string[];
      const text = row[0]?.toString() || "";
      const match = text.match(/holdings?\s+(?:statement\s+)?(?:for\s+stocks\s+)?as\s+on\s+(\d{2}-\d{2}-\d{4})/i);
      if (match) {
        const [day, month, year] = match[1].split("-");
        asOfDate = `${year}-${month}-${day}`;
        break;
      }
    }

    const records = [];
    const skipped: string[] = [];

    // Process data rows (start from headerRowIndex + 1)
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i] as (string | number)[];
      if (!row || row.length < 5) continue;

      const [stockName, isin, quantity, avgBuyPrice, buyValue] = row;
      
      if (!stockName || !quantity || typeof quantity !== "number" || quantity <= 0) {
        continue;
      }

      const stockNameStr = stockName.toString().trim();
      const isinStr = isin?.toString().trim() || "";
      const qty = Number(quantity);
      const avgPrice = Number(avgBuyPrice) || 0;
      const value = Number(buyValue) || (qty * avgPrice);

      if (stockNameStr && qty > 0) {
        records.push({
          user_id: user.id,
          stock_name: stockNameStr,
          symbol: isinStr.split("INE")[0] || stockNameStr.substring(0, 10), // fallback symbol
          isin: isinStr || null,
          transaction_type: "BUY",
          quantity: qty,
          price: avgPrice,
          value: value,
          exchange: "NSE",
          execution_date: asOfDate,
          order_status: "Opening Balance",
          notes: `Imported from holdings statement as of ${asOfDate}`,
        });
      } else {
        skipped.push(stockNameStr || `Row ${i}`);
      }
    }

    if (records.length === 0) {
      return NextResponse.json({
        error: "No holdings found in the statement.",
        debug: `Searched ${rawData.length} rows, header at row ${headerRowIndex}`,
      }, { status: 422 });
    }

    const { error: dbError } = await supabase
      .from("stock_transactions")
      .insert(records);

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      imported: records.length,
      skipped: skipped.length,
      message: `Imported ${records.length} stock holdings as opening balance${skipped.length > 0 ? `, ${skipped.length} skipped` : ""}`,
      asOfDate,
    });
  } catch (err) {
    console.error("Stocks holdings import error:", err);
    return NextResponse.json({
      error: `Import failed: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 500 });
  }
}
