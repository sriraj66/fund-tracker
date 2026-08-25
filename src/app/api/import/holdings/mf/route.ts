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
    const rawData: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    let headerRowIndex = -1;
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i] as string[];
      if (row[0]?.toString().toLowerCase().includes("scheme name")) { headerRowIndex = i; break; }
    }
    if (headerRowIndex === -1) return NextResponse.json({ error: "Invalid holdings statement format." }, { status: 422 });

    let asOfDate = new Date().toISOString().split("T")[0];
    for (let i = 0; i < Math.min(20, rawData.length); i++) {
      const text = (rawData[i] as string[])[0]?.toString() || "";
      const match = text.match(/holdings?\s+as\s+on\s+(\d{4}-\d{2}-\d{2})/i);
      if (match) { asOfDate = match[1]; break; }
    }

    const records = [];
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i] as (string | number)[];
      if (!row || row.length < 7) continue;
      const [schemeName, , , , , , units, investedValue] = row;
      if (!schemeName || !units || typeof units !== "number" || units <= 0) continue;

      const schemeNameStr = schemeName.toString().trim();
      const unitsNum = Number(units);
      const invested = Number(investedValue) || 0;
      records.push({
        scheme_name: schemeNameStr,
        transaction_type: "PURCHASE",
        units: unitsNum,
        nav: invested > 0 && unitsNum > 0 ? invested / unitsNum : 0,
        amount: invested,
        transaction_date: asOfDate,
        notes: `Imported from holdings statement as of ${asOfDate}`,
        created_at: new Date().toISOString(),
      });
    }

    if (records.length === 0) return NextResponse.json({ error: "No holdings found in the statement." }, { status: 422 });

    const db = getAdminFirestore();
    const batch = db.batch();
    const col = db.collection("users").doc(user.uid).collection("mf_transactions");
    records.forEach((rec) => batch.set(col.doc(), rec));
    await batch.commit();

    return NextResponse.json({ success: true, imported: records.length, skipped: 0, message: `Imported ${records.length} MF holdings`, asOfDate });
  } catch (err) {
    return NextResponse.json({ error: `Import failed: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
  }
}
