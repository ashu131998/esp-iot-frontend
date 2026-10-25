'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';

import { NodeSensorBindingsEditor } from '@/components/sensors/node-sensor-bindings-editor';
import { Card, CardHeader } from '@/components/ui/card';
import { TBody, TD, TH, THead, TR, Table } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useFactoryRefsOptional } from '@/lib/factory-refs-context';
import { formatDate } from '@/lib/utils';

export function FactorySensorMappingPanel({ factoryId }: { factoryId: string }) {
  const { canWriteFactory } = useAuth();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const lines = useFactoryRefsOptional()?.lines;
  const lineName = (lineId: string) => lines?.find((l) => l.line_id === lineId)?.name ?? lineId;

  function configure(deviceId: string) {
    setSelectedDeviceId(deviceId);
    requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

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
          title="Sensor boxes"
          description="Pick a sensor box to choose which machine each of its sensors belongs to."
        />
        {nodesQuery.isLoading ? (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        ) : nodes.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No sensor boxes yet. They show up here when they start sending data.</p>
        ) : (
          <Table className="mt-4 border-0">
            <THead>
              <TR>
                <TH>Sensor box</TH>
                <TH>Line</TH>
                <TH>Sensors</TH>
                <TH>Last data</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {nodes.map((n) => (
                <TR key={n.device_id}>
                  <TD className="font-mono text-sm">{n.device_id}</TD>
                  <TD>{lineName(n.line_id)}</TD>
                  <TD>{n.binding_count}</TD>
                  <TD className="text-xs text-muted">
                    {n.last_seen_at ? formatDate(n.last_seen_at) : '—'}
                  </TD>
                  <TD>
                    <button
                      type="button"
                      className={`text-sm ${activeDeviceId === n.device_id ? 'font-semibold text-primary' : 'text-primary hover:underline'}`}
                      onClick={() => configure(n.device_id)}
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
        <div ref={editorRef} className="scroll-mt-4">
          <NodeSensorBindingsEditor
            factoryId={factoryId}
            deviceId={activeDeviceId}
            apiMode="factory"
            canWrite={canWriteFactory}
          />
        </div>
      )}
    </div>
  );
}
