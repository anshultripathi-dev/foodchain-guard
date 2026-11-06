import { useMemo, useState } from 'react'
import { Download, Search } from 'lucide-react'
import { Badge, Btn, Card, HashText, PageHeader } from '../../components/ui'
import { useStore } from '../../state/store'
import { useAnalysis } from '../../state/selectors'
import { fmtDateTime, downloadText } from '../../utils/format'

interface Row { ts: number; actor: string; batch: string; action: string; location: string; hash: string; status: 'VALID' | 'INVALID' | 'FLAGGED'; src: 'ledger' | 'system' }

export function AuditLog() {
  const an = useAnalysis()
  const audit = useStore((s) => s.audit)
  const [q, setQ] = useState('')
  const [st, setSt] = useState('ALL')
  const [src, setSrc] = useState('ALL')
  const [n, setN] = useState(40)
  const rows = useMemo(() => {
    const led: Row[] = an.list.flatMap((a) => a.events.map((e, i) => ({ ts: e.timestamp, actor: e.actor, batch: e.batchId, action: e.action, location: e.location, hash: e.currentHash, status: (a.chain.checks[i].status === 'VALID' ? 'VALID' : 'INVALID') as Row['status'], src: 'ledger' as const })))
    const sys: Row[] = audit.map((x) => ({ ts: x.ts, actor: x.actor, batch: x.batchId, action: x.action, location: x.location, hash: x.hash, status: x.status, src: 'system' as const }))
    return [...led, ...sys].sort((a, b) => b.ts - a.ts)
  }, [an, audit])
  const f = rows.filter((r) => (st === 'ALL' || r.status === st) && (src === 'ALL' || r.src === src) && (!q || `${r.actor} ${r.batch} ${r.action} ${r.location} ${r.hash}`.toLowerCase().includes(q.toLowerCase())))
  const exp = () => downloadText('foodchain-audit.csv', ['timestamp,actor,batch,action,location,hash,status', ...f.map((r) => [fmtDateTime(r.ts), r.actor, r.batch, r.action, r.location, r.hash, r.status].map((x) => `"${x}"`).join(','))].join('\n'), 'text/csv')
  return (
    <>
      <PageHeader eyebrow="Event audit log" title="Audit trail" subtitle="Every ledger block and every system action, with the hash that proves it." actions={<Btn icon={<Download size={14} />} onClick={exp}>Export CSV</Btn>} />
      <Card bodyClassName="!pt-4 !px-0 !pb-2">
        <div className="mb-3 flex flex-wrap gap-3 px-5">
          <div className="relative min-w-[240px] flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input className="input !pl-9" placeholder="Search actor, batch, action, hash…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="input !w-auto" value={st} onChange={(e) => setSt(e.target.value)}>{['ALL', 'VALID', 'INVALID', 'FLAGGED'].map((x) => <option key={x}>{x}</option>)}</select>
          <select className="input !w-auto" value={src} onChange={(e) => setSrc(e.target.value)}><option value="ALL">All sources</option><option value="ledger">Ledger blocks</option><option value="system">System actions</option></select>
        </div>
        <div className="max-h-[640px] overflow-auto">
          <table className="tbl">
            <thead><tr><th>Timestamp</th><th>Actor</th><th>Batch</th><th>Action</th><th>Location</th><th>Hash</th><th>Status</th></tr></thead>
            <tbody>
              {f.slice(0, n).map((r, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap text-xs text-slate-300">{fmtDateTime(r.ts)}</td><td className="text-slate-100">{r.actor}</td><td className="mono text-[12px] text-brand">{r.batch === '—' ? '—' : r.batch.replace('FCG-2026-', 'FCG-')}</td>
                  <td className="font-medium">{r.action}</td><td className="text-slate-300">{r.location}</td><td><HashText hash={r.hash} n={7} /></td>
                  <td><Badge tone={r.status === 'VALID' ? 'ok' : r.status === 'INVALID' ? 'bad' : 'warn'} dot>{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 pt-3 text-xs text-slate-500"><span>Showing {Math.min(n, f.length)} of {f.length}</span>{n < f.length && <Btn size="sm" onClick={() => setN(n + 60)}>Load more</Btn>}</div>
      </Card>
    </>
  )
}
