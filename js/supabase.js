/* ===== AFRORAMA — SUPABASE CLIENT =====
 *
 * Setup:
 *  1. Create a free project at https://supabase.com
 *  2. Go to Project Settings → API
 *  3. Replace the two values below with your own
 *  4. Run the SQL schema below in the Supabase SQL Editor
 *
 * SQL SCHEMA (run once in Supabase → SQL Editor):
 * ─────────────────────────────────────────────────
 *
 * -- Enable UUID extension
 * CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
 *
 * -- PROFILES
 * CREATE TABLE profiles (
 *   id                   UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
 *   full_name            TEXT,
 *   linkedin_url         TEXT,
 *   location             TEXT,
 *   is_actively_looking  BOOLEAN DEFAULT false,
 *   job_type_prefs       TEXT[]  DEFAULT '{}',
 *   sector_prefs         TEXT[]  DEFAULT '{}',
 *   email_alerts         BOOLEAN DEFAULT true,
 *   cv_score             INTEGER,
 *   cv_score_history     JSONB   DEFAULT '[]',
 *   is_member            BOOLEAN DEFAULT false,
 *   member_since         TIMESTAMPTZ,
 *   is_moderator         BOOLEAN DEFAULT false,
 *   created_at           TIMESTAMPTZ DEFAULT NOW()
 * );
 * ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Profiles are publicly readable" ON profiles FOR SELECT USING (true);
 * CREATE POLICY "Users manage own profile"       ON profiles FOR ALL   USING (auth.uid() = id);
 *
 * -- COMMUNITY POSTS
 * CREATE TABLE community_posts (
 *   id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
 *   user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
 *   content      TEXT NOT NULL,
 *   upvotes      INTEGER DEFAULT 0,
 *   tab          TEXT DEFAULT 'general',
 *   created_at   TIMESTAMPTZ DEFAULT NOW()
 * );
 * ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Anyone reads posts"  ON community_posts FOR SELECT USING (true);
 * CREATE POLICY "Auth users post"     ON community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
 * CREATE POLICY "Author deletes post" ON community_posts FOR DELETE USING (auth.uid() = user_id);
 *
 * -- COMMUNITY COMMENTS
 * CREATE TABLE community_comments (
 *   id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
 *   post_id      UUID REFERENCES community_posts(id) ON DELETE CASCADE,
 *   user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
 *   content      TEXT NOT NULL,
 *   created_at   TIMESTAMPTZ DEFAULT NOW()
 * );
 * ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Anyone reads comments" ON community_comments FOR SELECT USING (true);
 * CREATE POLICY "Auth users comment"    ON community_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
 *
 * -- POST UPVOTES (prevent double-voting)
 * CREATE TABLE post_upvotes (
 *   post_id  UUID REFERENCES community_posts(id) ON DELETE CASCADE,
 *   user_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
 *   PRIMARY KEY (post_id, user_id)
 * );
 * ALTER TABLE post_upvotes ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Upvote visibility" ON post_upvotes FOR SELECT USING (true);
 * CREATE POLICY "Auth users upvote" ON post_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);
 * CREATE POLICY "Auth users remove upvote" ON post_upvotes FOR DELETE USING (auth.uid() = user_id);
 *
 * -- Enable realtime on community tables (optional)
 * ALTER PUBLICATION supabase_realtime ADD TABLE community_posts;
 * ALTER PUBLICATION supabase_realtime ADD TABLE community_comments;
 * ─────────────────────────────────────────────────
 */

const SUPABASE_URL      = 'https://vqchwioyhyiuunpyildz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_HeGZfQZEDI_IR46a2Ezp-Q_tIUdhF6_';

// Initialise client (Supabase JS v2 loaded via CDN in each HTML page)
let _supabase = null;

function getSupabase() {
  if (!_supabase) {
    if (typeof supabase === 'undefined') {
      console.warn('[Afrorama] Supabase JS not loaded. Add the CDN script before supabase.js.');
      return null;
    }
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return _supabase;
}

// Demo mode: if keys are still placeholders, use localStorage simulation
function isDemoMode() {
  return SUPABASE_URL === 'YOUR_SUPABASE_URL';
}

window.AfroramaSupabase = { getSupabase, isDemoMode };
