import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 1. Initialize Supabase Client
// Ensure these two variables are in your Next.js .env or .env.local file!
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const VALID_COMMANDS = new Set(["V", "P", "E", "C"]);

// 2. Handle GET: Your frontend calls this when clicking "Wi-Fi" mode to check connection
export async function GET() {
  // We just return success since the "connection" is now just checking the database
  return NextResponse.json({ success: true, message: "Cloud mailbox ready!" });
}

// 3. Handle POST: Your frontend calls this when a button (like "Visitor") is clicked
export async function POST(request: Request) {
  try {
    const { cmd } = await request.json();
    const normalizedCmd = String(cmd || "").trim().toUpperCase();

    if (!VALID_COMMANDS.has(normalizedCmd)) {
      return NextResponse.json(
        { success: false, error: "無效指令，只允許 V/P/E/C" },
        { status: 400 },
      );
    }

    // Update Row #1 in our Supabase mailbox table with the new command
    const { error } = await supabase
      .from('iot_commands')
      .update({ current_command: normalizedCmd })
      .eq('id', 1);

    if (error) {
      console.error("Supabase Error:", error);
      throw error;
    }

    // Return the exact format your ArduinoConsole.tsx expects
    return NextResponse.json({ success: true, cmd: normalizedCmd, device: "Mailbox updated" });
    
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, error: 'Failed to send command to mailbox' }, 
      { status: 500 }
    );
  }
}