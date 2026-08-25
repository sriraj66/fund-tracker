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
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("transaction")) ?? wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    let headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      if (row.some((cell) => typeof cell === "string" && cell.toString().toLowerCase().includes("scheme name"))) {
        headerIdx = i; break;
      }
    }
    if (headerIdx === -1) return NextResponse.json({ error: "Could not find header row with 'Scheme Name'" }, { status: 422 });

    const headers = (rows[headerIdx] as unknown[]).map((h) => (h ? h.toString().trim().toLowerCase() : ""));
    const schemeIdx = headers.findIndex((h) => h.includes("scheme"));
    const typeIdx = headers.findIndex((h) => h.includes("transaction type") || h.includes("type"));
    const unitsIdx = headers.findIndex((h) => h.includes("unit"));
    const navIdx = headers.findIndex((h) => h.includes("nav"));
    const amountIdx = headers.findIndex((h) => h.includes("amount"));
    const dateIdx = headers.findIndex((h) => h.includes("date"));

    const records = [];
    const skipped = [];

    for (let i = headerIdx + 1; i < rows.length; i++) {
      const row = rows[i] as unknown[];
      if (!row || row.every((cell) => cell === null || cell === "")) continue;

      const schemeName = row[schemeIdx]?.toString().trim();
      const txType = row[typeIdx]?.toString().trim().toUpperCase();
      const amountRaw = row[amountIdx]?.toString().replace(/,/g, "").trim();
      const dateRaw = row[dateIdx]?.toString().trim();

      if (!schemeName || !txType || !amountRaw || !dateRaw) { skipped.push(i + 1); continue; }

      let txDate: string;
      if (!isNaN(Date.parse(dateRaw))) {
        txDate = new Date(dateRaw).toISOString().split("T")[0];
      } else {
        const parsed = XLSX.SSF.parse_date_code(Number(dateRaw));
        txDate = parsed
          ? `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`
          : dateRaw;
      }

      const amount = parseFloat(amountRaw);
      if (isNaN(amount)) { skipped.push(i + 1); continue; }

      records.push({
        scheme_name: schemeName,
        transaction_type: (txType === "REDEMPTION" || txType === "REDEEM") ? "REDEMPTION" : txType === "SIP" ? "SIP" : "PURCHASE",
        units: unitsIdx >= 0 && row[unitsIdx] ? parseFloat(row[unitsIdx]!.toString().replace(/,/g, "")) : null,
        nav: navIdx >= 0 && row[navIdx] ? parseFloat(row[navIdx]!.toString().replace(/,/g, "")) : null,
        amount,
        transaction_date: txDate,
        created_at: new Date().toISOString(),
      });
    }

    if (records.length === 0) return NextResponse.json({ error: "No valid transactions found in file", skipped }, { status: 422 });

    const db = getAdminFirestore();
    const batch = db.batch();
    const col = db.collection("users").doc(user.uid).collection("mf_transactions");
    records.forEach((rec) => batch.set(col.doc(), rec));
    await batch.commit();

    return NextResponse.json({
      success: true, imported: records.length, skipped: skipped.length,
      message: `Imported ${records.length} transactions${skipped.length > 0 ? `, skipped ${skipped.length} rows` : ""}`,
    });
  } catch (err) {
    console.error("MF import error:", err);
    return NextResponse.json({ error: "Failed to parse file. Make sure it is the INDMoney MF order history XLSX." }, { status: 500 });
  }
}