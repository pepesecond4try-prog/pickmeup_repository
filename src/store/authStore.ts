import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setAuthToken } from '../lib/supabase';

interface User {
  id: string;
  role: 'admin' | 'passenger';
  display_name: string;
  emoji: string | null;
  accent_color: string;
}

interface AuthState {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      login: (user) => set({ user }),
      logout: () => {
        setAuthToken('');
        set({ user: null });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
