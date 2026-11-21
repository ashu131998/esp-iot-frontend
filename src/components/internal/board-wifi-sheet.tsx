'use client';

import { BoardWifiPanel } from '@/components/wifi/board-wifi-panel';
import { Sheet } from '@/components/ui/sheet';
import type { AdminBoard } from '@/lib/board-status';

/**
 * A board's WiFi from the Boards page (super admin), as on a phone: the networks it sees, Connect and
 * Retry, the networks it keeps. The same panel as on its factory's WiFi page (components/wifi).
 */
export function BoardWifiSheet({ board, onClose }: { board: AdminBoard; onClose: () => void }) {
  return (
    <Sheet title={`WiFi · ${board.board_id}`} onClose={onClose}>
      <BoardWifiPanel scope={null} boardId={board.board_id} />
    </Sheet>
  );
}
