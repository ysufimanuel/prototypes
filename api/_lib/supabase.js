const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("SUPABASE_URL is not configured");
}

if (!supabaseServiceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
}

/**
 * Server-only Supabase client.
 *
 * IMPORTANT:
 * - Never import this file from browser/frontend code.
 * - Never expose SUPABASE_SERVICE_ROLE_KEY to the client.
 * - RLS is bypassed by the service-role key, so authorization must happen
 *   in the API layer before privileged queries are executed.
 */
const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

module.exports = { supabaseAdmin };