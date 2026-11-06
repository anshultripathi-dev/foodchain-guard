import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, BadgeCheck, ChevronDown, Leaf, LogOut, MapPin, QrCode, ScanLine, ShieldAlert, ShieldCheck, Sparkles, Thermometer } from 'lucide-react'
import { useStore } from '../../state/store'
import { useAnalysis } from '../../state/selectors'
import type { BatchAnalysis } from '../../services/analysis'
import { fmtDate, cn, fmtShortDate } from '../../utils/format'
import { navigate } from '../../utils/router'
import { PackageImage } from '../../components/PackageImage'
import { DEMO_TARGETS } from '../../data/seed'
import { HERO_BATCH } from '../../services/incidents'

type Screen = 'scan' | 'result' | 'journey' | 'ask'

interface Outcome { tone: 'good' | 'caution' | 'bad'; title: string; sub: string; reasons: string[] }

function outcomeOf(a: BatchAnalysis): Outcome {
  const reasons: string[] = []
  if (!a.packaging.watermarkValid || a.classification.label !== 'AUTHENTIC') reasons.push('The packaging does not match what the farm registered.')
  if (a.qr.replay) reasons.push('This code has been scanned in several far-apart cities within hours — it may have been copied.')
  if (!a.chain.valid) reasons.push('The product’s record has been changed after the fact.')
  if (!a.batch.certValid) reasons.push(`The ${a.batch.certification} certificate could not be confirmed.`)
  if (a.unaccounted > 0) reasons.push('Some units of this batch are unaccounted for.')
  if (a.cold.violation) reasons.push('It was kept too warm for a while during storage.')
  if (a.days < 0) reasons.push('It is past its expiry date.')
  if (a.batch.hold === 'RECALLED') return { tone: 'bad', title: 'Recalled — please don’t eat this', sub: 'This batch has been recalled. Return it to the store.', reasons: ['A recall notice is active for this batch.', ...reasons] }
  if (a.batch.hold === 'BLOCKED') return { tone: 'bad', title: 'Not verified', sub: 'This batch is on hold while our security team investigates.', reasons }
  if (a.days < 0) return { tone: 'bad', title: 'Past its date', sub: 'Please do not eat this product.', reasons }
  if (a.trust.verdict !== 'AUTHENTIC') return { tone: 'bad', title: 'We couldn’t verify this product', sub: 'It may be counterfeit. Don’t buy or eat it — tell the store.', reasons }
  if (a.cold.violation) return { tone: 'caution', title: 'Verified — with a storage warning', sub: 'The product is genuine, but its cold storage slipped.', reasons }
  return { tone: 'good', title: 'PRODUCT VERIFIED', sub: 'This is the real thing, and its journey checks out.', reasons: [] }
}

const STEPS = [
  { emoji: '🌱', t: 'Grown', k: 0 }, { emoji: '🏭', t: 'Cleaned & packed', k: 1 }, { emoji: '🚚', t: 'Shipped', k: 2 },
  { emoji: '❄️', t: 'Kept cold', k: 3 }, { emoji: '🛒', t: 'On the shelf', k: 4 }, { emoji: '✅', t: 'Checked', k: 5 },
]

function Ring({ v }: { v: number }) {
  const r = 34, c = 2 * Math.PI * r
  const col = v >= 85 ? '#15803d' : v >= 60 ? '#d97706' : '#b91c1c'
  return (
    <svg width="88" height="88" className="-rotate-90"><circle cx="44" cy="44" r={r} stroke="#e7e5e4" strokeWidth="9" fill="none" /><circle cx="44" cy="44" r={r} stroke={col} strokeWidth="9" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ transition: 'stroke-dashoffset 1s' }} /></svg>
  )
}

