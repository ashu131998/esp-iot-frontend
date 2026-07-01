import { cache } from 'react';

import { internalApiFetch } from '@/lib/internal-api-fetch';
import type {
  AvailabilityResponse,
  DateRangeParams,
  EnergyResponse,
  Factory,
  Machine,
  MachineConfiguration,
  MachineConfigProfile,
  PaginatedMeta,
  PaginationParams,
  PerformanceResponse,
  PlatformOverview,
  ProductionLine,
  ProductionResponse,
  QualityRecord,
  UptimeResponse,
  Worker,
  WorkerSchedule,
} from '@/lib/types';
import type { AuthUser } from '@/lib/auth-types';

function qs(
  params?: DateRangeParams &
    PaginationParams & { machine_id?: string; status?: string },
): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    search.set(k, String(v));
  }
  if (params.offset === 0 && !search.has('offset')) {
    search.set('offset', '0');
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function serverRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await internalApiFetch(path, init);

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.error ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Request-scoped cached API for server components (dedupes layout + page fetches). */
export const serverApi = {
  overview: cache((params?: DateRangeParams) =>
    serverRequest<PlatformOverview>(`/v1/overview${qs(params)}`),
  ),
  factories: cache(() => serverRequest<{ factories: Factory[] }>('/v1/factories')),
  factory: cache((factoryId: string) =>
    serverRequest<Factory & { machines: Machine[] }>(`/v1/factories/${factoryId}`),
  ),
  machines: cache((factoryId: string, lineId?: string) =>
    serverRequest<{ factory_id: string; machines: Machine[] }>(
      `/v1/factories/${factoryId}/machines${qs({ line_id: lineId })}`,
    ),
  ),
  lines: cache((factoryId: string, limit?: number, offset?: number) =>
    serverRequest<{ factory_id: string; lines: ProductionLine[] }>(
      `/v1/factories/${factoryId}/lines${qs({ limit, offset })}`,
    ),
  ),
  availability: cache((factoryId: string, params?: DateRangeParams) =>
    serverRequest<AvailabilityResponse>(`/v1/factories/${factoryId}/metrics/availability${qs(params)}`),
  ),
  energy: cache((factoryId: string, params?: DateRangeParams) =>
    serverRequest<EnergyResponse>(`/v1/factories/${factoryId}/metrics/energy${qs(params)}`),
  ),
  production: cache((factoryId: string, params?: DateRangeParams) =>
    serverRequest<ProductionResponse>(`/v1/factories/${factoryId}/metrics/production${qs(params)}`),
  ),
  uptime: cache((factoryId: string, params?: DateRangeParams) =>
    serverRequest<UptimeResponse>(`/v1/factories/${factoryId}/uptime${qs(params)}`),
  ),
  performance: cache((factoryId: string, params?: DateRangeParams) =>
    serverRequest<PerformanceResponse>(`/v1/factories/${factoryId}/metrics/performance${qs(params)}`),
  ),
  quality: cache((
    factoryId: string,
    from: string,
    to: string,
    limit: number,
    offset: number,
    machineId?: string,
  ) =>
    serverRequest<{ factory_id: string; records: QualityRecord[] } & PaginatedMeta>(
      `/v1/factories/${factoryId}/quality${qs({ from, to, limit, offset, machine_id: machineId })}`,
    ),
  ),
  configurations: cache((
    factoryId: string,
    limit: number,
    offset: number,
    machineId?: string,
    lineId?: string,
  ) =>
    serverRequest<{ factory_id: string; configurations: MachineConfiguration[] } & PaginatedMeta>(
      `/v1/factories/${factoryId}/configurations${qs({ limit, offset, machine_id: machineId, line_id: lineId })}`,
    ),
  ),
  factoryUsers: cache((
    factoryId: string,
    limit: number,
    offset: number,
    status?: string,
  ) =>
    serverRequest<{ factory_id: string; users: AuthUser[] } & PaginatedMeta>(
      `/v1/factories/${factoryId}/users${qs({ limit, offset, status })}`,
    ),
  ),
  configProfiles: cache((factoryId: string, machineId?: string) =>
    serverRequest<{ factory_id: string; profiles: MachineConfigProfile[] }>(
      `/v1/factories/${factoryId}/config-profiles${qs({ machine_id: machineId })}`,
    ),
  ),
  workers: cache((factoryId: string, limit = 200, offset = 0, status?: string) =>
    serverRequest<{ factory_id: string; workers: Worker[] } & PaginatedMeta>(
      `/v1/factories/${factoryId}/workers${qs({ limit, offset, status })}`,
    ),
  ),
  schedules: cache((
    factoryId: string,
    limit = 100,
    offset = 0,
    from?: string,
    to?: string,
  ) =>
    serverRequest<{ factory_id: string; schedules: WorkerSchedule[] } & PaginatedMeta>(
      `/v1/factories/${factoryId}/schedules${qs({ limit, offset, from, to })}`,
    ),
  ),
};

export { ApiError };
