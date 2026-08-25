import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase/admin";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse") as (buf: Buffer, opts?: object) => Promise<{ text: string; numpages: number }>;

export async function POST(request: NextRequest) {
  try {
    const user = await verifyIdToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    let text: string;
    try {
      const pdf = await pdfParse(buffer);
      text = pdf.text;
    } catch (pdfErr) {
      return NextResponse.json({ error: "Could not read PDF file.", details: String(pdfErr) }, { status: 422 });
    }

    const records = [];
    const skipped: string[] = [];
    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

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
        const [month, day, year] = m[1].split("/");
        const txDate = `${year}-${month}-${day}`;
        const chunk = lines.slice(i + 1, i + 10);
        let side = "", symbol = "", qty = 0, price = 0, amount = 0, state = 0;

        for (const c of chunk) {
          if (state === 0 && sideRe.test(c)) { side = c.toLowerCase(); state = 1; continue; }
          if (state === 1 && symbolRe.test(c)) { symbol = c; state = 2; continue; }
          if (state === 2 && idLineRe.test(c)) { state = 3; continue; }
          if (state === 3 && qtyRe.test(c)) { qty = Math.abs(parseFloat(c)); state = 4; continue; }
          if (state === 4 && priceRe.test(c)) { price = parseFloat(c.replace(/[$,]/g, "")); state = 5; continue; }
          if (state === 5 && amountRe.test(c)) { amount = parseFloat(c.replace(/[$,]/g, "")); break; }
        }

        if (side && symbol && qty > 0) {
          records.push({ symbol, side: side as "buy" | "sell", quantity: qty, price: price || null, amount: amount || null, transaction_date: txDate, created_at: new Date().toISOString() });
        } else {
          skipped.push(`${m[1]} ${symbol || "?"}`);
        }
        i++; continue;
      }
      i++;
    }

    // Fallback regex strategies
    if (records.length === 0) {
      const flat = text.replace(/\n+/g, " ");
      const re1 = /(\d{2}\/\d{2}\/\d{4})Trade\s*Entry(buy|sell)([A-Z]{2,6})ID:\s*[\w-]+\s*-\s*(-?\d+\.?\d*)\$(\d+\.?\d*)-?\$(\d+\.?\d*)/gi;
      let match;
      while ((match = re1.exec(flat)) !== null) {
        const [, dateStr, side, symbol, qtyStr, priceStr, amtStr] = match;
        const [mon, day, yr] = dateStr.split("/");
        const qty = Math.abs(parseFloat(qtyStr));
        if (qty > 0) records.push({ symbol, side: side.toLowerCase() as "buy" | "sell", quantity: qty, price: parseFloat(priceStr), amount: parseFloat(amtStr), transaction_date: `${yr}-${mon}-${day}`, created_at: new Date().toISOString() });
      }
    }

    if (records.length === 0) {
      return NextResponse.json({ error: "No trade entries found in PDF.", debug: { totalLines: lines.length, sampleText: lines.slice(0, 30).join(" | ") } }, { status: 422 });
    }

    const db = getAdminFirestore();
    const batch = db.batch();
    const col = db.collection("users").doc(user.uid).collection("us_stock_transactions");
    records.forEach((rec) => batch.set(col.doc(), rec));
    await batch.commit();

    return NextResponse.json({ success: true, imported: records.length, skipped: skipped.length, message: `Imported ${records.length} US stock trades${skipped.length > 0 ? `, ${skipped.length} skipped` : ""}` });
  } catch (err) {
    return NextResponse.json({ error: `Import failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}