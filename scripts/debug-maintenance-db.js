const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

function loadEnv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const env = {};
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^"|"$/g, '');
    env[key] = val;
  }
  return env;
}

(async () => {
  try {
    const env = loadEnv('.env.local');
    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

    const maintenance = await supabase
      .from('maintenance')
      .select('id, reported_by_id, unit_id, admin_note, completed_at')
      .limit(1);

    console.log('[maintenance columns] error:', maintenance.error ? maintenance.error.message : null);

    const profiles = await supabase
      .from('profiles')
      .select('id, name, line_user_id, unit_id')
      .not('line_user_id', 'is', null)
      .limit(100);

    console.log('[profiles with line] error:', profiles.error ? profiles.error.message : null);
    console.log('[profiles with line] count:', profiles.data ? profiles.data.length : 0);

    const lineProfiles = profiles.data || [];
    const unitIds = [...new Set(lineProfiles.map((p) => p.unit_id).filter(Boolean))];
    let validUnitSet = new Set();

    if (unitIds.length > 0) {
      const units = await supabase.from('units').select('id').in('id', unitIds);
      console.log('[units query] error:', units.error ? units.error.message : null);
      validUnitSet = new Set((units.data || []).map((u) => u.id));
    }

    const broken = lineProfiles.filter((p) => p.unit_id && !validUnitSet.has(p.unit_id));
    console.log('[broken profile.unit_id] count:', broken.length);
    if (broken.length > 0) {
      console.log('[broken sample]', broken.slice(0, 5));
    }

    const insertProbe = await supabase
      .from('maintenance')
      .insert([
        {
          equipment: '測試地點',
          item: '一般報修',
          status: 'open',
          time: new Date().toISOString(),
          description: 'debug probe',
          image_url: null,
          reported_by_id: null,
          created_by: null,
          unit_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select('id')
      .maybeSingle();

    console.log('[insert probe] error:', insertProbe.error ? insertProbe.error.message : null);
    if (insertProbe.data?.id) {
      await supabase.from('maintenance').delete().eq('id', insertProbe.data.id);
      console.log('[insert probe] cleanup: deleted', insertProbe.data.id);
    }
  } catch (err) {
    console.error('[script fatal]', err);
    process.exitCode = 1;
  }
})();
