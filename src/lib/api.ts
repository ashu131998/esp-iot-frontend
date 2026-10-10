import type {
  ActiveAssignmentsResponse,
  AlertSettings,
  AvailabilityResponse,
  ConfigSelection,
  DowntimeReason,
  DowntimeReport,
  NotificationItem,
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
  ShiftReportScheduleResponse,
  ShiftReportAdminOverview,
  NodeDetailResponse,
  FactoryNodeSummary,
  SensorBinding,
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
      type?: string;
      latest?: string;
      stale_minutes?: number;
      device_id?: string;
      stale_only?: string | boolean;
      q?: string;
      line_id?: string;
      action?: string;
      actor?: string;
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

  shiftReportSchedule: (factoryId: string, options?: ApiRequestOptions) =>
    request<ShiftReportScheduleResponse>(
      `/v1/factories/${factoryId}/shift-report-schedule`,
      options,
    ),

  updateShiftReportSchedule: (
    factoryId: string,
    body: { enabled: boolean; recipient_emails: string[] },
    options?: ApiRequestOptions,
  ) =>
    request<ShiftReportScheduleResponse>(
      `/v1/factories/${factoryId}/shift-report-schedule`,
      { method: 'PUT', body: JSON.stringify(body), ...options },
    ),

  testShiftReportSchedule: (
    factoryId: string,
    body?: { recipient_emails?: string[] },
    options?: ApiRequestOptions,
  ) =>
    request<{ ok: boolean; recipients: string[]; message_id?: string }>(
      `/v1/factories/${factoryId}/shift-report-schedule/test`,
      { method: 'POST', body: JSON.stringify(body ?? {}), ...options },
    ),

  factoryNodes: (factoryId: string, options?: ApiRequestOptions) =>
    request<{ factory_id: string; nodes: FactoryNodeSummary[] }>(
      `/v1/factories/${factoryId}/nodes`,
      options,
    ),

  nodeDetail: (factoryId: string, deviceId: string, options?: ApiRequestOptions) =>
    request<NodeDetailResponse>(`/v1/factories/${factoryId}/nodes/${deviceId}`, options),

  replaceNodeSensorBindings: (
    factoryId: string,
    deviceId: string,
    bindings: SensorBinding[],
    options?: ApiRequestOptions,
  ) =>
    request<{ factory_id: string; device_id: string; bindings: SensorBinding[] }>(
      `/v1/factories/${factoryId}/nodes/${deviceId}/sensor-bindings`,
      { method: 'PUT', body: JSON.stringify({ bindings }), ...options },
    ),

  sensorBindings: (
    factoryId: string,
    params?: { device_id?: string; machine_id?: string },
    options?: ApiRequestOptions,
  ) =>
    request<{ factory_id: string; bindings: SensorBinding[] }>(
      `/v1/factories/${factoryId}/sensor-bindings${qs(params)}`,
      options,
    ),

  adminNodeDetail: (factoryId: string, deviceId: string, options?: ApiRequestOptions) =>
    request<NodeDetailResponse>(`/v1/admin/nodes/${factoryId}/${deviceId}`, options),

  adminReplaceNodeSensorBindings: (
    factoryId: string,
    deviceId: string,
    bindings: SensorBinding[],
    options?: ApiRequestOptions,
  ) =>
    request<{ factory_id: string; device_id: string; bindings: SensorBinding[] }>(
      `/v1/admin/nodes/${factoryId}/${deviceId}/sensor-bindings`,
      { method: 'PUT', body: JSON.stringify({ bindings }), ...options },
    ),

  adminCreateLine: (
    factoryId: string,
    body: { line_id: string; name?: string },
    options?: ApiRequestOptions,
  ) =>
    request<{ factory_id: string; line: ProductionLine }>(
      `/v1/admin/factories/${factoryId}/lines`,
      { method: 'POST', body: JSON.stringify(body), ...options },
    ),

  adminCreateMachine: (
    factoryId: string,
    body: {
      machine_id: string;
      line_id: string;
      name: string;
      type?: string;
      voltage_v?: number;
      target_cycle_time_sec?: number;
      target_units_per_hour?: number;
    },
    options?: ApiRequestOptions,
  ) =>
    request<{ factory_id: string; machine: Machine }>(
      `/v1/admin/factories/${factoryId}/machines`,
      { method: 'POST', body: JSON.stringify(body), ...options },
    ),

  adminRegisterDevice: (
    body: {
      factory_id: string;
      line_id: string;
      device_id: string;
      device_type?: string;
      bindings?: SensorBinding[];
    },
    options?: ApiRequestOptions,
  ) =>
    request<NodeDetailResponse>('/v1/admin/devices', {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    }),

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
    request<
      MachineConfiguration | { factory_id: string; configurations: MachineConfiguration[] }
    >(`/v1/factories/${factoryId}/configurations`, {
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
    request<MachineConfigProfile | { factory_id: string; profiles: MachineConfigProfile[] }>(
      `/v1/factories/${factoryId}/config-profiles`,
      {
        method: 'POST',
        body: JSON.stringify(body),
        ...options,
      },
    ),

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

  alertSettings: (factoryId: string, options?: ApiRequestOptions) =>
    request<AlertSettings>(`/v1/factories/${factoryId}/alert-settings`, options),

  updateAlertSettings: (
    factoryId: string,
    body: Partial<Omit<AlertSettings, 'factory_id' | 'updated_at' | 'mobile_configured' | 'alertops_configured'>>,
    options?: ApiRequestOptions,
  ) =>
    request<AlertSettings>(`/v1/factories/${factoryId}/alert-settings`, {
      method: 'PUT',
      body: JSON.stringify(body),
      ...options,
    }),

  notifications: (
    factoryId: string,
    params?: PaginationParams & { type?: string },
    options?: ApiRequestOptions,
  ) =>
    request<{ factory_id: string; notifications: NotificationItem[] } & PaginatedMeta>(
      `/v1/factories/${factoryId}/notifications${qs(params)}`,
      options,
    ),

  sendTestNotification: (
    factoryId: string,
    body: { phone: string; message?: string },
    options?: ApiRequestOptions,
  ) =>
    request<{ ok: boolean; channel: string; error: string | null }>(
      `/v1/factories/${factoryId}/notifications/test`,
      { method: 'POST', body: JSON.stringify(body), ...options },
    ),

  sendTestPush: (
    factoryId: string,
    body: { worker_id: string; message?: string },
    options?: ApiRequestOptions,
  ) =>
    request<{
      ok: boolean;
      channel: string;
      error: string | null;
      recipient_count: number | null;
    }>(`/v1/factories/${factoryId}/notifications/test-push`, {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    }),

  downtimeReasons: (factoryId: string, options?: ApiRequestOptions) =>
    request<{ reasons: DowntimeReason[] }>(
      `/v1/factories/${factoryId}/downtime-reasons`,
      options,
    ),

  downtimeReports: (
    factoryId: string,
    params?: DateRangeParams & PaginationParams & { machine_id?: string },
    options?: ApiRequestOptions,
  ) =>
    request<{ factory_id: string; reports: DowntimeReport[] } & PaginatedMeta>(
      `/v1/factories/${factoryId}/downtime-reports${qs(params)}`,
      options,
    ),

  setDowntimeReason: (
    factoryId: string,
    reportId: string,
    body: { reason_code: string },
    options?: ApiRequestOptions,
  ) =>
    request<DowntimeReport>(`/v1/factories/${factoryId}/downtime-reports/${reportId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
      ...options,
    }),

  configSelections: (
    factoryId: string,
    params?: PaginationParams & { machine_id?: string; latest?: string },
    options?: ApiRequestOptions,
  ) =>
    request<{ factory_id: string; selections: ConfigSelection[]; total: number }>(
      `/v1/factories/${factoryId}/config-selections${qs(params)}`,
      options,
    ),

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

  adminUpdateFactoryFeatures: (
    factoryId: string,
    features: import('./factory-features').FactoryFeatures,
    options?: ApiRequestOptions,
  ) =>
    request<{ factory_id: string; features: import('./factory-features').FactoryFeatures }>(
      `/v1/admin/factories/${factoryId}/features`,
      { method: 'PATCH', body: JSON.stringify(features), ...options },
    ),

  adminSummary: (params?: { stale_minutes?: number }, options?: ApiRequestOptions) =>
    request<{
      factory_count: number;
      device_count: number;
      device_stale_count: number;
      stale_threshold_minutes: number;
    }>(`/v1/admin/summary${qs(params)}`, options),

  adminShiftReportJob: (options?: ApiRequestOptions) =>
    request<ShiftReportAdminOverview>('/v1/admin/jobs/shift-reports', options),

  adminUpdateShiftReportJob: (
    body: { enabled: boolean; tick_minutes?: number },
    options?: ApiRequestOptions,
  ) =>
    request<ShiftReportAdminOverview>('/v1/admin/jobs/shift-reports', {
      method: 'PUT',
      body: JSON.stringify(body),
      ...options,
    }),

  adminRunShiftReportJob: (options?: ApiRequestOptions) =>
    request<{ ran_at: string; results: unknown[] }>('/v1/admin/jobs/shift-reports/run', {
      method: 'POST',
      body: '{}',
      ...options,
    }),

  adminHealth: (params?: { stale_minutes?: number }, options?: ApiRequestOptions) =>
    request<{
      postgres: string;
      checked_at: string;
      error?: string;
      summary?: {
        factory_count: number;
        device_count: number;
        device_stale_count: number;
        stale_threshold_minutes: number;
      };
      aggregator?: {
        pending_failures: number;
        failures_since: string | null;
        last_pass_at: string | null;
        last_stats: Record<string, unknown>;
        updated_at: string | null;
      } | null;
    }>(`/v1/admin/health${qs(params)}`, options),

  adminDevices: (
    params?: PaginationParams & {
      factory_id?: string;
      line_id?: string;
      machine_id?: string;
      stale_minutes?: number;
      stale_only?: string | boolean;
      q?: string;
    },
    options?: ApiRequestOptions,
  ) =>
    request<{
      devices: Array<{
        device_id: string;
        factory_id: string;
        line_id: string;
        device_type: string;
        last_seen_at: string | null;
        is_stale: boolean;
        machines?: Array<{
          machine_id: string;
          name: string;
          line_id: string;
          factory_id: string;
        }>;
      }>;
      total: number;
      limit: number;
      offset: number;
      stale_threshold_minutes?: number;
    }>(`/v1/admin/devices${qs(params)}`, options),

  readingsRecent: (
    factoryId: string,
    params?: { device_id?: string; limit?: number },
    options?: ApiRequestOptions,
  ) =>
    request<{
      factory_id: string;
      limit: number;
      devices: Array<{
        device_id: string;
        line_id: string;
        device_type: string;
        last_seen_at: string | null;
        current: Array<{
          state?: string;
          amps?: number | null;
          amps_min?: number | null;
          amps_max?: number | null;
          occurred_at: string;
          metadata?: Record<string, unknown>;
        }>;
        cycle: Array<{
          count?: number;
          rotations?: number | null;
          running?: boolean | null;
          window_s?: number | null;
          occurred_at: string;
          metadata?: Record<string, unknown>;
        }>;
      }>;
    }>(`/v1/factories/${factoryId}/readings/recent${qs(params)}`, options),

  readingsRange: (
    factoryId: string,
    params: { device_id: string; from: string; to: string; limit?: number },
    options?: ApiRequestOptions,
  ) =>
    request<{
      factory_id: string;
      device: { device_id: string; line_id: string; device_type: string; last_seen_at: string | null };
      from: string;
      to: string;
      limit: number;
      current: Array<{
        state?: string;
        amps?: number | null;
        amps_min?: number | null;
        amps_max?: number | null;
        occurred_at: string;
        metadata?: Record<string, unknown>;
      }>;
      cycle: Array<{
        count?: number;
        rotations?: number | null;
        running?: boolean | null;
        window_s?: number | null;
        occurred_at: string;
        metadata?: Record<string, unknown>;
      }>;
    }>(`/v1/factories/${factoryId}/readings/range${qs(params)}`, options),

  adminAudit: (
    params?: PaginationParams & { action?: string; actor?: string; from?: string; to?: string },
    options?: ApiRequestOptions,
  ) =>
    request<{ entries: unknown[]; total: number; limit: number; offset: number }>(
      `/v1/admin/audit${qs(params)}`,
      options,
    ),

  createStaff: (
    body: { username: string; password: string; role: 'internal_admin' | 'internal_viewer'; email?: string },
    options?: ApiRequestOptions,
  ) =>
    request<import('./auth-types').AuthUser>('/v1/admin/staff', {
      method: 'POST',
      body: JSON.stringify(body),
      ...options,
    }),

  adminResetPassword: (userId: string, password: string, options?: ApiRequestOptions) =>
    request<import('./auth-types').AuthUser>(`/v1/admin/users/${userId}/password`, {
      method: 'POST',
      body: JSON.stringify({ password }),
      ...options,
    }),

  adminUpdateUser: (
    userId: string,
    body: { status?: import('./auth-types').UserStatus; role?: import('./auth-types').Role },
    options?: ApiRequestOptions,
  ) =>
    request<import('./auth-types').AuthUser>(`/v1/admin/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      ...options,
    }),
};

export { ApiError };
