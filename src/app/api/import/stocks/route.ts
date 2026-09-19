import { NextRequest, NextResponse } from "next/server";
import { verifyIdToken, getAdminFirestore } from "@/lib/firebase/admin";
import * as XLSX from "xlsx";

/**
 * POST /api/import/stocks
 *
 * Accepts a broker Holdings Statement XLSX (Zerodha / Groww format).
 * Reads the summary block at the top (Invested Value, Closing Value,
 * Unrealised P&L) and stores one document per month in
 * `stock_monthly_entries`. Existing entry for the same month is
 * overwritten (safe to re-import).
 *
 * Required form fields:
 *   file          – the .xlsx file
 *   import_month  – "YYYY-MM" (the month this statement represents)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await verifyIdToken(request.headers.get("authorization"));
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData   = await request.formData();
    const file       = formData.get("file")         as File   | null;
    const importMonth = formData.get("import_month") as string | null; // "YYYY-MM"

    if (!file)        return NextResponse.json({ error: "No file provided"   }, { status: 400 });
    if (!importMonth || !/^\d{4}-\d{2}$/.test(importMonth))
      return NextResponse.json({ error: "import_month (YYYY-MM) is required" }, { status: 400 });

    // ── Parse XLSX ───────────────────────────────────────────────────────────
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb     = XLSX.read(buffer, { type: "buffer" });
    const ws     = wb.Sheets[wb.SheetNames[0]];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

    // ── Extract summary values ───────────────────────────────────────────────
    // The broker statement has a summary block like:
    //   Row N:   ["Invested Value",  272120.48, ...]
    //   Row N+1: ["Closing Value",   270594.44, ...]
    //   Row N+2: ["Unrealised P&L",  -1526.04,  ...]
    //
    // We scan all rows for these labels (case-insensitive).

    const toNum = (raw: unknown): number => {
      if (typeof raw === "number") return raw;
      const s = (raw ?? "").toString().replace(/,/g, "").trim();
      const n = parseFloat(s);
      return isNaN(n) ? 0 : n;
    };

    let invested     = 0;
    let currentValue = 0;
    let pnl          = 0;
    let foundInvested = false, foundCurrent = false, foundPnl = false;

    // Also try to read the statement date from the heading row, e.g.
    // "Holdings statement for stocks as on 18-09-2026"
    let statementDateStr = "";

    for (const row of rows) {
      const r = row as unknown[];
      if (!r || r.every((c) => c === null || c === "")) continue;

      const label = r[0]?.toString().trim().toLowerCase() ?? "";

      if (!statementDateStr && label.includes("as on")) {
        const m = label.match(/as on\s+(\d{2}-\d{2}-\d{4})/);
        if (m) statementDateStr = m[1]; // "18-09-2026"
      }

      if (!foundInvested && (label.includes("invested value") || label === "invested value")) {
        invested    = toNum(r[1]);
        foundInvested = true;
      }
      if (!foundCurrent && (label.includes("closing value") || label === "closing value")) {
        currentValue = toNum(r[1]);
        foundCurrent  = true;
      }
      if (!foundPnl && (label.includes("unrealised") || label.includes("unrealized") || label.includes("p&l"))) {
        pnl    = toNum(r[1]);
        foundPnl = true;
      }

      if (foundInvested && foundCurrent && foundPnl) break;
    }

    if (!foundInvested || invested === 0) {
      return NextResponse.json(
        { error: "Could not find 'Invested Value' in the file. Make sure you're uploading a Holdings Statement (not an Order History)." },
        { status: 422 }
      );
    }

    // Derive closing value from pnl if only two were found
    if (!foundCurrent && foundPnl)   currentValue = invested + pnl;
    if (!foundPnl    && foundCurrent) pnl          = currentValue - invested;

    const pnlPct = invested > 0 ? ((currentValue - invested) / invested) * 100 : 0;

    // ── Build month label ────────────────────────────────────────────────────
    const [yyyy, mm] = importMonth.split("-");
    const monthLabel = new Date(Number(yyyy), Number(mm) - 1, 1).toLocaleDateString("en-IN", {
      month: "short",
      year:  "numeric",
    });

    // ── Upsert to Firestore ──────────────────────────────────────────────────
    const adminDb = getAdminFirestore();
    const colRef  = adminDb.collection("users").doc(user.uid).collection("stock_monthly_entries");

    // Check for existing doc with this month key
    const existing = await colRef.where("month", "==", importMonth).limit(1).get();

    const data = {
      month:          importMonth,
      month_label:    monthLabel,
      invested:       Math.round(invested     * 100) / 100,
      current_value:  Math.round(currentValue * 100) / 100,
      pnl:            Math.round(pnl          * 100) / 100,
      pnl_pct:        Math.round(pnlPct       * 100) / 100,
      statement_date: statementDateStr || null,
      updated_at:     new Date().toISOString(),
    };

    if (!existing.empty) {
      await existing.docs[0].ref.set(data, { merge: true });
    } else {
      await colRef.add({ ...data, created_at: new Date().toISOString() });
    }

    return NextResponse.json({
      success:      true,
      month:        importMonth,
      month_label:  monthLabel,
      invested:     data.invested,
      current_value: data.current_value,
      pnl:          data.pnl,
      pnl_pct:      data.pnl_pct,
      message:      `Holdings for ${monthLabel} imported — Invested ₹${data.invested.toLocaleString("en-IN")}, Current ₹${data.current_value.toLocaleString("en-IN")}, P&L ₹${data.pnl.toLocaleString("en-IN")}`,
    });
  } catch (err) {
    console.error("Stocks holdings import error:", err);
    return NextResponse.json(
      { error: "Failed to parse file. Make sure you're uploading a Holdings Statement XLSX from your broker." },
      { status: 500 }
    );
  }
}
