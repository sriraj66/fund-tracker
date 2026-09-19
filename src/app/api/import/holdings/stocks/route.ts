import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase/admin";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require("xlsx");

export async function POST(request: NextRequest) {
  try {
    const user = await verifyIdToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // Find header row
    let headerRowIndex = -1;
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i] as unknown[];
      if (row.some((c) => typeof c === "string" && c.toLowerCase().includes("stock name"))) {
        headerRowIndex = i;
        break;
      }
    }
    if (headerRowIndex === -1)
      return NextResponse.json({ error: "Could not find header row with 'Stock Name'" }, { status: 422 });

    const headers = (rawData[headerRowIndex] as unknown[]).map((h) =>
      h ? h.toString().trim().toLowerCase() : ""
    );

    const nameIdx    = headers.findIndex((h) => h.includes("stock name"));
    const symbolIdx  = headers.findIndex((h) => h === "symbol");
    const exchangeIdx= headers.findIndex((h) => h === "exchange");
    const isinIdx    = headers.findIndex((h) => h === "isin");
    const qtyIdx     = headers.findIndex((h) => h.includes("quantity") || h === "qty");
    const avgIdx     = headers.findIndex((h) => h.includes("avg") || h.includes("average"));

    if (nameIdx === -1 || symbolIdx === -1 || qtyIdx === -1 || avgIdx === -1)
      return NextResponse.json(
        { error: "Missing required columns. Expected: Stock Name, Symbol, Quantity, Avg Buy Price" },
        { status: 422 }
      );

    // Parse rows into holding records
    interface HoldingRecord {
      symbol: string;
      stock_name: string;
      quantity: number;
      avg_buy_price: number;
      invested_amount: number;
      exchange: string | null;
      isin: string | null;
      updated_at: string;
    }

    const holdings: HoldingRecord[] = [];
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i] as unknown[];
      if (!row || row.every((c) => c === null || c === "")) continue;

      const stockName = row[nameIdx]?.toString().trim();
      const symbol    = row[symbolIdx]?.toString().trim().toUpperCase();
      const qty       = parseFloat(row[qtyIdx]?.toString().replace(/,/g, "") ?? "");
      const avgPrice  = parseFloat(row[avgIdx]?.toString().replace(/,/g, "") ?? "");

      if (!stockName || !symbol || isNaN(qty) || qty <= 0 || isNaN(avgPrice) || avgPrice <= 0) continue;

      holdings.push({
        symbol,
        stock_name:      stockName,
        quantity:        qty,
        avg_buy_price:   avgPrice,
        invested_amount: qty * avgPrice,
        exchange:        exchangeIdx >= 0 ? (row[exchangeIdx]?.toString().trim() || null) : null,
        isin:            isinIdx    >= 0 ? (row[isinIdx]?.toString().trim()    || null) : null,
        updated_at:      new Date().toISOString(),
      });
    }

    if (holdings.length === 0)
      return NextResponse.json({ error: "No valid holdings found in the file." }, { status: 422 });

    const db = getAdminFirestore();
    const holdingsCol = db.collection("users").doc(user.uid).collection("stock_holdings");

    // Fetch existing holdings to do upsert (match by symbol)
    const symbols = holdings.map((h) => h.symbol);
    const existingMap = new Map<string, string>(); // symbol → docId

    for (let i = 0; i < symbols.length; i += 30) {
      const chunk = symbols.slice(i, i + 30);
      const snap = await holdingsCol.where("symbol", "in", chunk).get();
      snap.docs.forEach((d) => existingMap.set(d.data().symbol as string, d.id));
    }

    // Batch upsert to stock_holdings
    const batch = db.batch();
    for (const h of holdings) {
      const existingId = existingMap.get(h.symbol);
      const ref = existingId ? holdingsCol.doc(existingId) : holdingsCol.doc();
      batch.set(ref, h);
    }
    await batch.commit();

    return NextResponse.json({
      success: true,
      imported: holdings.length,
      message: `Imported ${holdings.length} stock holding${holdings.length !== 1 ? "s" : ""} into your portfolio`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Import failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
