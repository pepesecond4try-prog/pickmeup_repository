import React, { useState, useEffect } from 'react';
import { ArrowUp, Check, Loader2, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function PassengerView() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleRequest = async () => {
    if (status === 'loading' || status === 'success' || !supabase || !user) return;
    
    setStatus('loading');
    setErrorMessage('');

    try {
      // 1. Get Geolocation
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      // 2. Call RPC to request pickup
      const { data, error } = await supabase.rpc('request_pickup', {
        p_lat: position.coords.latitude,
        p_lng: position.coords.longitude,
        p_accuracy: position.coords.accuracy
      });

      if (error) throw error;

      if (data.success) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage(data.message || 'Failed to request pickup');
      }
    } catch (err: any) {
      console.error('Pickup request error:', err);
      setStatus('error');
      if (err.code === 1) {
        setErrorMessage('Location access denied. Please enable location services.');
      } else {
        setErrorMessage('An error occurred. Please try again.');
      }
    }
  };

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-black font-sans text-slate-100 antialiased selection:bg-white selection:text-black">
      <div className="absolute inset-0 z-0 bg-black"></div>
      <div className="absolute inset-0 z-0 opacity-100 pointer-events-none mix-blend-overlay bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%220.03%22/%3E%3C/svg%3E')]"></div>
      
      <button 
        onClick={logout}
        className="absolute top-8 right-8 z-50 text-neutral-500 hover:text-white transition-colors"
      >
        <LogOut size={24} />
      </button>

      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full max-w-md mx-auto p-6">
        <div className="relative flex items-center justify-center">
          {status === 'idle' && (
            <>
              <div className="absolute inset-0 rounded-full bg-white/5 blur-[80px] w-64 h-64 -translate-x-12 -translate-y-12 pointer-events-none"></div>
              <div className="absolute inset-0 rounded-full bg-white/10 blur-[60px] animate-pulse transform scale-110 pointer-events-none" style={{ animationDuration: '4s' }}></div>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping opacity-75 duration-1000" style={{ animationDuration: '3s' }}></div>
              <div className="absolute inset-0 rounded-full bg-green-500/10 animate-ping opacity-50 delay-300" style={{ animationDuration: '4s' }}></div>
            </>
          )}

          <button 
            onClick={handleRequest}
            disabled={status === 'loading' || status === 'success'}
            aria-label="Request Pickup" 
            className={cn(
              "group relative flex items-center justify-center w-32 h-32 md:w-40 md:h-40 rounded-full shadow-[0_0_40px_rgba(255,255,255,0.3)] transition-all duration-500 cursor-pointer border-0 outline-none focus:outline-none",
              status === 'idle' && "bg-white hover:scale-105 active:scale-95 hover:shadow-[0_0_80px_rgba(255,255,255,0.5)]",
              status === 'loading' && "bg-white scale-95",
              status === 'success' && "bg-green-500 text-white scale-100 shadow-[0_0_40px_rgba(34,197,94,0.6)]",
              status === 'error' && "bg-red-500 text-white hover:scale-105 active:scale-95"
            )}
            style={{
              animation: status === 'idle' ? 'subtle-glow 4s ease-in-out infinite' : 'none'
            }}
          >
            {status === 'idle' && <div className="w-full h-full rounded-full bg-white" />}
            {status === 'loading' && <Loader2 size={48} className="animate-spin text-black" />}
            {status === 'success' && <Check size={56} strokeWidth={3} className="animate-in zoom-in duration-300" />}
            {status === 'error' && <ArrowUp size={48} strokeWidth={3} className="rotate-45" />}
          </button>
        </div>
        
        {status === 'error' && (
          <div className="absolute bottom-20 text-center animate-in slide-in-from-bottom-4 fade-in duration-300">
            <p className="text-red-400 font-medium">{errorMessage}</p>
            <button onClick={() => setStatus('idle')} className="mt-4 text-sm text-neutral-400 hover:text-white transition-colors">Try Again</button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes subtle-glow {
            0%, 100% { box-shadow: 0 0 30px 5px rgba(255, 255, 255, 0.15); transform: scale(1); }
            50% { box-shadow: 0 0 60px 15px rgba(255, 255, 255, 0.3); transform: scale(1.02); }
        }
      `}</style>
    </div>
  );
}
