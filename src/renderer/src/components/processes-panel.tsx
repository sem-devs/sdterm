import { useMemo, useState } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { formatBytes } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useProcesses } from '@/store/processes'

type SortKey = 'cpu' | 'mem'

interface Row {
  key: string
  name: string
  /** pid, or the number of processes when grouped */
  detail: string
  cpu: number
  rss: number
}

/** What Activity Monitor and Task Manager show: who is using the CPU and the memory right now. */
export function ProcessesPanel(): React.JSX.Element {
  const snapshot = useProcesses((s) => s.snapshot)
  const [sort, setSort] = useState<SortKey>('cpu')
  const [grouped, setGrouped] = useState(true)
  const [query, setQuery] = useState('')

  const rows = useMemo<Row[]>(() => {
    if (!snapshot) return []
    const q = query.trim().toLowerCase()
    const list = snapshot.list.filter((p) => !q || p.name.toLowerCase().includes(q))
    let out: Row[]
    if (grouped) {
      const byName = new Map<string, Row & { count: number }>()
      for (const p of list) {
        const g = byName.get(p.name) ?? {
          key: p.name,
          name: p.name,
          detail: '',
          cpu: 0,
          rss: 0,
          count: 0
        }
        g.cpu += p.cpu
        g.rss += p.rss
        g.count += 1
        byName.set(p.name, g)
      }
      out = [...byName.values()].map((g) => ({ ...g, detail: g.count > 1 ? `×${g.count}` : '' }))
    } else {
      out = list.map((p) => ({
        key: String(p.pid),
        name: p.name,
        detail: String(p.pid),
        cpu: p.cpu,
        rss: p.rss
      }))
    }
    return out.sort((a, b) => (sort === 'cpu' ? b.cpu - a.cpu : b.rss - a.rss)).slice(0, 60)
  }, [snapshot, sort, grouped, query])

  const header = (key: SortKey, label: string): React.JSX.Element => (
    <button
      onClick={() => setSort(key)}
      aria-sort={sort === key ? 'descending' : 'none'}
      className={cn(
        'focus-visible:ring-ring/60 flex items-center justify-end gap-1 rounded-sm outline-none focus-visible:ring-2',
        sort === key ? 'text-foreground' : 'hover:text-foreground'
      )}
    >
      {label}
      {sort === key && <CaretDown className="size-3" />}
    </button>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b p-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name"
          aria-label="Filter processes by name"
          className="h-7 flex-1 text-xs"
        />
        <label className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
          Group by name
          <Switch checked={grouped} onCheckedChange={setGrouped} />
        </label>
      </div>

      <div className="text-muted-foreground grid shrink-0 grid-cols-[1fr_3.5rem_4rem_5rem] gap-2 border-b px-3 py-1.5 text-[11px] font-medium">
        <span>Name</span>
        <span className="text-right">{grouped ? 'Count' : 'PID'}</span>
        {header('cpu', 'CPU')}
        {header('mem', 'Memory')}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!snapshot ? (
          <p className="text-muted-foreground p-4 text-xs">Reading processes…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground p-4 text-xs">No process matches that name.</p>
        ) : (
          <ul>
            {rows.map((r) => (
              <li
                key={r.key}
                className="hover:bg-accent/50 grid grid-cols-[1fr_3.5rem_4rem_5rem] gap-2 px-3 py-1 text-xs"
              >
                <span className="truncate" title={r.name}>
                  {r.name}
                </span>
                <span className="text-muted-foreground text-right font-mono tabular-nums">
                  {r.detail}
                </span>
                <span
                  className={cn(
                    'text-right font-mono tabular-nums',
                    r.cpu >= 50 && 'text-primary font-medium'
                  )}
                >
                  {r.cpu.toFixed(1)}%
                </span>
                <span className="text-right font-mono tabular-nums">{formatBytes(r.rss)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {snapshot && (
        <p className="text-muted-foreground shrink-0 border-t px-3 py-1.5 text-[11px]">
          CPU is a percentage of one core, as in Activity Monitor and Task Manager, so a busy app
          can pass 100%. {snapshot.cores} cores in total.
        </p>
      )}
    </div>
  )
}
