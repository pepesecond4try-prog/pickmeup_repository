import React, { useState, useEffect } from 'react';
import { Plus, Calendar, Clock, Loader2, Play, Square, RefreshCw, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format, addDays, isAfter, isBefore } from 'date-fns';

export default function AdminSessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSessions = async () => {
    setLoading(true);
    if (!supabase) return;
    
    // Fetch sessions with ticket counts
    const { data, error } = await supabase
      .from('sessions')
      .select(`
        *,
        tickets (id, is_used)
      `)
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setSessions(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const openAddModal = () => {
    setName(`Weekend Trip ${format(new Date(), 'MMM d')}`);
    const now = new Date();
    setStartTime(format(now, "yyyy-MM-dd'T'HH:mm"));
    setEndTime(format(addDays(now, 3), "yyyy-MM-dd'T'HH:mm"));
    setIsActive(true);
    setIsModalOpen(true);
  };

  const applyTemplate = (days: number) => {
    const now = new Date();
    setStartTime(format(now, "yyyy-MM-dd'T'HH:mm"));
    setEndTime(format(addDays(now, days), "yyyy-MM-dd'T'HH:mm"));
  };

  const saveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !name.trim() || !startTime || !endTime) return;
    
    setSaving(true);
    try {
      await supabase.rpc('admin_create_session', {
        p_name: name,
        p_start_time: new Date(startTime).toISOString(),
        p_end_time: new Date(endTime).toISOString(),
        p_is_active: isActive
      });
      setIsModalOpen(false);
      fetchSessions();
    } catch (err) {
      console.error('Error saving session:', err);
      alert('Failed to save session.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSessionStatus = async (id: string, currentStatus: boolean) => {
    if (!supabase) return;
    await supabase.from('sessions').update({ is_active: !currentStatus }).eq('id', id);
    fetchSessions();
  };

  const bulkResetTickets = async (id: string) => {
    if (!supabase) return;
    if (!confirm('Are you sure you want to reset ALL tickets for this session?')) return;
    
    await supabase.rpc('admin_bulk_reset_tickets', { p_session_id: id });
    fetchSessions();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-neutral-500" size={24} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Sessions</h2>
        <button 
          onClick={openAddModal}
          className="flex items-center gap-1.5 text-xs font-medium bg-white text-black px-3 py-1.5 rounded-full hover:bg-neutral-200 transition-colors"
        >
          <Plus size={14} /> New Session
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center text-neutral-500 py-10 text-sm">
          No sessions found.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sessions.map(session => {
            const now = new Date();
            const start = new Date(session.start_time);
            const end = new Date(session.end_time);
            const isCurrentlyActive = session.is_active && isAfter(now, start) && isBefore(now, end);
            
            const totalTickets = session.tickets?.length || 0;
            const usedTickets = session.tickets?.filter((t: any) => t.is_used).length || 0;
            const progress = totalTickets > 0 ? (usedTickets / totalTickets) * 100 : 0;

            return (
              <div key={session.id} className={`flex flex-col p-5 rounded-3xl border ${isCurrentlyActive ? 'border-green-500/30 bg-green-500/5' : 'border-neutral-800 bg-neutral-900/30'}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-medium text-white">{session.name}</h3>
                      {isCurrentlyActive && <span className="size-2 rounded-full bg-green-500 animate-pulse"></span>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-500">
                      <span className="flex items-center gap-1"><Calendar size={12} /> {format(start, 'MMM d, h:mm a')}</span>
                      <span>→</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {format(end, 'MMM d, h:mm a')}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={() => toggleSessionStatus(session.id, session.is_active)}
                      className={`size-10 rounded-full flex items-center justify-center transition-colors ${session.is_active ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-green-500/10 text-green-400 hover:bg-green-500/20'}`}
                      title={session.is_active ? "Deactivate" : "Activate"}
                    >
                      {session.is_active ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                    </button>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">Tickets Used</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono text-white">{usedTickets} / {totalTickets}</span>
                      <button 
                        onClick={() => bulkResetTickets(session.id)}
                        className="text-neutral-500 hover:text-white transition-colors"
                        title="Reset all tickets"
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-white">New Session</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-500 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={saveSession} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5 ml-1">Session Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-neutral-600"
                  placeholder="e.g. Weekend Trip"
                  required
                />
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => applyTemplate(1)} className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs rounded-lg transition-colors">1 Day</button>
                <button type="button" onClick={() => applyTemplate(3)} className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs rounded-lg transition-colors">3 Days</button>
                <button type="button" onClick={() => applyTemplate(7)} className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs rounded-lg transition-colors">1 Week</button>
              </div>
              
              <div className="flex gap-4">
                <div className="w-1/2">
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5 ml-1">Start Time</label>
                  <input 
                    type="datetime-local" 
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-3 text-white text-xs focus:outline-none focus:border-neutral-600"
                    required
                  />
                </div>
                <div className="w-1/2">
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5 ml-1">End Time</label>
                  <input 
                    type="datetime-local" 
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-3 text-white text-xs focus:outline-none focus:border-neutral-600"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 p-3 bg-black border border-neutral-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <Play size={18} className="text-green-500" />
                  <span className="text-sm text-white font-medium">Activate Immediately</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? 'bg-green-500' : 'bg-neutral-700'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
              
              <button 
                type="submit"
                disabled={saving}
                className="w-full bg-white text-black font-medium rounded-xl py-3.5 mt-4 flex items-center justify-center hover:bg-neutral-200 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={20} /> : 'Create Session'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
