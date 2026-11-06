import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Brain, ImagePlus, Loader2, Play, ShieldAlert, Upload } from 'lucide-react'
import { Badge, Bar, Btn, Card, Check2, ScoreRing, scoreTone } from '../../components/ui'
import { PackageImage } from '../../components/PackageImage'
import { useStore } from '../../state/store'
import { useSelectedAnalysis } from '../../state/selectors'
import { NO_MODS, type PackageMods } from '../../models/types'
import { classify, packagingScores, REGIONS, type PackagingScores } from '../../services/packaging'
import { computeDiff, drawPackageFront, newCanvas, PKG_H, PKG_W } from '../../utils/packageArt'
import { RISK, regionConfidence, scoresFromDiff } from '../../services/vision'
import { cn } from '../../utils/format'
import { PackageLab } from './PackagingVerification'

type Source = { kind: 'store' } | { kind: 'sample'; name: string; mods: PackageMods } | { kind: 'upload'; name: string; canvas: HTMLCanvasElement }

const SAMPLES: Array<{ name: string; mods: PackageMods }> = [
  { name: 'Authentic sample', mods: NO_MODS },
  { name: 'Suspicious sample', mods: { ...NO_MODS, expiry: true, color: true } },
  { name: 'Counterfeit sample', mods: { ...NO_MODS, logo: true, expiry: true, structure: true, watermark: true } },
]
const LAYERS = ['Pre-processing', 'Convolutional feature extraction', 'Fingerprint comparison', 'Watermark & QR decoders', 'Classification head']
const WEIGHTS: Array<[string, keyof PackagingScores | 'wm' | 'qr', number]> = [
  ['Logo match', 'logo', 0.3], ['Typography match', 'typography', 0.2], ['Color match', 'color', 0.1], ['Layout match', 'layout', 0.25], ['Security pattern', 'pattern', 0.15],
]

