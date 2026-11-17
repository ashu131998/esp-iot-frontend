/**
 * The FloorBeat Alerts app (alerts.floorbeat.in): what the API gives the signed-in person
 * (query-api /v1/me/*). Safe to import from client and server code.
 */

/** One answer an alert offers (a downtime reason, a configuration): its id goes back as the reply. */
export interface AlertOption {
  id: string;
  label: string;
}

/** One alert in the person's inbox: a notifications row, with its factory's and machine's names. */
export interface MyAlert {
  notification_id: string;
  factory_id: string;
  factory_name: string | null;
  type: string;
  title: string | null;
  severity: string | null;
  message: string;
  machine_id: string | null;
  machine_name: string | null;
  payload: {
    kind?: string;
    prompt?: string;
    report_id?: string;
    options?: AlertOption[];
    [key: string]: unknown;
  } | null;
  created_at: string;
  read_at: string | null;
  resolved_at: string | null;
  /** The answer given (by this person or another it went to), once answered. */
  resolution: string | null;
}

export interface MyAlertsPage {
  items: MyAlert[];
  total: number;
  limit: number;
  offset: number;
  /** Unread alerts in all, not only on this page. */
  unread: number;
}

export interface ReplyResult {
  handled: boolean;
  kind?: string;
  resolution: string;
  /** What the alert engine says back ("Noted: changeover"), when it says anything. */
  message?: string | null;
}

export interface PushKey {
  enabled: boolean;
  public_key: string | null;
}

export interface PushSubscriptionBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface TestPushResult {
  sent: number;
  failed: number;
  gone: number;
  error?: string | null;
}

export interface Plant {
  factory_id: string;
  name: string;
}
