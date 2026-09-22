import {createClient} from '@supabase/supabase-js';

const rawUrl=process.env.NEXT_PUBLIC_SUPABASE_URL||'';
const supabaseUrl=rawUrl.replace(/^http:\/\//i,'https://');
const supabaseKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'';

export const supabase=createClient(supabaseUrl,supabaseKey);
