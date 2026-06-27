import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://evchjtlhoadiavslontd.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_kGwj9rk6I1DBFHWb5Qh2ew_Xko0KrY0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
