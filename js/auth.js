/* ===== AFRORAMA AUTH HELPERS =====
 * Wraps Supabase auth with a localStorage demo fallback.
 * When SUPABASE_URL is configured, real auth is used.
 * In demo mode, auth state is stored in localStorage.
 */

(function () {
  const { getSupabase, isDemoMode } = window.AfroramaSupabase;

  /* ── DEMO SESSION (used until real Supabase keys are set) ─────── */
  const DEMO_KEY = 'afrorama_demo_user';

  function getDemoUser() {
    try { return JSON.parse(localStorage.getItem(DEMO_KEY)); } catch { return null; }
  }
  function setDemoUser(user) {
    localStorage.setItem(DEMO_KEY, JSON.stringify(user));
  }
  function clearDemoUser() {
    localStorage.removeItem(DEMO_KEY);
  }

  /* ── AUTH FUNCTIONS ───────────────────────────────────────────── */

  async function signUp({ email, password, fullName }) {
    if (isDemoMode()) {
      const user = { id: 'demo-' + Date.now(), email, full_name: fullName, demo: true };
      setDemoUser(user);
      return { user, error: null };
    }
    const sb = getSupabase();
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } },
    });
    if (!error && data.user) {
      await sb.from('profiles').upsert({ id: data.user.id, full_name: fullName });
    }
    return { user: data?.user, error };
  }

  async function signIn({ email, password }) {
    if (isDemoMode()) {
      const user = { id: 'demo-1', email, full_name: 'Demo User', demo: true };
      setDemoUser(user);
      return { user, error: null };
    }
    const sb = getSupabase();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    return { user: data?.user, error };
  }

  async function signInWithGoogle() {
    if (isDemoMode()) {
      const user = { id: 'demo-g', email: 'demo@google.com', full_name: 'Google User', demo: true };
      setDemoUser(user);
      return { error: null };
    }
    const sb       = getSupabase();
    const afterUrl = localStorage.getItem('auth_next') || '/profile.html';
    localStorage.removeItem('auth_next');
    return sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + afterUrl },
    });
  }

  async function signInWithLinkedIn() {
    if (isDemoMode()) {
      const user = { id: 'demo-li', email: 'demo@linkedin.com', full_name: 'LinkedIn User', demo: true };
      setDemoUser(user);
      return { error: null };
    }
    const sb       = getSupabase();
    const afterUrl = localStorage.getItem('auth_next') || '/profile.html';
    localStorage.removeItem('auth_next');
    return sb.auth.signInWithOAuth({
      provider: 'linkedin_oidc',
      options: { redirectTo: window.location.origin + afterUrl },
    });
  }

  async function signOut() {
    clearDemoUser();
    if (!isDemoMode()) await getSupabase()?.auth.signOut();
    window.location.href = 'index.html';
  }

  async function getUser() {
    if (isDemoMode()) return getDemoUser();
    const sb = getSupabase();
    if (!sb) return null;
    const { data: { user } } = await sb.auth.getUser();
    return user;
  }

  async function requireAuth(redirectTo) {
    const user = await getUser();
    if (!user) {
      window.location.href = (redirectTo || 'auth.html') + '?next=' + encodeURIComponent(window.location.pathname);
      return null;
    }
    return user;
  }

  /* ── PROFILE FUNCTIONS ────────────────────────────────────────── */

  async function getProfile(userId) {
    if (isDemoMode()) {
      const raw = localStorage.getItem('afrorama_demo_profile');
      return raw ? { profile: JSON.parse(raw), error: null } : { profile: null, error: null };
    }
    const sb = getSupabase();
    const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
    return { profile: data, error };
  }

  async function upsertProfile(userId, fields) {
    if (isDemoMode()) {
      const existing = JSON.parse(localStorage.getItem('afrorama_demo_profile') || '{}');
      const updated  = { ...existing, id: userId, ...fields };
      localStorage.setItem('afrorama_demo_profile', JSON.stringify(updated));
      return { profile: updated, error: null };
    }
    const sb = getSupabase();
    const { data, error } = await sb.from('profiles').upsert({ id: userId, ...fields }).select().single();
    return { profile: data, error };
  }

  async function saveCVScore(userId, score, filename) {
    const { profile } = await getProfile(userId);
    const history = profile?.cv_score_history || [];
    history.push({ score, filename, date: new Date().toISOString() });
    return upsertProfile(userId, { cv_score: score, cv_score_history: history.slice(-20) });
  }

  /* ── COMMUNITY FUNCTIONS ──────────────────────────────────────── */

  async function getPosts(tab = 'general', search = '') {
    if (isDemoMode()) {
      let posts = JSON.parse(localStorage.getItem('afrorama_posts') || '[]');
      if (search) {
        const q = search.toLowerCase();
        posts = posts.filter(p => p.content.toLowerCase().includes(q) || (p.author || '').toLowerCase().includes(q));
      }
      return { posts: posts.filter(p => p.tab === tab), error: null };
    }
    const sb  = getSupabase();
    let query = sb.from('community_posts')
      .select('*, profiles(full_name, is_moderator), community_comments(count)')
      .eq('tab', tab)
      .order('created_at', { ascending: false });
    if (search) query = query.ilike('content', `%${search}%`);
    const { data, error } = await query;
    return { posts: data || [], error };
  }

  async function createPost(userId, content, tab = 'general') {
    if (isDemoMode()) {
      const posts = JSON.parse(localStorage.getItem('afrorama_posts') || '[]');
      const user  = getDemoUser();
      const post  = {
        id: 'post-' + Date.now(),
        user_id: userId,
        content, tab,
        upvotes: 0,
        created_at: new Date().toISOString(),
        profiles: { full_name: user?.full_name || 'Member', is_moderator: false },
        community_comments: [{ count: 0 }],
      };
      posts.unshift(post);
      localStorage.setItem('afrorama_posts', JSON.stringify(posts));
      return { post, error: null };
    }
    const sb = getSupabase();
    const { data, error } = await sb.from('community_posts')
      .insert({ user_id: userId, content, tab })
      .select('*, profiles(full_name, is_moderator)')
      .single();
    return { post: data, error };
  }

  async function upvotePost(userId, postId) {
    if (isDemoMode()) {
      const posts = JSON.parse(localStorage.getItem('afrorama_posts') || '[]');
      const voted = JSON.parse(localStorage.getItem('afrorama_voted') || '[]');
      if (voted.includes(postId)) {
        // Remove upvote
        const idx = posts.findIndex(p => p.id === postId);
        if (idx >= 0) posts[idx].upvotes = Math.max(0, (posts[idx].upvotes || 0) - 1);
        localStorage.setItem('afrorama_voted', JSON.stringify(voted.filter(v => v !== postId)));
      } else {
        const idx = posts.findIndex(p => p.id === postId);
        if (idx >= 0) posts[idx].upvotes = (posts[idx].upvotes || 0) + 1;
        voted.push(postId);
        localStorage.setItem('afrorama_voted', JSON.stringify(voted));
      }
      localStorage.setItem('afrorama_posts', JSON.stringify(posts));
      return { error: null };
    }
    const sb = getSupabase();
    const voted = JSON.parse(localStorage.getItem('afrorama_voted') || '[]');
    if (voted.includes(postId)) {
      await sb.from('post_upvotes').delete().match({ post_id: postId, user_id: userId });
      await sb.from('community_posts').update({ upvotes: sb.rpc('decrement_upvotes', { row_id: postId }) }).eq('id', postId);
      localStorage.setItem('afrorama_voted', JSON.stringify(voted.filter(v => v !== postId)));
    } else {
      await sb.from('post_upvotes').insert({ post_id: postId, user_id: userId });
      await sb.rpc('increment_upvotes', { row_id: postId });
      voted.push(postId);
      localStorage.setItem('afrorama_voted', JSON.stringify(voted));
    }
    return { error: null };
  }

  async function getComments(postId) {
    if (isDemoMode()) {
      const all = JSON.parse(localStorage.getItem('afrorama_comments') || '[]');
      return { comments: all.filter(c => c.post_id === postId), error: null };
    }
    const sb = getSupabase();
    const { data, error } = await sb.from('community_comments')
      .select('*, profiles(full_name, is_moderator)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    return { comments: data || [], error };
  }

  async function addComment(userId, postId, content) {
    if (isDemoMode()) {
      const all  = JSON.parse(localStorage.getItem('afrorama_comments') || '[]');
      const user = getDemoUser();
      const c    = {
        id: 'cmt-' + Date.now(), post_id: postId, user_id: userId, content,
        created_at: new Date().toISOString(),
        profiles: { full_name: user?.full_name || 'Member', is_moderator: false },
      };
      all.push(c);
      localStorage.setItem('afrorama_comments', JSON.stringify(all));
      return { comment: c, error: null };
    }
    const sb = getSupabase();
    const { data, error } = await sb.from('community_comments')
      .insert({ user_id: userId, post_id: postId, content })
      .select('*, profiles(full_name, is_moderator)')
      .single();
    return { comment: data, error };
  }

  /* ── SAVED JOBS ──────────────────────────────────────────────── */

  const SAVED_KEY = 'afrorama_saved_jobs';

  function getSavedJobs() {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY) || '[]'); } catch { return []; }
  }

  function isSaved(jobId) {
    return getSavedJobs().some(j => j.job_id === jobId);
  }

  async function saveJob(userId, jobId, jobData) {
    const list = getSavedJobs();
    if (!list.some(j => j.job_id === jobId)) {
      list.push({ job_id: jobId, job_data: jobData, applied: false, cv_ready: false, saved_at: new Date().toISOString() });
      localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    }
    if (!isDemoMode()) {
      const sb = getSupabase();
      await sb?.from('saved_jobs').upsert({ user_id: userId, job_id: jobId, job_data: jobData });
    }
  }

  async function unsaveJob(userId, jobId) {
    const list = getSavedJobs().filter(j => j.job_id !== jobId);
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
    if (!isDemoMode()) {
      const sb = getSupabase();
      await sb?.from('saved_jobs').delete().match({ user_id: userId, job_id: jobId });
    }
  }

  async function updateSavedJob(jobId, fields) {
    const list = getSavedJobs().map(j => j.job_id === jobId ? { ...j, ...fields } : j);
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  }

  /* ── PROFILE COMPLETENESS ────────────────────────────────────── */

  async function isProfileComplete(userId) {
    const { profile } = await getProfile(userId);
    return !!(
      profile?.full_name?.trim() &&
      profile?.location?.trim() &&
      (profile?.sector_prefs?.length || profile?.job_type_prefs?.length)
    );
  }

  /** Redirect to profile setup page if profile is incomplete */
  async function requireCompleteProfile(userId) {
    const complete = await isProfileComplete(userId);
    if (!complete) {
      window.location.href = 'profile.html?setup=1';
      return false;
    }
    return true;
  }

  window.AfroramaAuth = {
    signUp, signIn, signInWithGoogle, signInWithLinkedIn, signOut, getUser, requireAuth,
    getProfile, upsertProfile, saveCVScore,
    getPosts, createPost, upvotePost, getComments, addComment,
    getSavedJobs, isSaved, saveJob, unsaveJob, updateSavedJob,
    isProfileComplete, requireCompleteProfile,
  };
})();
