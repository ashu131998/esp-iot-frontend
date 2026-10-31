'use client';

import { useState } from 'react';
import {
  type ColumnDef,
  type RowData,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

import { LoadMore, ScrollTable, useShowMore } from './load-more';
import { PHONE_HIDDEN, Table, THead, TBody, TR, TH, TD } from './table';
import { cn } from '@/lib/utils';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- must match TanStack's generic signature
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Left out on phones held upright (below sm): only what matters fits there. */
    phoneHidden?: boolean;
  }
}

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  /**
   * Infinite scroll: this many rows first, and as many more each time the table's end scrolls into
   * view (lib/infinite.ts). Omit to render all rows.
   */
  scrollStep?: number;
  /** What the rows are of (dates, filters): when it changes the table starts again from its first rows. */
  resetKey?: string;
  emptyMessage?: string;
  initialSorting?: SortingState;
  className?: string;
  /** Optional per-row class, e.g. to dim a row that is being deleted. */
  rowClassName?: (row: T) => string | undefined;
}

export function DataTable<T>({
  columns,
  data,
  scrollStep,
  resetKey,
  emptyMessage = 'No data available',
  initialSorting = [],
  className,
  rowClassName,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;
  const { shown, more, hasMore } = useShowMore(rows.length, resetKey ?? String(data.length), scrollStep ?? Math.max(rows.length, 1));

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  return (
    <>
      <TableFor scroll={scrollStep != null} className={className} rowCount={shown} resetKey={resetKey ?? String(data.length)}>
        <THead>
          {table.getHeaderGroups().map((group) => (
            <TR key={group.id}>
              {group.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <TH
                    key={header.id}
                    className={cn(
                      canSort && 'cursor-pointer select-none',
                      header.column.columnDef.meta?.phoneHidden && PHONE_HIDDEN,
                    )}
                  >
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={cn('flex items-center gap-1', canSort ? 'hover:text-foreground' : 'cursor-default')}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        disabled={!canSort}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort &&
                          (sorted === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : sorted === 'desc' ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                          ))}
                      </button>
                    )}
                  </TH>
                );
              })}
            </TR>
          ))}
        </THead>
        <TBody>
          {rows.slice(0, shown).map((row) => (
            <TR key={row.id} className={rowClassName?.(row.original)}>
              {row.getVisibleCells().map((cell) => (
                <TD key={cell.id} className={cn(cell.column.columnDef.meta?.phoneHidden && PHONE_HIDDEN)}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </TableFor>

      {scrollStep != null && <LoadMore shown={shown} total={rows.length} hasMore={hasMore} onMore={more} />}
    </>
  );
}

/** A table that grows as it scrolls holds its column widths (ScrollTable); one shown whole does not need to. */
function TableFor({
  scroll, className, rowCount, resetKey, children,
}: { scroll: boolean; className?: string; rowCount: number; resetKey: string; children: React.ReactNode }) {
  return scroll
    ? <ScrollTable className={className} rowCount={rowCount} resetKey={resetKey}>{children}</ScrollTable>
    : <Table className={className}>{children}</Table>;
}
