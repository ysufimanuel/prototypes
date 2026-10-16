import { supabaseAdmin } from '../api/_lib/supabase.js';

const { data, error } = await supabaseAdmin
  .from('churches')
  .select('id')
  .limit(1);

if (error) {
  console.error('[SUPABASE TEST] FAILED');
  console.error(error.message);
  process.exit(1);
}

console.log('[SUPABASE TEST] CONNECTED');
console.log('[SUPABASE TEST] churches query OK');
console.log('[SUPABASE TEST] rows:', data?.length ?? 0);