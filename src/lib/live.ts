/**
 * A camera's live view (firmware 2.9.5; query-api live.js), only while someone watches: the page asks the server
 * to start the camera and gets a link to its stream, an MJPEG the browser plays in a plain <img> (every browser,
 * phones too), served straight from the API so the dashboard's proxy never holds it. Closing the view ends the
 * stream; the server stops the camera soon after, so the factory's internet is not used up.
 */

export interface LiveStatus {
  /** Someone asked for it lately or watches it. */
  live: boolean;
  viewers: number;
  frames: number;
  last_frame_at: string | null;
  /** Frames a second, as they arrive. */
  fps: number;
}

export interface LiveStart extends LiveStatus {
  /** The stream: open it within two minutes. */
  stream: string;
  fps_asked: number;
  /** A stream ends after this long (Keep watching opens another). */
  session_s: number;
}

/** Where the requests go: a factory's Cameras page, or ops (null: our super admin, the Boards page). */
export type LiveScope = { factoryId: string } | null;

export function livePath(scope: LiveScope, boardId: string): string {
  const board = encodeURIComponent(boardId);
  return scope ? `/v1/factories/${encodeURIComponent(scope.factoryId)}/cameras/${board}/live` : `/v1/admin/boards/${board}/live`;
}

/** Why it would not start: its firmware has no live view, it is offline, or something else (the message says). */
export function liveRefusal(err: unknown): 'update-firmware' | 'offline' | 'other' {
  const code = (err as { body?: { code?: unknown } } | null)?.body?.code;
  return code === 'update-firmware' || code === 'offline' ? code : 'other';
}

/** The origin live streams come from, for the page's image policy (middleware): the API's public address. */
export function liveImageOrigin(env: { API_PUBLIC_ORIGIN?: string; API_INTERNAL_URL?: string }): string | null {
  for (const value of [env.API_PUBLIC_ORIGIN, env.API_INTERNAL_URL]) {
    if (!value?.trim()) continue;
    try {
      const url = new URL(value.trim());
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin;
    } catch {
      // not a URL: the next one
    }
  }
  return null;
}
