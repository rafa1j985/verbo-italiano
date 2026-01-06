import { createClient } from '@supabase/supabase-js';
import { UserBrain } from '../types';

const supabaseUrl = 'https://jdggakcxcvwvvkwlxhxm.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkZ2dha2N4Y3Z3dnZrd2x4aHhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NDAxNDAsImV4cCI6MjA4MzIxNjE0MH0.5gcR7KSYsxBg6VRNx48l-W3rFNtBXzY8guihE6yo7K0';

export const supabase = createClient(supabaseUrl, supabaseKey);

export const saveUserProgress = async (email: string, brain: UserBrain) => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({ email, brain_data: brain }, { onConflict: 'email' });
    
    if (error) throw error;
    return data;
  } catch (e) {
    console.error('Error saving to Supabase:', e);
    // Fallback to local storage
    localStorage.setItem(`brain_${email}`, JSON.stringify(brain));
  }
};

export const loadUserProgress = async (email: string): Promise<UserBrain | null> => {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('brain_data')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows found"
    
    if (data?.brain_data) return data.brain_data;
    
    // Fallback to local storage
    const local = localStorage.getItem(`brain_${email}`);
    return local ? JSON.parse(local) : null;
  } catch (e) {
    console.error('Error loading from Supabase:', e);
    const local = localStorage.getItem(`brain_${email}`);
    return local ? JSON.parse(local) : null;
  }
};