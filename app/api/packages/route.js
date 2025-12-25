import { createClient } from '@supabase/supabase-js';
import { Client } from '@line/bot-sdk';

export const runtime = 'nodejs';

// --- LINE Bot ---
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};
const client = new Client(lineConfig);

// --- Supabase ---
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// 1. ADDING A NEW PACKAGE (POST)
export async function POST(req) {
  try {
    const body = await req.json();
    const { courier, recipient_name, recipient_room, tracking_number, arrived_at, test } = body;

    // Validation
    if (!courier || !recipient_name || !recipient_room || !arrived_at) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (test === true) return Response.json({ message: 'Test success' });

    // Find the Unit ID
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('id')
      .or(`unit_code.eq.${recipient_room},unit_number.eq.${recipient_room}`)
      .single();

    if (unitError || !unit) {
      return Response.json({ error: 'Room not found in database' }, { status: 404 });
    }

    // FIXED: Now saving recipient_name and recipient_room to the packages table
    const { data: insertedPackage, error: insertError } = await supabase
      .from('packages')
      .insert({
        courier,
        recipient_name,  // <-- Added
        recipient_room,  // <-- Added
        tracking_number: tracking_number || null,
        arrived_at,
        unit_id: unit.id,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    // Find LINE User ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('line_user_id')
      .eq('unit_id', unit.id)
      .single();

    // Send LINE Notification
    if (profile?.line_user_id) {
      const time = new Date(arrived_at).toLocaleString('zh-TW', { hour12: false });
      const flexMessage = {
        type: 'flex',
        altText: '📦 Package Notification',
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: '📦 Package Notification', weight: 'bold', size: 'lg' },
              { type: 'separator', margin: 'md' },
              { type: 'text', text: `Recipient: ${recipient_name}`, margin: 'md' },
              { type: 'text', text: `Room: ${recipient_room}`, margin: 'sm' },
              { type: 'text', text: `Courier: ${courier}`, margin: 'sm' },
              { type: 'text', text: `Time: ${time}`, margin: 'sm' }
            ]
          }
        }
      };
      await client.pushMessage(profile.line_user_id, flexMessage);
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// 2. MARKING AS PICKED UP (PATCH)
export async function PATCH(req) {
  try {
    const body = await req.json();
    const { packageId, picked_up_by } = body;

    if (!packageId || !picked_up_by) {
      return Response.json({ error: 'Package ID and Picker Name required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('packages')
      .update({
        status: 'picked_up',
        picked_up_by: picked_up_by,
        picked_up_at: new Date().toISOString()
      })
      .eq('id', packageId);

    if (error) throw error;
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ error: 'Method Not Allowed' }, { status: 405 });
}