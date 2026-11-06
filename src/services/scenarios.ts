import type {
  AuditEntry, ChainEvent, Incident, Notification, QrScan, ThreatType, Settings,
} from '../models/types'
import { NO_MODS } from '../models/types'
import type { DataState } from '../data/seed'
import { pristine } from '../data/seed'
import { HERO_BATCH, makeIncident, nextIncidentId } from './incidents'
import { rebuildChain, tamperEvent } from './ledger'
import { packagingScores, REGIONS } from './packaging'
import { NOW, MIN, DAY } from '../utils/clock'
import { sha256 } from '../utils/sha256'
import { roadKm } from '../utils/geo'
import { ACTOR_BY_ID } from '../data/catalog'
import { fmtTime } from '../utils/format'

export type ScenarioId =
  | 'authentic' | 'counterfeit' | 'replay' | 'ledger' | 'travel'
  | 'quantity' | 'cold' | 'expired' | 'cert'

export interface ScenarioMeta { id: ScenarioId; title: string; blurb: string; tone: 'ok' | 'bad' | 'warn'; expect: string }

export const SCENARIOS: ScenarioMeta[] = [
  { id: 'authentic', title: 'Authentic Product', blurb: 'Restore the demo batch to a pristine, fully verified state.', tone: 'ok', expect: 'Trust ≈ 95 · Authentic 96.8%' },
  { id: 'counterfeit', title: 'Counterfeit Packaging', blurb: 'Forged logo, reprinted expiry, altered structure and a destroyed watermark.', tone: 'bad', expect: 'Packaging mismatch · watermark INVALID · heatmap' },
  { id: 'replay', title: 'QR Replay Attack', blurb: 'A legitimate QR is cloned and scanned in Mumbai, Delhi, Pune and Bengaluru.', tone: 'bad', expect: 'QR REPLAY ATTACK · impossible travel' },
  { id: 'ledger', title: 'Ledger Tampering', blurb: 'Modify historical block #3 and recompute its hash.', tone: 'bad', expect: 'Block #3 INVALID · downstream hashes invalid' },
  { id: 'travel', title: 'Impossible Travel', blurb: 'The same package is scanned in Mumbai and Delhi 47 minutes apart.', tone: 'bad', expect: '~1,400 km in 47 min' },
  { id: 'quantity', title: 'Quantity Manipulation', blurb: 'Distributor reports 300 fewer units than the processor shipped.', tone: 'warn', expect: '300 units unaccounted for' },
  { id: 'cold', title: 'Cold Chain Violation', blurb: 'Refrigeration fails: 14.8 °C for 43 minutes.', tone: 'warn', expect: 'Food-safety score degrades' },
  { id: 'expired', title: 'Expired Product', blurb: 'Batch crosses its expiry date while still on the shelf.', tone: 'warn', expect: 'Expired product alert' },
  { id: 'cert', title: 'Certification Tampering', blurb: 'The organic certificate no longer verifies against the registry.', tone: 'bad', expect: 'Certification invalid' },
]

export interface ScenarioOpts { tempC?: number; minutes?: number; missing?: number; block?: number; quantityDelta?: number }
export interface ScenarioResult { data: DataState; message: string; incidentId?: string; backup?: ChainEvent[] }

const hashOf = (s: string) => sha256(s)

function push<T>(arr: T[], x: T): T[] { return [x, ...arr] }

function note(d: DataState, n: Omit<Notification, 'id' | 'ts' | 'read'>): DataState {
  const full: Notification = { id: `N-${d.notifications.length + 1}-${n.title.length}`, ts: NOW, read: false, ...n }
  return { ...d, notifications: push(d.notifications, full) }
}
function audit(d: DataState, a: Omit<AuditEntry, 'id' | 'ts' | 'hash'>): DataState {
  const entry: AuditEntry = { id: `A-${d.audit.length + 1}`, ts: NOW, hash: hashOf(JSON.stringify(a) + d.audit.length), ...a }
  return { ...d, audit: push(d.audit, entry) }
}
function raise(d: DataState, inc: Parameters<typeof makeIncident>[1], settings: Settings): { d: DataState; incident: Incident } {
  const id = nextIncidentId(d.incidents, inc.type, inc.batchId)
  const incident = makeIncident(id, inc)
  let next: DataState = { ...d, incidents: [incident, ...d.incidents] }
  if (settings.autoBlockCritical && incident.severity === 'CRITICAL') {
    next = { ...next, batches: next.batches.map((b) => (b.batchId === inc.batchId ? { ...b, hold: 'BLOCKED' as const } : b)) }
    next.incidents = next.incidents.map((i) => (i.incidentId === id ? { ...i, status: 'CONTAINED' as const } : i))
  }
  return { d: next, incident }
}

