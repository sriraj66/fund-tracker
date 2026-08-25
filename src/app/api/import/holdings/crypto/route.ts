import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase/admin";
import * as XLSX from "xlsx";

export async function POST(request: NextRequest) {
  try {
    const user = await verifyIdToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const balancesSheet = workbook.Sheets["Balances VDA"];
    if (!balancesSheet) return NextResponse.json({ error: "Could not find 'Balances VDA' sheet" }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawData = XLSX.utils.sheet_to_json(balancesSheet, { header: 1, defval: "" }) as any[][];

    let dataStartRow = 0;
    for (let i = 0; i < rawData.length; i++) {
      if (rawData[i][0] === "Symbol" || rawData[i][0] === "1") { dataStartRow = i + 1; break; }
    }

    const holdings = [];
    for (let i = dataStartRow; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row[0] || row[0] === "" || row[0] === "1") continue;
      const symbol = String(row[0]).trim().toLowerCase();
      const quantity = parseFloat(String(row[1] || 0));
      if (!symbol || quantity === 0) continue;

      const buyDate = String(row[3] || "");
      let parsedDate = new Date();
      if (buyDate) { const datePart = buyDate.split(" ")[0]; parsedDate = new Date(datePart); }

      holdings.push({
        market: `${symbol.toUpperCase()}INR`,
        coin: symbol.toUpperCase(),
        trade_type: "BUY",
        price: parseFloat(String(row[4] || 0)),
        volume: quantity,
        total_inr: parseFloat(String(row[6] || 0)),
        transaction_date: parsedDate.toISOString().split("T")[0],
        fee_amount: parseFloat(String(row[5] || 0)),
        tds_amount: 0,
        notes: `Imported from CoinSwitch holdings - ${String(row[2] || "").substring(0, 30)}`,
        created_at: new Date().toISOString(),
      });
    }

    if (holdings.length === 0) return NextResponse.json({ error: "No valid holdings data found." }, { status: 400 });

    const db = getAdminFirestore();
    const batch = db.batch();
    const col = db.collection("users").doc(user.uid).collection("crypto_transactions");
    holdings.forEach((rec) => batch.set(col.doc(), rec));
    await batch.commit();

    return NextResponse.json({ success: true, message: `Successfully imported ${holdings.length} crypto holdings`, count: holdings.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to import file" }, { status: 500 });
  }
}