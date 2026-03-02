import React, { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { supabase, setAuthToken } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore((state) => state.login);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !supabase) return;

    setIsLoading(true);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc('login', { access_code: code });
      
      if (rpcError) throw rpcError;
      
      if (data.success) {
        setAuthToken(data.token);
        login(data.user);
      } else {
        setError(data.message || 'Invalid access code');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-black overflow-hidden font-sans text-slate-100 antialiased">
      <div className="absolute inset-0 pointer-events-none z-10 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%220.07%22/%3E%3C/svg%3E')]"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-[120px] pointer-events-none opacity-20"></div>
      
      <form onSubmit={handleLogin} className="relative z-20 flex w-full max-w-sm flex-col items-center gap-12 p-6">
        <div className="flex w-full flex-col gap-5">
          {!supabase && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-xl text-sm text-center mb-4">
              Supabase is not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment variables.
            </div>
          )}
          <div className="group relative flex w-full items-center">
            <input 
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-label="Access Code" 
              placeholder="Access Code" 
              className="h-14 w-full rounded-full border-0 bg-white/10 px-8 text-center text-lg font-normal text-white placeholder-white/30 focus:bg-white/15 focus:ring-0 transition-all duration-300" 
              disabled={isLoading || !supabase}
            />
          </div>
          {error && (
            <p className="text-red-400 text-sm text-center font-medium animate-pulse">{error}</p>
          )}
        </div>
        
        <button 
          type="submit"
          disabled={isLoading || !code.trim() || !supabase}
          className="group relative flex h-20 w-20 cursor-pointer items-center justify-center rounded-full bg-white text-black shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] transition-transform active:scale-95 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
        >
          {isLoading ? (
            <Loader2 className="animate-spin" size={32} strokeWidth={2} />
          ) : (
            <ArrowRight size={32} strokeWidth={2} className="transition-transform group-hover:translate-x-1" />
          )}
        </button>
      </form>
    </div>
  );
}
