import { redirect } from 'next/navigation';

/** The Bottles page became Cameras (2026-11: the dye bottles were dropped): old links and bookmarks go there. */
export default async function BottlesMoved({ params }: { params: Promise<{ factoryId: string }> }) {
  const { factoryId } = await params;
  redirect(`/factories/${encodeURIComponent(factoryId)}/cameras`);
}
