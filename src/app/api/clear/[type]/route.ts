import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteParams = {
  params: Promise<{ type: string }>;
};

export async function DELETE(request: NextRequest, props: RouteParams) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = await props.params;
    const { type } = params;

    // Map type to table name
    const tableMap: Record<string, string> = {
      mf: "mf_transactions",
      stocks: "stock_transactions",
      "us-stocks": "us_stock_transactions",
      crypto: "crypto_transactions",
      gold: "gold_transactions",
      snapshots: "portfolio_snapshots",
    };

    const tableName = tableMap[type];

    if (!tableName) {
      return NextResponse.json(
        { error: "Invalid data type" },
        { status: 400 }
      );
    }

    // Delete all records for this user in the specified table
    const { error, count } = await supabase
      .from(tableName)
      .delete({ count: "exact" })
      .eq("user_id", user.id);

    if (error) {
      console.error(`Error clearing ${type}:`, error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${count ?? 0} records from ${type}`,
      count: count ?? 0,
    });
  } catch (error) {
    console.error("Clear data error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to clear data",
      },
      { status: 500 }
    );
  }
}
