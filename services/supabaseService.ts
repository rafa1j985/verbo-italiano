
import { supabase } from './supabaseClient';
import { UserBrain, GlobalGameConfig } from '../types';

// --- USER PROGRESS (BRAIN) ---

export const saveUserProgress = async (userId: string, brain: UserBrain): Promise<boolean> => {
  if (!userId) return false;
  
  // Explicitly specifying onConflict ensures we update the existing row for this user
  // Using 'id' as the column name to match auth.users reference standard
  const { data, error } = await supabase
    .from('user_progress')
    .upsert(
      { 
        id: userId, 
        brain_data: brain,
        updated_at: new Date().toISOString()
      },
      { onConflict: 'id' }
    );

  if (error) {
      console.error("CRITICAL: Error saving progress to cloud:", error.message);
      return false;
  } else {
      return true;
  }
};

export const loadUserProgress = async (userId: string): Promise<UserBrain | null> => {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('user_progress')
    .select('brain_data')
    .eq('id', userId)
    .maybeSingle(); // maybeSingle is safer than single() for optional rows

  if (error) {
    // Check if it's a real error or just "no row found" (which implies new user)
    console.error("CRITICAL: Error loading progress from cloud:", error.message);
    throw new Error(error.message); 
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
    .select('id, brain_data');

  if (progressError) {
      console.error("Error fetching progress:", progressError);
      return profiles;
  }

  // Merge Data
  return profiles.map(profile => {
      const prog = progressData.find(p => p.id === profile.id);
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
