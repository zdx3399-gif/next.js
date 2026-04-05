import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase";

export async function POST(req: Request) {
  const body = await req.json();
  const { eventType, message, time } = body;

  const { error } = await supabaseServer
    .from("events")
    .insert({
      event_type: eventType,
      message: message,
      time_created: time
    });

  if (error) return NextResponse.json({ error });

  return NextResponse.json({ status: "ok" });
}
