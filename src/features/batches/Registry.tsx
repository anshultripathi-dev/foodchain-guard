import { useMemo, useState } from 'react'
import { ArrowUpDown, FileText, GitBranch, Plus, ScanLine, Search } from 'lucide-react'
import { Btn, Card, PageHeader, StatusBadge, Empty } from '../../components/ui'
import { useStore } from '../../state/store'
import { useAnalysis } from '../../state/selectors'
import { ROLE_BY_ID } from '../../data/roles'
import { navigate } from '../../utils/router'
import { fmtDate, fmtNum, daysRemaining, cn } from '../../utils/format'
import { expiryLabel } from '../../services/analysis'

type SortKey = 'new' | 'auth' | 'expiry' | 'qty'

export function Registry() {
  const an = useAnalysis()
  const role = useStore((s) => s.role)
  const select = useStore((s) => s.selectBatch)
  const def = ROLE_BY_ID[role]
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('ALL')
  const [cert, setCert] = useState('ALL')
  const [sort, setSort] = useState<SortKey>('new')
  const [mine, setMine] = useState(!!def.scope)

  const rows = useMemo(() => {
    let list = an.list
    if (mine && def.scope) list = list.filter((a) => def.scope!(a.batch))
    const s = q.trim().toLowerCase()
    if (s) list = list.filter((a) => `${a.batch.batchId} ${a.batch.product} ${a.batch.origin} ${a.batch.farm} ${a.batch.qrId}`.toLowerCase().includes(s))
    if (status !== 'ALL') list = list.filter((a) => a.status === status)
    if (cert !== 'ALL') list = list.filter((a) => a.batch.certification === cert)
    const by: Record<SortKey, (a: typeof list[number], b: typeof list[number]) => number> = {
      new: (a, b) => b.batch.batchId.localeCompare(a.batch.batchId),
      auth: (a, b) => a.trust.authenticity - b.trust.authenticity,
      expiry: (a, b) => a.batch.expiryDate - b.batch.expiryDate,
      qty: (a, b) => b.batch.quantity - a.batch.quantity,
    }
    return [...list].sort(by[sort])
  }, [an, q, status, cert, sort, mine, def])

  const statuses = ['ALL', ...Array.from(new Set(an.list.map((a) => a.status)))]
  const certs = ['ALL', ...Array.from(new Set(an.list.map((a) => a.batch.certification)))]
  const go = (id: string, to: string) => { select(id); navigate(to) }

  return (
    <>
      <PageHeader
        eyebrow="Batch registry"
        title="Batches"
        subtitle="Every batch has a cryptographic identity, a packaging fingerprint and a signed hand-off history."
        actions={(role === 'admin' || role === 'farmer') && <Btn variant="primary" icon={<Plus size={15} />} onClick={() => navigate('/app/batches/new')}>Register batch</Btn>}
      />
      <Card bodyClassName="!pt-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input className="input !pl-9" placeholder="Search batch ID, product, origin, QR…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input !w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
          <select className="input !w-auto" value={cert} onChange={(e) => setCert(e.target.value)}>{certs.map((s) => <option key={s}>{s}</option>)}</select>
          <div className="flex items-center gap-2"><ArrowUpDown size={14} className="text-slate-500" />
            <select className="input !w-auto" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="new">Newest</option><option value="auth">Lowest authenticity</option><option value="expiry">Soonest expiry</option><option value="qty">Largest quantity</option>
            </select>
          </div>
          {def.scope && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="accent-cyan-400" /> Only {def.actorName}
            </label>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Batch ID</th><th>Product</th><th>Origin</th><th>Harvest</th><th className="text-right">Quantity</th><th>Certification</th><th>Expiry</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {rows.map((a) => {
                const b = a.batch
                return (
                  <tr key={b.batchId} className="clickable" onClick={() => go(b.batchId, `/app/batches/${b.batchId}`)}>
                    <td className="mono text-[12px] font-semibold text-brand">{b.batchId}</td>
                    <td>{b.emoji} {b.product}</td>
                    <td className="text-slate-300">{b.origin}</td>
                    <td className="text-slate-400">{fmtDate(b.harvestDate)}</td>
                    <td className="text-right tabular-nums">{fmtNum(b.quantity)} <span className="text-xs text-slate-500">{b.unit}</span></td>
                    <td>{b.certification}</td>
                    <td className="whitespace-nowrap"><span className="text-slate-300">{fmtDate(b.expiryDate)}</span> <span className={cn('text-[11px]', a.days <= 0 ? 'text-bad' : a.days <= 4 ? 'text-warn' : 'text-slate-500')}>{expiryLabel(a.days) !== 'SAFE' ? expiryLabel(a.days) : `${a.days}d`}</span></td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className="whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                      <Btn size="sm" variant="ghost" title="Open" onClick={() => go(b.batchId, `/app/batches/${b.batchId}`)}>Open</Btn>
                      <Btn size="sm" variant="ghost" icon={<ScanLine size={13} />} title="Verify" onClick={() => go(b.batchId, '/app/verification')} />
                      <Btn size="sm" variant="ghost" icon={<GitBranch size={13} />} title="Trace" onClick={() => go(b.batchId, '/app/supply-chain')} />
                      <Btn size="sm" variant="ghost" icon={<FileText size={13} />} title="Report" onClick={() => go(b.batchId, '/app/reports')} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {rows.length === 0 && <Empty>No batches match these filters.</Empty>}
        </div>
        <div className="mt-3 text-xs text-slate-500">{rows.length} of {an.list.length} batches · {an.list.reduce((a, x) => a + x.packages.length, 0)} tracked packages</div>
      </Card>
    </>
  )
}
