import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Copy, Check, X, Loader2, UserX, UserCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDistanceToNow } from 'date-fns';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Form state
  const [displayName, setDisplayName] = useState('');
  const [emoji, setEmoji] = useState('👤');
  const [accentColor, setAccentColor] = useState('#196ee6');
  const [accessCode, setAccessCode] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    if (!supabase) return;
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'passenger')
      .order('created_at', { ascending: false });
      
    if (!error && data) {
      setUsers(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setAccessCode(code);
  };

  const openAddModal = () => {
    setEditingUser(null);
    setDisplayName('');
    setEmoji('👤');
    setAccentColor('#196ee6');
    generateCode();
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setDisplayName(user.display_name);
    setEmoji(user.emoji || '👤');
    setAccentColor(user.accent_color || '#196ee6');
    setAccessCode(''); // Keep empty unless they want to change it
    setIsActive(user.is_active);
    setIsModalOpen(true);
  };

  const saveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !displayName.trim()) return;
    
    setSaving(true);
    try {
      if (editingUser) {
        await supabase.rpc('admin_update_user', {
          p_user_id: editingUser.id,
          p_display_name: displayName,
          p_access_code: accessCode || null,
          p_emoji: emoji,
          p_accent_color: accentColor,
          p_is_active: isActive
        });
      } else {
        await supabase.rpc('admin_create_user', {
          p_display_name: displayName,
          p_access_code: accessCode,
          p_emoji: emoji,
          p_accent_color: accentColor,
          p_is_active: isActive
        });
      }
      setIsModalOpen(false);
      fetchUsers();
    } catch (err) {
      console.error('Error saving user:', err);
      alert('Failed to save user.');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
        <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Passengers</h2>
        <button 
          onClick={openAddModal}
          className="flex items-center gap-1.5 text-xs font-medium bg-white text-black px-3 py-1.5 rounded-full hover:bg-neutral-200 transition-colors"
        >
          <Plus size={14} /> Add User
        </button>
      </div>

      {users.length === 0 ? (
        <div className="text-center text-neutral-500 py-10 text-sm">
          No passengers found.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map(user => (
            <div key={user.id} className={`flex items-center justify-between p-4 rounded-2xl border ${user.is_active ? 'border-neutral-800 bg-neutral-900/30' : 'border-red-900/30 bg-red-900/10 opacity-75'}`}>
              <div className="flex items-center gap-4">
                <div 
                  className="size-12 rounded-full border flex items-center justify-center text-lg bg-black shrink-0" 
                  style={{ borderColor: user.accent_color || '#333' }}
                >
                  {user.emoji || '👤'}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-medium text-white">{user.display_name}</h3>
                    {!user.is_active && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Disabled</span>}
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {user.last_active_at ? `Active ${formatDistanceToNow(new Date(user.last_active_at), { addSuffix: true })}` : 'Never active'}
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => openEditModal(user)}
                className="size-10 rounded-full flex items-center justify-center text-neutral-400 hover:bg-neutral-800 hover:text-white transition-colors"
              >
                <Edit2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium text-white">{editingUser ? 'Edit Passenger' : 'New Passenger'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-neutral-500 hover:text-white">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={saveUser} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5 ml-1">Display Name</label>
                <input 
                  type="text" 
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-neutral-600"
                  placeholder="e.g. Alex"
                  required
                />
              </div>
              
              <div className="flex gap-4">
                <div className="w-1/3">
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5 ml-1">Emoji</label>
                  <input 
                    type="text" 
                    value={emoji}
                    onChange={e => setEmoji(e.target.value)}
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white text-center text-xl focus:outline-none focus:border-neutral-600"
                    maxLength={2}
                  />
                </div>
                <div className="w-2/3">
                  <label className="block text-xs font-medium text-neutral-400 mb-1.5 ml-1">Accent Color</label>
                  <div className="flex items-center gap-3 bg-black border border-neutral-800 rounded-xl px-3 py-2.5">
                    <input 
                      type="color" 
                      value={accentColor}
                      onChange={e => setAccentColor(e.target.value)}
                      className="size-6 rounded cursor-pointer border-0 p-0 bg-transparent"
                    />
                    <span className="text-sm text-neutral-300 font-mono uppercase">{accentColor}</span>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-neutral-400 mb-1.5 ml-1">
                  Access Code {editingUser && '(Leave blank to keep current)'}
                </label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={accessCode}
                    onChange={e => setAccessCode(e.target.value.toUpperCase())}
                    className="flex-1 bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white font-mono text-center tracking-widest focus:outline-none focus:border-neutral-600"
                    placeholder={editingUser ? '••••••' : 'Code'}
                    required={!editingUser}
                  />
                  <button 
                    type="button"
                    onClick={generateCode}
                    className="px-4 bg-neutral-800 text-white rounded-xl text-xs font-medium hover:bg-neutral-700 transition-colors"
                  >
                    Generate
                  </button>
                  {accessCode && (
                    <button 
                      type="button"
                      onClick={() => copyToClipboard(accessCode, 'code')}
                      className="px-4 bg-neutral-800 text-white rounded-xl flex items-center justify-center hover:bg-neutral-700 transition-colors"
                    >
                      {copiedId === 'code' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between mt-2 p-3 bg-black border border-neutral-800 rounded-xl">
                <div className="flex items-center gap-3">
                  {isActive ? <UserCheck size={18} className="text-green-500" /> : <UserX size={18} className="text-red-500" />}
                  <span className="text-sm text-white font-medium">Account Active</span>
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
                {saving ? <Loader2 className="animate-spin" size={20} /> : 'Save Passenger'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
