import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertOctagon, CheckCircle2, Hammer, Link2, Loader2, RotateCcw, ShieldCheck, Unlink } from 'lucide-react'
import { Badge, Btn, Card, Check2, Field, HashText, Kv, PageHeader } from '../../components/ui'
import { useStore } from '../../state/store'
import { useAnalysis, useSelectedAnalysis } from '../../state/selectors'
import { computeHash } from '../../services/ledger'
import { cn, fmtDateTime } from '../../utils/format'
import { sha256 } from '../../utils/sha256'
import { useQuery } from '../../utils/router'

const STATUS_STYLE: Record<string, { ring: string; chip: 'ok' | 'bad' | 'warn' | 'mute'; label: string }> = {
  VALID: { ring: 'border-ok/40 shadow-[0_0_30px_-14px_#34d399]', chip: 'ok', label: 'VALID' },
  HASH_MISMATCH: { ring: 'border-bad/70 shadow-[0_0_32px_-10px_#f87171]', chip: 'bad', label: 'HASH MISMATCH' },
  SIGNATURE_INVALID: { ring: 'border-bad/70 shadow-[0_0_32px_-10px_#f87171]', chip: 'bad', label: 'INVALID SIGNATURE' },
  LINK_BROKEN: { ring: 'border-bad/70 shadow-[0_0_32px_-10px_#f87171]', chip: 'bad', label: 'LINK BROKEN' },
  UNAUTHORIZED_SIGNER: { ring: 'border-bad/70 shadow-[0_0_32px_-10px_#f87171]', chip: 'bad', label: 'UNAUTHORISED SIGNER' },
  DOWNSTREAM_INVALID: { ring: 'border-warn/60', chip: 'warn', label: 'DOWNSTREAM INVALID' },
}

