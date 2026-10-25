'use client';

import { useQuery } from '@tanstack/react-query';

import { ListEmpty, ListGroup, ListRow, SummaryCard } from '@/components/ui/simple';
import { api } from '@/lib/api';
import { useRefetchInterval } from '@/lib/refresh-context';
import type { NotificationItem } from '@/lib/types';

const REFRESH_MS = 30_000;

const TYPE_LABEL: Record<string, string> = {
  shift_reminder: 'Shift reminder',
  machine_down: 'Machine stopped',
  owner_machine_down: 'Owner · machine stopped',
  machine_up_config: 'Machine running again',
  owner_machine_up: 'Owner · machine running',
  downtime_reason_reply: 'Reason from worker',
  config_selection_reply: 'Config from worker',
  test: 'Test message',
  test_push: 'Test push',
  board_offline: 'Board offline (email)',
  board_online: 'Board back (email)',
  board_power_cut: 'Board powered off (email)',
};

function rowTitle(n: NotificationItem) {
  return TYPE_LABEL[n.type] ?? n.type.replace(/_/g, ' ');
}

function rowDetail(n: NotificationItem) {
  const who = [n.recipient_name, n.phone].filter(Boolean).join(' · ');
  const when = new Date(n.created_at).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const bits = [who, n.machine_id, when, n.status === 'simulated' ? 'simulated' : null].filter(Boolean);
  const msg = n.message?.trim();
  return msg ? `${msg.slice(0, 120)}${msg.length > 120 ? '…' : ''} · ${bits.join(' · ')}` : bits.join(' · ');
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

  if (isLoading) {
    return <p className="text-sm text-muted">Loading notification history…</p>;
  }

  return (
    <div className="space-y-6">
      <SummaryCard
        tone={notifications.length === 0 ? 'idle' : 'good'}
        title={notifications.length === 0 ? 'No notifications yet' : 'Notification history'}
        subtitle={
          data
            ? `${notifications.length} recent · ${data.total} total`
            : 'Reminders, mobile alerts, and board emails'
        }
      />

      <ListGroup title="Latest" count={notifications.length}>
        {notifications.length === 0 ? (
          <ListEmpty>Shift reminders and alerts will appear here as they are sent.</ListEmpty>
        ) : (
          notifications.map((n) => (
            <ListRow
              key={n.notification_id}
              tone={n.status === 'failed' ? 'bad' : n.status === 'simulated' ? 'idle' : 'good'}
              title={rowTitle(n)}
              detail={rowDetail(n)}
            />
          ))
        )}
      </ListGroup>
    </div>
  );
}
