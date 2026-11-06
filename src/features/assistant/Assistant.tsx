import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Bot, CornerDownLeft, Send, Sparkles, User } from 'lucide-react'
import { Badge, Btn, Card, Kv, PageHeader, StatusBadge } from '../../components/ui'
import { useStore } from '../../state/store'
import { useAnalysis, useSelectedAnalysis } from '../../state/selectors'
import { answer, SUGGESTIONS, type AssistantReply } from '../../services/assistant'
import { navigate } from '../../utils/router'
import { cn } from '../../utils/format'

interface Msg { id: number; from: 'user' | 'ai'; text?: string; reply?: AssistantReply; batchId?: string }

function Rich({ t }: { t: string }) {
  return <>{t.split(/\*\*(.+?)\*\*/g).map((p, i) => (i % 2 ? <b key={i} className="text-white">{p}</b> : <span key={i}>{p}</span>))}</>
}

export function Assistant() {
  const an = useAnalysis()
  const a = useSelectedAnalysis()
  const { incidents, batches, seed, setSeed, select } = useStore((s) => ({ incidents: s.incidents, batches: s.batches, seed: s.assistantSeed, setSeed: s.setAssistantSeed, select: s.selectBatch }))
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 0, from: 'ai', reply: { lines: ['Hi — I’m the **FoodChain Guard assistant**. I’m grounded in this platform’s ledger, scans, sensors and incidents, and I tell you how confident I am. I’m not a general chatbot.'], confidence: 100, sources: ['Platform data'], bullets: [], follow: SUGGESTIONS.slice(0, 4) } }])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  const idRef = useRef(1)
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, typing])

  const ask = (q: string) => {
    if (!q.trim() || typing) return
    const uid = idRef.current++
    setMsgs((m) => [...m, { id: uid, from: 'user', text: q }])
    setInput(''); setTyping(true)
    setTimeout(() => {
      const reply = answer(q, { an, incidents, batches, selected: a.batch.batchId })
      setMsgs((m) => [...m, { id: idRef.current++, from: 'ai', reply, batchId: a.batch.batchId }])
      setTyping(false)
    }, 700)
  }
  useEffect(() => { if (seed) { ask(seed); setSeed(null) } }, [seed]) // eslint-disable-line

  return (
    <>
      <PageHeader eyebrow="AI FoodChain assistant" title="Ask the platform" subtitle="Answers are generated from live platform data — not a generic chatbot — with confidence and sources." />
      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <Card bodyClassName="!p-0" className="flex h-[min(74vh,720px)] min-h-[480px] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {msgs.map((m) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={cn('flex gap-3', m.from === 'user' && 'flex-row-reverse')}>
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', m.from === 'ai' ? 'bg-brand/15 text-brand' : 'bg-white/10 text-slate-300')}>{m.from === 'ai' ? <Bot size={17} /> : <User size={16} />}</span>
                <div className={cn('max-w-[84%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed', m.from === 'user' ? 'bg-brand/15 text-slate-100' : 'border border-line bg-white/[0.03] text-slate-300')}>
                  {m.text}
                  {m.reply && (
                    <>
                      {m.reply.lines.map((l, i) => <p key={i} className={i ? 'mt-2' : ''}><Rich t={l} /></p>)}
                      {!!m.reply.bullets?.length && <ul className="mt-2 space-y-1">{m.reply.bullets.map((b) => <li key={b} className="flex gap-2 text-[12.5px]"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand" />{m.reply!.bullets === SUGGESTIONS ? <button className="text-left text-brand hover:underline" onClick={() => ask(b)}>{b}</button> : b}</li>)}</ul>}
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-2 text-[11px] text-slate-500">
                        <Badge tone={m.reply.confidence >= 90 ? 'ok' : 'warn'}>confidence {m.reply.confidence}%</Badge>
                        <span>Sources: {m.reply.sources.join(' · ')}</span>
                      </div>
                      {!!m.reply.actions?.length && <div className="mt-2 flex flex-wrap gap-2">{m.reply.actions.map((x) => <Btn key={x.label} size="sm" onClick={() => { x.batchId && select(x.batchId); navigate(x.to) }}>{x.label} →</Btn>)}</div>}
                      {!!m.reply.follow?.length && <div className="mt-2 flex flex-wrap gap-2">{m.reply.follow.map((f) => <button key={f} onClick={() => ask(f)} className="rounded-full border border-line px-3 py-1 text-[11.5px] text-slate-300 hover:border-brand/50 hover:text-white"><CornerDownLeft size={10} className="mr-1 inline" />{f}</button>)}</div>}
                    </>
                  )}
                </div>
              </motion.div>
            ))}
            {typing && <div className="flex items-center gap-3 pl-1 text-slate-500"><Bot size={16} className="text-brand" />{[0, 1, 2].map((i) => <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-brand" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }} />)}</div>}
            <div ref={end} />
          </div>
          <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); ask(input) }}>
            <input className="input !rounded-xl" placeholder={`Ask about ${a.batch.batchId}, a QR, an incident…`} value={input} onChange={(e) => setInput(e.target.value)} />
            <Btn type="submit" variant="primary" icon={<Send size={15} />} disabled={typing}>Ask</Btn>
          </form>
        </Card>
        <div className="space-y-5">
          <Card title="Context" subtitle="Questions about “this batch” use:">
            <div className="mono text-[13px] font-semibold text-brand">{a.batch.batchId}</div>
            <div className="text-xs text-slate-300">{a.batch.emoji} {a.batch.product}</div>
            <div className="mt-2"><StatusBadge status={a.status} /></div>
            <div className="mt-3"><Kv k="Trust" v={`${a.trust.trust}/100`} /><Kv k="Anomalies" v={a.anomalies.length} /></div>
          </Card>
          <Card title="Try asking" icon={<Sparkles size={14} className="text-vio" />}>
            <div className="space-y-1.5">{SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)} className="block w-full rounded-lg border border-line px-3 py-2 text-left text-xs text-slate-300 hover:border-brand/40 hover:bg-white/[0.04]">{s}</button>)}</div>
          </Card>
          <p className="px-1 text-[11px] leading-relaxed text-slate-500">Answers come from deterministic lookups over the shared platform state. Confidence reflects the detector behind the answer; the assistant never claims certainty it doesn’t have.</p>
        </div>
      </div>
    </>
  )
}
