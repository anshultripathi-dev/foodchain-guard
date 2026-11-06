import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Cpu, Loader2, ScanLine, ShieldAlert, ShieldCheck, Sparkles, Undo2 } from 'lucide-react'
import { Badge, Bar, Btn, Card, Check2, ScoreRing, scoreTone } from '../../components/ui'
import { PackageImage } from '../../components/PackageImage'
import { PackageViewer3D, type Highlight } from '../../components/3d/PackageViewer'
import { useStore } from '../../state/store'
import { useSelectedAnalysis } from '../../state/selectors'
import { NO_MODS, type PackageMods } from '../../models/types'
import { MOD_REGIONS, REGIONS, type RegionKey } from '../../services/packaging'
import { cn } from '../../utils/format'

export const MOD_LABEL: Record<keyof PackageMods, string> = {
  logo: 'Logo changed', expiry: 'Expiry reprinted', cert: 'Certification altered', qr: 'QR distorted', color: 'Colour shifted', structure: 'Structure altered', watermark: 'Watermark removed',
}

export function PackageLab({ pkgId, mods }: { pkgId: string; mods: PackageMods }) {
  const setMods = useStore((s) => s.setPackageMods)
  const run = useStore((s) => s.runScenario)
  const batchId = useStore((s) => s.selectedBatchId)
  return (
    <Card title="Package lab" subtitle="Alter the scanned package, or use a preset" icon={<Sparkles size={14} className="text-vio" />}>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(MOD_LABEL) as Array<keyof PackageMods>).map((k) => (
          <label key={k} className={cn('flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition', mods[k] ? 'border-bad/40 bg-bad/10 text-bad' : 'border-line text-slate-300 hover:bg-white/[0.04]')}>
            <input type="checkbox" className="accent-red-400" checked={mods[k]} onChange={(e) => setMods(pkgId, { [k]: e.target.checked })} />{MOD_LABEL[k]}
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn size="sm" variant="ok" icon={<Undo2 size={13} />} onClick={() => setMods(pkgId, NO_MODS)}>Authentic</Btn>
        <Btn size="sm" onClick={() => setMods(pkgId, { ...NO_MODS, expiry: true, color: true })}>Suspicious preset</Btn>
        <Btn size="sm" variant="danger" icon={<ShieldAlert size={13} />} onClick={() => run('counterfeit', batchId)}>Simulate counterfeit (raises incident)</Btn>
      </div>
    </Card>
  )
}

const PHASES = ['Capturing image', 'Normalising geometry & light', 'Extracting visual features', 'Comparing with registered fingerprint', 'Classifying (CNN head)']

export function PackagingVerification({ view3d }: { view3d?: boolean }) {
  const a = useSelectedAnalysis()
  const b = a.batch
  const pk = a.worstPackage
  const [phase, setPhase] = useState<number>(PHASES.length) // finished
  const timer = useRef<number[]>([])
  const run = () => {
    timer.current.forEach(clearTimeout); timer.current = []
    setPhase(0)
    PHASES.forEach((_, i) => timer.current.push(window.setTimeout(() => setPhase(i + 1), (i + 1) * 520)))
  }
  useEffect(() => () => timer.current.forEach(clearTimeout), [])
  const scanning = phase < PHASES.length
  const p = a.packaging
  const bad = a.classification.label !== 'AUTHENTIC' || !p.watermarkValid || !p.qrValid
  const highlights = !scanning ? [...new Set(p.tamperedRegions)].map((r) => ({ region: r, color: '#f87171' })) : []

  const rows: Array<[string, number]> = [['Logo', p.logo], ['Typography', p.typography], ['Color', p.color], ['Layout', p.layout], ['Security pattern', p.pattern]]

  // 3D viewer state
  const [hl, setHl] = useState<Highlight[]>([])
  const [beam, setBeam] = useState(false)
  const [spin, setSpin] = useState(true)
  const seqRef = useRef<number[]>([])
  const verify3d = () => {
    seqRef.current.forEach(clearTimeout); seqRef.current = []
    setHl([]); setBeam(true); setSpin(false)
    const order: Array<{ r: RegionKey; ok: boolean }> = [
      { r: 'qr', ok: p.qrValid }, { r: 'watermark', ok: p.watermarkValid }, { r: 'logo', ok: !p.tamperedRegions.includes('logo') }, { r: 'cert', ok: p.certMatch }, { r: 'expiry', ok: !p.tamperedRegions.includes('expiry') },
    ]
    order.forEach(({ r, ok }, i) => seqRef.current.push(window.setTimeout(() => setHl((h) => [...h, { region: r, color: ok ? '#34d399' : '#f87171', label: `${REGIONS[r].label} ${ok ? '✓' : '✕'}` }]), (i + 1) * 650)))
    seqRef.current.push(window.setTimeout(() => setBeam(false), order.length * 650 + 400))
  }
  useEffect(() => () => seqRef.current.forEach(clearTimeout), [])
  useEffect(() => { setHl([]) }, [b.batchId, JSON.stringify(pk.mods)])

  if (view3d) {
    return (
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <Card title="3D package viewer" subtitle={`${b.product} · ${pk.packageId}`} right={<><Btn size="sm" variant="ghost" onClick={() => setSpin(!spin)}>{spin ? 'Stop spin' : 'Auto-rotate'}</Btn><Btn size="sm" variant="primary" icon={<ScanLine size={13} />} onClick={verify3d}>Verify package</Btn></>} bodyClassName="!p-3">
          <PackageViewer3D batch={b} qrId={pk.qrId} watermarkId={pk.watermarkId} mods={pk.mods} highlights={hl.length ? hl : highlights} scanning={beam} autoRotate={spin} height={560} />
        </Card>
        <div className="space-y-5">
          <PackageLab pkgId={pk.packageId} mods={pk.mods} />
          <Card title="Verification result">
            <div className="space-y-2.5 text-[13px]">
              <div className="flex justify-between"><span className="text-slate-400">QR</span><Check2 ok={p.qrValid} label={p.qrValid ? 'Valid' : 'Distorted'} /></div>
              <div className="flex justify-between"><span className="text-slate-400">Watermark</span><Check2 ok={p.watermarkValid} label={p.watermarkValid ? 'Valid' : 'Invalid'} /></div>
              <div className="flex justify-between"><span className="text-slate-400">Logo</span><Check2 ok={p.logo > 85} label={`${p.logo.toFixed(0)}%`} /></div>
              <div className="flex justify-between"><span className="text-slate-400">Certification</span><Check2 ok={p.certMatch} label={p.certMatch ? 'Matches registry' : 'Altered'} /></div>
              <div className="flex justify-between"><span className="text-slate-400">Expiry label</span><Check2 ok={!p.tamperedRegions.includes('expiry')} label={p.tamperedRegions.includes('expiry') ? 'Reprinted' : 'Original'} /></div>
              <div className="flex justify-between"><span className="text-slate-400">Tamper regions</span><span className="font-semibold text-slate-100">{[...new Set(p.tamperedRegions)].length}</span></div>
            </div>
            <div className={cn('mt-4 rounded-xl border px-3 py-2.5 text-sm font-semibold', bad ? 'border-bad/40 bg-bad/10 text-bad' : 'border-ok/30 bg-ok/10 text-ok')}>{bad ? 'Counterfeit indicators found — compare against the registered design.' : 'Package matches the registered design.'}</div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_420px_1fr]">
        <Card title="Registered package" subtitle="Original design sealed at processing" right={<Badge tone="info">{b.packagingFingerprint}</Badge>}>
          <div className="mx-auto max-w-[280px]"><PackageImage batch={b} qrId={pk.qrId} watermarkId={pk.watermarkId} mods={NO_MODS} /></div>
        </Card>

        <Card title="AI comparison" subtitle="Computer-vision verification" glow right={<Btn size="sm" variant="primary" icon={scanning ? <Loader2 size={13} className="animate-spin" /> : <Cpu size={13} />} onClick={run} disabled={scanning}>Run AI comparison</Btn>}>
          {scanning ? (
            <div className="space-y-3 py-6">
              {PHASES.map((t, i) => (
                <div key={t} className={cn('flex items-center gap-3 text-[13px]', i < phase ? 'text-ok' : i === phase ? 'text-brand' : 'text-slate-600')}>
                  {i < phase ? <ShieldCheck size={15} /> : i === phase ? <Loader2 size={15} className="animate-spin" /> : <span className="h-3.5 w-3.5 rounded-full border border-slate-600" />}{t}
                </div>
              ))}
            </div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex flex-col items-center">
                <ScoreRing value={p.overall} size={132} stroke={12} label={`${p.overall.toFixed(0)}%`} sub="packaging match" />
                <div className={cn('mt-3 rounded-full border px-4 py-1 text-xs font-bold tracking-widest', a.classification.label === 'AUTHENTIC' ? 'border-ok/40 bg-ok/10 text-ok' : a.classification.label === 'SUSPICIOUS' ? 'border-warn/40 bg-warn/10 text-warn' : 'border-bad/40 bg-bad/10 text-bad')}>{a.classification.label}</div>
                <div className="mt-1 text-[11px] text-slate-500">model confidence {a.classification.confidence.toFixed(1)}% — not infallible</div>
              </div>
              <div className="mt-5 space-y-3">
                {rows.map(([l, v]) => (
                  <div key={l}><div className="mb-1 flex justify-between text-xs"><span className="text-slate-400">{l}</span><span className={cn('font-semibold tabular-nums', v >= 85 ? 'text-ok' : v >= 60 ? 'text-warn' : 'text-bad')}>{v.toFixed(0)}%</span></div><Bar value={v} tone={scoreTone(v)} height={5} /></div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-[13px]">
                <div className="rounded-xl border border-line p-3"><div className="label mb-1">QR</div><Check2 ok={p.qrValid} label={p.qrValid ? 'Valid' : 'Distorted'} /></div>
                <div className="rounded-xl border border-line p-3"><div className="label mb-1">Watermark</div><Check2 ok={p.watermarkValid} label={p.watermarkValid ? 'Valid' : 'Invalid'} /></div>
              </div>
              <div className={cn('mt-3 rounded-xl border px-3 py-2.5 text-center text-sm font-bold tracking-wide', bad ? 'border-bad/40 bg-bad/10 text-bad' : 'border-ok/30 bg-ok/10 text-ok')}>{bad ? 'PACKAGING MISMATCH' : 'PACKAGING VERIFIED'}</div>
            </motion.div>
          )}
        </Card>

        <Card title="Scanned package" subtitle={`${pk.packageId} · ${pk.qrId}`} right={bad && !scanning ? <Badge tone="bad" dot>differences marked</Badge> : <Badge tone="ok" dot>live scan</Badge>}>
          <div className="mx-auto max-w-[280px]"><PackageImage batch={b} qrId={pk.qrId} watermarkId={pk.watermarkId} mods={pk.mods} highlights={highlights} scanning={scanning} /></div>
        </Card>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <PackageLab pkgId={pk.packageId} mods={pk.mods} />
        <Card className="xl:col-span-2" title="Why packaging matters" subtitle="A copied QR can still point to a legitimate ledger record">
          <p className="text-[13px] leading-relaxed text-slate-300">QR validity alone proves nothing about the box in your hand. FoodChain Guard re-derives a <b className="text-white">packaging fingerprint</b> — logo geometry, typography, colour, layout, micro-pattern and an embedded watermark — and compares it with the one sealed at the processing plant. If the QR is valid but the fingerprint disagrees, the system concludes <b className="text-bad">possible counterfeit / QR replay</b>.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {Object.entries(MOD_REGIONS).filter(([k]) => pk.mods[k as keyof PackageMods]).map(([k, v]) => <Badge key={k} tone="bad">{MOD_LABEL[k as keyof PackageMods]} → {v.map((r) => REGIONS[r].label).join(', ')}</Badge>)}
            {!bad && <Badge tone="ok" dot>No differences detected</Badge>}
          </div>
        </Card>
      </div>
    </>
  )
}
