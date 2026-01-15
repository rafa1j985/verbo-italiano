
import { createClient } from '@supabase/supabase-js';

// USER PROVIDED CREDENTIALS - HARDCODED FOR DIRECT USAGE
const HARDCODED_URL = "https://jdggakcxcvwvvkwlxhxm.supabase.co";
const HARDCODED_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkZ2dha2N4Y3Z3dnZrd2x4aHhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NDAxNDAsImV4cCI6MjA4MzIxNjE0MH0.5gcR7KSYsxBg6VRNx48l-W3rFNtBXzY8guihE6yo7K0";

// Helper to safely get environment variables
const getEnv = (key: string, fallback: string) => {
  // Check import.meta.env (Vite standard)
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {
    // Ignore error if import.meta is not supported or env is undefined
  }

  // Check process.env (Node/Vercel standard)
  try {
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      // @ts-ignore
      return process.env[key];
    }
  } catch (e) {
    // Ignore error if process is not defined
  }

  return fallback;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL', HARDCODED_URL);
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY', HARDCODED_KEY);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
