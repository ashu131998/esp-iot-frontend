import { cn } from '@/lib/utils';

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-lg border', className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="border-b bg-slate-50 text-left text-xs uppercase text-muted">{children}</thead>;
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y">{children}</tbody>;
}

export function TR({ children, className, ...props }: React.ComponentPropsWithoutRef<'tr'>) {
  return (
    <tr className={cn('hover:bg-slate-50/80', className)} {...props}>
      {children}
    </tr>
  );
}

export function TH({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn('px-2 py-2 font-medium sm:px-4 sm:py-3', className)}>{children}</th>;
}

export function TD({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-2 py-2 sm:px-4 sm:py-3', className)}>{children}</td>;
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {message}
    </div>
  );
}
