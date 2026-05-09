import { useEffect, useState } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ActivityLog } from '../../lib/types';

type Props = {
  groupId: string;
  limit?: number;
};

const ACTION_COLORS: Record<string, string> = {
  group_created: 'bg-teal-100 text-teal-900',
  expense_added: 'bg-amber-100 text-amber-900',
  expense_notification: 'bg-amber-100 text-amber-900',
  task_assigned: 'bg-sky-100 text-sky-900',
  member_joined: 'bg-green-100 text-green-900',
  member_left: 'bg-red-100 text-red-900',
};

const ACTION_LABELS: Record<string, string> = {
  group_created: 'Group created',
  expense_added: 'Expense added',
  expense_notification: 'Expense notification',
  task_assigned: 'Task assigned',
  member_joined: 'Member joined',
  member_left: 'Member left',
};

export function ActivityLog({ groupId, limit = 50 }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false })
        .limit(limit);
      setLogs(data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [groupId]);

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-teal-950 flex items-center gap-2 mb-2">
          <Activity className="w-6 h-6" /> Activity Log
        </h2>
        <p className="text-stone-600 text-sm">Immutable audit trail of all group actions</p>
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-stone-500">No activity yet</p>
      ) : (
        <div className="space-y-1">
          {logs.map((log, idx) => (
            <div key={log.id} className="relative flex gap-4 pb-4">
              {/* Timeline */}
              <div className="absolute left-4 top-10 bottom-0 w-px bg-stone-200" />
              {idx === logs.length - 1 && <div className="absolute left-4 top-10 bottom-0 w-px bg-gradient-to-b from-stone-200 to-transparent" />}

              {/* Marker */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${ACTION_COLORS[log.action_type] || 'bg-stone-200 text-stone-700'}`}>
                <Activity className="w-4 h-4" />
              </div>

              {/* Content */}
              <div className="bg-white border border-stone-200 rounded-xl p-4 flex-1 mt-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-teal-950 text-sm">
                      {ACTION_LABELS[log.action_type] || log.action_type}
                    </div>
                    <p className="text-sm text-stone-600 mt-1">{log.description}</p>
                  </div>
                  <div className="text-xs text-stone-400 whitespace-nowrap flex-shrink-0">
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info */}
      <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
        <p className="text-xs text-stone-600">
          <strong>Immutable Log:</strong> All activity entries are permanent and cannot be edited or deleted. This ensures accountability and transparency across all group operations.
        </p>
      </div>
    </div>
  );
}
