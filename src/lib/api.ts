import type {
  ActiveAssignmentsResponse,
  AvailabilityResponse,
  CreateConfigurationInput,
  CreateConfigProfileInput,
  CreateQualityInput,
  DateRangeParams,
  EnergyResponse,
  Factory,
  FactoryDailyAvailabilityResponse,
  Machine,
  MachineDailyTrendResponse,
  MachineLiveDaysResponse,
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
  CreateWorkerInput,
  CreateScheduleInput,
} from './types';
import { getClientCsrf } from './auth-context';
import {
  type ApiRequestOptions,
  fetchWithSignal,
  isAbortError,
} from './request-signal';

export type { ApiRequestOptions };

const API_BASE = '/api';

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function csrfHeaders(method?: string): Record<string, string> {
  if (!method || method === 'GET' || method === 'HEAD') return {};
  const token = typeof document !== 'undefined' ? getClientCsrf() : '';
  return token ? { 'X-CSRF-Token': token } : {};
}

async function request<T>(path: string, init?: RequestInit & ApiRequestOptions): Promise<T> {
  const { signal, timeoutMs, method: initMethod, headers: initHeaders, ...fetchInit } = init ?? {};
  const method = initMethod ?? 'GET';
  const headers = {
    'Content-Type': 'application/json',
    ...csrfHeaders(method),
    ...(initHeaders as Record<string, string> | undefined),
  };

  try {
    const res = await fetchWithSignal(`${API_BASE}${path}`, {
      ...fetchInit,
      method,
      credentials: 'same-origin',
      headers,
      cache: 'no-store',
      signal,
      timeoutMs,
    });

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
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw error;
  }
}

