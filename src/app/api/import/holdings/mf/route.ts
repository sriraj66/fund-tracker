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

    // Find header row (contains "Scheme Name")
    let headerRowIndex = -1;
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i] as string[];
      if (row[0]?.toString().toLowerCase().includes("scheme name")) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      return NextResponse.json({ 
        error: "Invalid holdings statement format. Could not find MF holdings table." 
      }, { status: 422 });
    }

    // Extract as-of date
    let asOfDate = new Date().toISOString().split("T")[0];
    for (let i = 0; i < Math.min(20, rawData.length); i++) {
      const row = rawData[i] as string[];
      const text = row[0]?.toString() || "";
      const match = text.match(/holdings?\s+as\s+on\s+(\d{4}-\d{2}-\d{2})/i);
      if (match) {
        asOfDate = match[1];
        break;
      }
    }

    const records = [];
    const skipped: string[] = [];

    // Process data rows
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i] as (string | number)[];
      if (!row || row.length < 7) continue;

      // Columns: Scheme Name, AMC, Category, Sub-category, Folio No., Source, Units, Invested Value, Current Value, Returns, XIRR
      const [schemeName, , , , , , units, investedValue] = row;
      
      if (!schemeName || !units || typeof units !== "number" || units <= 0) {
        continue;
      }

      const schemeNameStr = schemeName.toString().trim();
      const unitsNum = Number(units);
      const invested = Number(investedValue) || 0;
      const nav = invested > 0 && unitsNum > 0 ? invested / unitsNum : 0;

      if (schemeNameStr && unitsNum > 0) {
        records.push({
          user_id: user.id,
          scheme_name: schemeNameStr,
          transaction_type: "PURCHASE",
          units: unitsNum,
          nav: nav,
          amount: invested,
          transaction_date: asOfDate,
          notes: `Imported from holdings statement as of ${asOfDate}`,
        });
      } else {
        skipped.push(schemeNameStr || `Row ${i}`);
      }
    }

    if (records.length === 0) {
      return NextResponse.json({
        error: "No holdings found in the statement.",
        debug: `Searched ${rawData.length} rows, header at row ${headerRowIndex}`,
      }, { status: 422 });
    }

    const { error: dbError } = await supabase
      .from("mf_transactions")
      .insert(records);

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      imported: records.length,
      skipped: skipped.length,
      message: `Imported ${records.length} MF holdings as opening balance${skipped.length > 0 ? `, ${skipped.length} skipped` : ""}`,
      asOfDate,
    });
  } catch (err) {
    console.error("MF holdings import error:", err);
    return NextResponse.json({
      error: `Import failed: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 500 });
  }
}
