import { Card, CardHeader } from '@/components/ui/card';

export default function LinesLoading() {
  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <Card>
        <CardHeader title="Production Lines" description="Loading lines…" />
        <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
      </Card>
    </div>
  );
}
