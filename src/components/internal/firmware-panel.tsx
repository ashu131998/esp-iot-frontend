'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { TableSkeleton } from '@/components/ui/page-skeletons';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { isSuperAdmin } from '@/lib/auth-types';
import { formatBytes } from '@/lib/board-status';
import {
  fileToBase64, parseReleaseSignature, targetLabel, type FirmwareRelease, type ReleaseSignature,
} from '@/lib/firmware';
import { formatDate } from '@/lib/utils';

export const FIRMWARE_KEY = ['admin-firmware'];

function UploadDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [image, setImage] = useState<File | null>(null);
  const [sig, setSig] = useState<ReleaseSignature | null>(null);
  const [sigError, setSigError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const sizeMismatch = Boolean(image && sig && image.size !== sig.size);
  const upload = useMutation({
    mutationFn: async () => {
      if (!image || !sig) throw new Error('Choose the image and its signature file');
      return api.adminFirmwareUpload({ ...sig, image_base64: await fileToBase64(image), notes: notes || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FIRMWARE_KEY });
      onClose();
    },
  });
  const readSig = async (file: File | undefined) => {
    setSig(null);
    setSigError(null);
    if (!file) return;
    try {
      setSig(parseReleaseSignature(await file.text()));
    } catch (err) {
      setSigError((err as Error).message);
    }
  };
  return (
    <Modal open onClose={onClose} title="Upload a release">
      <p className="mb-3 text-sm">
        Both files come from the signing tool (<span className="font-mono text-xs">tools/sign_firmware.sh</span>):
        the image and its signature. The server checks the signature before keeping it; the board checks it again.
      </p>
      <div className="space-y-3">
        <Field label="Image (.bin)">
          <Input type="file" accept=".bin,application/octet-stream" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        </Field>
        <Field label="Signature (.sig.json)">
          <Input type="file" accept=".json,application/json" onChange={(e) => readSig(e.target.files?.[0])} />
        </Field>
        {sigError && <p className="text-xs text-red-700">{sigError}</p>}
        {sig && (
          <p className="text-xs">
            {sig.version} for {targetLabel(sig.target)} · {formatBytes(sig.size)}
            {sizeMismatch && <span className="text-red-700"> — the image chosen is a different size</span>}
          </p>
        )}
        <Field label="Notes (optional)">
          <Input value={notes} maxLength={500} placeholder="What changed" onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      {upload.isError && <p className="mt-3 text-xs text-red-700">{(upload.error as Error).message}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!image || !sig || sizeMismatch || upload.isPending} onClick={() => upload.mutate()}>
          {upload.isPending ? 'Uploading…' : 'Upload'}
        </Button>
      </div>
    </Modal>
  );
}

function DeleteConfirm({ release, onClose }: { release: FirmwareRelease; onClose: () => void }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => api.adminFirmwareDelete(release.target, release.version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FIRMWARE_KEY });
      onClose();
    },
  });
  return (
    <Modal open onClose={onClose} title={`Delete ${release.version} (${targetLabel(release.target)})`}>
      <p className="text-sm">A board it is still offered to will fail to download it.</p>
      {remove.isError && <p className="mt-3 text-xs text-red-700">{(remove.error as Error).message}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={remove.isPending} onClick={() => remove.mutate()}>{remove.isPending ? 'Deleting…' : 'Delete'}</Button>
      </div>
    </Modal>
  );
}

export function FirmwarePanel() {
  const { user } = useAuth();
  const canChange = isSuperAdmin(user);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<FirmwareRelease | null>(null);
  const releasesQuery = useQuery({ queryKey: FIRMWARE_KEY, queryFn: ({ signal }) => api.adminFirmware({ signal }) });
  const releases = releasesQuery.data?.releases ?? [];

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Card className="p-6">
        <CardHeader
          title="Releases"
          description="Boards on firmware 2.2 or later install these when offered; a new image that does not prove healthy rolls back by itself"
          action={canChange && <Button size="sm" onClick={() => setUploading(true)}>Upload release</Button>}
        />
        {releasesQuery.isError ? (
          <p className="text-sm text-red-600">{(releasesQuery.error as Error).message}</p>
        ) : releasesQuery.isPending ? (
          <TableSkeleton rows={3} cols={6} />
        ) : releases.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No releases uploaded yet.</p>
        ) : (
          <Table className="border-0">
            <THead>
              <TR>
                <TH>Version</TH><TH>Hardware</TH><TH>Size</TH><TH>SHA-256</TH><TH>Uploaded</TH><TH>Notes</TH>
                {canChange && <TH />}
              </TR>
            </THead>
            <TBody>
              {releases.map((r) => (
                <TR key={`${r.target}/${r.version}`}>
                  <TD className="font-mono text-xs">{r.version}</TD>
                  <TD className="text-xs">{targetLabel(r.target)}</TD>
                  <TD className="text-xs">{formatBytes(r.size)}</TD>
                  <TD className="font-mono text-xs"><span title={r.sha256}>{r.sha256.slice(0, 12)}…</span></TD>
                  <TD className="text-xs">{formatDate(r.uploaded_at)}{r.uploaded_by ? ` · ${r.uploaded_by}` : ''}</TD>
                  <TD className="text-xs">{r.notes ?? ''}</TD>
                  {canChange && (
                    <TD><Button size="sm" variant="secondary" onClick={() => setDeleting(r)}>Delete</Button></TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
      {uploading && <UploadDialog onClose={() => setUploading(false)} />}
      {deleting && <DeleteConfirm release={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}
