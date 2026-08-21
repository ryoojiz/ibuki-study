import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vmptcrlpezjinvlcxmlj.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_dA3ajjXfmpFvP9Trje-d0w_-IBxks82'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)