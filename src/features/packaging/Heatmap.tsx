import { useState } from 'react'
import { motion } from 'framer-motion'
import { Flame } from 'lucide-react'
import { Badge, Card, Stat, Bar } from '../../components/ui'
import { useSelectedAnalysis } from '../../state/selectors'
import { usePackageRenders, CanvasView } from './usePackageRenders'
import { REGIONS } from '../../services/packaging'
import { RISK, regionConfidence } from '../../services/vision'
import { regionRect, PKG_H, PKG_W } from '../../utils/packageArt'
import { cn } from '../../utils/format'
import { PackageLab } from './PackagingVerification'

export function Heatmap() {
  const a = useSelectedAnalysis()
  const pk = a.worstPackage
  const r = usePackageRenders(a.batch, pk.qrId, pk.watermarkId, pk.mods)
  const [alpha, setAlpha] = useState(0.85)
  const [boxes, setBoxes] = useState(true)
  if (!r) return <Card><div className="p-8 text-center text-slate-400">Rendering packages…</div></Card>
  const ranked = r.diff.ranked
  const detected = ranked.filter((x) => RISK(x.score) !== 'GREEN')
  const top = ranked[0]
  const clean = RISK(top.score) === 'GREEN'
  const tone = (s: number) => (RISK(s) === 'RED' ? '#f87171' : RISK(s) === 'YELLOW' ? '#fbbf24' : '#34d399')

  const Panel = ({ title, children, sub }: { title: string; children: React.ReactNode; sub?: string }) => (
    <div>
      <div className="mb-2 flex items-center justify-between"><span className="text-[12.5px] font-semibold text-slate-200">{title}</span>{sub && <span className="text-[11px] text-slate-500">{sub}</span>}</div>
      <div className="relative overflow-hidden rounded-2xl border border-line bg-ink-950" style={{ aspectRatio: `${PKG_W}/${PKG_H}` }}>{children}</div>
    </div>
  )

  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Detected regions" value={clean ? 0 : detected.length} tone={clean ? 'ok' : 'bad'} sub="Red + yellow zones" />
        <Stat label="Highest risk" value={clean ? '—' : <span className="text-[19px]">{REGIONS[top.region].label}</span>} tone={clean ? 'ok' : 'bad'} sub={clean ? 'No significant difference' : 'Region with strongest pixel divergence'} />
        <Stat label="Confidence" value={clean ? '—' : `${regionConfidence(top.score)}%`} tone={clean ? 'ok' : 'warn'} sub="Localisation confidence (model, not certainty)" />
        <Stat label="Overall match" value={`${a.packaging.overall.toFixed(0)}%`} tone={a.packaging.overall > 85 ? 'ok' : 'bad'} sub={a.classification.label} />
      </div>
      <Card title="Tampering heatmap" subtitle="Registered render vs scanned package — pixel-level difference, blurred into a risk field" right={
        <div className="flex items-center gap-4 text-xs text-slate-300">
          <label className="flex items-center gap-2">Overlay <input type="range" min={0} max={1} step={0.05} value={alpha} onChange={(e) => setAlpha(+e.target.value)} className="accent-cyan-400" /></label>
          <label className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={boxes} onChange={(e) => setBoxes(e.target.checked)} className="accent-cyan-400" />Region boxes</label>
        </div>
      }>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Panel title="Original" sub="registered"><CanvasView canvas={r.registered} className="h-full w-full" /></Panel>
          <Panel title="Scanned" sub={pk.packageId}>
            <CanvasView canvas={r.scanned} className="h-full w-full" />
            {boxes && <svg viewBox={`0 0 ${PKG_W} ${PKG_H}`} className="absolute inset-0 h-full w-full">{detected.map((d) => { const q = regionRect(d.region); return <rect key={d.region} x={q.x - 3} y={q.y - 3} width={q.w + 6} height={q.h + 6} rx="6" fill="none" stroke={tone(d.score)} strokeWidth="2.5" strokeDasharray="6 4" /> })}</svg>}
          </Panel>
          <Panel title="Difference" sub="amplified"><CanvasView canvas={r.diff.diff} className="h-full w-full" /></Panel>
          <Panel title="Heatmap" sub="risk field">
            <CanvasView canvas={r.scanned} className="h-full w-full opacity-60" />
            <motion.div key={pk.packageId + JSON.stringify(pk.mods)} initial={{ opacity: 0 }} animate={{ opacity: alpha }} transition={{ duration: 1.1 }} className="absolute inset-0"><CanvasView canvas={r.diff.heat} className="h-full w-full" /></motion.div>
          </Panel>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-slate-300">
          <span className="flex items-center gap-2"><span className="h-3 w-6 rounded bg-bad" />RED · high probability of modification</span>
          <span className="flex items-center gap-2"><span className="h-3 w-6 rounded bg-warn" />YELLOW · moderate difference</span>
          <span className="flex items-center gap-2"><span className="h-3 w-6 rounded bg-ok/60" />GREEN · no significant difference</span>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3" title="Region analysis" subtitle="Where the scanned package diverges" icon={<Flame size={14} className="text-bad" />} bodyClassName="!px-0 !pb-2">
          <table className="tbl">
            <thead><tr><th>Region</th><th>Divergence</th><th>Risk</th><th className="text-right">Confidence</th></tr></thead>
            <tbody>
              {ranked.map((x) => (
                <tr key={x.region}>
                  <td className="text-slate-100">{REGIONS[x.region].label}</td>
                  <td className="w-[40%]"><Bar value={Math.max(3, x.score * 100)} tone={RISK(x.score) === 'RED' ? 'bad' : RISK(x.score) === 'YELLOW' ? 'warn' : 'ok'} height={5} /></td>
                  <td><Badge tone={RISK(x.score) === 'RED' ? 'bad' : RISK(x.score) === 'YELLOW' ? 'warn' : 'ok'}>{RISK(x.score)}</Badge></td>
                  <td className={cn('text-right tabular-nums', RISK(x.score) === 'GREEN' ? 'text-slate-500' : 'text-slate-100')}>{RISK(x.score) === 'GREEN' ? '—' : `${regionConfidence(x.score)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div className="xl:col-span-2"><PackageLab pkgId={pk.packageId} mods={pk.mods} /></div>
      </div>
    </>
  )
}
