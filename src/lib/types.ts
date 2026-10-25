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
  /** Raw page / section switches as stored (only the keys staff changed). */
  features?: Record<string, boolean>;
  /** Every page and section switch resolved to on/off (lib/display.ts). */
  display?: import('./display').Display;
  /** Accent colour and logo set by our staff (lib/branding.ts). */
  branding?: import('./branding').FactoryBranding;
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
  /** Proximity pulses per production unit (e.g. rotations per metre). 1 = every pulse is a unit. */
  rotations_per_unit?: number;
  /** Production unit name, e.g. "m", "cm"; null = plain units. */
  unit_label?: string | null;
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
  /** null = unknown (no observed time); never shown as 0 %. */
  availability_percent: number | null;
  /** Speed while running vs the machine's target; null without a target or a production count. */
  throughput_percent: number | null;
  /** availability × throughput; null when either is unknown. */
  performance_percent: number | null;
  units_produced: number;
  unit_label?: string | null;
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
  unit_label?: string | null;
  rotations_per_unit?: number;
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
  /** Units: proximity pulses / rotations_per_unit. */
  units_produced: number;
  /** Raw proximity pulses behind units_produced. */
  pulses?: number;
  unit_label?: string | null;
  rotations_per_unit?: number;
  status: string;
  data_points?: number;
}

export interface ProductionResponse {
  factory_id: string;
  from: string;
  to: string;
  total_units: number;
  /** Unit name all producing machines share; 'mixed' when they differ; null = plain units. */
  unit_label?: string | null;
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

/** A power cut the board reported (it restarted after power-on / brownout): its last heartbeat before → it started again. */
export interface UptimePowerCut {
  from: string;
  to: string;
}

export interface UptimeStream {
  binding_id: string | null;
  label: string;
  channel_slot?: string;
  device_id?: string | null;
  machine_id?: string;
  machine_name?: string;
  display_name?: string;
  up_hours: number;
  down_hours: number;
  offline_hours?: number;
  idle_hours?: number;
  availability_percent: number | null;
  live_status?: UptimeStatus;
  live_since?: string | null;
  timeline: UptimeSegment[];
  /** Power cuts in the timeline window (backend, firmware 2.0.3+). */
  power_cuts?: UptimePowerCut[];
  detail_timeline?: UptimeSegment[];
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
  /** Power cuts in the timeline window (backend, firmware 2.0.3+). */
  power_cuts?: UptimePowerCut[];
  /** Last 2h zoom — same segments, wider pixels for recent transitions. */
  detail_timeline?: UptimeSegment[];
  /** When sensor_bindings exist — one timeline per labeled channel. */
  streams?: UptimeStream[];
}

export interface SensorBinding {
  binding_id?: string;
  factory_id?: string;
  device_id?: string;
  channel_slot: string;
  sensor_type: string;
  label: string;
  machine_id: string;
  line_id?: string | null;
  on_threshold_a?: number | null;
  enabled: boolean;
  sort_order?: number;
}

export interface NodeDetailResponse {
  device: {
    device_id: string;
    factory_id: string;
    line_id: string;
    device_type: string | null;
    last_seen_at: string | null;
  };
  bindings: SensorBinding[];
  discovered_channels: Array<{
    channel_slot: string;
    sensor_type: string;
    sample_name?: string | null;
  }>;
  machines: Array<{ machine_id: string; name: string; line_id: string }>;
}

export interface FactoryNodeSummary {
  device_id: string;
  line_id: string;
  device_type: string | null;
  last_seen_at: string | null;
  binding_count: number;
}

export interface ShiftReportScheduleResponse {
  factory_id: string;
  enabled: boolean;
  recipient_emails: string[];
  last_sent: Record<string, string>;
  updated_at: string | null;
  shifts?: Shift[];
  platform_scheduler_enabled?: boolean;
  email_delivery_configured?: boolean;
}

export interface ShiftReportJobSettings {
  job_id: string;
  enabled: boolean;
  tick_minutes: number;
  last_run_at: string | null;
  last_run_result: Record<string, unknown>;
  updated_at: string | null;
}

export interface ShiftReportAdminOverview {
  job: ShiftReportJobSettings;
  email_configured: boolean;
  factory_schedules: Array<{
    factory_id: string;
    factory_name?: string;
    enabled: boolean;
    recipient_emails: string[];
    last_sent: Record<string, string>;
    updated_at: string | null;
  }>;
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
  board_email_configured?: boolean;
  board_email_from?: string;
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
  machine_ids?: string[];
  line_id?: string;
  key: string;
  value: string | number;
  unit?: string;
  description?: string;
}
