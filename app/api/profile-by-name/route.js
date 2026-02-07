import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }
  return createClient(url, anonKey);
}

export async function POST(req) {
  const supabase = getSupabase();
  const { name } = await req.json();
  if (!name) {
    return new Response('No name provided', { status: 400 });
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id, unit_id')
    .eq('name', name)
    .single();
  if (error || !data) {
    return new Response('Profile not found', { status: 404 });
  }
  return new Response(JSON.stringify(data), { status: 200 });
}
