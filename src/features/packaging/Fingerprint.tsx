import { useMemo } from 'react'
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import { BadgeCheck, ShieldX } from 'lucide-react'
import { Badge, Card, HashText, ScoreRing } from '../../components/ui'
import { useSelectedAnalysis } from '../../state/selectors'
import { fingerprintComponents, fingerprintDigest } from '../../services/packaging'
import { NO_MODS } from '../../models/types'
import { cn } from '../../utils/format'
import { TOOLTIP_STYLE } from '../../components/charts'

function Poly({ pts, color, dash }: { pts: number[]; color: string; dash?: boolean }) {
  const n = pts.length
  const d = pts.map((r, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; return `${i ? 'L' : 'M'}${(60 + Math.cos(a) * r * 50).toFixed(1)},${(60 + Math.sin(a) * r * 50).toFixed(1)}` }).join(' ') + 'Z'
  return <path d={d} fill={color + '22'} stroke={color} strokeWidth="2" strokeDasharray={dash ? '4 3' : undefined} />
}

export function Fingerprint() {
  const a = useSelectedAnalysis()
  const pk = a.worstPackage
  const reg = useMemo(() => fingerprintComponents(a.batch.batchId), [a.batch.batchId])
  const scn = useMemo(() => fingerprintComponents(a.batch.batchId, pk.mods), [a.batch.batchId, pk.mods])
  const regDigest = fingerprintDigest(reg), scnDigest = fingerprintDigest(scn)
  const verified = regDigest === scnDigest
  const sim = a.packaging.overall
  const radar = [
    { k: 'Logo geometry', Registered: 100, Scanned: a.packaging.logo }, { k: 'Typography', Registered: 100, Scanned: a.packaging.typography },
    { k: 'Colour profile', Registered: 100, Scanned: a.packaging.color }, { k: 'Layout', Registered: 100, Scanned: a.packaging.layout },
    { k: 'Micro-pattern', Registered: 100, Scanned: a.packaging.pattern }, { k: 'Watermark', Registered: 100, Scanned: a.packaging.watermarkValid ? 97 : 20 },
  ]
  const gridDiff = (x: number[], y: number[], i: number) => x[i] !== y[i]
  void NO_MODS
  return (
    <>
      <div className={cn('mb-5 flex flex-wrap items-center gap-4 rounded-2xl border px-5 py-4', verified ? 'border-ok/30 bg-ok/10' : 'border-bad/40 bg-bad/10')}>
        {verified ? <BadgeCheck className="text-ok" size={26} /> : <ShieldX className="text-bad" size={26} />}
        <div>
          <div className={cn('text-lg font-bold', verified ? 'text-ok' : 'text-bad')}>{verified ? 'Packaging fingerprint verified.' : 'Packaging fingerprint mismatch.'}</div>
          <div className="text-xs text-slate-400">{verified ? 'Scanned feature vector is identical to the registered fingerprint.' : 'The scanned package’s feature vector diverges from the registered fingerprint.'}</div>
        </div>
        <div className="ml-auto flex items-center gap-5">
          <div className="text-right"><div className="label">Registered</div><div className="mono text-xl font-bold text-white">{a.batch.packagingFingerprint}</div></div>
          <div className="text-right"><div className="label">Scanned</div><div className={cn('mono text-xl font-bold', verified ? 'text-ok' : 'text-bad')}>PF-{scnDigest.slice(0, 10).toUpperCase()}</div></div>
          <ScoreRing value={sim} size={80} stroke={8} label={`${sim.toFixed(0)}%`} sub="similarity" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Logo geometry" subtitle="Radial contour signature">
          <div className="flex items-center gap-4">
            <svg viewBox="0 0 120 120" className="h-36 w-36 shrink-0">
              {[0.33, 0.66, 1].map((r) => <circle key={r} cx="60" cy="60" r={r * 50} fill="none" stroke="rgba(148,163,184,.15)" />)}
              <Poly pts={reg.logoGeometry} color="#22d3ee" /><Poly pts={scn.logoGeometry} color={verified ? '#34d399' : '#f87171'} dash />
            </svg>
            <div className="space-y-1 text-xs"><div className="flex items-center gap-2"><span className="h-2 w-4 rounded bg-brand" />Registered</div><div className="flex items-center gap-2"><span className={cn('h-2 w-4 rounded', a.packaging.logo > 85 ? 'bg-ok' : 'bg-bad')} />Scanned · {a.packaging.logo.toFixed(0)}%</div></div>
          </div>
        </Card>
        <Card title="Typography" subtitle="Font metrics & glyph spacing">
          {[['Registered', reg.typography, 'text-slate-200'], ['Scanned', scn.typography, a.packaging.typography > 85 ? 'text-ok' : 'text-bad']].map(([l, list, c]) => (
            <div key={l as string} className="mb-3"><div className="label mb-1">{l as string}</div>{(list as string[]).map((t) => <div key={t} className={cn('mono text-[12px]', c as string)}>{t}</div>)}</div>
          ))}
        </Card>
        <Card title="Colour profile" subtitle="Dominant palette (Lab-space)">
          {[['Registered', reg.palette], ['Scanned', scn.palette]].map(([l, pal]) => (
            <div key={l as string} className="mb-3"><div className="label mb-1.5">{l as string}</div><div className="flex gap-2">{(pal as string[]).map((c) => <span key={c} className="h-8 w-8 rounded-lg border border-white/10" style={{ background: c }} title={c} />)}</div></div>
          ))}
          <div className="text-xs text-slate-400">Palette similarity <b className={a.packaging.color > 85 ? 'text-ok' : 'text-bad'}>{a.packaging.color.toFixed(0)}%</b></div>
        </Card>
        <Card title="Layout grid" subtitle="4 × 6 occupancy of the front panel">
          <div className="flex gap-6">
            {[['Registered', reg.layoutGrid, null], ['Scanned', scn.layoutGrid, reg.layoutGrid]].map(([l, g, cmp]) => (
              <div key={l as string}><div className="label mb-1.5">{l as string}</div>
                <div className="grid grid-cols-4 gap-1">{(g as number[]).map((v, i) => <span key={i} className={cn('h-5 w-5 rounded-sm', v ? 'bg-brand/60' : 'bg-white/[0.06]', cmp && gridDiff(g as number[], cmp as number[], i) && 'ring-2 ring-bad bg-bad/60')} />)}</div></div>
            ))}
          </div>
        </Card>
        <Card title="Micro-pattern" subtitle="8 × 8 print-texture bits">
          <div className="flex gap-6">
            {[['Registered', reg.microPattern, null], ['Scanned', scn.microPattern, reg.microPattern]].map(([l, g, cmp]) => (
              <div key={l as string}><div className="label mb-1.5">{l as string}</div>
                <div className="grid grid-cols-8 gap-[3px]">{(g as number[]).map((v, i) => <span key={i} className={cn('h-3.5 w-3.5 rounded-[3px]', v ? 'bg-vio/70' : 'bg-white/[0.06]', cmp && gridDiff(g as number[], cmp as number[], i) && 'ring-2 ring-bad bg-bad/70')} />)}</div></div>
            ))}
          </div>
        </Card>
        <Card title="Security markers & watermark">
          {[['Registered', reg.securityMarkers, 'text-slate-200'], ['Scanned', scn.securityMarkers, verified ? 'text-ok' : 'text-bad']].map(([l, list, c]) => (
            <div key={l as string} className="mb-3"><div className="label mb-1">{l as string}</div>{(list as string[]).map((t) => <div key={t} className={cn('text-[12.5px]', c as string)}>• {t}</div>)}</div>
          ))}
          <div className="flex items-center gap-2 text-xs"><Badge tone={a.packaging.watermarkValid ? 'ok' : 'bad'} dot>Watermark {a.batch.watermarkId}</Badge></div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Feature similarity" subtitle="Registered fingerprint (100%) vs scanned package">
          <div className="h-72">
            <ResponsiveContainer>
              <RadarChart data={radar} outerRadius="75%">
                <PolarGrid stroke="rgba(148,163,184,.2)" /><PolarAngleAxis dataKey="k" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Radar name="Registered" dataKey="Registered" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.12} />
                <Radar name="Scanned" dataKey="Scanned" stroke={verified ? '#34d399' : '#f87171'} fill={verified ? '#34d399' : '#f87171'} fillOpacity={0.3} />
                <Legend wrapperStyle={{ fontSize: 12 }} /><Tooltip {...TOOLTIP_STYLE} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Fingerprint digests" subtitle="SHA-256 over all extracted features">
          <div className="space-y-3 text-xs">
            <div><div className="label mb-1">Registered</div><HashText hash={regDigest} n={26} /></div>
            <div><div className="label mb-1">Scanned</div><HashText hash={scnDigest} n={26} /></div>
            <p className="leading-relaxed text-slate-400">Similarity is computed per feature (not by exact hash equality) so lighting, camera angle and print variance do not cause false alarms. The digest is the tamper-evident anchor; the score drives the authenticity decision.</p>
          </div>
        </Card>
      </div>
    </>
  )
}
