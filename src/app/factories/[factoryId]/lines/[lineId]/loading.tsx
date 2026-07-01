import { Card, CardHeader } from '@/components/ui/card';

export default function LineDetailLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="h-4 w-48 animate-pulse rounded bg-slate-100" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
      <Card>
        <CardHeader title="Machines" description="Loading machines…" />
        <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
      </Card>
      <Card>
        <CardHeader title="Machine Configurations" description="Loading configurations…" />
        <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
      </Card>
    </div>
  );
}
