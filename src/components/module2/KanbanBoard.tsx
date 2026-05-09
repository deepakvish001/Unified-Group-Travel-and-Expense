import { useEffect, useState } from 'react';
import { Plus, X, Loader2, Trash2, Calendar, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { TripTask, TripMember, Profile, Priority } from '../../lib/types';

type MemberRow = TripMember & { profile: Profile };
type Status = 'todo' | 'in_progress' | 'completed';

const COLUMNS: { id: Status; label: string; color: string; badge: string }[] = [
  { id: 'todo', label: 'To do', color: 'border-stone-300', badge: 'bg-stone-100 text-stone-700' },
  { id: 'in_progress', label: 'In progress', color: 'border-amber-400', badge: 'bg-amber-100 text-amber-800' },
  { id: 'completed', label: 'Completed', color: 'border-emerald-500', badge: 'bg-emerald-100 text-emerald-800' },
];

const PRIORITY_COLOR: Record<Priority, string> = {
  low: 'bg-stone-100 text-stone-600',
  medium: 'bg-sky-100 text-sky-800',
  high: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-700',
};

export function KanbanBoard({ tripId, members }: { tripId: string; members: MemberRow[] }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TripTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState<Status | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from('trip_tasks').select('*').eq('trip_id', tripId).order('position').order('created_at');
    setTasks(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [tripId]);

  useEffect(() => {
    const ch = supabase.channel(`m2-tasks:${tripId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_tasks', filter: `trip_id=eq.${tripId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tripId]);

  const moveTo = async (taskId: string, status: Status) => {
    const t = tasks.find(x => x.id === taskId);
    if (!t || t.status === status || !user) return;
    await supabase.from('trip_tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', taskId);
    await supabase.from('trip_activity_logs').insert({
      trip_id: tripId, actor_id: user.id, action_type: 'task_moved',
      description: `Moved task "${t.title}" to ${COLUMNS.find(c => c.id === status)?.label}`,
      related_entity_type: 'trip_task', related_entity_id: taskId,
    });
  };

  const remove = async (id: string) => {
    const t = tasks.find(x => x.id === id);
    await supabase.from('trip_tasks').delete().eq('id', id);
    if (t && user) {
      await supabase.from('trip_activity_logs').insert({
        trip_id: tripId, actor_id: user.id, action_type: 'task_deleted',
        description: `Deleted task "${t.title}"`,
      });
    }
  };

  const memberName = (id: string | null) => id ? (members.find(m => m.user_id === id)?.profile.full_name || 'Member') : null;

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-teal-900" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-teal-950">Tasks</h2>
        <p className="text-stone-600 text-sm">Drag tasks across columns to update their state.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id);
          return (
            <div
              key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragging) moveTo(dragging, col.id); setDragging(null); }}
              className={`bg-stone-50 rounded-2xl border-t-4 ${col.color} p-4 min-h-[300px]`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-semibold text-teal-950">{col.label}</h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${col.badge}`}>{colTasks.length}</span>
                </div>
                <button onClick={() => setShowAdd(col.id)} className="text-teal-900 hover:bg-stone-200 rounded-lg p-1 transition">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                {colTasks.length === 0 && (
                  <div className="text-xs text-stone-400 italic text-center py-6">No tasks</div>
                )}
                {colTasks.map(t => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => setDragging(t.id)}
                    onDragEnd={() => setDragging(null)}
                    className="group bg-white rounded-xl border border-stone-200 p-3 hover:shadow-md hover:border-teal-800 transition cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-medium text-teal-950 text-sm flex-1 min-w-0">{t.title}</h4>
                      <button onClick={() => remove(t.id)} className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-600 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {t.description && <p className="text-xs text-stone-600 line-clamp-2 mb-2">{t.description}</p>}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PRIORITY_COLOR[t.priority]}`}>{t.priority}</span>
                      {t.assigned_to && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full">
                          <User className="w-2.5 h-2.5" /> {memberName(t.assigned_to)}
                        </span>
                      )}
                      {t.deadline && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-stone-600">
                          <Calendar className="w-2.5 h-2.5" /> {new Date(t.deadline).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 mt-2">
                      {COLUMNS.filter(c => c.id !== t.status).map(c => (
                        <button key={c.id} onClick={() => moveTo(t.id, c.id)} className="text-[10px] px-2 py-0.5 rounded border border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-teal-900 transition">
                          → {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {showAdd && <TaskModal tripId={tripId} status={showAdd} members={members} onClose={() => setShowAdd(null)} onCreated={() => { setShowAdd(null); load(); }} />}
    </div>
  );
}

function TaskModal({ tripId, status, members, onClose, onCreated }: { tripId: string; status: Status; members: MemberRow[]; onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim()) return;
    setLoading(true);
    const { data } = await supabase.from('trip_tasks').insert({
      trip_id: tripId, title, description, status, priority,
      assigned_to: assignedTo || null, deadline: deadline || null, created_by: user.id,
    }).select().maybeSingle();
    if (data) {
      await supabase.from('trip_activity_logs').insert({
        trip_id: tripId, actor_id: user.id, action_type: 'task_created',
        description: `Created task "${title}"`, related_entity_type: 'trip_task', related_entity_id: data.id,
      });
    }
    setLoading(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 bg-teal-950/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-stone-200">
          <h3 className="font-display text-xl font-bold text-teal-950">New task</h3>
          <button onClick={onClose} className="p-1 hover:bg-stone-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <input required autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Task title" className="w-full px-3 py-2 border border-stone-300 rounded-lg" />
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" rows={2} className="w-full px-3 py-2 border border-stone-300 rounded-lg" />
          <div className="grid grid-cols-2 gap-3">
            <select value={priority} onChange={e => setPriority(e.target.value as Priority)} className="px-3 py-2 border border-stone-300 rounded-lg bg-white">
              <option value="low">Low</option><option value="medium">Medium</option>
              <option value="high">High</option><option value="critical">Critical</option>
            </select>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="px-3 py-2 border border-stone-300 rounded-lg" />
          </div>
          <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-white">
            <option value="">Assign to (optional)</option>
            {members.map(m => <option key={m.user_id} value={m.user_id}>{m.profile.full_name}</option>)}
          </select>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-stone-700 hover:bg-stone-100 rounded-lg">Cancel</button>
            <button disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-teal-900 text-stone-50 rounded-lg hover:bg-teal-800 disabled:opacity-60">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}Add task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
