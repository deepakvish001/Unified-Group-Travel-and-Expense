import { useEffect, useState } from 'react';
import { Plus, CheckCircle, Clock, AlertCircle, BarChart2, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Task, Poll, PollOption, GroupMember } from '../../lib/types';

type Props = {
  groupId: string;
};

type Tab = 'tasks' | 'polls' | 'logs';

export function TasksAndPolls({ groupId }: Props) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showPollForm, setShowPollForm] = useState(false);

  const [taskForm, setTaskForm] = useState({ name: '', assignedTo: '', deadline: '' });
  const [pollForm, setPollForm] = useState({ question: '', options: ['', ''] });

  const load = async () => {
    try {
      const { data: t } = await supabase.from('tasks').select('*').eq('group_id', groupId).order('deadline');
      setTasks(t ?? []);

      const { data: p } = await supabase.from('polls').select('*').eq('group_id', groupId).eq('is_closed', false);
      setPolls(p ?? []);

      const { data: m } = await supabase.from('group_members').select('*').eq('group_id', groupId);
      setMembers(m ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [groupId]);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !taskForm.name || !taskForm.assignedTo) return;

    await supabase.from('tasks').insert({
      group_id: groupId,
      name: taskForm.name,
      assigned_to: taskForm.assignedTo,
      deadline: taskForm.deadline || null,
      created_by: user.id,
      status: 'pending',
    });

    await supabase.from('activity_logs').insert({
      group_id: groupId,
      actor_id: user.id,
      action_type: 'task_assigned',
      description: `Task assigned: ${taskForm.name}`,
    });

    setTaskForm({ name: '', assignedTo: '', deadline: '' });
    setShowTaskForm(false);
    load();
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    await supabase.from('tasks').update({ status }).eq('id', taskId);
    load();
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from('tasks').delete().eq('id', taskId);
    load();
  };

  const addPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pollForm.question) return;

    const { data: poll } = await supabase
      .from('polls')
      .insert({
        group_id: groupId,
        question: pollForm.question,
        created_by: user.id,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .maybeSingle();

    if (poll) {
      await supabase.from('poll_options').insert(
        pollForm.options.filter(o => o.trim()).map(option_text => ({
          poll_id: poll.id,
          option_text,
        }))
      );
    }

    setPollForm({ question: '', options: ['', ''] });
    setShowPollForm(false);
    load();
  };

  const votePoll = async (optionId: string) => {
    if (!user) return;
    await supabase.from('poll_votes').insert({
      option_id: optionId,
      user_id: user.id,
    }).maybeSingle();
    load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-stone-200">
        {(['tasks', 'polls'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === t ? 'border-teal-900 text-teal-900' : 'border-transparent text-stone-600'
            }`}
          >
            {t === 'tasks' ? 'Tasks' : 'Polls'}
          </button>
        ))}
      </div>

      {/* Tasks Tab */}
      {tab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-display text-xl font-bold text-teal-950">Tasks & Reminders</h2>
            <button
              onClick={() => setShowTaskForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-900 text-white rounded-lg text-sm font-medium hover:bg-teal-800 transition"
            >
              <Plus className="w-4 h-4" /> Add Task
            </button>
          </div>

          {showTaskForm && (
            <form onSubmit={addTask} className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
              <input
                type="text"
                value={taskForm.name}
                onChange={(e) => setTaskForm({ ...taskForm, name: e.target.value })}
                placeholder="Task name (e.g., Train Booking)"
                required
                className="w-full px-3 py-2 border border-stone-300 rounded-lg"
              />
              <div className="grid md:grid-cols-2 gap-3">
                <select
                  value={taskForm.assignedTo}
                  onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                  required
                  className="px-3 py-2 border border-stone-300 rounded-lg bg-white"
                >
                  <option value="">Assign to...</option>
                  {members.map(m => (
                    <option key={m.id} value={m.user_id}>{m.user_id}</option>
                  ))}
                </select>
                <input
                  type="datetime-local"
                  value={taskForm.deadline}
                  onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                  className="px-3 py-2 border border-stone-300 rounded-lg"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowTaskForm(false)} className="px-3 py-1 text-stone-600 hover:bg-stone-100 rounded">Cancel</button>
                <button type="submit" className="px-3 py-1 bg-teal-900 text-white rounded hover:bg-teal-800">Add</button>
              </div>
            </form>
          )}

          {tasks.length === 0 ? (
            <p className="text-sm text-stone-500">No tasks yet</p>
          ) : (
            <div className="space-y-3">
              {tasks.map(task => (
                <div key={task.id} className="bg-white border border-stone-200 rounded-xl p-4 flex items-start gap-3">
                  <button
                    onClick={() => updateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')}
                    className={`mt-1 ${task.status === 'completed' ? 'text-teal-900' : 'text-stone-300'}`}
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-semibold ${task.status === 'completed' ? 'line-through text-stone-400' : 'text-teal-950'}`}>
                      {task.name}
                    </h4>
                    {task.deadline && (
                      <div className="flex items-center gap-1 text-xs text-stone-500 mt-1">
                        <Clock className="w-3 h-3" /> {new Date(task.deadline).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-1 text-stone-400 hover:text-red-600 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Polls Tab */}
      {tab === 'polls' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-display text-xl font-bold text-teal-950">Group Polls</h2>
            <button
              onClick={() => setShowPollForm(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-900 text-white rounded-lg text-sm font-medium hover:bg-teal-800 transition"
            >
              <Plus className="w-4 h-4" /> Create Poll
            </button>
          </div>

          {showPollForm && (
            <form onSubmit={addPoll} className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
              <input
                type="text"
                value={pollForm.question}
                onChange={(e) => setPollForm({ ...pollForm, question: e.target.value })}
                placeholder="Poll question"
                required
                className="w-full px-3 py-2 border border-stone-300 rounded-lg"
              />
              <div className="space-y-2">
                {pollForm.options.map((opt, i) => (
                  <input
                    key={i}
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...pollForm.options];
                      newOpts[i] = e.target.value;
                      setPollForm({ ...pollForm, options: newOpts });
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg"
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowPollForm(false)} className="px-3 py-1 text-stone-600 hover:bg-stone-100 rounded">Cancel</button>
                <button type="submit" className="px-3 py-1 bg-teal-900 text-white rounded hover:bg-teal-800">Create</button>
              </div>
            </form>
          )}

          {polls.length === 0 ? (
            <p className="text-sm text-stone-500">No active polls</p>
          ) : (
            <div className="space-y-4">
              {polls.map(poll => (
                <div key={poll.id} className="bg-white border border-stone-200 rounded-xl p-4">
                  <h4 className="font-semibold text-teal-950 mb-3 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4" /> {poll.question}
                  </h4>
                  <div className="space-y-2">
                    {poll.options?.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => votePoll(opt.id)}
                        className="w-full text-left px-3 py-2 bg-stone-50 hover:bg-teal-50 border border-stone-200 rounded-lg transition text-sm"
                      >
                        {opt.option_text}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
