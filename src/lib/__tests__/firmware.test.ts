import { describe, expect, it } from 'vitest';

import {
  boardTargetOf, fileToBase64, installsRemoteUpdates, parseReleaseSignature, updateStatus, versionsFor, type FirmwareRelease,
} from '@/lib/firmware';

const SIG = { format: 'floorbeat-fw/1', target: 'rev-b', version: '2.2.1-uni', size: 1136464, sha256: 'ab', signature: 'MEQ=' };

describe('parseReleaseSignature', () => {
  it('the signing tool\'s .sig.json', () => {
    expect(parseReleaseSignature(JSON.stringify(SIG))).toEqual({ target: 'rev-b', version: '2.2.1-uni', size: 1136464, sha256: 'ab', signature: 'MEQ=' });
  });

  it('anything else: a reason', () => {
    expect(() => parseReleaseSignature('not json')).toThrow(/not JSON/);
    expect(() => parseReleaseSignature(JSON.stringify({ ...SIG, format: 'x' }))).toThrow(/Not a firmware signature/);
    expect(() => parseReleaseSignature(JSON.stringify({ ...SIG, size: '5' }))).toThrow(/incomplete/);
  });
});

describe('which boards take which releases', () => {
  const releases: FirmwareRelease[] = [
    { target: 'rev-b', version: '2.2.0-uni', size: 1, sha256: '', notes: null, uploaded_by: null, uploaded_at: '2026-10-26T10:00:00Z' },
    { target: 'rev-b', version: '2.2.1-uni', size: 1, sha256: '', notes: null, uploaded_by: null, uploaded_at: '2026-10-27T10:00:00Z' },
    { target: 'rev-a2', version: '2.2.1-uni', size: 1, sha256: '', notes: null, uploaded_by: null, uploaded_at: '2026-10-27T10:00:00Z' },
  ];

  it('hardware from the board (2.2+), else its name', () => {
    expect(boardTargetOf({ board_id: 'x', beat: { hw: 'rev-a2' } })).toBe('rev-a2');
    expect(boardTargetOf({ board_id: 'revb-311d80', beat: { fw: '2.0.8-uni' } })).toBe('rev-b');
    expect(boardTargetOf({ board_id: 'loom-1', beat: null })).toBeNull();
  });

  it('its hardware\'s releases, newest first, without what it runs', () => {
    expect(versionsFor(releases, { board_id: 'revb-304ad0', beat: { fw: '2.2.0-uni', hw: 'rev-b' } }).map((r) => r.version)).toEqual(['2.2.1-uni']);
    expect(versionsFor(releases, { board_id: 'revb-304ad0', beat: { fw: '2.1.1-uni' } }).map((r) => r.version)).toEqual(['2.2.1-uni', '2.2.0-uni']);
  });

  it('remote updates from firmware 2.2 on', () => {
    expect(['2.2.0-uni', '2.10.1', '3.0.0'].map(installsRemoteUpdates)).toEqual([true, true, true]);
    expect(['2.1.1-uni', '1.9.0', '', null, undefined].map(installsRemoteUpdates)).toEqual([false, false, false, false, false]);
  });
});

describe('updateStatus', () => {
  it('from its heartbeats: downloading, starting, installed, failed, rolled back', () => {
    expect(updateStatus({ ota_version: '2.2.1-uni', beat: { ota_state: 'downloading', ota_version: '2.2.1-uni', ota_pct: 45 } }))
      .toMatchObject({ label: 'Downloading 2.2.1-uni 45%', tone: 'neutral' });
    expect(updateStatus({ ota_version: null, beat: { ota_state: 'available', ota_version: '2.2.1-uni' } }).label).toBe('Starting 2.2.1-uni');
    expect(updateStatus({ ota_version: null, beat: { ota_state: 'installed', ota_version: '2.2.1-uni' } }).label).toBe('Installed 2.2.1-uni');
    expect(updateStatus({ ota_version: '2.2.1-uni', beat: { ota_state: 'failed', ota_error: 'download: HTTP 403' } }))
      .toEqual({ label: 'Update failed', tone: 'bad', detail: 'download: HTTP 403' });
    expect(updateStatus({ ota_version: '2.2.1-uni', beat: { ota_state: 'rolled-back' } }).tone).toBe('bad');
  });

  it('from what was offered: done (it runs it), or waiting; nothing offered', () => {
    expect(updateStatus({ ota_version: '2.2.1-uni', beat: { fw: '2.2.1-uni' } })).toMatchObject({ label: 'Updated to 2.2.1-uni', tone: 'good' });
    expect(updateStatus({ ota_version: '2.2.1-uni', beat: { fw: '2.2.0-uni' } }).label).toBe('Offered 2.2.1-uni');
    expect(updateStatus({ ota_version: null, beat: null }).label).toBe('—');
  });
});

describe('fileToBase64', () => {
  it('bytes as base64, also past one chunk', async () => {
    const bytes = new Uint8Array(70_000).map((_, i) => i % 251);
    const b64 = await fileToBase64(new Blob([bytes]));
    expect(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))).toEqual(bytes);
  });
});