const replaceBatchEvents = (d: DataState, batchId: string, evs: ChainEvent[]): DataState => ({
  ...d, events: d.events.filter((e) => e.batchId !== batchId).concat(evs),
})
const eventsOf = (d: DataState, id: string) => d.events.filter((e) => e.batchId === id).sort((a, b) => a.index - b.index)

export function resolveOpenForBatch(d: DataState, batchId: string, types?: ThreatType[], why = 'Closed — condition no longer present'): DataState {
  return {
    ...d,
    incidents: d.incidents.map((i) =>
      i.batchId === batchId && i.status !== 'RESOLVED' && (!types || types.includes(i.type))
        ? { ...i, status: 'RESOLVED', timeline: [...i.timeline, { t: NOW, text: why }] }
        : i),
  }
}

export function runScenario(id: ScenarioId, d0: DataState, batchId: string, settings: Settings, o: ScenarioOpts = {}): ScenarioResult {
  let d = d0
  const batch = d.batches.find((b) => b.batchId === batchId)!
  const pkgs = d.packages.filter((p) => p.batchId === batchId)
  const evs = eventsOf(d, batchId)
  const retailCity = evs.find((e) => e.action === 'RETAILED')?.location ?? evs[evs.length - 1]?.location ?? 'Mumbai'
  const setPkg = (idx: number, mods: Partial<typeof NO_MODS>) => {
    const target = pkgs[idx]
    d = { ...d, packages: d.packages.map((p) => (p.packageId === target.packageId ? { ...p, mods: { ...p.mods, ...mods } } : p)) }
  }
  const addScans = (qrId: string, list: Array<[string, number]>, tag: string) => {
    const scans: QrScan[] = list.map(([city, minAgo], i) => ({
      scanId: `SCN-SIM-${tag}-${d.scans.length + i}`, qrId, batchId, city, timestamp: NOW - minAgo * MIN, source: 'unknown',
    }))
    d = { ...d, scans: [...d.scans, ...scans] }
    return scans
  }

  switch (id) {
    case 'authentic': {
      const p = pristine(batchId)
      if (!p) return { data: d, message: 'No pristine snapshot for this batch.' }
      d = replaceBatchEvents(d, batchId, p.events)
      d = {
        ...d,
        batches: d.batches.map((b) => (b.batchId === batchId ? p.batch : b)),
        packages: d.packages.filter((x) => x.batchId !== batchId).concat(p.packages),
        scans: d.scans.filter((x) => x.batchId !== batchId).concat(p.scans),
        telemetry: { ...d.telemetry, [batchId]: p.telemetry },
      }
      d = resolveOpenForBatch(d, batchId, undefined, 'Closed — batch restored to verified state (Authentic scenario)')
      d = note(d, { level: 'success', title: `Batch ${batchId} verified`, body: 'All trust signals agree. Product is authentic.', batchId })
      d = audit(d, { actor: 'Demo Lab', batchId, action: 'SCENARIO: AUTHENTIC PRODUCT', location: retailCity, status: 'VALID' })
      return { data: d, message: 'Batch restored to a pristine, verified state.' }
    }
    case 'counterfeit': {
      const mods = { logo: true, expiry: true, structure: true, watermark: true }
      setPkg(0, mods)
      const sc = packagingScores({ ...NO_MODS, ...mods }, pkgs[0].packageId)
      const regions = [...new Set(sc.tamperedRegions)].map((r) => REGIONS[r].label).join(', ')
      const r = raise(d, { type: 'COUNTERFEIT_PACKAGING', batchId, ts: NOW, location: retailCity, qrId: pkgs[0].qrId, details: { similarity: Math.round(sc.overall), regions: `Altered: ${regions}.` } }, settings)
      d = r.d
      d = note(d, { level: 'critical', title: 'Packaging mismatch detected', body: `${batchId}: match ${Math.round(sc.overall)}% · watermark invalid.`, batchId })
      d = audit(d, { actor: 'AI Vision', batchId, action: 'PACKAGING MISMATCH', location: retailCity, status: 'FLAGGED' })
      return { data: d, message: `Counterfeit package injected — ${Math.round(sc.overall)}% match, watermark invalid.`, incidentId: r.incident.incidentId }
    }
    case 'replay': {
      const qr = pkgs[0].qrId
      const first = retailCity
      const list: Array<[string, number]> = [[first, 102], [first, 75], ['Delhi', 28], ['Pune', 21], ['Bengaluru', 12]]
      addScans(qr, list, 'RP')
      const r = raise(d, {
        type: 'QR_REPLAY', batchId, ts: NOW, location: `${first} → Delhi → Pune → Bengaluru`, qrId: qr,
        details: { cities: `${first}, Delhi, Pune, Bengaluru` },
        evidence: [
          { label: 'QR history', value: `${qr} · 5 scans in 90 minutes` },
          { label: 'Location history', value: `${first} → ${first} → Delhi → Pune → Bengaluru` },
          { label: 'First impossible hop', value: `${first} ${fmtTime(NOW - 75 * MIN)} → Delhi ${fmtTime(NOW - 28 * MIN)} (~${roadKm(first, 'Delhi').toLocaleString('en-US')} km / 47 min)` },
          { label: 'Timestamps', value: list.map(([c, m]) => `${c} ${fmtTime(NOW - m * MIN)}`).join(' · ') },
        ],
      }, settings)
      d = r.d
      d = note(d, { level: 'critical', title: 'QR replay attack detected', body: `${qr} scanned in 4 cities within 90 minutes.`, batchId })
      d = audit(d, { actor: 'Anomaly Engine', batchId, action: 'QR REPLAY DETECTED', location: first, status: 'FLAGGED' })
      return { data: d, message: 'Replay injected: Mumbai → Delhi → Pune → Bengaluru.', incidentId: r.incident.incidentId }
    }
    case 'travel': {
      const pk = pkgs[1] ?? pkgs[0]
      const first = retailCity === 'Delhi' ? 'Mumbai' : retailCity
      addScans(pk.qrId, [[first, 75], ['Delhi', 28]], 'IT')
      const km = roadKm(first, 'Delhi')
      const r = raise(d, {
        type: 'IMPOSSIBLE_TRAVEL', batchId, ts: NOW, location: `${first} → Delhi`, qrId: pk.qrId,
        details: { from: first, to: 'Delhi', minutes: 47, km: km.toLocaleString('en-US') },
        evidence: [
          { label: 'Previous scan', value: `${first} · ${fmtTime(NOW - 75 * MIN)}` }, { label: 'Next scan', value: `Delhi · ${fmtTime(NOW - 28 * MIN)}` },
          { label: 'Distance', value: `${km.toLocaleString('en-US')} km` }, { label: 'Elapsed', value: '47 minutes' }, { label: 'Expected', value: `~${Math.round(km / 80)} hours` },
        ],
      }, settings)
      d = r.d
      d = note(d, { level: 'critical', title: 'Impossible travel detected', body: `${pk.qrId}: ${first} → Delhi in 47 minutes.`, batchId })
      d = audit(d, { actor: 'Geo-velocity Engine', batchId, action: 'IMPOSSIBLE TRAVEL', location: 'Delhi', status: 'FLAGGED' })
      return { data: d, message: `${first} → Delhi in 47 minutes (~${km.toLocaleString('en-US')} km).`, incidentId: r.incident.incidentId }
    }
    case 'ledger': {
      const idx = Math.min(o.block ?? 2, evs.length - 1)
      const backup = evs
      const delta = o.quantityDelta ?? Math.max(50, Math.round(evs[idx].quantity * 0.2))
      const tampered = tamperEvent(evs, idx, { quantity: evs[idx].quantity + delta }, true)
      d = replaceBatchEvents(d, batchId, tampered)
      const r = raise(d, {
        type: 'LEDGER_TAMPERING', batchId, ts: NOW, location: evs[idx].location, details: { block: idx + 1 },
        evidence: [
          { label: 'Block', value: `#${idx + 1} ${evs[idx].action}` }, { label: 'Field changed', value: `quantity ${evs[idx].quantity} → ${evs[idx].quantity + delta}` },
          { label: 'Original hash', value: evs[idx].currentHash.slice(0, 24) + '…' }, { label: 'Recomputed hash', value: tampered[idx].currentHash.slice(0, 24) + '…' },
          { label: 'Effect', value: `${tampered.length - idx} block(s) fail verification` },
        ],
      }, settings)
      d = r.d
      d = note(d, { level: 'critical', title: 'Ledger tampering detected', body: `${batchId}: block #${idx + 1} invalid, downstream hashes invalid.`, batchId })
      d = audit(d, { actor: 'Hash-chain Validator', batchId, action: `BLOCK #${idx + 1} MODIFIED`, location: evs[idx].location, status: 'INVALID' })
      return { data: d, message: `Block #${idx + 1} modified — chain broken.`, incidentId: r.incident.incidentId, backup }
    }
    case 'quantity': {
      const idx = Math.min(2, evs.length - 1)
      if (idx < 1) return { data: d, message: 'Batch has not reached distribution yet.' }
      const missing = o.missing ?? 300
      const backup = evs
      let chain = evs.map((e) => ({ ...e }))
      const newQ = chain[idx - 1].quantity - missing
      chain[idx] = { ...chain[idx], quantity: newQ }
      for (let i = idx + 1; i < chain.length; i++) chain[i] = { ...chain[i], quantity: Math.min(chain[i].quantity, chain[i - 1].quantity) }
      chain = rebuildChain(chain, idx)
      d = replaceBatchEvents(d, batchId, chain)
      const r = raise(d, {
        type: 'QUANTITY_ANOMALY', batchId, ts: NOW, location: chain[idx].location,
        details: { missing, unit: batch.unit, from: chain[idx - 1].actor, to: chain[idx].actor },
        evidence: [
          { label: chain[idx - 1].actor, value: `${evs[idx - 1].quantity.toLocaleString('en-US')} ${batch.unit}` },
          { label: chain[idx].actor, value: `${newQ.toLocaleString('en-US')} ${batch.unit}` },
          { label: 'Unaccounted', value: `${missing.toLocaleString('en-US')} ${batch.unit}` }, { label: 'Event', value: chain[idx].eventId },
        ],
      }, settings)
      d = r.d
      d = note(d, { level: 'warning', title: `${missing} units unaccounted for`, body: `${batchId}: ${chain[idx - 1].actor} → ${chain[idx].actor}.`, batchId })
      d = audit(d, { actor: chain[idx].actor, batchId, action: 'QUANTITY MISMATCH', location: chain[idx].location, status: 'FLAGGED' })
      return { data: d, message: `${chain[idx].actor} now reports ${newQ.toLocaleString('en-US')} ${batch.unit} — ${missing} unaccounted.`, incidentId: r.incident.incidentId, backup }
    }
    case 'cold': {
      const temp = o.tempC ?? 14.8
      const minutes = o.minutes ?? 43
      const pts = (d.telemetry[batchId] ?? []).filter((p) => p.t < NOW - 60 * MIN)
      pts.push({ t: NOW - 58 * MIN, tempC: 6.4, humidity: 83 })
      for (let t = minutes; t > 0; t -= 15) pts.push({ t: NOW - t * MIN, tempC: +(temp + (t % 2 ? 0 : 0.0)).toFixed(1), humidity: 74 })
      pts.push({ t: NOW, tempC: temp, humidity: 72 })
      d = { ...d, telemetry: { ...d.telemetry, [batchId]: pts } }
      const loc = evs.find((e) => e.action === 'STORED')?.location ?? evs[evs.length - 1]?.location ?? 'Pune'
      const r = raise(d, { type: 'COLD_CHAIN_VIOLATION', batchId, ts: NOW, location: loc, details: { peak: temp, minutes, range: `${settings.minTempC}–${settings.maxTempC}°C` } }, settings)
      d = r.d
      d = note(d, { level: 'critical', title: 'Cold-chain violation detected', body: `${batchId}: ${temp}°C for ${minutes} minutes.`, batchId })
      d = audit(d, { actor: 'IoT Sensor', batchId, action: `TEMP ${temp}°C × ${minutes}min`, location: loc, status: 'FLAGGED' })
      return { data: d, message: `${temp}°C for ${minutes} minutes — cold chain violated.`, incidentId: r.incident.incidentId }
    }
    case 'expired': {
      d = { ...d, batches: d.batches.map((b) => (b.batchId === batchId ? { ...b, expiryDate: NOW - DAY * 0.4 } : b)) }
      const r = raise(d, { type: 'EXPIRED_PRODUCT', batchId, ts: NOW, location: retailCity, details: { days: 1, location: ACTOR_BY_ID[batch.route.retailerId].name } }, settings)
      d = r.d
      d = note(d, { level: 'warning', title: 'Expired product on shelf', body: `${batchId} passed its expiry date.`, batchId })
      d = audit(d, { actor: 'Expiry Intelligence', batchId, action: 'EXPIRED BATCH SCANNED', location: retailCity, status: 'FLAGGED' })
      return { data: d, message: 'Batch is now past its expiry date.', incidentId: r.incident.incidentId }
    }
    case 'cert': {
      d = { ...d, batches: d.batches.map((b) => (b.batchId === batchId ? { ...b, certValid: false } : b)) }
      const r = raise(d, { type: 'CERTIFICATION_TAMPERING', batchId, ts: NOW, location: batch.origin, details: { certId: batch.certId } }, settings)
      d = r.d
      d = note(d, { level: 'critical', title: 'Certification tampering', body: `${batch.certification} certificate ${batch.certId} failed verification.`, batchId })
      d = audit(d, { actor: 'Certificate Verifier', batchId, action: 'CERT HASH MISMATCH', location: batch.origin, status: 'INVALID' })
      return { data: d, message: 'Certification no longer verifies.', incidentId: r.incident.incidentId }
    }
  }
}

export { HERO_BATCH }