export function Explorer() {
  const a = useSelectedAnalysis()
  const an = useAnalysis()
  const select = useStore((s) => s.selectBatch)
  const { tamperBlock, restoreChain, backups, runScenario } = useStore((s) => ({ tamperBlock: s.tamperBlock, restoreChain: s.restoreChain, backups: s.backups, runScenario: s.runScenario }))
  const query = useQuery()
  const [sel, setSel] = useState(Math.max(0, (parseInt(query.get('block') ?? '1', 10) || 1) - 1))
  const [progress, setProgress] = useState<number | null>(null) // blocks already examined during validation
  const [verdict, setVerdict] = useState<null | { ok: boolean; at?: number }>(null)
  const [tamperIdx, setTamperIdx] = useState(2)
  const [qty, setQty] = useState<number>(0)
  const [ts, setTs] = useState<number>(0)
  const [field, setField] = useState<'quantity' | 'timestamp'>('quantity')
  const [recompute, setRecompute] = useState(true)
  const timer = useRef<number[]>([])
  const evs = a.events
  const hasBackup = !!backups[a.batch.batchId]

  useEffect(() => { setSel(Math.min(sel, Math.max(0, evs.length - 1))); setVerdict(null); setProgress(null) }, [a.batch.batchId])
  useEffect(() => { const e = evs[Math.min(tamperIdx, evs.length - 1)]; if (e) { setQty(e.quantity + Math.round(e.quantity * 0.2)); setTs(e.timestamp - 3 * 3600_000) } }, [tamperIdx, a.batch.batchId])
  useEffect(() => () => timer.current.forEach(clearTimeout), [])

  const validate = () => {
    timer.current.forEach(clearTimeout); timer.current = []
    setVerdict(null); setProgress(0)
    evs.forEach((_, i) => timer.current.push(window.setTimeout(() => setProgress(i + 1), (i + 1) * 650)))
    timer.current.push(window.setTimeout(() => { setVerdict({ ok: a.chain.valid, at: a.chain.brokenAt ?? undefined }); setProgress(null) }, evs.length * 650 + 450))
  }
  const validating = progress !== null
  const cur = evs[sel]
  const chk = a.chain.checks[sel]
  const recomputed = cur ? computeHash(cur) : ''
  const brokenNow = !a.chain.valid

  const applyTamper = () => {
    if (!evs[tamperIdx]) return
    tamperBlock(a.batch.batchId, tamperIdx, field === 'quantity' ? { quantity: qty } : { timestamp: ts }, recompute)
    setVerdict(null)
  }

  return (
    <>
      <PageHeader
        eyebrow="Blockchain / hash-chain explorer"
        title="Ledger explorer"
        subtitle="Every block stores SHA-256(block data + previous hash) and the custodian’s signature. Change history and every hash after it breaks."
        actions={
          <>
            <select className="input mono !w-[290px]" value={a.batch.batchId} onChange={(e) => select(e.target.value)}>
              {an.list.map((x) => <option key={x.batch.batchId} value={x.batch.batchId}>{x.batch.batchId} {x.chain.valid ? '' : '⚠ '}· {x.batch.product}</option>)}
            </select>
            <Btn variant="primary" icon={validating ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} onClick={validate} disabled={validating}>Validate chain</Btn>
          </>
        }
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={verdict ? (verdict.ok ? 'ok' : 'bad') : validating ? 'run' : brokenNow ? 'broken' : 'idle'}
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          className={cn('mb-5 flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-3.5',
            verdict ? (verdict.ok ? 'border-ok/40 bg-ok/10 text-ok' : 'border-bad/50 bg-bad/10 text-bad anim-shake') : validating ? 'border-brand/40 bg-brand/10 text-brand' : brokenNow ? 'border-bad/40 bg-bad/[0.08] text-bad' : 'border-line bg-white/[0.02] text-slate-300')}
        >
          {verdict ? (verdict.ok ? <CheckCircle2 size={22} /> : <AlertOctagon size={22} />) : validating ? <Loader2 className="animate-spin" size={20} /> : brokenNow ? <Unlink size={20} /> : <Link2 size={20} />}
          <div className="text-[14px]">
            {verdict?.ok && <b className="tracking-wide">CHAIN INTEGRITY VERIFIED</b>}
            {verdict && !verdict.ok && <><b className="tracking-wide">LEDGER TAMPERING DETECTED</b><span className="ml-3 font-semibold">BLOCK #{(verdict.at ?? 0) + 1} INVALID · DOWNSTREAM HASHES INVALID</span></>}
            {!verdict && validating && <b>Validating block {Math.min(progress!, evs.length)} of {evs.length}…</b>}
            {!verdict && !validating && brokenNow && <><b>COMPROMISED</b> — {a.chain.invalidCount} of {evs.length} blocks fail verification. Run “Validate chain” to see where it breaks.</>}
            {!verdict && !validating && !brokenNow && <>Chain looks intact. Press <b>Validate chain</b> to re-compute every hash, link and signature.</>}
          </div>
          {hasBackup && <Btn size="sm" variant="ok" className="ml-auto" icon={<RotateCcw size={14} />} onClick={() => { restoreChain(a.batch.batchId); setVerdict(null) }}>Restore original</Btn>}
        </motion.div>
      </AnimatePresence>

      {/* chain */}
      <div className="glass overflow-x-auto rounded-2xl p-5">
        <div className="flex min-w-max items-stretch">
          {evs.map((e, i) => {
            const c = a.chain.checks[i]
            const examined = progress === null || i < progress
            const scanning = progress !== null && i === progress
            const st = examined && !scanning ? STATUS_STYLE[c.status] : null
            const linkBad = i > 0 && examined && !scanning && !c.linkOk
            return (
              <div key={e.eventId} className="flex items-stretch">
                {i > 0 && (
                  <div className="flex w-16 flex-col items-center justify-center">
                    <div className={cn('h-0.5 w-full', linkBad ? 'bg-bad' : examined && !scanning ? 'bg-ok' : 'bg-slate-600')} style={linkBad ? { backgroundImage: 'repeating-linear-gradient(90deg,#f87171 0 6px,transparent 6px 10px)', background: 'none' } : undefined} />
                    <span className={cn('mt-1 rounded-full p-1', linkBad ? 'bg-bad/20 text-bad' : 'bg-white/5 text-slate-500')}>{linkBad ? <Unlink size={12} /> : <Link2 size={12} />}</span>
                  </div>
                )}
                <motion.button
                  layout onClick={() => setSel(i)}
                  animate={{ scale: scanning ? 1.03 : 1 }}
                  className={cn('relative w-[268px] shrink-0 rounded-2xl border-2 bg-ink-850/90 p-4 text-left transition', st ? st.ring : scanning ? 'border-brand shadow-[0_0_30px_-8px_#22d3ee]' : 'border-line', sel === i && 'outline outline-2 outline-offset-4 outline-brand/40')}
                >
                  {scanning && <div className="scanline" />}
                  <div className="flex items-center justify-between">
                    <span className="mono text-[13px] font-bold text-white">BLOCK {String(i + 1).padStart(3, '0')}</span>
                    {st ? <Badge tone={st.chip} dot>{st.label}</Badge> : <Badge tone="info">{scanning ? 'VERIFYING…' : 'PENDING'}</Badge>}
                  </div>
                  <div className="mt-3 space-y-1 text-[12px]">
                    <div className="flex justify-between"><span className="text-slate-500">Action</span><span className="font-semibold text-slate-100">{e.action}</span></div>
                    <div className="flex justify-between gap-2"><span className="text-slate-500">Actor</span><span className="truncate text-slate-200">{e.actor}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Time</span><span className="text-slate-200">{fmtDateTime(e.timestamp)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Quantity</span><span className="tabular-nums text-slate-200">{e.quantity.toLocaleString('en-US')} {e.unit}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Batch</span><span className="mono text-slate-300">{e.batchId.slice(-5)}</span></div>
                  </div>
                  <div className="mono mt-3 space-y-1 rounded-lg bg-ink-950/60 p-2 text-[10.5px]">
                    <div><span className="text-slate-500">prev </span><span className={linkBad ? 'text-bad' : 'text-slate-400'}>{e.previousHash.slice(0, 18)}…</span></div>
                    <div><span className="text-slate-500">hash </span><span className={st && st.chip === 'bad' ? 'text-bad' : 'text-ok'}>{e.currentHash.slice(0, 18)}…</span></div>
                  </div>
                </motion.button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3" title={cur ? `Block ${String(sel + 1).padStart(3, '0')} — ${cur.action}` : 'Block'} subtitle="Live re-computation of the selected block" right={chk && <Badge tone={STATUS_STYLE[chk.status].chip} dot>{STATUS_STYLE[chk.status].label}</Badge>}>
          {cur && chk && (
            <>
              <div className="grid gap-x-8 md:grid-cols-2">
                <div>
                  <Kv k="Index" v={cur.index + 1} /><Kv k="Timestamp" v={fmtDateTime(cur.timestamp)} /><Kv k="Batch ID" v={<span className="mono">{cur.batchId}</span>} />
                  <Kv k="Actor" v={cur.actor} /><Kv k="Location" v={cur.location} /><Kv k="Action" v={cur.action} /><Kv k="Quantity" v={`${cur.quantity.toLocaleString('en-US')} ${cur.unit}`} />
                </div>
                <div>
                  <Kv k="Payload digest (encrypted record)" v={<HashText hash={cur.payloadDigest} n={9} />} />
                  <Kv k="Previous hash" v={<HashText hash={cur.previousHash} n={9} />} />
                  <Kv k="Stored hash" v={<HashText hash={cur.currentHash} n={9} />} />
                  <Kv k="Recomputed hash" v={<span className={cn('mono text-[12px]', chk.hashOk ? 'text-ok' : 'text-bad')}>{recomputed.slice(0, 9)}…{recomputed.slice(-6)}</span>} />
                  <Kv k="Signature" v={<HashText hash={cur.signature} n={9} />} />
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl border border-line p-3 text-xs"><div className="label mb-1">Hash recompute</div><Check2 ok={chk.hashOk} label={chk.hashOk ? 'matches stored hash' : 'MISMATCH'} /></div>
                <div className="rounded-xl border border-line p-3 text-xs"><div className="label mb-1">Previous-block link</div><Check2 ok={chk.linkOk} label={chk.linkOk ? 'links to block ' + sel : 'LINK BROKEN'} /></div>
                <div className="rounded-xl border border-line p-3 text-xs"><div className="label mb-1">Custodian signature</div><Check2 ok={chk.sigOk} label={chk.sigOk ? 'verified' : 'INVALID'} /></div>
              </div>
              <p className="mt-3 text-xs text-slate-400">{chk.message}. Hash = SHA-256( index · timestamp · batch · actor · action · quantity · location · payload digest · previous hash ).</p>
              <div className="mono mt-2 text-[11px] text-slate-500">sha256(“{cur.eventId}…”) = {sha256(cur.eventId).slice(0, 16)}…</div>
            </>
          )}
        </Card>

        <Card className="xl:col-span-2" title="Attack simulator — modify history" subtitle="Edit a historical block and watch the chain break" icon={<Hammer size={15} className="text-bad" />}>
          <div className="space-y-3">
            <Field label="Block to modify">
              <select className="input" value={tamperIdx} onChange={(e) => setTamperIdx(+e.target.value)}>{evs.map((e, i) => <option key={e.eventId} value={i}>Block #{i + 1} — {e.action}</option>)}</select>
            </Field>
            <div className="flex gap-2">
              {(['quantity', 'timestamp'] as const).map((f) => <button key={f} onClick={() => setField(f)} className={cn('flex-1 rounded-lg border px-3 py-2 text-xs font-semibold capitalize', field === f ? 'border-bad/50 bg-bad/10 text-bad' : 'border-line text-slate-400')}>{f}</button>)}
            </div>
            {field === 'quantity'
              ? <Field label={`New quantity (was ${evs[tamperIdx]?.quantity.toLocaleString('en-US')})`}><input type="number" className="input" value={qty} onChange={(e) => setQty(+e.target.value)} /></Field>
              : <Field label={`New timestamp (was ${evs[tamperIdx] ? fmtDateTime(evs[tamperIdx].timestamp) : ''})`}><input className="input" readOnly value={fmtDateTime(ts)} /></Field>}
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300"><input type="checkbox" className="accent-red-400" checked={recompute} onChange={(e) => setRecompute(e.target.checked)} /> Attacker recomputes this block’s hash</label>
            <div className="flex gap-2">
              <Btn variant="danger" className="flex-1" icon={<Hammer size={14} />} onClick={applyTamper}>Tamper block</Btn>
              <Btn variant="ok" className="flex-1" icon={<RotateCcw size={14} />} onClick={() => { restoreChain(a.batch.batchId); setVerdict(null) }} disabled={!hasBackup}>Restore original</Btn>
            </div>
            <p className="text-[11.5px] leading-relaxed text-slate-500">Even with a recomputed hash the attacker cannot forge the custodian’s signature, and the next block’s <span className="mono">previousHash</span> no longer matches. Everything after the edit becomes untrusted.</p>
            <Btn size="sm" variant="ghost" onClick={() => runScenario('ledger', a.batch.batchId)}>…or run the “Ledger Tampering” scenario</Btn>
          </div>
        </Card>
      </div>

      <Card className="mt-5" title="Network ledger status" subtitle="Hash-chain health of every batch" bodyClassName="!px-0 !pb-2">
        <div className="max-h-72 overflow-auto">
          <table className="tbl">
            <thead><tr><th>Batch</th><th>Blocks</th><th>Valid</th><th>Chain</th><th>First failure</th></tr></thead>
            <tbody>
              {an.list.map((x) => (
                <tr key={x.batch.batchId} className="clickable" onClick={() => select(x.batch.batchId)}>
                  <td className="mono text-[12px] text-brand">{x.batch.batchId}</td><td>{x.events.length}</td><td>{x.events.length - x.chain.invalidCount}</td>
                  <td>{x.chain.valid ? <Badge tone="ok" dot>VALID</Badge> : <Badge tone="bad" dot>COMPROMISED</Badge>}</td>
                  <td className="text-xs text-slate-400">{x.chain.brokenAt !== null ? `Block #${x.chain.brokenAt + 1} · ${x.chain.checks[x.chain.brokenAt].status.replace(/_/g, ' ')}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
