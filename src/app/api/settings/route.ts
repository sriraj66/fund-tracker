import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("user_settings")
      .select("usd_to_inr_rate")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If no settings found, create default
    if (!data) {
      const { data: newSettings } = await supabase
        .from("user_settings")
        .insert({ user_id: user.id, usd_to_inr_rate: 83.50 })
        .select("usd_to_inr_rate")
        .single();
      
      return NextResponse.json({ usd_to_inr_rate: newSettings?.usd_to_inr_rate || 83.50 });
    }

    return NextResponse.json({ usd_to_inr_rate: data.usd_to_inr_rate });
  } catch (err) {
    console.error("Get settings error:", err);
    return NextResponse.json({
      error: `Failed: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { usd_to_inr_rate } = body;

    if (!usd_to_inr_rate || usd_to_inr_rate <= 0) {
      return NextResponse.json({ error: "Invalid exchange rate" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_settings")
      .upsert({
        user_id: user.id,
        usd_to_inr_rate: parseFloat(usd_to_inr_rate),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, usd_to_inr_rate: parseFloat(usd_to_inr_rate) });
  } catch (err) {
    console.error("Update settings error:", err);
    return NextResponse.json({
      error: `Failed: ${err instanceof Error ? err.message : String(err)}`,
    }, { status: 500 });
  }
}
