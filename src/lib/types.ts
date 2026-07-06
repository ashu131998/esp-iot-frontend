export interface Shift {
  shift_id: string;
  name: string;
  start_hour: number;
  end_hour: number;
  duration_hours: number;
  label: string;
}

export interface Factory {
  factory_id: string;
  name: string;
  location: string | null;
  timezone: string;
  tier: string;
  shifts?: Shift[];
  shifts_per_day?: number;
  shift_hours?: number;
  machine_count: number;
  device_count: number;
  line_count: number;
  last_seen_at: string | null;
  created_at: string | null;
}

export interface ProductionLine {
  line_id: string;
  factory_id: string;
  name: string;
  created_at: string;
  last_seen_at: string | null;
}

export interface Machine {
  machine_id: string;
  factory_id: string;
  line_id: string;
  name: string;
  type: string;
  /** ESP32 node + sensor roles — up to 4 streams on one node (current, cycle, time, …). */
  devices: Record<string, string>;
  target_cycle_time_sec: number | null;
  target_units_per_hour: number | null;
  voltage_v: number;
  device_states?: Record<string, { device_id: string; readings: Record<string, unknown>; occurred_at: string } | null>;
}

export interface AvailabilityMachine {
  machine_id: string;
  machine_name: string;
  line_id: string;
  device_id?: string;
  uptime_minutes: number;
  downtime_minutes: number;
  availability_percent: number | null;
  status: string;
  data_points?: number;
}

export interface AvailabilityResponse {
  factory_id: string;
  from: string;
  to: string;
  shift?: string | null;
  avg_availability_percent: number | null;
  total_uptime_minutes: number;
  total_downtime_minutes: number;
  machines: AvailabilityMachine[];
  by_shift?: Array<{
    shift_id: string;
    name: string;
    label: string;
    from: string;
    to: string;
    avg_availability_percent: number | null;
  }>;
}

export interface EnergyMachine {
  machine_id: string;
  machine_name: string;
  line_id: string;
  device_id?: string;
  energy_kwh: number | null;
  avg_amps: number | null;
  peak_amps: number | null;
  voltage_v?: number;
  status: string;
  data_points?: number;
}

export interface EnergyResponse {
  factory_id: string;
  from: string;
  to: string;
  total_energy_kwh: number;
  machines: EnergyMachine[];
}

export interface PerformanceMachine {
  machine_id: string;
  machine_name: string;
  line_id: string;
  availability_percent: number;
  throughput_percent: number | null;
  performance_percent: number;
  units_produced: number;
  target_units: number;
  target_cycle_time_sec: number | null;
  status: string;
}

export interface PerformanceResponse {
  factory_id: string;
  from: string;
  to: string;
  avg_performance_percent: number | null;
  machines: PerformanceMachine[];
}

export interface MachineDailyTrendDay {
  date: string;
  availability_percent: number | null;
  uptime_minutes: number;
  downtime_minutes: number;
  throughput_percent: number | null;
  performance_percent: number | null;
  units_produced: number | null;
  is_live?: boolean;
}

export interface MachineDailyTrendResponse {
  machine_id: string;
  from: string;
  to: string;
  days: MachineDailyTrendDay[];
}

export interface MachineLiveDaysResponse {
  machine_id: string;
  from: string;
  to: string;
  days: MachineDailyTrendDay[];
}

export interface FactoryDailyAvailabilityDay {
  date: string;
  availability_percent: number | null;
  uptime_minutes: number;
  downtime_minutes: number;
  is_live?: boolean;
}

export interface FactoryDailyAvailabilityResponse {
  factory_id: string;
  from: string;
  to: string;
  days: FactoryDailyAvailabilityDay[];
}

export interface ProductionMachine {
  machine_id: string;
  machine_name: string;
  line_id: string;
  device_id?: string;
  units_produced: number;
  status: string;
  data_points?: number;
}

export interface ProductionResponse {
  factory_id: string;
  from: string;
  to: string;
  total_units: number;
  machines: ProductionMachine[];
}

// API segment codes (up/down/idle) — UI always shows Running | Stopped | No signal.
export type UptimeStatus = 'up' | 'down' | 'idle' | 'offline';

export interface UptimeSegment {
  from: string;
  to: string;
  duration_seconds: number;
  status: UptimeStatus;
}

export interface UptimeMachine {
  machine_id: string;
  machine_name: string;
  line_id: string;
  device_id: string | null;
  up_hours: number;
  down_hours: number;
  offline_hours: number;
  idle_hours?: number;
  availability_percent: number | null;
  /** Current loom state from the latest machine_status_event (extends to now). */
  live_status?: UptimeStatus;
  live_since?: string | null;
  timeline: UptimeSegment[];
  /** Last 2h zoom — same segments, wider pixels for recent transitions. */
  detail_timeline?: UptimeSegment[];
}

export interface UptimeResponse {
  factory_id: string;
  from: string;
  to: string;
  timeline_from: string;
  timeline_to: string;
  detail_from?: string;
  detail_to?: string;
  total_up_hours: number;
  total_down_hours: number;
  machines: UptimeMachine[];
  meta?: {
    requires_filter?: boolean;
    truncated?: boolean;
    total_machines?: number;
    returned?: number;
    message?: string;
  };
}

