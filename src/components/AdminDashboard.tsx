import React, { useState, useEffect } from 'react';
import { Grid, Map, Plus, MessageSquare, User, Settings, Bell, ArrowRight, Check, X, LogOut, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { formatDistanceToNow } from 'date-fns';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'drivers'>('active');
  const [pings, setPings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  useEffect(() => {
    if (!supabase) return;
    
    const fetchPings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('pings')
        .select('*, users(display_name, emoji, accent_color)')
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        setPings(data);
      }
      setLoading(false);
    };

    fetchPings();

    const subscription = supabase
      .channel('public:pings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pings' }, (payload) => {
        fetchPings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  const subscribeToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !supabase || !user) {
      alert('Push notifications are not supported in this browser.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Permission for notifications was denied');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error('VAPID public key not found');
        return;
      }

      const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      const subJSON = subscription.toJSON();

      await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: subJSON.endpoint,
        p256dh: subJSON.keys?.p256dh,
        auth: subJSON.keys?.auth
      }, { onConflict: 'endpoint' });

      alert('Successfully subscribed to notifications!');
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      alert('Failed to subscribe to notifications.');
    }
  };

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const openNavigation = (lat: number, lng: number) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) {
      window.open(`maps://?q=${lat},${lng}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    }
  };

  const updatePingStatus = async (id: string, status: 'viewed' | 'picked_up') => {
    if (!supabase) return;
    await supabase.from('pings').update({ status }).eq('id', id);
  };

  const activePings = pings.filter(p => p.status === 'pending' || p.status === 'viewed');
  const historyPings = pings.filter(p => p.status === 'picked_up');

  const renderPing = (ping: any) => (
    <div key={ping.id} className="group flex items-center justify-between py-5 border-b border-neutral-900 last:border-0 hover:bg-neutral-900/20 transition-colors duration-300 -mx-2 px-2 rounded-lg cursor-pointer" onClick={() => openNavigation(ping.lat, ping.lng)}>
      <div className="flex items-center gap-5">
        <div className="size-12 rounded-full border border-neutral-700 flex items-center justify-center text-white font-light text-sm bg-black" style={{ borderColor: ping.users?.accent_color }}>
          {ping.users?.emoji || ping.users?.display_name?.substring(0, 2).toUpperCase()}
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-normal text-white">{ping.users?.display_name}</h3>
            {ping.status === 'pending' && <span className="size-1.5 rounded-full bg-green-500 animate-pulse"></span>}
            {ping.status === 'viewed' && <span className="size-1.5 rounded-full bg-yellow-500"></span>}
          </div>
          <div className="flex items-center gap-2 text-neutral-500 text-xs font-light">
            <span>{ping.lat.toFixed(4)}, {ping.lng.toFixed(4)}</span>
            <span className="size-0.5 rounded-full bg-neutral-700"></span>
            <span>{formatDistanceToNow(new Date(ping.created_at), { addSuffix: true })}</span>
          </div>
        </div>
      </div>
      
      {ping.status !== 'picked_up' ? (
        <div className="flex gap-2">
          {ping.status === 'pending' && (
            <button 
              onClick={(e) => { e.stopPropagation(); updatePingStatus(ping.id, 'viewed'); }}
              className="flex items-center justify-center size-10 rounded-full border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600 transition-all duration-300"
            >
              <Check size={20} />
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); updatePingStatus(ping.id, 'picked_up'); }}
            className="flex items-center justify-center size-10 rounded-full border border-neutral-800 text-white hover:bg-white hover:text-black transition-all duration-300"
          >
            <ArrowRight size={20} />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-center size-10 text-neutral-600">
          <Check size={18} />
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-black text-white min-h-screen flex flex-col items-center justify-start overflow-x-hidden selection:bg-white/20 selection:text-white font-sans">
      <div className="w-full max-w-md min-h-screen flex flex-col bg-black relative shadow-none border-x border-neutral-900 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiMwMDAwMDAiLz48cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjMzMzMzMzIiBmaWxsLW9wYWNpdHk9IjAuMSIvPjwvc3ZnPg==')]">
        
        <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-6 bg-black/90 backdrop-blur-md border-b border-neutral-900">
          <h1 className="font-medium text-lg tracking-wide text-white">Requests</h1>
          <div className="flex gap-4">
            <button onClick={subscribeToPush} className="flex items-center justify-center size-8 rounded-full border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors duration-300" title="Enable Notifications">
              <Bell size={18} />
            </button>
            <button onClick={logout} className="flex items-center justify-center size-8 rounded-full border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600 transition-colors duration-300" title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col px-6 pt-6 pb-24 gap-8">
          <div className="flex gap-6 text-sm font-medium border-b border-neutral-900 pb-3">
            <button onClick={() => setActiveTab('active')} className={`pb-3 -mb-3.5 px-1 transition-colors ${activeTab === 'active' ? 'text-white border-b border-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
              Active
            </button>
            <button onClick={() => setActiveTab('history')} className={`pb-3 -mb-3 px-1 transition-colors ${activeTab === 'history' ? 'text-white border-b border-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
              History
            </button>
            <button onClick={() => setActiveTab('drivers')} className={`pb-3 -mb-3 px-1 transition-colors ${activeTab === 'drivers' ? 'text-white border-b border-white' : 'text-neutral-500 hover:text-neutral-300'}`}>
              Users
            </button>
          </div>

          <div className="flex flex-col gap-0">
            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-neutral-500" size={24} />
              </div>
            ) : (
              <>
                {activeTab === 'active' && activePings.map(renderPing)}
                {activeTab === 'history' && historyPings.map(renderPing)}
                {activeTab === 'drivers' && (
                  <div className="text-center text-neutral-500 py-10 text-sm">
                    User management coming soon.
                  </div>
                )}
                {activeTab === 'active' && activePings.length === 0 && (
                  <div className="text-center text-neutral-500 py-10 text-sm">
                    No active requests.
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        <div className="sticky bottom-0 bg-black/90 backdrop-blur-xl border-t border-neutral-900 pb-8 pt-4 px-8 flex justify-between items-center z-50">
          <button className="flex flex-col items-center justify-center gap-1.5 text-white">
            <Grid size={24} strokeWidth={1.5} />
          </button>
          <button className="flex flex-col items-center justify-center gap-1.5 text-neutral-600 hover:text-neutral-400 transition-colors">
            <Map size={24} strokeWidth={1.5} />
          </button>
          <button className="size-12 rounded-full bg-white text-black flex items-center justify-center shadow-lg hover:bg-neutral-200 transition-all active:scale-95">
            <Plus size={24} />
          </button>
          <button className="flex flex-col items-center justify-center gap-1.5 text-neutral-600 hover:text-neutral-400 transition-colors">
            <MessageSquare size={24} strokeWidth={1.5} />
          </button>
          <button className="flex flex-col items-center justify-center gap-1.5 text-neutral-600 hover:text-neutral-400 transition-colors">
            <User size={24} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
