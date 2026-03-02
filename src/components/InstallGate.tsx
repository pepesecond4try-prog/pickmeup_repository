import React from 'react';
import { Share, PlusSquare } from 'lucide-react';

export default function InstallGate() {
  return (
    <div className="min-h-screen bg-black text-neutral-300 flex flex-col items-center justify-center relative overflow-hidden font-sans selection:bg-white selection:text-black">
      <div className="absolute inset-0 pointer-events-none opacity-30 z-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22 opacity=%220.03%22/%3E%3C/svg%3E')]"></div>
      
      <main className="relative z-10 flex flex-col items-center justify-center w-full max-w-md px-6 gap-10">
        <div className="relative group">
          <div className="absolute -inset-4 bg-white/5 rounded-[2.5rem] blur-3xl opacity-0 group-hover:opacity-20 transition duration-1000"></div>
          <div className="relative bg-black border border-neutral-800 rounded-[2.5rem] p-3 shadow-2xl overflow-hidden aspect-[9/18] w-64 mx-auto flex flex-col">
            <div className="flex-1 bg-black rounded-[2rem] flex flex-col items-center justify-center relative overflow-hidden border border-neutral-900/50">
              <div className="absolute top-0 w-32 h-6 bg-black rounded-b-xl z-20 border-b border-l border-r border-neutral-800/50"></div>
              
              <div className="size-24 bg-neutral-900/30 border border-neutral-800 rounded-[1.75rem] shadow-none flex items-center justify-center mb-16 transform transition-transform duration-500 hover:scale-105">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                  <path d="M12 2v14M12 16l-4-4M12 16l4-4M6 20h12" />
                </svg>
              </div>
              
              <div className="absolute bottom-16 animate-bounce">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-600">
                  <path d="M12 5v14M19 12l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-3 text-center mb-2">
          <h1 className="text-lg font-normal text-white tracking-wide">Install Application</h1>
          <p className="text-sm text-neutral-500 font-light max-w-[240px] leading-relaxed">Tap the Share button below, then select 'Add to Home Screen'</p>
        </div>
        
        <div className="flex items-start justify-center gap-10 w-full">
          <div className="group relative flex flex-col items-center gap-4">
            <div className="size-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white transition-all duration-300 group-hover:border-neutral-600 group-hover:bg-neutral-800">
              <Share size={24} strokeWidth={1.5} />
            </div>
            <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-widest group-hover:text-white transition-colors">Share</span>
          </div>
          
          <div className="text-neutral-800 pt-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
          
          <div className="group relative flex flex-col items-center gap-4">
            <div className="size-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-white transition-all duration-300 group-hover:border-neutral-600 group-hover:bg-neutral-800">
              <PlusSquare size={24} strokeWidth={1.5} />
            </div>
            <span className="text-[10px] font-medium text-neutral-500 uppercase tracking-widest group-hover:text-white transition-colors">Add to Home</span>
          </div>
        </div>
      </main>
      
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-30">
        <div className="w-1 h-12 rounded-full bg-gradient-to-b from-transparent via-neutral-700 to-transparent"></div>
      </div>
    </div>
  );
}
