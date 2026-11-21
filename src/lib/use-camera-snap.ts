'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import { camerasQueryKey, type Camera } from '@/lib/cameras';

/** How long a camera gets to upload the picture asked for before the page stops looking for it. */
export const SNAP_WAIT_MS = 45_000;
const SNAP_POLL_MS = 3_000;

/**
 * "Take a picture": asks the camera (a snap counter in its retained settings), then re-reads the page's
 * data every few seconds until a new picture is there or the wait runs out.
 */
export function useCameraSnap(factoryId: string, camera: Pick<Camera, 'board_id' | 'last_picture'>) {
  const queryClient = useQueryClient();
  const [since, setSince] = useState<{ at: number; pictureId: number | null } | null>(null);
  const currentId = camera.last_picture?.id ?? null;
  const mutation = useMutation({
    mutationFn: () => api.snapCamera(factoryId, camera.board_id),
    onSuccess: () => setSince({ at: Date.now(), pictureId: currentId }),
  });

  // Asked, and the new picture has not arrived yet (the ask is forgotten when the wait runs out).
  const waiting = since !== null && currentId === since.pictureId;

  useEffect(() => {
    if (!since || currentId !== since.pictureId) return;
    const left = SNAP_WAIT_MS - (Date.now() - since.at);
    if (left <= 0) return;
    const poll = setInterval(() => queryClient.invalidateQueries({ queryKey: camerasQueryKey(factoryId) }), SNAP_POLL_MS);
    const stop = setTimeout(() => setSince(null), left);
    return () => {
      clearInterval(poll);
      clearTimeout(stop);
    };
  }, [since, currentId, queryClient, factoryId]);

  return {
    take: () => mutation.mutate(),
    pending: mutation.isPending,
    waiting,
    error: mutation.error as Error | null,
  };
}
