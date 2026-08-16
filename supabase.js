// =====================================================
// Supabase Client - MEI Fácil IA
// =====================================================

const SUPABASE_URL = 'https://kpggwsttbvttkjeniftb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_wot5YHH810ZgKRIzFrBA2Q_x_m5iyoC';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function signIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function signOut() {
  await supabaseClient.auth.signOut();
}

async function getCurrentUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  return user;
}

async function getSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session;
}

async function getProfile(userId) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

async function isAdmin(userId) {
  const profile = await getProfile(userId);
  return profile?.role === 'admin';
}

async function getGeminiKey() {
  const { data, error } = await supabaseClient
    .from('app_settings')
    .select('value')
    .eq('key', 'gemini_api_key')
    .single();
  if (error) return null;
  return data?.value || null;
}

async function setGeminiKey(key) {
  const { error } = await supabaseClient
    .from('app_settings')
    .upsert({ 
      key: 'gemini_api_key', 
      value: key, 
      updated_at: new Date().toISOString() 
    });
  if (error) throw error;
}

async function getLancamentos(userId) {
  const { data, error } = await supabaseClient
    .from('lancamentos')
    .select('*')
    .eq('user_id', userId)
    .order('data', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function addLancamento(userId, lancamento) {
  const { data, error } = await supabaseClient
    .from('lancamentos')
    .insert([{ ...lancamento, user_id: userId }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteAllLancamentos(userId) {
  const { error } = await supabaseClient
    .from('lancamentos')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}
