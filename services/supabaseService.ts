
import { supabase } from './supabaseClient';
import { UserBrain, GlobalGameConfig } from '../types';

// --- USER PROGRESS (BRAIN) ---

export const saveUserProgress = async (userId: string, brain: UserBrain) => {
  if (!userId) return;
  
  const { error } = await supabase
    .from('user_progress')
    .upsert({ 
      user_id: userId, 
      brain_data: brain,
      updated_at: new Date().toISOString()
    });

  if (error) console.error("Error saving progress:", error);
};

export const loadUserProgress = async (userId: string): Promise<UserBrain | null> => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('user_progress')
    .select('brain_data')
    .eq('user_id', userId)
    .single();

  if (error) {
    // It's normal to have no data for a new user
    return null;
  }
  
  return data?.brain_data || null;
};

// --- ADMIN FEATURES ---

export const getAllUsersAdmin = async () => {
  // Fetches profiles joined with their progress
  // Note: This query relies on the RLS policies allowing Admins to see 'profiles' and 'user_progress'
  
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('*');

  if (profileError) {
    console.error("Error fetching profiles:", profileError);
    return [];
  }

  // Fetch progress for all users (Admin only)
  const { data: progressData, error: progressError } = await supabase
    .from('user_progress')
    .select('user_id, brain_data');

  if (progressError) {
      console.error("Error fetching progress:", progressError);
      return profiles;
  }

  // Merge Data
  return profiles.map(profile => {
      const prog = progressData.find(p => p.user_id === profile.id);
      return {
          ...profile,
          brain: prog?.brain_data || null
      };
  });
};

export const getGlobalConfig = async (): Promise<GlobalGameConfig | null> => {
  const { data, error } = await supabase
    .from('global_config')
    .select('config_data')
    .limit(1)
    .single();

  if (error) return null;
  return data.config_data;
};

export const saveGlobalConfig = async (config: GlobalGameConfig) => {
  const { data: existing } = await supabase.from('global_config').select('id').limit(1).single();
  
  if (existing) {
     const { error } = await supabase
      .from('global_config')
      .update({ config_data: config, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
     if (error) console.error("Error updating config:", error);
  } else {
     const { error } = await supabase
      .from('global_config')
      .insert({ config_data: config });
     if (error) console.error("Error inserting config:", error);
  }
};
