import type { Incident, Batch } from '../models/types'
import { THREAT_LABEL } from '../models/types'
import type { BatchAnalysis, GlobalAnalysis } from './analysis'
import { expiryLabel } from './analysis'
import { recallProfile } from './recall'
import { fmtDate, fmtDateTime, fmtTime, daysRemaining } from '../utils/format'
import { isOpen } from './incidents'

export interface AssistantReply {
  lines: string[]
  bullets?: string[]
  confidence: number
  sources: string[]
  actions?: Array<{ label: string; to: string; batchId?: string }>
  follow?: string[]
}

export interface AssistantCtx { an: GlobalAnalysis; incidents: Incident[]; batches: Batch[]; selected: string }

export const SUGGESTIONS = [
  'Is this product authentic?', 'Where did this batch come from?', 'Has this batch experienced a temperature violation?', 'Why is this product suspicious?',
  'Which batches are expiring?', 'Show me all QR replay attacks.', 'Which retailer received the affected batch?', 'Why was this batch flagged?',
]

function findBatch(q: string, ctx: AssistantCtx): BatchAnalysis {
  const m = q.match(/(?:FCG[-\s]?(?:BATCH[-\s]?)?(?:20\d\d[-\s]?)?)?(\d{5})\b/i)
  if (m) {
    const hit = ctx.an.list.find((a) => a.batch.batchId.endsWith(m[1]))
    if (hit) return hit
  }
  const prod = ctx.an.list.find((a) => q.toLowerCase().includes(a.batch.product.toLowerCase().split(' ').slice(-1)[0]) && q.toLowerCase().includes(a.batch.product.toLowerCase().split(' ')[0]))
  return prod ?? ctx.an.byId[ctx.selected] ?? ctx.an.list[0]
}

const has = (q: string, ...w: string[]) => w.some((x) => q.includes(x))