export interface QualityRecord {
  record_id: string;
  factory_id: string;
  machine_id: string;
  line_id: string | null;
  metric: string;
  value: number;
  unit: string;
  sample_size: number | null;
  notes: string;
  source: string;
  recorded_at: string;
  created_at: string;
  updated_at?: string;
}

export interface MachineConfiguration {
  config_id: string;
  factory_id: string;
  machine_id: string | null;
  line_id: string | null;
  key: string;
  value: string | number;
  unit: string;
  description: string;
  source: string;
  profile_id?: string;
  profile_name?: string;
  created_at: string;
  updated_at: string;
}

export interface ConfigProfileParameter {
  key: string;
  value: string | number;
  unit?: string;
  description?: string;
}

export interface MachineConfigProfile {
  profile_id: string;
  factory_id: string;
  machine_id: string;
  name: string;
  parameters: ConfigProfileParameter[];
  created_at: string;
  updated_at: string;
}

export interface CreateConfigProfileInput {
  machine_id: string;
  name: string;
  parameters: ConfigProfileParameter[];
}

export interface Worker {
  worker_id: string;
  factory_id: string;
  name: string;
  employee_code: string | null;
  role: string;
  skills: string[];
  phone: string | null;
  email: string | null;
  alertops_user_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateWorkerInput {
  name: string;
  employee_code?: string;
  role?: string;
  skills?: string[];
  phone?: string;
  status?: string;
  // Mobile-app login credentials — provisioned in AlertOps on creation.
  email?: string;
  password?: string;
}

export interface WorkerSchedule {
  schedule_id: string;
  factory_id: string;
  worker_id: string;
  worker_name?: string | null;
  worker_role?: string | null;
  task: string;
  shift_id: string;
  schedule_date: string;
  start_time: string | null;
  end_time: string | null;
  machine_ids: string[];
  config_profile_id: string | null;
  config_profile_name: string | null;
  notes: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduleInput {
  worker_id: string;
  task: string;
  shift_id: string;
  schedule_date: string;
  start_time?: string;
  end_time?: string;
  machine_ids?: string[];
  config_profile_id?: string | null;
  config_profile_name?: string | null;
  notes?: string;
  status?: string;
}

export interface ActiveAssignment {
  schedule_id: string;
  worker_id: string;
  worker_name: string | null;
  worker_role: string | null;
  worker_phone: string | null;
  task: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
}

export interface ActiveAssignmentsResponse {
  factory_id: string;
  as_of: string;
  shift_id: string;
  schedule_date: string;
  assignments: Record<string, ActiveAssignment[]>;
}

export interface PlatformOverview {
  from?: string;
  to?: string;
  factory_count: number;
  total_machines: number;
  factories: Array<{
    factory_id: string;
    name: string;
    location: string | null;
    tier: string;
    machine_count: number;
    avg_availability_percent: number | null;
    total_energy_kwh: number;
    total_units: number;
  }>;
}

export interface OwnerContact {
  name: string;
  phone: string;
}

export interface AlertSettings {
  factory_id: string;
  mobile_enabled: boolean;
  shift_reminder_minutes: number;
  notify_owner_on_down: boolean;
  owner_contacts: OwnerContact[];
  updated_at: string | null;
  mobile_configured: boolean;
  alertops_configured: boolean;
}

export interface NotificationItem {
  notification_id: string;
  factory_id: string;
  type: string;
  recipient_role: string;
  worker_id: string | null;
  recipient_name: string | null;
  phone: string | null;
  machine_id: string | null;
  message: string;
  channel: string;
  status: string;
  error: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface DowntimeReason {
  code: string;
  title: string;
  description?: string;
}

export interface DowntimeReport {
  report_id: string;
  factory_id: string;
  machine_id: string;
  machine_name: string | null;
  device_id: string | null;
  down_since: string;
  resolved_at: string | null;
  reason_code: string | null;
  reason_label: string | null;
  reported_by_worker_id: string | null;
  reported_by_name: string | null;
  reported_via: string | null;
  reason_reported_at: string | null;
  created_at: string;
}

export interface ConfigSelection {
  selection_id: string;
  factory_id: string;
  machine_id: string;
  profile_id: string;
  profile_name: string | null;
  selected_by_worker_id: string | null;
  selected_by_name: string | null;
  selected_via: string;
  effective_from: string;
  created_at: string;
}

export interface DateRangeParams {
  from?: string;
  to?: string;
  line_id?: string;
  machine_id?: string;
  /** Comma-separated machine IDs — for paginated overview mini-timelines at scale. */
  machine_ids?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface CreateQualityInput {
  machine_id: string;
  line_id?: string;
  metric: string;
  value: number;
  unit?: string;
  sample_size?: number;
  notes?: string;
  recorded_at?: string;
}

export interface CreateConfigurationInput {
  machine_id?: string;
  line_id?: string;
  key: string;
  value: string | number;
  unit?: string;
  description?: string;
}
