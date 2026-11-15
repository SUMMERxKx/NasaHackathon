// SI disclosure: this file was drafted with an SI coding assistant and reviewed by the team.
// A sortable table with a sticky header and first column.
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'

export type Column<T> = {
  key: string
  header: string
  title?: string
  cell: (row: T) => ReactNode
  sort?: (row: T) => number | string | null
  numeric?: boolean
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRow,
  rowLabel,
  highlight,
  rowProps,
  caption,
  initialSort,
  maxRows = 400,
}: {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  onRow?: (row: T) => void
  rowLabel?: (row: T) => string
  highlight?: (row: T) => boolean
  rowProps?: (row: T) => Record<string, string>
  caption: string
  initialSort?: { key: string; dir: 1 | -1 }
  maxRows?: number
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(initialSort ?? null)
  const [showAll, setShowAll] = useState(false)
  const sorted = useMemo(() => {
    if (!sort) return rows
    const column = columns.find((c) => c.key === sort.key)
    if (!column?.sort) return rows
    const get = column.sort
    return [...rows].sort((a, b) => {
      const x = get(a)
      const y = get(b)
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * sort.dir
      return String(x).localeCompare(String(y), 'en', { numeric: true }) * sort.dir
    })
  }, [rows, sort, columns])
  const shown = showAll ? sorted : sorted.slice(0, maxRows)
  return (
    <div>
      <div className="table-wrap">
        <table className="data-table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key
                return (
                  <th key={c.key} scope="col" title={c.title} aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                    {c.sort ? (
                      <button type="button" onClick={() => setSort({ key: c.key, dir: active && sort.dir === 1 ? -1 : 1 })}>
                        {c.header}
                        {active ? sort.dir === 1 ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" /> : null}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const extra = rowProps ? rowProps(row) : {}
              const hi = highlight?.(row)
              return (
                <tr
                  key={rowKey(row)}
                  id={`row-${rowKey(row)}`}
                  className={`${onRow ? 'row-link' : ''} ${hi ? 'row-hi' : ''}`}
                  tabIndex={onRow ? 0 : undefined}
                  role={onRow ? 'button' : undefined}
                  aria-label={onRow && rowLabel ? rowLabel(row) : undefined}
                  onClick={onRow ? () => onRow(row) : undefined}
                  onKeyDown={
                    onRow
                      ? (e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            onRow(row)
                          }
                        }
                      : undefined
                  }
                  {...extra}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={c.numeric ? 'num whitespace-nowrap' : undefined}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {sorted.length > shown.length ? (
        <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setShowAll(true)}>
          Show all {sorted.length} rows
        </button>
      ) : null}
    </div>
  )
}
