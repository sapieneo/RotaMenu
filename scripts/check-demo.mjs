import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: venue, error } = await admin.from('venues').select('id, org_id, slug, name').eq('slug', 'demo').maybeSingle();
console.log('venue', venue, error?.message);
if (venue) {
  const { data: menus } = await admin.from('menus').select('id, name, venue_id').eq('venue_id', venue.id);
  console.log('menus', menus);
  for (const menu of menus ?? []) {
    const { data: cats } = await admin.from('categories').select('id, name, background_url, menu_id').eq('menu_id', menu.id);
    console.log('categories for', menu.name, cats);
    for (const cat of cats ?? []) {
      const { data: items } = await admin.from('items').select('id, name, image_url, category_id').eq('category_id', cat.id);
      console.log('  items for', cat.name, items?.map(i => ({name: i.name, hasImg: !!i.image_url})));
    }
  }
}
