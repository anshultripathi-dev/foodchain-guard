import { motion } from 'framer-motion'
import { BadgeCheck, Factory, Sprout, Store, Truck, Warehouse as WarehouseIcon, Clock } from 'lucide-react'
import type { ReactNode } from 'react'
import { STAGES, type Stage } from '../../models/types'
import type { BatchAnalysis } from '../../services/analysis'
import { cn, fmtDateTime } from '../../utils/format'
import { Badge, HashText } from '../../components/ui'

export const STAGE_ICON: Record<Stage, ReactNode> = {
  HARVESTED: <Sprout size={16} />, PROCESSED: <Factory size={16} />, DISTRIBUTED: <Truck size={16} />,
  STORED: <WarehouseIcon size={16} />, RETAILED: <Store size={16} />, VERIFIED: <BadgeCheck size={16} />,
}

export function EventTimeline({ a, highlight, onSelect }: { a: BatchAnalysis; highlight?: number | null; onSelect?: (i: number) => void }) {
  return (
    <ol className="relative space-y-3">
      <div className="absolute bottom-4 left-[19px] top-4 w-px bg-gradient-to-b from-brand/50 via-line to-transparent" />
      {STAGES.map((stage, i) => {
        const ev = a.events[i]
        const check = a.chain.checks[i]
        const anomalies = ev ? a.anomalies.filter((x) => x.eventId === ev.eventId) : []
        const bad = ev && check && check.status !== 'VALID'
        const warn = !bad && anomalies.length > 0
        const tone = !ev ? 'border-line text-slate-600' : bad ? 'border-bad text-bad bg-bad/10' : warn ? 'border-warn text-warn bg-warn/10' : 'border-ok/60 text-ok bg-ok/10'
        return (
          <motion.li key={stage} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="relative flex gap-4">
            <div className={cn('z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-ink-900', tone, highlight === i && 'ring-4 ring-brand/30')}>
              {ev ? STAGE_ICON[stage] : <Clock size={15} />}
            </div>
            <div
              role={onSelect && ev ? 'button' : undefined}
              onClick={() => ev && onSelect?.(i)}
              className={cn('glass flex-1 rounded-xl p-3.5 text-left transition', onSelect && ev && 'cursor-pointer', highlight === i && 'glass-hi', !ev && 'opacity-50', onSelect && ev && 'hover:border-brand/40')}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold tracking-wide text-white">{stage}</span>
                  {ev && <span className="mono text-[11px] text-slate-500">block #{i + 1}</span>}
                </div>
                {ev ? (
                  bad ? <Badge tone="bad" dot>{check.status.replace(/_/g, ' ')}</Badge> : warn ? <Badge tone="warn" dot>FLAGGED</Badge> : <Badge tone="ok" dot>VERIFIED</Badge>
                ) : <Badge tone="mute">PENDING</Badge>}
              </div>
              {ev ? (
                <div className="mt-2 grid gap-x-6 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
                  <div><span className="text-slate-500">Actor </span><span className="text-slate-100">{ev.actor}</span></div>
                  <div><span className="text-slate-500">Location </span><span className="text-slate-100">{ev.location}</span></div>
                  <div><span className="text-slate-500">Time </span><span className="text-slate-100">{fmtDateTime(ev.timestamp)}</span></div>
                  <div><span className="text-slate-500">Quantity </span><span className="text-slate-100 tabular-nums">{ev.quantity.toLocaleString('en-US')} {ev.unit}</span></div>
                  <div className="sm:col-span-2 flex items-center gap-2"><span className="text-slate-500">Hash </span><HashText hash={ev.currentHash} n={14} /></div>
                  {anomalies.map((x) => <div key={x.id} className="sm:col-span-2 text-warn">⚠ {x.title}</div>)}
                </div>
              ) : <div className="mt-1 text-xs text-slate-500">Awaiting hand-off from {a.batch.route && 'the next custodian'}</div>}
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}
