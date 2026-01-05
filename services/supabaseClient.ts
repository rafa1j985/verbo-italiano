
import { createClient } from '@supabase/supabase-js';

// Função auxiliar para buscar variáveis de ambiente de forma segura
const getEnv = (key: string): string => {
  // Tenta buscar do import.meta.env (Vite padrão)
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
      return (import.meta as any).env[key];
    }
  } catch (e) {}

  // Tenta buscar do process.env (Injetado via vite.config ou ambiente)
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
  } catch (e) {}

  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

// Só inicializa o cliente se as chaves existirem para evitar erros em tempo de execução
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);

export const saveUserProgress = async (email: string, brainData: any) => {
  if (!supabaseUrl || !supabaseAnonKey || !email) {
    console.warn("Supabase não configurado ou e-mail ausente.");
    return;
  }
  
  const { error } = await supabase
    .from('user_progress')
    .upsert({ 
      email: email.toLowerCase().trim(), 
      brain_data: brainData 
    }, { onConflict: 'email' });
  
  if (error) console.error("Erro ao salvar no Supabase:", error.message);
};

export const loadUserProgress = async (email: string) => {
  if (!supabaseUrl || !supabaseAnonKey || !email) return null;
  
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('brain_data')
      .eq('email', email.toLowerCase().trim())
      .single();
    
    if (error) {
      console.warn("Nenhum progresso prévio encontrado ou erro na busca.");
      return null;
    }
    return data?.brain_data;
  } catch (err) {
    console.error("Falha ao carregar progresso:", err);
    return null;
  }
};
