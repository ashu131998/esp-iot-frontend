import { BoardsPanel } from '@/components/internal/boards-panel';
import { PageHeader } from '@/components/layout/page-header';

export default function InternalBoardsPage() {
  return (
    <>
      <PageHeader
        title="Boards"
        description="ESP32 boards — status, settings and logins (changes: super admin only)"
      />
      <BoardsPanel />
    </>
  );
}
