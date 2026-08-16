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

    // Find header row (contains "Stock Symbol")
    let headerRowIndex = -1;
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i] as string[];
      if (row[0]?.toString().toLowerCase().includes("stock symbol")) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return NextResponse.json({ 
        error: "Invalid holdings statement format. Could not find US stock holdings table." 
      }, { status: 422 });
    }

    // Extract as-of date
    let asOfDate = new Date().toISOString().split("T")[0];
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
      const row = rawData[i] as (string | number)[];
      if (row[0]?.toString().toLowerCase() === "holdings as on" && row[1]) {
        asOfDate = row[1].toString();
        break;
      }
    }

    const records = [];
    const skipped: string[] = [];

    // Process data rows (start from headerRowIndex + 1)
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i] as (string | number)[];
      if (!row || row.length < 5) continue;

      // Columns: Stock Symbol, Holding Since, Quantity, Avg. Price ($), Total Value ($)
      const [symbol, , quantity, avgPrice, totalValue] = row;
      
      if (!symbol || !quantity || typeof quantity !== "number" || quantity <= 0) {
        continue;
      }

      const symbolStr = symbol.toString().trim().toUpperCase();
      const qty = Number(quantity);
      const price = Number(avgPrice) || 0;
      const amount = Number(totalValue) || (qty * price);

      if (symbolStr && qty > 0) {
        records.push({
          user_id: user.id,
          symbol: symbolStr,
          description: null,
          side: "buy",
          quantity: qty,
          price: price,
          amount: amount,
          transaction_date: asOfDate,
          notes: `Imported from holdings statement as of ${asOfDate}`,
        });
      } else {
        skipped.push(symbolStr || `Row ${i}`);
      }
    }

    if (records.length === 0) {
      return NextResponse.json({
        error: "No holdings found in the statement.",
        debug: `Searched ${rawData.length} rows, header at row ${headerRowIndex}`,
      }, { status: 422 });
    }

    const { error: dbError } = await supabase
      .from("us_stock_transactions")
      .insert(records);

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      imported: records.length,
      skipped: skipped.length,
      message: `Imported ${records.length} US stock holdings as opening balance${skipped.length > 0 ? `, ${skipped.length} skipped` : ""}`,
      asOfDate,
    });
  } catch (err) {
    console.error("US stocks holdings import error:", err);
    return NextResponse.json({
      error: `Import failed: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 500 });
  }
}
