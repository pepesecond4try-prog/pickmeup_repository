import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Initialize Supabase only if environment variables are present
// The actual initialization is deferred until standalone validation passes in the app logic
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          'x-auth-token': localStorage.getItem('pickup_auth_token') || '',
        },
      },
    }) 
  : null;

// Helper to update the token after login
export const setAuthToken = (token: string) => {
  if (token) {
    localStorage.setItem('pickup_auth_token', token);
  } else {
    localStorage.removeItem('pickup_auth_token');
  }
  
  // We need to reload the page to re-initialize the Supabase client with the new header
  // In a more complex setup, we could use a custom fetch implementation, but this is simplest
  if (token) {
    window.location.reload();
  }
};
