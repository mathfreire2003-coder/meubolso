import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://dnunwibanngcputgalxz.supabase.co'
const SUPABASE_KEY = 'sb_publishable_8OQwBgb5igyy5V1ytnHiFw_KxtdvrYS'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

export async function dbLoad(key, fallback) {
  try {
    const { data, error } = await supabase
      .from('finances')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (error || !data) return fallback
    return JSON.parse(data.value)
  } catch {
    return fallback
  }
}

export async function dbSave(key, val) {
  try {
    await supabase
      .from('finances')
      .upsert({ key, value: JSON.stringify(val), updated_at: new Date().toISOString() }, { onConflict: 'key' })
  } catch {}
}
