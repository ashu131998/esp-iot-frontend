import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">404 — Not Found</h1>
      <p className="text-muted">The page or factory you requested does not exist.</p>
      <Link href="/overview" className="text-primary hover:underline">
        Back to overview
      </Link>
    </div>
  );
}
