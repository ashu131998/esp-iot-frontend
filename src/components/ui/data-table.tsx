'use client';

import { useState } from 'react';
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

import { Table, THead, TBody, TR, TH, TD } from './table';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  /** Enable client-side pagination at this page size. Omit to render all rows. */
  pageSize?: number;
  emptyMessage?: string;
  initialSorting?: SortingState;
  className?: string;
  /** Optional per-row class, e.g. to dim a row that is being deleted. */
  rowClassName?: (row: T) => string | undefined;
}

export function DataTable<T>({
  columns,
  data,
  pageSize,
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
    ...(pageSize
      ? {
          getPaginationRowModel: getPaginationRowModel(),
          initialState: { pagination: { pageSize } },
        }
      : {}),
  });

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">{emptyMessage}</p>;
  }

  const paginated = pageSize != null;
  const pageIndex = table.getState().pagination.pageIndex;
  const total = data.length;
  const start = paginated ? pageIndex * pageSize + 1 : 1;
  const end = paginated ? Math.min((pageIndex + 1) * pageSize, total) : total;

  return (
    <>
      <Table className={className}>
        <THead>
          {table.getHeaderGroups().map((group) => (
            <TR key={group.id}>
              {group.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <TH key={header.id} className={cn(canSort && 'cursor-pointer select-none')}>
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
          {table.getRowModel().rows.map((row) => (
            <TR key={row.id} className={rowClassName?.(row.original)}>
              {row.getVisibleCells().map((cell) => (
                <TD key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>

      {paginated && total > pageSize && (
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted">
          <span>
            Showing {start}–{end} of {total}
          </span>
          <div className="flex items-center gap-2">
            <span>
              Page {pageIndex + 1} of {table.getPageCount()}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
