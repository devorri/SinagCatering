const fs = require('fs');
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let v = (m[2] || '').trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1);
    env[m[1]] = v.trim();
  }
});
const { createClient } = require('@supabase/supabase-js');
const s = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
(async () => {
  const { data: pkgs, error: e1 } = await s.from('packages').select('*');
  console.log('PACKAGES in DB count:', pkgs?.length, 'error:', e1);
  console.log('PACKAGES in DB:', JSON.stringify(pkgs, null, 2));
  const { data: menu, error: e2 } = await s.from('menu_items').select('*');
  console.log('MENU ITEMS in DB count:', menu?.length, 'error:', e2);
  console.log(menu?.map(m => ({ id: m.id, name: m.name, cat: m.category, active: m.active })));
  const { data: addons, error: e3 } = await s.from('package_addons').select('*');
  console.log('ADDONS in DB:', addons, 'error:', e3);
})();
