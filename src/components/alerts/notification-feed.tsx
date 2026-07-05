'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  BellRing,
  Clock,
  MessageCircle,
  Reply,
  Send,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useRefetchInterval } from '@/lib/refresh-context';
import type { NotificationItem } from '@/lib/types';

const REFRESH_MS = 30_000;

const TYPE_META: Record<string, { label: string; Icon: typeof BellRing; iconClass: string }> = {
  shift_reminder: { label: 'Shift reminder', Icon: Clock, iconClass: 'text-blue-500' },
  machine_down: { label: 'Machine down', Icon: ArrowDownCircle, iconClass: 'text-red-500' },
  owner_machine_down: { label: 'Owner alert · down', Icon: ArrowDownCircle, iconClass: 'text-red-400' },
  machine_up_config: { label: 'Machine up · config', Icon: ArrowUpCircle, iconClass: 'text-emerald-500' },
  owner_machine_up: { label: 'Owner alert · up', Icon: ArrowUpCircle, iconClass: 'text-emerald-400' },
  downtime_reason_reply: { label: 'Reason received', Icon: Reply, iconClass: 'text-violet-500' },
  config_selection_reply: { label: 'Config selected', Icon: Reply, iconClass: 'text-violet-500' },
  test: { label: 'Test message', Icon: Send, iconClass: 'text-slate-400' },
  test_push: { label: 'Test push', Icon: Send, iconClass: 'text-blue-500' },
};

function statusBadge(n: NotificationItem) {
  if (n.status === 'sent') return 'bg-emerald-50 text-emerald-700';
  if (n.status === 'received') return 'bg-violet-50 text-violet-700';
  if (n.status === 'simulated') return 'bg-slate-100 text-slate-600';
  return 'bg-red-50 text-red-700';
}

export function NotificationFeed({ factoryId }: { factoryId: string }) {
  const refetchInterval = useRefetchInterval(REFRESH_MS);
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', factoryId],
    queryFn: ({ signal }) => api.notifications(factoryId, { limit: 30 }, { signal }),
    refetchInterval,
    staleTime: 0,
  });

  const notifications = data?.notifications ?? [];

  return (
    <Card>
      <CardHeader
        title="Mobile Alert Log"
        description={`Every reminder, alert and worker reply${data ? ` · ${data.total} total` : ''}`}
        action={<MessageCircle className="h-4 w-4 text-muted" />}
      />
      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted">Loading…</p>
      ) : notifications.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted">
          No messages yet. Reminders go out automatically before each shift, and machine
          down/up alerts fire the moment a loom changes state.
        </div>
      ) : (
        <ul className="max-h-[480px] divide-y overflow-y-auto rounded-lg border">
          {notifications.map((n) => {
            const meta = TYPE_META[n.type] ?? {
              label: n.type,
              Icon: BellRing,
              iconClass: 'text-slate-400',
            };
            const { Icon } = meta;
            return (
              <li key={n.notification_id} className="flex gap-3 px-4 py-3">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.iconClass}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{meta.label}</span>
                    <Badge className={statusBadge(n)}>{n.status}</Badge>
                    {n.channel === 'console' && (
                      <Badge className="bg-slate-100 text-slate-500">simulated</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-muted">
                    {n.message}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    {n.recipient_name ? `${n.recipient_name} · ` : ''}
                    {n.phone ?? ''}
                    {n.machine_id ? ` · ${n.machine_id}` : ''}
                    {' · '}
                    {new Date(n.created_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {n.error ? ` · ${n.error}` : ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
