import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Loader2, QrCode, ScanLine, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react'
import { Badge, Btn, Card, Check2, Kv } from '../../components/ui'
import { PackageImage } from '../../components/PackageImage'
import { IndiaMap } from '../../components/IndiaMap'
import { useStore } from '../../state/store'
import { useAnalysis, useSelectedAnalysis, getEngineInput } from '../../state/selectors'
import { assessQr } from '../../services/analysis'
import { cn, fmtDateTime } from '../../utils/format'
import { useQuery } from '../../utils/router'
import { CITIES } from '../../utils/geo'

type Check = { label: string; ok: boolean; note?: string }

export function QrVerification() {
  const a = useSelectedAnalysis()
  const an = useAnalysis()
  const q = useQuery()
  const run = useStore((s) => s.runScenario)
  const select = useStore((s) => s.selectBatch)
  const [qrId, setQrId] = useState(q.get('qr') ?? a.worstPackage.qrId)
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'checking' | 'done'>('idle')
  const [shown, setShown] = useState(0)
  const timers = useRef<number[]>([])
  const pkg = an.list.flatMap((x) => x.packages).find((p) => p.qrId === qrId)
  const owner = pkg ? an.byId[pkg.batchId] : undefined

  useEffect(() => {
    const p = q.get('qr')
    if (p) { setQrId(p); const pk = an.list.flatMap((x) => x.packages).find((x) => x.qrId === p); if (pk) select(pk.batchId) }
  }, [q.get('qr')]) // eslint-disable-line
  useEffect(() => { if (!q.get('qr')) setQrId(a.worstPackage.qrId); reset() }, [a.batch.batchId]) // eslint-disable-line
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const reset = () => { timers.current.forEach(clearTimeout); timers.current = []; setPhase('idle'); setShown(0) }

  const checks: Check[] = useMemo(() => {
    const qr = assessQr(qrId, owner?.batch.batchId ?? null, getEngineInput())
    const o = owner
    return [
      { label: 'Does the QR exist in the registry?', ok: qr.exists, note: qr.exists ? qr.packageId ?? '' : 'unknown identity' },
      { label: 'Is it active?', ok: qr.active, note: qr.active ? 'active' : 'inactive / revoked' },
      { label: 'Does it belong to this batch?', ok: qr.belongsToBatch && !!o, note: o?.batch.batchId },
      { label: 'Has it been revoked?', ok: qr.exists && !qr.revoked, note: qr.revoked ? 'revoked by security' : 'not revoked' },
      { label: 'Does scan behaviour look suspicious?', ok: !qr.replay && !qr.repeated, note: qr.replay ? `seen in ${qr.cities.join(', ')}` : qr.repeated ? `${qr.repeated.count} scans/hr` : `${qr.scans.length} prior scans, consistent` },
      { label: 'Is the hash chain intact?', ok: !!o?.chain.valid, note: o ? (o.chain.valid ? `${o.events.length} blocks valid` : `${o.chain.invalidCount} blocks untrusted`) : '—' },
      { label: 'Does the packaging fingerprint match?', ok: !!o && o.classification.label === 'AUTHENTIC' && o.packaging.watermarkValid, note: o ? `${o.packaging.overall.toFixed(0)}% · watermark ${o.packaging.watermarkValid ? 'valid' : 'INVALID'}` : '—' },
    ]
  }, [qrId, owner, an]) // eslint-disable-line

  const scan = (id?: string) => {
    if (id) setQrId(id)
    timers.current.forEach(clearTimeout); timers.current = []
    setPhase('scanning'); setShown(0)
    timers.current.push(window.setTimeout(() => setPhase('checking'), 1500))
    for (let i = 1; i <= 7; i++) timers.current.push(window.setTimeout(() => setShown(i), 1500 + i * 420))
    timers.current.push(window.setTimeout(() => setPhase('done'), 1500 + 7 * 420 + 250))
  }

  const allOk = checks.every((c) => c.ok)
  const qrOk = checks.slice(0, 5).every((c) => c.ok)
  const replay = checks[4] && !checks[4].ok
  const b = owner?.batch
  const qrAssess = assessQr(qrId, b?.batchId ?? null, getEngineInput())
  const hist = qrAssess.scans

  return (
    <div className="grid gap-5 xl:grid-cols-[430px_1fr]">
      <div className="space-y-5">
        <Card title="QR scanner" subtitle="Simulated camera · decodes and verifies the identity">
          <div className="relative mx-auto aspect-[3/4] w-full max-w-[330px] overflow-hidden rounded-3xl border-2 border-brand/40 bg-ink-950">
            <div className="absolute inset-3 opacity-90">{owner ? <PackageImage batch={owner.batch} qrId={qrId} watermarkId={owner.worstPackage.watermarkId} mods={pkg?.mods} /> : <div className="flex h-full items-center justify-center rounded-2xl bg-slate-800 text-slate-400"><QrCode size={60} /></div>}</div>
            {/* viewfinder */}
            {['left-4 top-4 border-l-4 border-t-4', 'right-4 top-4 border-r-4 border-t-4', 'left-4 bottom-4 border-b-4 border-l-4', 'right-4 bottom-4 border-b-4 border-r-4'].map((c) => <span key={c} className={cn('absolute h-8 w-8 rounded-sm border-brand', c)} />)}
            {phase === 'scanning' && <div className="scanline" />}
            {phase !== 'idle' && phase !== 'scanning' && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-ink-950/90 px-3 py-1 text-[11px] mono text-brand">decoded · {qrId}</motion.div>}
          </div>
          <div className="mt-4 space-y-2">
            <Btn variant="primary" className="w-full" size="lg" icon={phase === 'scanning' || phase === 'checking' ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />} onClick={() => scan()} disabled={phase === 'scanning' || phase === 'checking'}>Scan QR</Btn>
            <div className="grid grid-cols-2 gap-2">
              <Btn size="sm" onClick={() => { const id = a.worstPackage.qrId; scan(id) }}>Authentic QR</Btn>
              <Btn size="sm" variant="danger" onClick={() => scan('QR-FCG-000000')}>Unregistered QR</Btn>
            </div>
            <Btn size="sm" variant="danger" className="w-full" icon={<ShieldAlert size={13} />} onClick={() => { run('replay', a.batch.batchId); setTimeout(() => scan(a.packages[0].qrId), 80) }}>Suspicious QR — simulate replay attack, then scan</Btn>
          </div>
          <div className="mt-4"><label className="label mb-1 block">QR ID</label>
            <select className="input mono" value={qrId} onChange={(e) => { setQrId(e.target.value); reset() }}>
              {!a.packages.some((p) => p.qrId === qrId) && <option value={qrId}>{qrId}</option>}
              {a.packages.map((p) => <option key={p.qrId} value={p.qrId}>{p.qrId} · {p.packageId}</option>)}
            </select>
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Verification pipeline" subtitle="Seven independent checks — QR alone is never enough">
          {phase === 'idle' && <div className="py-10 text-center text-sm text-slate-400">Press <b className="text-brand">Scan QR</b> to verify the selected package.</div>}
          {phase !== 'idle' && (
            <ul className="space-y-2">
              {checks.map((c, i) => (
                <motion.li key={c.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: i < shown ? 1 : 0.25, x: 0 }} className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.02] px-4 py-2.5">
                  <span className="w-5 shrink-0">{i < shown ? (c.ok ? <CheckCircle2 size={18} className="text-ok" /> : <XCircle size={18} className="text-bad" />) : <Loader2 size={16} className={i === shown ? 'animate-spin text-brand' : 'text-slate-600'} />}</span>
                  <span className="flex-1 text-[13px] text-slate-200">{c.label}</span>
                  {i < shown && <span className={cn('text-xs', c.ok ? 'text-slate-400' : 'font-semibold text-bad')}>{c.note}</span>}
                </motion.li>
              ))}
            </ul>
          )}
          <AnimatePresence>
            {phase === 'done' && (
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className={cn('mt-4 rounded-2xl border-2 p-5', allOk ? 'border-ok/50 bg-ok/10' : 'border-bad/50 bg-bad/10')}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {allOk ? <ShieldCheck size={34} className="text-ok" /> : <ShieldAlert size={34} className="text-bad" />}
                    <div>
                      <div className={cn('text-2xl font-extrabold tracking-wide', allOk ? 'text-ok' : 'text-bad')}>{allOk ? 'PRODUCT VERIFIED' : replay ? 'QR REPLAY SUSPECTED' : !checks[0].ok ? 'UNKNOWN QR — NOT VERIFIED' : 'VERIFICATION FAILED'}</div>
                      <div className="text-xs text-slate-300">{owner ? owner.trust.conclusion : 'This identity does not exist in the FoodChain Guard registry — likely a printed fake.'}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center text-xs">
                    <div><div className="label">QR</div><div className={cn('font-bold', qrOk ? 'text-ok' : 'text-bad')}>{qrOk ? 'VALID' : 'INVALID'}</div></div>
                    <div><div className="label">Chain</div><div className={cn('font-bold', checks[5].ok ? 'text-ok' : 'text-bad')}>{checks[5].ok ? 'VALID' : 'BROKEN'}</div></div>
                    <div><div className="label">Packaging</div><div className={cn('font-bold', checks[6].ok ? 'text-ok' : 'text-bad')}>{checks[6].ok ? 'MATCH' : 'MISMATCH'}</div></div>
                  </div>
                </div>
                {b && <div className="mt-4 grid gap-x-8 border-t border-white/10 pt-3 sm:grid-cols-2"><Kv k="Product" v={`${b.emoji} ${b.product}`} /><Kv k="Batch" v={<span className="mono">{b.batchId}</span>} /></div>}
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Scan history" subtitle={`${hist.length} scans of ${qrId}`}>
            {hist.length === 0 ? <div className="text-sm text-slate-400">No scans recorded.</div> : (
              <table className="tbl"><thead><tr><th>Time</th><th>City</th><th>Source</th></tr></thead>
                <tbody>{hist.slice(-8).map((s) => <tr key={s.scanId}><td className="text-xs text-slate-300">{fmtDateTime(s.timestamp)}</td><td>{s.city}</td><td className="text-xs text-slate-500">{s.source}</td></tr>)}</tbody></table>
            )}
            {qrAssess.replay && <div className="mt-3"><Badge tone="bad" dot pulse>Same identity observed across inconsistent locations</Badge></div>}
          </Card>
          <Card title="Scan locations">
            <IndiaMap height={250} zoom="all" markers={qrAssess.cities.filter((c) => CITIES[c]).map((c) => ({ city: c, tone: qrAssess.replay ? 'bad' : 'ok', r: 6, pulse: qrAssess.replay }))} routes={hist.slice(1).map((s, i) => ({ from: hist[i].city, to: s.city, tone: qrAssess.replay ? 'bad' : 'info' }))} />
          </Card>
        </div>
      </div>
    </div>
  )
}
export { Check2 }