export function AiDetection() {
  const a = useSelectedAnalysis()
  const b = a.batch
  const pk = a.worstPackage
  const run = useStore((s) => s.runScenario)
  const [src, setSrc] = useState<Source>({ kind: 'store' })
  const [layer, setLayer] = useState<number>(LAYERS.length)
  const [result, setResult] = useState<{ scores: PackagingScores; ranked: ReturnType<typeof computeDiff>['ranked'] } | null>(null)
  const timers = useRef<number[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<HTMLCanvasElement | null>(null)

  const compute = (s: Source) => {
    const reg = newCanvas()
    drawPackageFront(reg.getContext('2d')!, b, { mods: NO_MODS, qrId: pk.qrId, watermarkId: pk.watermarkId })
    const mods = s.kind === 'store' ? pk.mods : s.kind === 'sample' ? s.mods : null
    let scn: HTMLCanvasElement
    if (s.kind === 'upload') scn = s.canvas
    else { scn = newCanvas(); drawPackageFront(scn.getContext('2d')!, b, { mods: mods!, qrId: pk.qrId, watermarkId: pk.watermarkId }) }
    const d = computeDiff(reg, scn)
    const scores = s.kind === 'upload' ? scoresFromDiff(d) : packagingScores(mods!, pk.packageId)
    setPreview(scn)
    setResult({ scores, ranked: d.ranked })
  }

  const start = (s: Source = src) => {
    timers.current.forEach(clearTimeout); timers.current = []
    setLayer(0); setResult(null)
    LAYERS.forEach((_, i) => timers.current.push(window.setTimeout(() => setLayer(i + 1), (i + 1) * 480)))
    timers.current.push(window.setTimeout(() => compute(s), LAYERS.length * 480))
  }
  useEffect(() => { start({ kind: 'store' }); return () => timers.current.forEach(clearTimeout) }, [b.batchId]) // eslint-disable-line
  const running = layer < LAYERS.length
  const onFile = (f?: File) => {
    if (!f) return
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => {
      const c = newCanvas()
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PKG_W, PKG_H)
      const k = Math.min(PKG_W / img.width, PKG_H / img.height)
      ctx.drawImage(img, (PKG_W - img.width * k) / 2, (PKG_H - img.height * k) / 2, img.width * k, img.height * k)
      const s: Source = { kind: 'upload', name: f.name, canvas: c }
      setSrc(s); start(s)
      URL.revokeObjectURL(url)
    }
    img.src = url
  }

  const sc = result?.scores
  const cls = sc ? classify(sc) : null
  const authScore = sc ? Math.min(99.2, sc.overall * 0.99 + (sc.watermarkValid ? 2.2 : -18) + (sc.qrValid ? 1.2 : -8)) : 0
  const final = sc ? Math.max(1, Math.min(99.2, authScore)) : 0
  const regions = result?.ranked.filter((x) => RISK(x.score) !== 'GREEN') ?? []

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <div className="space-y-5">
        <Card title="Input — packaging image" subtitle="Upload a photo or choose a sample">
          <div
            onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files?.[0]) }}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-brand/40 bg-brand/[0.04] p-5 text-center hover:bg-brand/[0.08]"
          >
            <Upload className="text-brand" size={22} /><div className="text-[13px] font-semibold text-slate-100">Drop a package image here</div><div className="text-xs text-slate-500">or click to browse · analysed in your browser</div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          </div>
          <div className="mt-3 grid gap-2">
            <Btn size="sm" onClick={() => { const s: Source = { kind: 'store' }; setSrc(s); start(s) }} variant={src.kind === 'store' ? 'primary' : 'outline'}>Current scanned package ({pk.packageId})</Btn>
            {SAMPLES.map((s) => <Btn key={s.name} size="sm" variant={src.kind === 'sample' && src.name === s.name ? 'primary' : 'outline'} icon={<ImagePlus size={13} />} onClick={() => { const so: Source = { kind: 'sample', ...s }; setSrc(so); start(so) }}>{s.name}</Btn>)}
          </div>
          <div className="mt-4 mx-auto max-w-[220px]">
            {preview ? <div className="relative overflow-hidden rounded-2xl border border-line"><img src={preview.toDataURL()} className="w-full" alt="" />{running && <div className="scanline" />}</div> : <PackageImage batch={b} qrId={pk.qrId} watermarkId={pk.watermarkId} mods={pk.mods} scanning />}
          </div>
        </Card>
        <Card title="Counterfeit scenario" subtitle="Writes to the shared state (heatmap, SOC, dashboards)">
          <Btn variant="danger" className="w-full" icon={<ShieldAlert size={14} />} onClick={() => { run('counterfeit', b.batchId); setSrc({ kind: 'store' }); start({ kind: 'store' }) }}>Simulate counterfeit packaging</Btn>
          <Btn variant="ok" className="mt-2 w-full" onClick={() => { run('authentic', b.batchId); setSrc({ kind: 'store' }); start({ kind: 'store' }) }}>Restore authentic</Btn>
        </Card>
        <PackageLab pkgId={pk.packageId} mods={pk.mods} />
      </div>

      <div className="space-y-5">
        <Card title="AI counterfeit detection" subtitle="Simulated CNN inference with explainable components" glow right={<Btn size="sm" variant="primary" icon={running ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} onClick={() => start()} disabled={running}>Re-run inference</Btn>}>
          {running || !sc || !cls ? (
            <div className="grid gap-2 py-6 sm:grid-cols-5">
              {LAYERS.map((l, i) => (
                <div key={l} className={cn('rounded-xl border p-3 text-center text-[11.5px] transition', i < layer ? 'border-ok/40 bg-ok/10 text-ok' : i === layer ? 'border-brand/50 bg-brand/10 text-brand' : 'border-line text-slate-600')}>
                  <Brain size={16} className="mx-auto mb-1.5" />{l}
                </div>
              ))}
            </div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex flex-wrap items-center gap-8">
                <div className="flex items-center gap-5">
                  <ScoreRing value={final} size={150} stroke={13} label={`${final.toFixed(1)}%`} sub="authenticity score" />
                  <div>
                    <div className="label">Classification</div>
                    <div className={cn('text-3xl font-extrabold tracking-tight', cls.label === 'AUTHENTIC' ? 'text-ok' : cls.label === 'SUSPICIOUS' ? 'text-warn' : 'text-bad')}>{cls.label}</div>
                    <div className="mt-1 text-xs text-slate-400">Confidence {cls.confidence.toFixed(1)}% · human review advised below 90%</div>
                  </div>
                </div>
                <div className="min-w-[240px] flex-1 space-y-2.5">
                  {(['AUTHENTIC', 'SUSPICIOUS', 'COUNTERFEIT'] as const).map((k) => (
                    <div key={k}><div className="mb-1 flex justify-between text-xs"><span className="text-slate-300">{k[0] + k.slice(1).toLowerCase()}</span><span className="mono text-slate-200">{cls.probs[k].toFixed(1)}%</span></div><Bar value={cls.probs[k]} tone={k === 'AUTHENTIC' ? 'ok' : k === 'SUSPICIOUS' ? 'warn' : 'bad'} height={7} /></div>
                  ))}
                </div>
              </div>
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div>
                  <div className="label mb-2">Explainable components</div>
                  <table className="tbl"><thead><tr><th>Feature</th><th className="text-right">Match</th><th className="text-right">Weight</th><th className="text-right">Points lost</th></tr></thead>
                    <tbody>
                      {WEIGHTS.map(([l, k, w]) => { const v = sc[k as keyof PackagingScores] as number; return (
                        <tr key={l}><td>{l}</td><td className={cn('text-right tabular-nums', v >= 85 ? 'text-ok' : v >= 60 ? 'text-warn' : 'text-bad')}>{v.toFixed(0)}%</td><td className="text-right text-slate-500">{(w * 100).toFixed(0)}%</td><td className="text-right tabular-nums text-slate-300">−{((100 - v) * w).toFixed(1)}</td></tr>) })}
                      <tr><td>Watermark</td><td className="text-right"><Check2 ok={sc.watermarkValid} label={sc.watermarkValid ? 'valid' : 'invalid'} /></td><td className="text-right text-slate-500">gate</td><td className="text-right text-slate-300">{sc.watermarkValid ? '—' : '−20'}</td></tr>
                      <tr><td>QR</td><td className="text-right"><Check2 ok={sc.qrValid} label={sc.qrValid ? 'valid' : 'distorted'} /></td><td className="text-right text-slate-500">gate</td><td className="text-right text-slate-300">{sc.qrValid ? '—' : '−9'}</td></tr>
                    </tbody>
                  </table>
                </div>
                <div>
                  <div className="label mb-2">Detected regions ({regions.length})</div>
                  {regions.length === 0 ? <div className="rounded-xl border border-ok/30 bg-ok/10 p-3 text-sm text-ok">No suspicious regions localised.</div> : (
                    <div className="space-y-2">{regions.map((r) => (
                      <div key={r.region} className="flex items-center justify-between rounded-xl border border-line px-3 py-2 text-[13px]">
                        <span className="text-slate-100">{REGIONS[r.region].label}</span>
                        <span className="flex items-center gap-2"><Badge tone={RISK(r.score) === 'RED' ? 'bad' : 'warn'}>{RISK(r.score)}</Badge><span className="mono text-xs text-slate-400">{regionConfidence(r.score)}%</span></span>
                      </div>))}</div>
                  )}
                  {src.kind === 'upload' && <p className="mt-3 text-[11.5px] leading-relaxed text-slate-500">Uploaded photos are compared pixel-wise against the registered render. A real deployment would use a trained CNN + geometric alignment; this prototype simulates inference deterministically.</p>}
                </div>
              </div>
            </motion.div>
          )}
        </Card>
      </div>
    </div>
  )
}
export { scoreTone }
