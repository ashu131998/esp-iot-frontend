import type { UptimeMachine, UptimeStream } from '@/lib/types';

/** One chart/table row — either a legacy single stream per machine or one binding stream. */
export type UptimeDisplayRow = UptimeMachine &
  Partial<UptimeStream> & {
    display_name: string;
    stream_key: string;
  };

export function expandUptimeMachines(machines: UptimeMachine[]): UptimeDisplayRow[] {
  const out: UptimeDisplayRow[] = [];
  for (const m of machines) {
    if (m.streams?.length) {
      for (const s of m.streams) {
        out.push({
          ...m,
          binding_id: s.binding_id,
          label: s.label,
          channel_slot: s.channel_slot,
          device_id: s.device_id ?? m.device_id,
          up_hours: s.up_hours ?? m.up_hours,
          down_hours: s.down_hours ?? m.down_hours,
          offline_hours: s.offline_hours ?? m.offline_hours,
          idle_hours: s.idle_hours ?? m.idle_hours,
          availability_percent: s.availability_percent,
          live_status: s.live_status ?? m.live_status,
          live_since: s.live_since ?? m.live_since,
          timeline: s.timeline,
          detail_timeline: s.detail_timeline ?? s.timeline,
          display_name: s.display_name ?? `${m.machine_name}: ${s.label}`,
          stream_key: `${m.machine_id}:${s.binding_id ?? s.label}`,
        });
      }
    } else {
      out.push({
        ...m,
        display_name: m.machine_name,
        stream_key: m.machine_id,
      });
    }
  }
  return out;
}
