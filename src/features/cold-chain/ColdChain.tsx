import { useMemo, useState } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, Area } from 'recharts'
import { Droplets, Flame, RotateCcw, Snowflake, Thermometer } from 'lucide-react'
import { Badge, Btn, Card, Kv, PageHeader, Stat, StatusBadge, ScoreRing } from '../../components/ui'
import { useStore } from '../../state/store'
import { useAnalysis, useSelectedAnalysis } from '../../state/selectors'
import { AXIS, GRID, TOOLTIP_STYLE } from '../../components/charts'
import { fmtTime, fmtDateTime, cn } from '../../utils/format'
import { navigate } from '../../utils/router'
import { NOW } from '../../utils/clock'

export function ColdChain() {
  const a = useSelectedAnalysis()
  const an = useAnalysis()
  const { telemetry, settings, run, reset, select, safetyLog } = useStore((s) => ({ telemetry: s.telemetry, settings: s.settings, run: s.runScenario, reset: s.resetTelemetry, select: s.selectBatch, safetyLog: s.safetyLog }))
  const [temp, setTemp] = useState(14.8)
  const [mins, setMins] = useState(43)
  const pts = telemetry[a.batch.batchId] ?? []
  const data = useMemo(() => pts.map((p) => ({ t: p.t, label: fmtTime(p.t), temp: p.tempC, over: p.tempC > settings.maxTempC || p.tempC < settings.minTempC ? p.tempC : null, hum: p.humidity })), [pts, settings])
  const c = a.cold
  const violating = c.violation
  const lastEntry = safetyLog.find((e) => e.batchId === a.batch.batchId)
  const violations = an.list.filter((x) => x.cold.violation)
  const run0 = c.runs[0]

  return (
    <>
      <PageHeader
        eyebrow="IoT cold-chain monitoring"
        title="Cold chain"
        subtitle="Live (simulated) sensor telemetry for temperature and humidity. Safe range is 2–8 °C; anything outside it for two consecutive samples is a violation."
        actions={<><StatusBadge status={c.status} /><select className="input mono !w-[290px]" value={a.batch.batchId} onChange={(e) => select(e.target.value)}>{an.list.map((x) => <option key={x.batch.batchId} value={x.batch.batchId}>{x.batch.batchId} {x.cold.violation ? '⚠ ' : ''}· {x.batch.product}</option>)}</select></>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Temperature" value={<span className={violating ? 'text-bad' : 'text-ok'}>{c.current.toFixed(1)}°C</span>} tone={violating ? 'bad' : 'ok'} icon={<Thermometer size={16} />} sub="Current reading" />
        <Stat label="Humidity" value={`${c.humidity}%`} tone="info" icon={<Droplets size={16} />} sub={`target ${a.batch.storage.humidityMin}–${a.batch.storage.humidityMax}%`} />
        <Stat label="Safe range" value={`${settings.minTempC}–${settings.maxTempC}°C`} tone="mute" icon={<Snowflake size={16} />} sub="Batch storage requirement" />
        <Stat label="Excursion" value={c.excursionMinutes ? `${c.excursionMinutes} min` : '0 min'} tone={violating ? 'bad' : 'ok'} icon={<Flame size={16} />} sub={violating ? `peak ${Math.max(...c.runs.map((r) => r.peak)).toFixed(1)}°C` : 'none in last 24 h'} />
        <Stat label="Storage score" value={c.storageScore} tone={c.storageScore >= 85 ? 'ok' : c.storageScore >= 60 ? 'warn' : 'bad'} icon={<Thermometer size={16} />} sub="Feeds food-safety score" />
      </div>

      {violating && (
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-2xl border border-bad/50 bg-bad/10 px-5 py-4 anim-shake">
          <Flame className="text-bad" size={26} />
          <div>
            <div className="text-lg font-extrabold tracking-wide text-bad">COLD CHAIN VIOLATION</div>
            <div className="text-[13px] text-slate-200">{Math.max(...c.runs.map((r) => r.peak)).toFixed(1)}°C for {run0?.minutes} minutes · affected batch <b className="mono">{a.batch.batchId}</b> ({a.batch.product})</div>
          </div>
          {lastEntry && <div className="ml-auto text-right text-xs text-slate-300">Food safety score <b className="text-ok">{lastEntry.before}</b> → <b className="text-bad">{lastEntry.after}</b></div>}
          <Btn size="sm" onClick={() => navigate('/app/food-safety')}>See food-safety impact →</Btn>
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-4">
        <Card className="xl:col-span-3" title="Temperature — last 24 hours" subtitle={`${a.batch.batchId} · sensor TH-${a.batch.batchId.slice(-3)} · 15-minute samples`}>
          <div className="h-[330px]">
            <ResponsiveContainer>
              <ComposedChart data={data} margin={{ left: -14, right: 12, top: 10 }}>
                <defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22d3ee" stopOpacity={0.25} /><stop offset="1" stopColor="#22d3ee" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid {...GRID} vertical={false} />
                <XAxis dataKey="label" {...AXIS} interval={11} /><YAxis {...AXIS} domain={[0, Math.max(12, Math.ceil(c.max + 1))]} unit="°" />
                <ReferenceArea y1={settings.minTempC} y2={settings.maxTempC} fill="#34d399" fillOpacity={0.08} stroke="#34d399" strokeOpacity={0.25} strokeDasharray="4 4" />
                <ReferenceLine y={settings.maxTempC} stroke="#f87171" strokeDasharray="5 5" label={{ value: `max ${settings.maxTempC}°C`, fill: '#f87171', fontSize: 11, position: 'insideTopRight' }} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number, n) => [`${v}°C`, n === 'over' ? 'Out of range' : 'Temperature']} />
                <Area type="monotone" dataKey="temp" stroke="none" fill="url(#tg)" />
                <Line type="monotone" dataKey="temp" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive />
                <Line type="monotone" dataKey="over" stroke="#f87171" strokeWidth={3.5} dot={{ r: 3, fill: '#f87171' }} connectNulls={false} isAnimationActive />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <div className="space-y-5">
          <Card title="Status"><div className="flex items-center gap-4"><ScoreRing value={c.storageScore} size={96} stroke={10} sub="storage" /><div className="text-[13px]"><div className={cn('text-lg font-extrabold', violating ? 'text-bad' : 'text-ok')}>{c.status}</div><div className="text-xs text-slate-400">{violating ? 'Isolate and test the batch' : 'Within the 2–8 °C window'}</div></div></div>
            <div className="mt-3"><Kv k="Mean" v={`${c.mean.toFixed(1)}°C`} /><Kv k="Min / max" v={`${c.min.toFixed(1)} / ${c.max.toFixed(1)}°C`} /><Kv k="Std. dev." v={`${c.stdev.toFixed(2)}°C`} /><Kv k="Last sample" v={fmtDateTime(NOW)} /></div></Card>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card title="Attack / demo simulator" subtitle="Fail the refrigeration unit and watch every dashboard react" icon={<Flame size={14} className="text-bad" />}>
          <div className="space-y-4">
            <div><div className="mb-1 flex justify-between text-xs text-slate-400"><span>Injected temperature</span><b className="text-bad">{temp.toFixed(1)}°C</b></div><input type="range" min={6} max={25} step={0.2} value={temp} onChange={(e) => setTemp(+e.target.value)} className="w-full accent-red-400" /></div>
            <div><div className="mb-1 flex justify-between text-xs text-slate-400"><span>Duration</span><b className="text-bad">{mins} min</b></div><input type="range" min={15} max={180} step={1} value={mins} onChange={(e) => setMins(+e.target.value)} className="w-full accent-red-400" /></div>
            <div className="flex gap-2">
              <Btn variant="danger" className="flex-1" icon={<Flame size={14} />} onClick={() => run('cold', a.batch.batchId, { tempC: temp, minutes: mins })}>Inject excursion (6°C → {temp.toFixed(0)}°C)</Btn>
              <Btn variant="ok" icon={<RotateCcw size={14} />} onClick={() => reset(a.batch.batchId)}>Restore</Btn>
            </div>
            <Btn size="sm" variant="ghost" onClick={() => { setTemp(14.8); setMins(43) }}>Use demo values (14.8°C · 43 min)</Btn>
          </div>
        </Card>
        <Card title="Violations across the network" bodyClassName="!px-0 !pb-2">
          <table className="tbl"><thead><tr><th>Batch</th><th>Product</th><th>Peak</th><th>Duration</th></tr></thead>
            <tbody>
              {violations.map((x) => <tr key={x.batch.batchId} className="clickable" onClick={() => select(x.batch.batchId)}><td className="mono text-[12px] text-brand">{x.batch.batchId}</td><td>{x.batch.emoji} {x.batch.product}</td><td className="text-bad">{Math.max(...x.cold.runs.map((r) => r.peak)).toFixed(1)}°C</td><td>{x.cold.excursionMinutes} min</td></tr>)}
              {violations.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-slate-400">No cold-chain violations.</td></tr>}
            </tbody></table>
          <div className="px-5 pt-2"><Badge tone="info">{violations.length} violation{violations.length === 1 ? '' : 's'}</Badge></div>
        </Card>
      </div>
    </>
  )
}
