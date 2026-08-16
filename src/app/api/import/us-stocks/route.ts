import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
// Use the lib entry point to avoid pdf-parse's test-file auto-load bug
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse") as (buf: Buffer, opts?: object) => Promise<{ text: string; numpages: number }>;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    let text: string;
    try {
      const pdf = await pdfParse(buffer);
      text = pdf.text;
      console.log(`✓ PDF parsed successfully: ${pdf.numpages} pages, ${text.length} chars`);
    } catch (pdfErr) {
      console.error("pdf-parse error:", pdfErr);
      const errMsg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
      return NextResponse.json({ 
        error: "Could not read PDF file. Please make sure it is a valid PDF.",
        details: errMsg 
      }, { status: 422 });
    }

    const records = [];
    const skipped: string[] = [];

    // The INDMoney/Alpaca PDF renders as a table where each column is on its own line.
    // Structure per trade (after filtering blank lines):
    //   "MM/DD/YYYY Trade Entry"
    //   "buy" or "sell"
    //   "SYMBOL"
    //   "ID: <uuid> -"
    //   "<quantity>"          e.g. "0.131805157"
    //   "$<price>"            e.g. "$45.37"
    //   "-$<amount>" or "$<amount>"  e.g. "-$5.98"
    //   "$ --"                (commission, ignore)
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    console.log(`Extracted ${lines.length} non-empty lines from PDF`);
    
    // Debug: Log lines that contain "Trade Entry" to see the actual format
    const tradeLines = lines.filter(l => l.includes("Trade Entry"));
    console.log(`Found ${tradeLines.length} lines containing "Trade Entry":`);
    tradeLines.slice(0, 5).forEach((line, i) => console.log(`  [${i}]: ${line.substring(0, 150)}`));
    
    const dateTradeRe = /^(\d{2}\/\d{2}\/\d{4})\s+Trade\s*Entry$/i;
    const sideRe = /^(buy|sell)$/i;
    const symbolRe = /^[A-Z]{1,6}$/;
    const idLineRe = /^ID:/i;
    const qtyRe = /^-?[\d.]+$/;
    const priceRe = /^\$[\d,.]+$/;
    const amountRe = /^-?\$[\d,.]+$/;

    let i = 0;
    while (i < lines.length) {
      const m = dateTradeRe.exec(lines[i]);
      if (m) {
        const dateStr = m[1]; // "07/02/2026"
        const [month, day, year] = dateStr.split("/");
        const txDate = `${year}-${month}-${day}`;

        // Collect up to 10 subsequent lines for parsing
        const chunk = lines.slice(i + 1, i + 10);

        let side = "";
        let symbol = "";
        let qty = 0;
        let price = 0;
        let amount = 0;
        let state = 0; // 0=side, 1=symbol, 2=id, 3=qty, 4=price, 5=amount

        for (const c of chunk) {
          if (state === 0 && sideRe.test(c)) { side = c.toLowerCase(); state = 1; continue; }
          if (state === 1 && symbolRe.test(c)) { symbol = c; state = 2; continue; }
          if (state === 2 && idLineRe.test(c)) { state = 3; continue; }
          if (state === 3 && qtyRe.test(c)) { qty = Math.abs(parseFloat(c)); state = 4; continue; }
          if (state === 4 && priceRe.test(c)) { price = parseFloat(c.replace(/[$,]/g, "")); state = 5; continue; }
          if (state === 5 && amountRe.test(c)) { amount = parseFloat(c.replace(/[$,]/g, "")); break; }
        }

        if (side && symbol && qty > 0) {
          records.push({
            user_id: user.id,
            symbol,
            side: side as "buy" | "sell",
            quantity: qty,
            price: price || null,
            amount: amount || null,
            transaction_date: txDate,
          });
        } else {
          skipped.push(`${dateStr} ${symbol || "?"}`);
        }
        i++;
        continue;
      }
      i++;
    }

    console.log(`Line-by-line parsing found ${records.length} records, ${skipped.length} skipped`);

    // Fallback: Try multiple parsing strategies for table-based PDF layouts
    if (records.length === 0) {
      console.log("Line-by-line parsing found 0 records. Trying fallback strategies...");
      const flat = text.replace(/\n+/g, " ");
      
      // Debug: Show sample of flattened text around first "Trade Entry"
      const tradeIdx = flat.indexOf("Trade Entry");
      if (tradeIdx >= 0) {
        console.log(`Sample text around "Trade Entry": ${flat.substring(Math.max(0, tradeIdx - 50), tradeIdx + 200)}`);
      }
      
      // Strategy 1: Handle zero-space table format (how this PDF actually extracts)
      // Matches: "07/02/2026Trade EntrybuyEWJVID: 6c357fdd-f565-5406-bab9-041264983b60 -0.131805157$45.37-$5.98$ --"
      const re1 = /(\d{2}\/\d{2}\/\d{4})Trade\s*Entry(buy|sell)([A-Z]{2,6})ID:\s*[\w-]+\s*-\s*(-?\d+\.?\d*)\$(\d+\.?\d*)-?\$(\d+\.?\d*)/gi;
      let match;
      while ((match = re1.exec(flat)) !== null) {
        const [, dateStr, side, symbol, qtyStr, priceStr, amtStr] = match;
        const [mon, day, yr] = dateStr.split("/");
        const qty = Math.abs(parseFloat(qtyStr));
        const price = parseFloat(priceStr);
        const amount = parseFloat(amtStr);
        
        if (qty > 0 && price > 0) {
          records.push({
            user_id: user.id,
            symbol,
            side: side.toLowerCase() as "buy" | "sell",
            quantity: qty,
            price,
            amount,
            transaction_date: `${yr}-${mon}-${day}`,
          });
        }
      }
      console.log(`Fallback strategy 1 found ${records.length} records`);
      
      // Strategy 2: More lenient pattern with optional spaces
      if (records.length === 0) {
        const re2 = /(\d{2}\/\d{2}\/\d{4})\s*Trade\s*Entry\s*(buy|sell)\s*([A-Z]+)\s*ID:\s*[\w-]+\s*-\s*(-?\d+\.?\d*)\s*\$(\d+\.?\d*)\s*-?\$(\d+\.?\d*)/gi;
        while ((match = re2.exec(flat)) !== null) {
          try {
            const [, dateStr, side, symbol, qtyStr, priceStr, amtStr] = match;
            const [mon, day, yr] = dateStr.split("/");
            const qty = Math.abs(parseFloat(qtyStr));
            const price = parseFloat(priceStr);
            const amount = parseFloat(amtStr);
            
            if (qty > 0 && price > 0) {
              records.push({
                user_id: user.id,
                symbol,
                side: side.toLowerCase() as "buy" | "sell",
                quantity: qty,
                price,
                amount,
                transaction_date: `${yr}-${mon}-${day}`,
              });
            }
          } catch (e) {
            console.log(`Skipped match due to parse error:`, e);
          }
        }
        console.log(`Fallback strategy 2 found ${records.length} records`);
      }
    }

    if (records.length === 0) {
      // Return more detailed debug info to help troubleshoot
      const sampleLines = lines.slice(0, 30).join(" | ");
      return NextResponse.json({
        error: "No trade entries found in PDF. Ensure this is the INDMoney/Alpaca monthly statement.",
        debug: {
          totalLines: lines.length,
          sampleText: sampleLines,
          lookingFor: "Pattern: 'MM/DD/YYYY Trade Entry' followed by buy/sell, symbol, ID, quantity, price, amount"
        }
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
      message: `Imported ${records.length} US stock trades${skipped.length > 0 ? `, ${skipped.length} skipped` : ""}`,
    });
  } catch (err) {
    console.error("US stocks import error:", err);
    return NextResponse.json({
      error: `Import failed: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 500 });
  }
}
