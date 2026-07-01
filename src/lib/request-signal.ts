export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;

export type ApiRequestOptions = {
  signal?: AbortSignal | null;
  timeoutMs?: number;
};

export function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  return error instanceof Error && error.name === 'AbortError';
}

export interface RequestSignalHandle {
  signal: AbortSignal;
  cleanup: () => void;
}

/** Merge caller signal with a timeout using AbortController (and AbortSignal.any when available). */
export function createRequestSignal(options: ApiRequestOptions = {}): RequestSignalHandle {
  const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const external = options.signal ?? undefined;

  if (!external) {
    return { signal: timeoutSignal, cleanup: () => {} };
  }

  if (typeof AbortSignal.any === 'function') {
    return { signal: AbortSignal.any([external, timeoutSignal]), cleanup: () => {} };
  }

  const controller = new AbortController();
  const abortFrom = (source: AbortSignal) => {
    if (!controller.signal.aborted) controller.abort(source.reason);
  };

  if (external.aborted) {
    abortFrom(external);
    return { signal: controller.signal, cleanup: () => {} };
  }
  if (timeoutSignal.aborted) {
    abortFrom(timeoutSignal);
    return { signal: controller.signal, cleanup: () => {} };
  }

  const onExternalAbort = () => abortFrom(external);
  const onTimeoutAbort = () => abortFrom(timeoutSignal);
  external.addEventListener('abort', onExternalAbort, { once: true });
  timeoutSignal.addEventListener('abort', onTimeoutAbort, { once: true });

  return {
    signal: controller.signal,
    cleanup: () => {
      external.removeEventListener('abort', onExternalAbort);
      timeoutSignal.removeEventListener('abort', onTimeoutAbort);
    },
  };
}

/** fetch wrapper that honours caller abort + request timeout. */
export async function fetchWithSignal(
  input: RequestInfo | URL,
  init?: RequestInit & ApiRequestOptions,
): Promise<Response> {
  const { signal, timeoutMs, ...fetchInit } = init ?? {};
  const { signal: requestSignal, cleanup } = createRequestSignal({ signal, timeoutMs });

  try {
    return await fetch(input, { ...fetchInit, signal: requestSignal });
  } finally {
    cleanup();
  }
}