export function answer(question: string, ctx: AssistantCtx): AssistantReply {
  const q = question.toLowerCase()
  const a = findBatch(question, ctx)
  const b = a.batch
  const id = b.batchId
  const open = (x: Incident) => isOpen(x)

  // ---- why flagged / suspicious
  if (has(q, 'why') && has(q, 'flag', 'suspicious', 'blocked', 'wrong', 'alert')) {
    if (a.anomalies.length === 0 && a.status === 'VERIFIED') {
      return { lines: [`**${id}** (${b.product}) is not flagged. All ten trust signals agree and its trust score is **${a.trust.trust}/100**.`], confidence: 96, sources: ['Trust engine', 'Anomaly engine (0 findings)'], follow: ['Is this product authentic?'], actions: [{ label: 'Open batch', to: `/app/batches/${id}`, batchId: id }] }
    }
    return {
      lines: [`**${id}** (${b.product}) is flagged **${a.status}** because the three truths disagree:`, a.trust.conclusion],
      bullets: [...a.anomalies.map((x) => `${THREAT_LABEL[x.type]} — ${x.title} (AI confidence ${x.confidence}%)`), ...a.trust.caps.map((c) => `Score capped: ${c}`)],
      confidence: Math.round(a.anomalies.reduce((s, x) => s + x.confidence, 0) / Math.max(1, a.anomalies.length)),
      sources: ['Anomaly engine', 'Packaging fingerprint comparison', 'QR scan history', 'Hash-chain validator'],
      actions: [{ label: 'Open incident queue', to: '/app/soc' }, { label: 'Authenticity report', to: '/app/verification', batchId: id }], follow: ['Which retailer received the affected batch?', 'Show me all QR replay attacks.'],
    }
  }
  // ---- authenticity
  if (has(q, 'authentic', 'genuine', 'real ', 'fake', 'counterfeit', 'verified')) {
    const ok = a.trust.verdict === 'AUTHENTIC'
    return {
      lines: [`**${id}** — ${b.product}: **${a.trust.verdict}** with authenticity **${a.trust.authenticity.toFixed(1)}%** (trust ${a.trust.trust}/100).`, ok ? 'Physical, digital and supply-chain truth all agree.' : a.trust.conclusion],
      bullets: [`Packaging fingerprint: ${a.packaging.overall.toFixed(0)}% — ${a.classification.label}`, `Watermark: ${a.packaging.watermarkValid ? 'valid' : 'INVALID'}`, `QR: ${a.qr.status}`, `Hash chain: ${a.chain.valid ? 'valid' : 'COMPROMISED'}`, `Certification: ${b.certValid ? 'valid' : 'failed'}`],
      confidence: ok ? Math.round(a.classification.confidence) : 88, sources: ['Packaging model (CNN, simulated)', 'QR registry', 'Ledger', 'Trust engine'],
      actions: [{ label: 'Open authenticity report', to: '/app/verification', batchId: id }], follow: ['Why was this batch flagged?'],
    }
  }
  // ---- origin
  if (has(q, 'where', 'origin', 'come from', 'grown', 'farm', 'source')) {
    const first = a.events[0]
    return {
      lines: [`**${id}** (${b.product}) was grown at **${b.farm}**, ${b.origin}.`, `Harvested ${fmtDate(b.harvestDate)}${first ? ` (ledger block #1, ${fmtDateTime(first.timestamp)})` : ''}, processed ${fmtDate(b.processingDate)}. Certification: ${b.certification}${b.certValid ? '' : ' — FAILED verification'}.`],
      bullets: a.events.map((e, i) => `${i + 1}. ${e.action} — ${e.actor}, ${e.location} (${fmtDate(e.timestamp)})`),
      confidence: 98, sources: [`Ledger blocks 1–${a.events.length}`, 'Batch registry'], actions: [{ label: 'Trace in 3D', to: '/app/supply-chain', batchId: id }],
    }
  }
  // ---- temperature
  if (has(q, 'temperature', 'cold', 'refriger', 'humid', 'sensor')) {
    const c = a.cold
    return {
      lines: [c.violation ? `Yes — **${id}** had a **cold-chain violation**: ${Math.max(...c.runs.map((r) => r.peak)).toFixed(1)}°C for ${c.excursionMinutes} minutes (safe range 2–8°C).` : `No — **${id}** stayed within 2–8°C. Current reading **${c.current.toFixed(1)}°C**, mean ${c.mean.toFixed(1)}°C over the last 24h.`, `Storage score ${c.storageScore}/100 · food-safety score ${a.scores.foodSafety}/100.`],
      bullets: c.runs.map((r) => `Excursion ${fmtTime(r.start)}–${fmtTime(r.end)}: peak ${r.peak.toFixed(1)}°C`),
      confidence: 97, sources: [`IoT sensor TH-${id.slice(-3)} (96 samples)`], actions: [{ label: 'Open cold-chain monitor', to: '/app/cold-chain', batchId: id }],
    }
  }
  // ---- expiring
  if (has(q, 'expir', 'shelf', 'fresh')) {
    const list = [...ctx.an.list].sort((x, y) => x.days - y.days).filter((x) => x.days <= 4)
    return {
      lines: [`${list.length} batch${list.length === 1 ? '' : 'es'} expire within 4 days or are already expired:`],
      bullets: list.map((x) => `${x.batch.batchId} — ${x.batch.product}: ${expiryLabel(x.days)} (${x.days < 0 ? `${-x.days}d overdue` : `${x.days}d left`}, ${fmtDate(x.batch.expiryDate)})`),
      confidence: 99, sources: ['Expiry intelligence'], actions: [{ label: 'Open expiry dashboard', to: '/app/expiry' }],
    }
  }
  // ---- QR replay
  if (has(q, 'replay', 'duplicate', 'clone', 'cloned', 'impossible')) {
    const list = ctx.an.list.filter((x) => x.qr.replay)
    const hist = ctx.incidents.filter((i) => i.type === 'QR_REPLAY')
    return {
      lines: [list.length ? `**${list.length} batch${list.length > 1 ? 'es' : ''}** currently show a QR replay pattern; ${hist.length} replay incidents on record.` : `No live QR replay detected. ${hist.length} historical replay incidents are on record.`],
      bullets: [...list.map((x) => `${x.qr.qrId} (${x.batch.batchId}): ${x.qr.cities.join(' → ')}${x.qr.impossible[0] ? ` · ${x.qr.impossible[0].from.city}→${x.qr.impossible[0].to.city} in ${x.qr.impossible[0].minutes} min (~${x.qr.impossible[0].km} km)` : ''}`), ...hist.filter((i) => !list.some((x) => x.batch.batchId === i.batchId)).slice(0, 3).map((i) => `${i.incidentId}: ${i.description}`)],
      confidence: 94, sources: ['QR scan history', 'Geo-velocity engine', 'Incident store'], actions: [{ label: 'Open QR replay view', to: '/app/anomalies/replay' }],
    }
  }
  // ---- retailers / recall
  if (has(q, 'retailer', 'received', 'affected', 'recall', 'stock')) {
    const p = recallProfile(a)
    return {
      lines: [`**${id}** has **${p.affectedUnits.toLocaleString('en-US')} units** across **${p.retailers.length} retailers** in ${p.regions.join(', ')}.`],
      bullets: p.retailers.slice(0, 6).map((r) => `${r.name} (${r.city}) — ${r.units.toLocaleString('en-US')} units`).concat(p.retailers.length > 6 ? [`…and ${p.retailers.length - 6} more`] : []),
      confidence: 92, sources: ['Distribution ledger', 'Retail allocation'], actions: [{ label: 'Open recall center', to: '/app/recall', batchId: id }],
    }
  }
  // ---- quantity
  if (has(q, 'quantity', 'missing', 'unaccounted', 'units')) {
    const loss = a.qty.find((s) => s.kind !== 'OK')
    return {
      lines: [loss ? `**${id}**: **${Math.abs(loss.missing).toLocaleString('en-US')} ${b.unit} unaccounted for** between ${loss.from.actor} (${loss.from.quantity}) and ${loss.to.actor} (${loss.to.quantity}).` : `**${id}** reconciles: quantities stay within the 2% tolerance across all hand-offs.`],
      bullets: a.events.map((e) => `${e.action}: ${e.quantity.toLocaleString('en-US')} ${e.unit}`), confidence: 93, sources: ['Ledger quantities'], actions: [{ label: 'Quantity anomaly view', to: '/app/anomalies/quantity', batchId: id }],
    }
  }
  // ---- ledger
  if (has(q, 'ledger', 'hash', 'chain', 'tamper', 'block')) {
    return {
      lines: [a.chain.valid ? `The hash chain for **${id}** is **valid** (${a.events.length}/${a.events.length} blocks verified). Network-wide integrity is ${ctx.an.chainIntegrity.toFixed(1)}%.` : `The hash chain for **${id}** is **COMPROMISED**: block #${(a.chain.brokenAt ?? 0) + 1} is invalid and ${a.chain.invalidCount} blocks are untrusted.`],
      bullets: a.chain.checks.filter((c) => c.status !== 'VALID').map((c) => `Block #${c.index + 1}: ${c.status.replace(/_/g, ' ')} — ${c.message}`),
      confidence: 99, sources: ['SHA-256 recomputation', 'Signature verification'], actions: [{ label: 'Open hash-chain explorer', to: '/app/blockchain', batchId: id }],
    }
  }
  // ---- incidents / threats
  if (has(q, 'incident', 'open', 'threat', 'soc', 'attack', 'security')) {
    const o = ctx.incidents.filter(open)
    return {
      lines: [`${o.length} open incident${o.length === 1 ? '' : 's'} right now (${ctx.incidents.length} total on record).`],
      bullets: o.slice(0, 8).map((i) => `${i.incidentId} · ${THREAT_LABEL[i.type]} · ${i.severity} · ${i.batchId}`), confidence: 99, sources: ['Incident store'], actions: [{ label: 'Open SOC', to: '/app/soc' }],
    }
  }
  // ---- score
  if (has(q, 'score', 'trust', 'safe', 'safety')) {
    return {
      lines: [`**${id}**: trust score **${a.trust.trust}/100**, food-safety score **${a.scores.foodSafety}/100**, authenticity ${a.trust.authenticity.toFixed(1)}%.`],
      bullets: [`Authenticity ${a.scores.authenticity}`, `Chain integrity ${a.scores.chainIntegrity}`, `Storage ${a.scores.storage}`, `Certification ${a.scores.certification}`, `Expiry ${a.scores.expiry}`, `Packaging ${a.scores.packaging}`],
      confidence: 95, sources: ['Trust engine', 'Food-safety model'], actions: [{ label: 'Food-safety score', to: '/app/food-safety', batchId: id }],
    }
  }
  return {
    lines: ['I answer questions about this platform’s own data — batches, ledger blocks, packaging, QR scans, sensors, incidents and recalls. Try one of these:'],
    bullets: SUGGESTIONS, confidence: 100, sources: ['Platform capabilities'],
    follow: [],
  }
}
export { daysRemaining }
