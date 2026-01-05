
import { createClient } from '@supabase/supabase-js';

// No Vercel, configuraremos essas variáveis com os links que você me mandou
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const saveUserProgress = async (email: string, brainData: any) => {
  if (!supabaseUrl || !email) return;
  
  const { error } = await supabase
    .from('user_progress')
    .upsert({ 
      email: email.toLowerCase().trim(), 
      brain_data: brainData 
    }, { onConflict: 'email' });
  
  if (error) console.error("Erro ao salvar no Supabase:", error.message);
};

export const loadUserProgress = async (email: string) => {
  if (!supabaseUrl || !email) return null;
  
  const { data, error } = await supabase
    .from('user_progress')
    .select('brain_data')
    .eq('email', email.toLowerCase().trim())
    .single();
  
  if (error) {
    console.warn("Nenhum progresso prévio encontrado para este email.");
    return null;
  }
  return data?.brain_data;
};
