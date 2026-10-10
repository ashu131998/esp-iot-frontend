'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { NodeSensorBindingsEditor } from '@/components/sensors/node-sensor-bindings-editor';
import { Card, CardHeader } from '@/components/ui/card';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatDate } from '@/lib/utils';

export function FactorySensorMappingPanel({ factoryId }: { factoryId: string }) {
  const { canWriteFactory } = useAuth();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const nodesQuery = useQuery({
    queryKey: ['factory-nodes', factoryId],
    queryFn: ({ signal }) => api.factoryNodes(factoryId, { signal }),
  });

  const nodes = nodesQuery.data?.nodes ?? [];
  const activeDeviceId = selectedDeviceId ?? nodes[0]?.device_id ?? null;

  const selected = useMemo(
    () => nodes.find((n) => n.device_id === activeDeviceId),
    [nodes, activeDeviceId],
  );

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <CardHeader
          title="Nodes in this factory"
          description="Pick a node (ESP) to map each sensor channel to a machine and label. Status timelines and uptime use these names (e.g. Loom 1: Main motor)."
        />
        {nodesQuery.isLoading ? (
          <p className="mt-4 text-sm text-muted">Loading nodes…</p>
        ) : nodes.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No devices registered yet — telemetry will create nodes automatically.</p>
        ) : (
          <Table className="mt-4 border-0">
            <THead>
              <TR>
                <TH>Node</TH>
                <TH>Line</TH>
                <TH>Bindings</TH>
                <TH>Last seen</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {nodes.map((n) => (
                <TR key={n.device_id}>
                  <TD className="font-mono text-sm">{n.device_id}</TD>
                  <TD>{n.line_id}</TD>
                  <TD>{n.binding_count}</TD>
                  <TD className="text-xs text-muted">
                    {n.last_seen_at ? formatDate(n.last_seen_at) : '—'}
                  </TD>
                  <TD>
                    <button
                      type="button"
                      className={`text-sm ${activeDeviceId === n.device_id ? 'font-semibold text-primary' : 'text-primary hover:underline'}`}
                      onClick={() => setSelectedDeviceId(n.device_id)}
                    >
                      {activeDeviceId === n.device_id ? 'Editing' : 'Configure'}
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {activeDeviceId && selected && (
        <NodeSensorBindingsEditor
          factoryId={factoryId}
          deviceId={activeDeviceId}
          apiMode="factory"
          canWrite={canWriteFactory}
        />
      )}
    </div>
  );
}