export function ConsumerApp() {
  const an = useAnalysis()
  const { selected, select, setRole } = useStore((s) => ({ selected: s.selectedBatchId, select: s.selectBatch, setRole: s.setRole }))
  const [screen, setScreen] = useState<Screen>('scan')
  const [scanning, setScanning] = useState(false)
  const [open, setOpen] = useState<number | null>(0)
  const a = an.byId[selected] ?? an.list[0]
  const timer = useRef<number>()
  useEffect(() => () => clearTimeout(timer.current), [])
  const out = useMemo(() => outcomeOf(a), [a])
  const b = a.batch

  const samples = [
    { id: HERO_BATCH, label: `${an.byId[HERO_BATCH].batch.emoji} Organic Alphonso Mango`, sub: 'From the shelf' },
    { id: DEMO_TARGETS.suspicious, label: `${an.byId[DEMO_TARGETS.suspicious].batch.emoji} A package that looks a bit off`, sub: 'Suspicious sample' },
    { id: DEMO_TARGETS.replay, label: `${an.byId[DEMO_TARGETS.replay].batch.emoji} A copied-looking QR code`, sub: 'Cloned-QR sample' },
  ]

  const scan = (id?: string) => {
    if (id) select(id)
    setScanning(true)
    timer.current = window.setTimeout(() => { setScanning(false); setScreen('result') }, 1500)
  }

  const answers = [
    ['Where was this grown?', `${b.farm} in ${b.origin}. It was harvested on ${fmtDate(b.harvestDate)}.`],
    ['Where was it processed?', a.events[1] ? `${a.events[1].actor} in ${a.events[1].location}, on ${fmtDate(a.events[1].timestamp)} — washed, sorted and packed.` : 'It hasn’t reached the processing step yet.'],
    ['Where was it stored?', a.events[3] ? `In a cold warehouse (${a.events[3].actor}, ${a.events[3].location}) from ${fmtShortDate(a.events[3].timestamp)}.` : 'It hasn’t reached a warehouse yet.'],
    ['When was it shipped?', a.events[2] ? `It left for the distribution hub on ${fmtDate(a.events[2].timestamp)} and reached the shop on ${a.events[4] ? fmtDate(a.events[4].timestamp) : 'its way'}.` : 'Not shipped yet.'],
    ['Was the cold chain maintained?', a.cold.violation ? `Not fully — it got too warm for about ${a.cold.excursionMinutes} minutes (${Math.max(...a.cold.runs.map((r) => r.peak)).toFixed(0)}°C). Quality may be affected.` : `Yes. It stayed between 2 and 8 °C — right now ${a.cold.current.toFixed(1)}°C.`],
    ['Was the product verified?', out.tone === 'good' ? 'Yes. The pack, its code and every hand-off were checked against the farm’s original record, and they all agree.' : `We found a problem: ${out.reasons[0] ?? 'it could not be confirmed.'}`],
  ]

  return (
    <div className="consumer-bg min-h-screen font-sans" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-700 text-white"><Leaf size={18} /></span><span className="text-lg font-bold text-stone-900" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>FoodChain Guard</span></div>
        <button onClick={() => { setRole('admin'); navigate('/app/overview') }} className="flex items-center gap-2 rounded-full border border-stone-300 bg-white/70 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-white"><LogOut size={14} /> Exit consumer mode</button>
      </header>

      <div className="mx-auto grid max-w-6xl items-start gap-10 px-6 pb-16 lg:grid-cols-[1fr_430px]">
        <div className="hidden pt-10 lg:block">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800"><Sparkles size={14} /> For shoppers</div>
          <h1 className="mt-4 text-5xl leading-[1.08] text-stone-900" style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 700 }}>Know your food.<br />Trust every bite.</h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-stone-600">Scan the code on the pack. In seconds you’ll see where your food was grown, how it travelled, and whether it’s the real thing.</p>
          <ul className="mt-8 space-y-3 text-stone-700">
            {['See the farm it came from', 'Check it was kept cold the whole way', 'Spot fakes and copied codes', 'No account, no jargon'].map((t) => <li key={t} className="flex items-center gap-3"><BadgeCheck size={20} className="text-emerald-700" />{t}</li>)}
          </ul>
        </div>

        {/* phone */}
        <div className="mx-auto w-full max-w-[430px]">
          <div className="flex h-[780px] flex-col overflow-hidden rounded-[2.4rem] border-[10px] border-stone-900 bg-[#fffdf7] shadow-2xl">
            <div className="flex items-center justify-between bg-[#fffdf7] px-6 pb-1 pt-3 text-[11px] font-semibold text-stone-500"><span>9:41</span><span>● ● ●</span></div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 pt-2">
              <AnimatePresence mode="wait">
                {screen === 'scan' && (
                  <motion.div key="scan" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <h2 className="text-2xl text-stone-900" style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 700 }}>Scan your product</h2>
                    <p className="mt-1 text-sm text-stone-500">Point your camera at the QR code on the pack.</p>
                    <div className="relative mx-auto mt-5 aspect-[3/4] w-[78%] overflow-hidden rounded-3xl bg-stone-900">
                      <div className="absolute inset-2 opacity-95"><PackageImage batch={b} qrId={a.worstPackage.qrId} watermarkId={a.worstPackage.watermarkId} mods={a.worstPackage.mods} /></div>
                      {['left-3 top-3 border-l-4 border-t-4', 'right-3 top-3 border-r-4 border-t-4', 'left-3 bottom-3 border-b-4 border-l-4', 'right-3 bottom-3 border-b-4 border-r-4'].map((c) => <span key={c} className={cn('absolute h-9 w-9 rounded-md border-emerald-400', c)} />)}
                      {scanning && <div className="scanline" />}
                    </div>
                    <button onClick={() => scan()} disabled={scanning} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-700/25 active:scale-[.98] disabled:opacity-60"><ScanLine size={20} />{scanning ? 'Checking…' : 'Scan'}</button>
                    <div className="mt-6 text-xs font-semibold uppercase tracking-wider text-stone-400">Try a sample</div>
                    <div className="mt-2 space-y-2">{samples.map((s) => <button key={s.id} onClick={() => scan(s.id)} className={cn('flex w-full items-center justify-between rounded-2xl border bg-white px-4 py-3 text-left hover:border-emerald-600', selected === s.id ? 'border-emerald-600' : 'border-stone-200')}><span className="text-sm font-medium text-stone-800">{s.label}</span><span className="text-[11px] text-stone-400">{s.sub}</span></button>)}</div>
                  </motion.div>
                )}

                {screen === 'result' && (
                  <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <div className={cn('rounded-3xl p-6 text-center', out.tone === 'good' ? 'bg-emerald-700 text-white' : out.tone === 'caution' ? 'bg-amber-500 text-white' : 'bg-red-700 text-white')}>
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20">{out.tone === 'good' ? <ShieldCheck size={36} /> : out.tone === 'caution' ? <AlertTriangle size={34} /> : <ShieldAlert size={36} />}</motion.div>
                      <div className="mt-3 text-[22px] font-extrabold tracking-tight">{out.title}{out.tone === 'good' && ' ✓'}</div>
                      <div className="mt-1 text-sm text-white/90">{out.sub}</div>
                    </div>
                    {out.reasons.length > 0 && <ul className="mt-3 space-y-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-900">{out.reasons.map((r) => <li key={r} className="flex gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{r}</li>)}</ul>}
                    <div className="mt-4 rounded-3xl border border-stone-200 bg-white p-5">
                      <div className="flex items-center gap-3"><span className="text-4xl">{b.emoji}</span><div><div className="text-lg font-bold leading-tight text-stone-900" style={{ fontFamily: 'Fraunces, Georgia, serif' }}>{b.product}</div><div className="text-xs text-stone-500">{b.certification} · Batch {b.batchId.slice(-5)}</div></div></div>
                      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                        {[['Origin', b.origin], ['Farm', b.farm], ['Harvested', fmtDate(b.harvestDate)], ['Processed', fmtDate(b.processingDate)], ['Best before', fmtDate(b.expiryDate)], ['Days left', a.days < 0 ? 'Expired' : `${a.days} days`]].map(([k, v]) => <div key={k}><dt className="text-[11px] uppercase tracking-wider text-stone-400">{k}</dt><dd className="font-semibold text-stone-800">{v}</dd></div>)}
                      </dl>
                    </div>
                    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-4 rounded-3xl border border-stone-200 bg-white p-5">
                      <div className="relative"><Ring v={a.scores.foodSafety} /><div className="absolute inset-0 flex items-center justify-center text-xl font-extrabold text-stone-900">{a.scores.foodSafety}</div></div>
                      <div><div className="text-[11px] uppercase tracking-wider text-stone-400">Food safety</div><div className="text-lg font-bold text-stone-900">{a.scores.foodSafety} / 100</div>
                        <div className="mt-1 space-y-0.5 text-xs text-stone-600">
                          <div>Supply chain: <b className={a.chain.valid && a.unaccounted === 0 ? 'text-emerald-700' : 'text-red-700'}>{a.chain.valid && a.unaccounted === 0 ? 'Verified' : 'Needs review'}</b></div>
                          <div>Packaging: <b className={a.classification.label === 'AUTHENTIC' && a.packaging.watermarkValid ? 'text-emerald-700' : 'text-red-700'}>{a.classification.label === 'AUTHENTIC' && a.packaging.watermarkValid ? 'Authentic' : 'Doesn’t match'}</b></div>
                        </div></div>
                    </div>
                    <button onClick={() => setScreen('journey')} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 py-4 text-base font-semibold text-white">View journey →</button>
                  </motion.div>
                )}

                {screen === 'journey' && (
                  <motion.div key="journey" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <h2 className="text-2xl text-stone-900" style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 700 }}>The journey of your {b.product.split(' ').slice(-1)[0].toLowerCase()}</h2>
                    <p className="mt-1 text-sm text-stone-500">From the farm to your hands.</p>
                    <ol className="relative mt-6 space-y-5 pl-2">
                      <div className="absolute bottom-3 left-[27px] top-3 w-0.5 bg-emerald-200" />
                      {STEPS.map((s, i) => {
                        const ev = a.events[s.k]
                        const flagged = !!ev && ((i === 3 && a.cold.violation) || a.chain.checks[s.k]?.status !== 'VALID')
                        return (
                          <motion.li key={s.t} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="relative flex gap-4">
                            <span className={cn('z-10 flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full border-2 text-lg', !ev ? 'border-stone-200 bg-stone-100 opacity-60' : flagged ? 'border-amber-500 bg-amber-50' : 'border-emerald-600 bg-white')}>{s.emoji}</span>
                            <div className={cn('flex-1 rounded-2xl border bg-white p-3.5', flagged ? 'border-amber-300' : 'border-stone-200', !ev && 'opacity-60')}>
                              <div className="flex items-baseline justify-between"><span className="font-semibold text-stone-900">{s.t}</span><span className="text-[11px] text-stone-400">{ev ? fmtShortDate(ev.timestamp) : 'coming up'}</span></div>
                              <div className="mt-0.5 text-[13px] text-stone-600">{ev ? (<><MapPin size={11} className="mr-1 inline text-stone-400" />{ev.actor} · {ev.location}</>) : 'Not reached yet'}</div>
                              {flagged && <div className="mt-1 text-xs font-medium text-amber-700">⚠ Something needs a closer look here</div>}
                              {ev && i === 3 && !a.cold.violation && <div className="mt-1 flex items-center gap-1 text-xs text-emerald-700"><Thermometer size={12} /> Stayed cold the whole time</div>}
                            </div>
                          </motion.li>
                        )
                      })}
                    </ol>
                    <button onClick={() => setScreen('ask')} className="mt-6 w-full rounded-2xl border border-stone-300 bg-white py-3.5 text-sm font-semibold text-stone-800">Ask about this product</button>
                  </motion.div>
                )}

                {screen === 'ask' && (
                  <motion.div key="ask" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    <h2 className="text-2xl text-stone-900" style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 700 }}>Good questions</h2>
                    <p className="mt-1 text-sm text-stone-500">Plain answers about {b.product}.</p>
                    <div className="mt-5 space-y-2.5">
                      {answers.map(([q, ans], i) => (
                        <div key={q} className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                          <button className="flex w-full items-center justify-between px-4 py-3.5 text-left" onClick={() => setOpen(open === i ? null : i)}><span className="text-[14px] font-semibold text-stone-900">{q}</span><ChevronDown size={18} className={cn('text-stone-400 transition', open === i && 'rotate-180')} /></button>
                          <AnimatePresence initial={false}>{open === i && <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden"><p className="px-4 pb-4 text-[13.5px] leading-relaxed text-stone-600">{ans}</p></motion.div>}</AnimatePresence>
                        </div>
                      ))}
                    </div>
                    <p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-xs leading-relaxed text-emerald-900">How do we know? Every step of the journey is digitally signed by the people who handled your food, and the signatures are re-checked every time you scan. Nobody can quietly rewrite history.</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <nav className="flex h-[72px] shrink-0 items-center justify-around border-t border-stone-200 bg-white px-3">
              {([['scan', 'Scan', <QrCode size={20} key="a" />], ['result', 'Result', <ShieldCheck size={20} key="b" />], ['journey', 'Journey', <MapPin size={20} key="c" />], ['ask', 'Ask', <Sparkles size={20} key="d" />]] as Array<[Screen, string, JSX.Element]>).map(([id, l, ic]) => (
                <button key={id} onClick={() => setScreen(id)} className={cn('flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 text-[11px] font-semibold', screen === id ? 'text-emerald-700' : 'text-stone-400')}>{ic}{l}</button>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </div>
  )
}
