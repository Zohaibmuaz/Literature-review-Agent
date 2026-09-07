import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://epneyxuhkfukhmgrjnih.supabase.co';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_28-uIEN3PXeJqqfiiI1zNw_aA8DJfw1';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
