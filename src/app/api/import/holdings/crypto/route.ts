import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer" });

    // Find the "Balances VDA" sheet
    const balancesSheet = workbook.Sheets["Balances VDA"];
    if (!balancesSheet) {
      return NextResponse.json(
        { error: "Could not find 'Balances VDA' sheet in the file" },
        { status: 400 }
      );
    }

    // Convert to JSON - skip header rows (first 7 rows are header/description)
    const rawData = XLSX.utils.sheet_to_json(balancesSheet, {
      header: 1,
      defval: "",
    }) as any[][];

    // Find the data start (after the column headers row that contains "Symbol")
    let dataStartRow = 0;
    for (let i = 0; i < rawData.length; i++) {
      if (rawData[i][0] === "Symbol" || rawData[i][0] === "1") {
        dataStartRow = i + 1; // Start from next row after headers
        break;
      }
    }

    const holdings = [];
    for (let i = dataStartRow; i < rawData.length; i++) {
      const row = rawData[i];
      
      // Skip empty rows and the column number row (1, 2, 3, 4...)
      if (!row[0] || row[0] === "" || row[0] === "1") continue;

      // Parse the row data
      // Columns: Symbol, Quantity, Buy Trade Id, Buy Date and Time, Buy Price in INR, Fees charged in INR, Acquisition Cost in INR, TDS Deducted in INR
      const symbol = String(row[0]).trim().toLowerCase();
      const quantity = parseFloat(String(row[1] || 0));
      const buyTradeId = String(row[2] || "");
      const buyDate = String(row[3] || "");
      const buyPrice = parseFloat(String(row[4] || 0));
      const fees = parseFloat(String(row[5] || 0));
      const acquisitionCost = parseFloat(String(row[6] || 0));

      if (!symbol || quantity === 0) continue;

      // Parse date - format like "2025-08-30 06:04:53.688793"
      let parsedDate = new Date();
      if (buyDate) {
        const datePart = buyDate.split(" ")[0];
        parsedDate = new Date(datePart);
      }

      holdings.push({
        user_id: user.id,
        market: `${symbol.toUpperCase()}INR`,
        coin: symbol.toUpperCase(),
        trade_type: "BUY",
        price: buyPrice,
        volume: quantity,
        total_inr: acquisitionCost,
        transaction_date: parsedDate.toISOString().split("T")[0],
        fee_amount: fees,
        tds_amount: 0,
        notes: `Imported from CoinSwitch holdings - ${buyTradeId.substring(0, 30)}`,
      });
    }

    if (holdings.length === 0) {
      return NextResponse.json(
        { error: "No valid holdings data found in the file" },
        { status: 400 }
      );
    }

    console.log(`Processing ${holdings.length} crypto holdings...`);

    // Insert holdings as transactions
    const { data, error: insertError } = await supabase
      .from("crypto_transactions")
      .insert(holdings)
      .select();

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${holdings.length} crypto holdings`,
      count: holdings.length,
      data,
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to import file",
      },
      { status: 500 }
    );
  }
}