function qs(
  params?: DateRangeParams &
    PaginationParams & {
      machine_id?: string;
      status?: string;
      factory_id?: string;
      worker_id?: string;
      shift?: string;
    },
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

export const api = {
  overview: (params?: DateRangeParams, options?: ApiRequestOptions) =>
    request<PlatformOverview>(`/v1/overview${qs(params)}`, options),

  factories: (options?: ApiRequestOptions) =>
    request<{ factories: Factory[] }>('/v1/factories', options),

  factory: (factoryId: string, options?: ApiRequestOptions) =>
    request<Factory & { machines: Machine[] }>(`/v1/factories/${factoryId}`, options),

  machines: (factoryId: string, params?: { line_id?: string }, options?: ApiRequestOptions) =>
    request<{ factory_id: string; machines: Machine[] }>(
      `/v1/factories/${factoryId}/machines${qs(params)}`,
      options,
    ),

  lines: (factoryId: string, params?: PaginationParams, options?: ApiRequestOptions) =>
    request<{ factory_id: string; lines: ProductionLine[] }>(
      `/v1/factories/${factoryId}/lines${qs(params)}`,
      options,
    ),

  availability: (factoryId: string, params?: DateRangeParams, options?: ApiRequestOptions) =>
    request<AvailabilityResponse>(
      `/v1/factories/${factoryId}/metrics/availability${qs(params)}`,
      options,
    ),

  energy: (factoryId: string, params?: DateRangeParams, options?: ApiRequestOptions) =>
    request<EnergyResponse>(`/v1/factories/${factoryId}/metrics/energy${qs(params)}`, options),

  performance: (factoryId: string, params?: DateRangeParams, options?: ApiRequestOptions) =>
    request<PerformanceResponse>(
      `/v1/factories/${factoryId}/metrics/performance${qs(params)}`,
      options,
    ),

  production: (factoryId: string, params?: DateRangeParams, options?: ApiRequestOptions) =>
    request<ProductionResponse>(
      `/v1/factories/${factoryId}/metrics/production${qs(params)}`,
      options,
    ),

  uptime: (factoryId: string, params?: DateRangeParams, options?: ApiRequestOptions) =>
    request<UptimeResponse>(`/v1/factories/${factoryId}/uptime${qs(params)}`, options),

  activeAssignments: (factoryId: string, options?: ApiRequestOptions) =>
    request<ActiveAssignmentsResponse>(
      `/v1/factories/${factoryId}/active-assignments`,
      options,
    ),

  machineDailyTrend: (
    factoryId: string,
    machineId: string,
    params?: DateRangeParams,
    options?: ApiRequestOptions,
  ) =>
    request<MachineDailyTrendResponse>(
      `/v1/factories/${factoryId}/machines/${machineId}/daily-trend${qs(params)}`,
      options,
    ),

  machineLiveDays: (
    factoryId: string,
    machineId: string,
    options?: ApiRequestOptions,
  ) =>
    request<MachineLiveDaysResponse>(
      `/v1/factories/${factoryId}/machines/${machineId}/daily-trend/live`,
      options,
    ),

  factoryDailyAvailability: (factoryId: string, params?: DateRangeParams, options?: ApiRequestOptions) =>
    request<FactoryDailyAvailabilityResponse>(
      `/v1/factories/${factoryId}/metrics/daily-availability${qs(params)}`,
      options,
    ),

  quality: (
    factoryId: string,
    params?: DateRangeParams & PaginationParams & { machine_id?: string },
    options?: ApiRequestOptions,
  ) =>
    request<{ factory_id: string; records: QualityRecord[] } & PaginatedMeta>(
      `/v1/factories/${factoryId}/quality${qs(params)}`,
      options,
    ),

  createQuality: (factoryId: string, body: CreateQualityInput, options?: ApiRequestOptions) =>
    request<QualityRecord>(`/v1/factories/${factoryId}/quality`, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    }),

  updateQuality: (
    factoryId: string,
    recordId: string,
    body: Partial<CreateQualityInput>,
    options?: ApiRequestOptions,
  ) =>
    request<QualityRecord>(`/v1/factories/${factoryId}/quality/${recordId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      ...options,
    }),

  deleteQuality: (factoryId: string, recordId: string, options?: ApiRequestOptions) =>
    request<void>(`/v1/factories/${factoryId}/quality/${recordId}`, {
      method: 'DELETE',
      ...options,
    }),

  configurations: (
    factoryId: string,
    params?: PaginationParams & { machine_id?: string; line_id?: string },
    options?: ApiRequestOptions,
  ) =>
    request<{ factory_id: string; configurations: MachineConfiguration[] } & PaginatedMeta>(
      `/v1/factories/${factoryId}/configurations${qs(params)}`,
      options,
    ),

  createConfiguration: (
    factoryId: string,
    body: CreateConfigurationInput,
    options?: ApiRequestOptions,
  ) =>
    request<MachineConfiguration>(`/v1/factories/${factoryId}/configurations`, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    }),

  updateConfiguration: (
    factoryId: string,
    configId: string,
    body: Partial<CreateConfigurationInput>,
    options?: ApiRequestOptions,
  ) =>
    request<MachineConfiguration>(`/v1/factories/${factoryId}/configurations/${configId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      ...options,
    }),

  deleteConfiguration: (factoryId: string, configId: string, options?: ApiRequestOptions) =>
    request<void>(`/v1/factories/${factoryId}/configurations/${configId}`, {
      method: 'DELETE',
      ...options,
    }),

  configProfiles: (
    factoryId: string,
    params?: { machine_id?: string },
    options?: ApiRequestOptions,
  ) =>
    request<{ factory_id: string; profiles: MachineConfigProfile[] }>(
      `/v1/factories/${factoryId}/config-profiles${qs(params)}`,
      options,
    ),

  createConfigProfile: (
    factoryId: string,
    body: CreateConfigProfileInput,
    options?: ApiRequestOptions,
  ) =>
    request<MachineConfigProfile>(`/v1/factories/${factoryId}/config-profiles`, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    }),

  updateConfigProfile: (
    factoryId: string,
    profileId: string,
    body: Partial<CreateConfigProfileInput>,
    options?: ApiRequestOptions,
  ) =>
    request<MachineConfigProfile>(`/v1/factories/${factoryId}/config-profiles/${profileId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      ...options,
    }),

  deleteConfigProfile: (factoryId: string, profileId: string, options?: ApiRequestOptions) =>
    request<void>(`/v1/factories/${factoryId}/config-profiles/${profileId}`, {
      method: 'DELETE',
      ...options,
    }),

  applyConfigProfile: (factoryId: string, profileId: string, options?: ApiRequestOptions) =>
    request<MachineConfigProfile>(
      `/v1/factories/${factoryId}/config-profiles/${profileId}/apply`,
      { method: 'POST', body: '{}', ...options },
    ),

  workers: (
    factoryId: string,
    params?: PaginationParams & { status?: string },
    options?: ApiRequestOptions,
  ) =>
    request<{ factory_id: string; workers: Worker[] } & PaginatedMeta>(
      `/v1/factories/${factoryId}/workers${qs(params)}`,
      options,
    ),

  createWorker: (factoryId: string, body: CreateWorkerInput, options?: ApiRequestOptions) =>
    request<Worker>(`/v1/factories/${factoryId}/workers`, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    }),

  updateWorker: (
    factoryId: string,
    workerId: string,
    body: Partial<CreateWorkerInput>,
    options?: ApiRequestOptions,
  ) =>
    request<Worker>(`/v1/factories/${factoryId}/workers/${workerId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      ...options,
    }),

  deleteWorker: (factoryId: string, workerId: string, options?: ApiRequestOptions) =>
    request<void>(`/v1/factories/${factoryId}/workers/${workerId}`, {
      method: 'DELETE',
      ...options,
    }),

  schedules: (
    factoryId: string,
    params?: PaginationParams & {
      from?: string;
      to?: string;
      worker_id?: string;
      shift?: string;
      status?: string;
    },
    options?: ApiRequestOptions,
  ) =>
    request<{ factory_id: string; schedules: WorkerSchedule[] } & PaginatedMeta>(
      `/v1/factories/${factoryId}/schedules${qs(params)}`,
      options,
    ),

  createSchedule: (factoryId: string, body: CreateScheduleInput, options?: ApiRequestOptions) =>
    request<WorkerSchedule>(`/v1/factories/${factoryId}/schedules`, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    }),

  updateSchedule: (
    factoryId: string,
    scheduleId: string,
    body: Partial<CreateScheduleInput>,
    options?: ApiRequestOptions,
  ) =>
    request<WorkerSchedule>(`/v1/factories/${factoryId}/schedules/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      ...options,
    }),

  deleteSchedule: (factoryId: string, scheduleId: string, options?: ApiRequestOptions) =>
    request<void>(`/v1/factories/${factoryId}/schedules/${scheduleId}`, {
      method: 'DELETE',
      ...options,
    }),

  factoryUsers: (
    factoryId: string,
    params?: PaginationParams & { status?: string },
    options?: ApiRequestOptions,
  ) =>
    request<{ factory_id: string; users: import('./auth-types').AuthUser[] } & PaginatedMeta>(
      `/v1/factories/${factoryId}/users${qs(params)}`,
      options,
    ),

  approveUser: (factoryId: string, userId: string, options?: ApiRequestOptions) =>
    request<import('./auth-types').AuthUser>(
      `/v1/factories/${factoryId}/users/${userId}/approve`,
      { method: 'PATCH', body: '{}', ...options },
    ),

  adminFactories: (options?: ApiRequestOptions) =>
    request<{ factories: Factory[] }>('/v1/admin/factories', options),

  adminUsers: (
    params?: PaginationParams & { factory_id?: string; status?: string },
    options?: ApiRequestOptions,
  ) =>
    request<{ users: import('./auth-types').AuthUser[] } & PaginatedMeta>(
      `/v1/admin/users${qs(params)}`,
      options,
    ),

  onboardFactory: (body: Record<string, unknown>, options?: ApiRequestOptions) =>
    request<{ factory: Factory; admin: import('./auth-types').AuthUser }>('/v1/admin/factories', {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    }),
};

export { ApiError };
