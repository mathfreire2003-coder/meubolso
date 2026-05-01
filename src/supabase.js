import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dnunwibanngcputgalxz.supabase.co'
const SUPABASE_KEY = 'sb_publishable_8OQwBgb5igyy5V1ytnHiFw_KxtdvrYS'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function dbLoad(key, fallback) {
  try {
    const user = await getUser()
    if (!user) return fallback
    const { data, error } = await supabase
      .from('finances')
      .select('value')
      .eq('key', key)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error || !data) return fallback
    return JSON.parse(data.value)
  } catch {
    return fallback
  }
}

export async function dbSave(key, val) {
  try {
    const user = await getUser()
    if (!user) return
    await supabase
      .from('finances')
      .upsert(
        { key, value: JSON.stringify(val), user_id: user.id, updated_at: new Date().toISOString() },
        { onConflict: 'key,user_id' }
      )
  } catch {}
}
