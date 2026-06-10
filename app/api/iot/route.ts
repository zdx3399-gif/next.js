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
    // 1. Extract both the command AND the device ID from the frontend
    const { cmd, deviceId } = await request.json();
    const normalizedCmd = String(cmd || "").trim().toUpperCase();

    if (!VALID_COMMANDS.has(normalizedCmd)) {
      return NextResponse.json(
        { success: false, error: "無效指令，只允許 V/P/E/C" },
        { status: 400 },
      );
    }

    // 2. Ensure a deviceId was provided, default to 1 if not for safety
    const targetId = deviceId ? parseInt(deviceId) : 1;

    // 3. Update only the specific row matching the targetId
    const { error } = await supabase
      .from('iot_commands')
      .update({ current_command: normalizedCmd })
      .eq('id', targetId); // <--- DYNAMIC ID HERE

    if (error) {
      throw error;
    }

    return NextResponse.json({ 
      success: true, 
      cmd: normalizedCmd, 
      device: `Device ${targetId} updated` 
    });
    
  } catch (error: any) {
    console.error("Mailbox Command Error:", error.message || error);
    return NextResponse.json(
      { success: false, error: 'Failed to send command' }, 
      { status: 500 }
    );
  }
}