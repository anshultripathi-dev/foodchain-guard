import { Bell, CheckCheck } from 'lucide-react'
import { Badge, Btn, Card, PageHeader } from '../../components/ui'
import { useStore } from '../../state/store'
import { fmtAgo, cn } from '../../utils/format'
import { navigate } from '../../utils/router'
import { useState } from 'react'

export function NotificationsPage() {
  const notes = useStore((s) => s.notifications)
  const mark = useStore((s) => s.markNotificationsRead)
  const select = useStore((s) => s.selectBatch)
  const [f, setF] = useState<'all' | 'critical' | 'warning' | 'success' | 'unread'>('all')
  const list = notes.filter((n) => (f === 'all' ? true : f === 'unread' ? !n.read : n.level === f))
  const col = { critical: 'bg-bad', warning: 'bg-warn', success: 'bg-ok', info: 'bg-brand' }
  const tone = { critical: 'bad', warning: 'warn', success: 'ok', info: 'info' } as const
  return (
    <>
      <PageHeader eyebrow="Notifications" title="Notification center" subtitle="Alerts raised by verification, ledger validation, sensors and the anomaly engine." actions={<Btn icon={<CheckCheck size={14} />} onClick={mark}>Mark all read</Btn>} />
      <div className="mb-4 flex flex-wrap gap-2">{(['all', 'unread', 'critical', 'warning', 'success'] as const).map((k) => <button key={k} onClick={() => setF(k)} className={cn('rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize', f === k ? 'border-brand/50 bg-brand/10 text-white' : 'border-line text-slate-400')}>{k}</button>)}</div>
      <Card bodyClassName="!p-2">
        {list.length === 0 && <div className="p-8 text-center text-slate-400"><Bell className="mx-auto mb-2" />Nothing here.</div>}
        {list.map((n) => (
          <button key={n.id} onClick={() => { if (n.batchId) { select(n.batchId); navigate(`/app/batches/${n.batchId}`) } }} className="flex w-full items-start gap-4 rounded-xl px-4 py-3.5 text-left transition hover:bg-white/[0.04]">
            <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', col[n.level], !n.read && 'ring-4 ring-white/10')} />
            <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="text-[14px] font-semibold text-white">{n.title}</span><Badge tone={tone[n.level]}>{n.level}</Badge></span><span className="mt-0.5 block text-[13px] text-slate-400">{n.body}</span></span>
            <span className="shrink-0 text-xs text-slate-500">{fmtAgo(n.ts)}</span>
          </button>
        ))}
      </Card>
    </>
  )
}
