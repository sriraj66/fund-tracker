import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete all data for this user across all tables
    const tables = [
      "mf_transactions",
      "stock_transactions",
      "us_stock_transactions",
      "crypto_transactions",
      "gold_transactions",
      "portfolio_snapshots",
      "user_settings",
    ];

    let totalDeleted = 0;
    const errors: string[] = [];

    for (const table of tables) {
      try {
        const { error, count } = await supabase
          .from(table)
          .delete({ count: "exact" })
          .eq("user_id", user.id);

        if (error) {
          errors.push(`${table}: ${error.message}`);
          console.error(`Error clearing ${table}:`, error);
        } else {
          totalDeleted += count ?? 0;
        }
      } catch (err) {
        errors.push(
          `${table}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Partially cleared data. Deleted ${totalDeleted} records.`,
          errors,
          count: totalDeleted,
        },
        { status: 207 } // Multi-Status
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted all data (${totalDeleted} records)`,
      count: totalDeleted,
    });
  } catch (error) {
    console.error("Clear all data error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to clear all data",
      },
      { status: 500 }
    );
  }
}
