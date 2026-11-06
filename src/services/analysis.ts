import type {
  Anomaly, Batch, BatchStatus, ChainEvent, Pkg, QrScan, Settings, Severity, Stage, TelemetryPoint,
} from '../models/types'
import { STAGES } from '../models/types'
import { KNOWN_ACTOR_IDS } from '../data/catalog'
import { validateChain, type ChainValidation } from './ledger'
import { classify, packagingScores, type Classification, type PackagingScores } from './packaging'
import { AVG_ROAD_SPEED_KMH, roadKm } from '../utils/geo'
import { clamp, daysRemaining, fmtTime, fmtDate } from '../utils/format'
import { MIN } from '../utils/clock'

export interface EngineInput {
  batches: Batch[]
  packages: Pkg[]
  events: ChainEvent[]
  scans: QrScan[]
  telemetry: Record<string, TelemetryPoint[]>
  settings: Settings
}

// ------------------------------------------------------------------ QR
export interface ImpossibleTravel {
  from: QrScan
  to: QrScan
  km: number
  minutes: number
  expectedMinutes: number
  speedKmh: number
}

export interface QrAssessment {
  qrId: string
  packageId: string | null
  exists: boolean
  active: boolean
  belongsToBatch: boolean
  revoked: boolean
  scans: QrScan[]
  cities: string[]
  impossible: ImpossibleTravel[]
  repeated: { city: string; count: number } | null
  replay: boolean
  status: 'VALID' | 'REPLAY SUSPECTED' | 'REVOKED' | 'UNKNOWN'
}

export function assessQr(qrId: string, batchId: string | null, inp: EngineInput): QrAssessment {
  const pkg = inp.packages.find((p) => p.qrId === qrId) ?? null
  const scans = inp.scans.filter((s) => s.qrId === qrId).sort((a, b) => a.timestamp - b.timestamp)
  const impossible: ImpossibleTravel[] = []
  for (let i = 1; i < scans.length; i++) {
    const a = scans[i - 1], b = scans[i]
    if (a.city === b.city) continue
    const km = roadKm(a.city, b.city)
    const minutes = Math.max(1, Math.round((b.timestamp - a.timestamp) / MIN))
    const speed = km / (minutes / 60)
    if (km >= 30 && speed > inp.settings.maxPlausibleKmh) {
      impossible.push({ from: a, to: b, km, minutes, expectedMinutes: Math.round((km / AVG_ROAD_SPEED_KMH) * 60), speedKmh: Math.round(speed) })
    }
  }
  const cities = [...new Set(scans.map((s) => s.city))]
  // repeated scan: >=6 scans in one city within 60 minutes
  let repeated: QrAssessment['repeated'] = null
  for (let i = 0; i + 5 < scans.length; i++) {
    if (scans[i].city === scans[i + 5].city && scans[i + 5].timestamp - scans[i].timestamp <= 60 * MIN) {
      repeated = {
        city: scans[i].city,
        count: scans.filter((s) => s.city === scans[i].city && s.timestamp >= scans[i].timestamp && s.timestamp <= scans[i].timestamp + 60 * MIN).length,
      }
      break
    }
  }
  // sliding 6h window with >= 3 distinct cities → replay
  let multiCity = false
  for (let i = 0; i < scans.length; i++) {
    const win = scans.filter((s) => s.timestamp >= scans[i].timestamp && s.timestamp <= scans[i].timestamp + 6 * 3600_000)
    if (new Set(win.map((w) => w.city)).size >= 3) { multiCity = true; break }
  }
  const revoked = !!pkg?.qrRevoked
  const replay = impossible.length > 0 || multiCity
  return {
    qrId, packageId: pkg?.packageId ?? null,
    exists: !!pkg, active: !!pkg && !revoked,
    belongsToBatch: !!pkg && (batchId ? pkg.batchId === batchId : true),
    revoked, scans, cities, impossible, repeated, replay,
    status: !pkg ? 'UNKNOWN' : revoked ? 'REVOKED' : replay ? 'REPLAY SUSPECTED' : 'VALID',
  }
}

// ------------------------------------------------------------------ cold chain
export interface ColdRun { start: number; end: number; peak: number; trough: number; minutes: number; points: number }
export interface ColdSummary {
  current: number
  humidity: number
  min: number
  max: number
  mean: number
  stdev: number
  runs: ColdRun[]
  excursionMinutes: number
  maxDeviation: number
  violation: boolean
  storageScore: number
  status: 'NORMAL' | 'WARNING' | 'COLD CHAIN VIOLATION'
}

export function coldSummary(points: TelemetryPoint[], settings: Settings): ColdSummary {
  const { minTempC: lo, maxTempC: hi } = settings
  if (!points.length) {
    return { current: 0, humidity: 0, min: 0, max: 0, mean: 0, stdev: 0, runs: [], excursionMinutes: 0, maxDeviation: 0, violation: false, storageScore: 100, status: 'NORMAL' }
  }
  const temps = points.map((p) => p.tempC)
  const mean = temps.reduce((a, b) => a + b, 0) / temps.length
  const stdev = Math.sqrt(temps.reduce((a, b) => a + (b - mean) ** 2, 0) / temps.length)
  const runs: ColdRun[] = []
  let cur: ColdRun | null = null
  points.forEach((p) => {
    const out = p.tempC > hi || p.tempC < lo
    if (out) {
      if (!cur) cur = { start: p.t, end: p.t, peak: p.tempC, trough: p.tempC, minutes: 0, points: 0 }
      cur.end = p.t; cur.points++
      cur.peak = Math.max(cur.peak, p.tempC); cur.trough = Math.min(cur.trough, p.tempC)
      cur.minutes = Math.round((cur.end - cur.start) / MIN)
    } else if (cur) { runs.push(cur); cur = null }
  })
  if (cur) runs.push(cur)
  const real = runs.filter((r) => r.points >= 2 || r.peak - hi >= 4)
  const excursionMinutes = real.reduce((a, r) => a + r.minutes, 0)
  const maxDeviation = real.reduce((a, r) => Math.max(a, r.peak - hi, lo - r.trough, 0), 0)
  const violation = real.length > 0
  const storageScore = clamp(Math.round(100 - excursionMinutes * 0.9 - maxDeviation * 3 - stdev * 6 - Math.abs(mean - (lo + hi) / 2) * 1.5))
  const last = points[points.length - 1]
  return {
    current: last.tempC, humidity: last.humidity, min: Math.min(...temps), max: Math.max(...temps),
    mean, stdev, runs: real, excursionMinutes, maxDeviation, violation, storageScore,
    status: violation ? 'COLD CHAIN VIOLATION' : last.tempC > hi - 0.8 || last.tempC < lo + 0.8 ? 'WARNING' : 'NORMAL',
  }
}

// ------------------------------------------------------------------ expiry
export function expiryScore(days: number): number {
  if (days < 0) return 0
  if (days === 0) return 40
  if (days >= 7) return 100
  return 100 - (7 - days) * 6
}
export type ExpiryBucket = 'EXPIRED' | 'TODAY' | 'WITHIN_3' | 'SAFE'
export function expiryBucket(days: number): ExpiryBucket {
  return days < 0 ? 'EXPIRED' : days === 0 ? 'TODAY' : days <= 3 ? 'WITHIN_3' : 'SAFE'
}
export function expiryLabel(days: number): string {
  return days < 0 ? 'EXPIRED' : days === 0 ? 'EXPIRES TODAY' : days <= 4 ? 'NEAR EXPIRY' : 'SAFE'
}

// ------------------------------------------------------------------ quantity
export interface QtyStep { from: ChainEvent; to: ChainEvent; missing: number; pct: number; kind: 'LOSS' | 'GAIN' | 'OK' }
export function quantitySteps(events: ChainEvent[], tolPct: number): QtyStep[] {
  const steps: QtyStep[] = []
  for (let i = 1; i < events.length; i++) {
    const a = events[i - 1], b = events[i]
    const diff = a.quantity - b.quantity
    const pct = a.quantity ? (Math.abs(diff) / a.quantity) * 100 : 0
    steps.push({ from: a, to: b, missing: diff, pct, kind: diff > 0 && pct > tolPct ? 'LOSS' : diff < 0 ? 'GAIN' : 'OK' })
  }
  return steps
}

// ------------------------------------------------------------------ trust
export type TrustKey =
  | 'packaging' | 'qr' | 'watermark' | 'blockchain' | 'supplyChain'
  | 'location' | 'quantity' | 'temperature' | 'expiry' | 'certification'
export const TRUST_LABEL: Record<TrustKey, string> = {
  packaging: 'Packaging', qr: 'QR identity', watermark: 'Watermark', blockchain: 'Blockchain', supplyChain: 'Supply chain',
  location: 'Location', quantity: 'Quantity', temperature: 'Temperature', expiry: 'Expiry', certification: 'Certification',
}
const WEIGHTS: Record<TrustKey, number> = {
  packaging: 0.16, qr: 0.08, watermark: 0.08, blockchain: 0.12, supplyChain: 0.08,
  location: 0.08, quantity: 0.1, temperature: 0.12, expiry: 0.12, certification: 0.06,
}

export interface TrustResult {
  components: Record<TrustKey, number>
  risks: Record<TrustKey, number>
  trust: number
  authenticity: number
  verdict: 'AUTHENTIC' | 'SUSPICIOUS' | 'COUNTERFEIT'
  security: 'SECURE' | 'WATCH' | 'UNDER ATTACK'
  truths: { physical: number; digital: number; supply: number }
  conclusion: string
  caps: string[]
}

// ------------------------------------------------------------------ batch analysis
export interface BatchAnalysis {
  batch: Batch
  events: ChainEvent[]
  packages: Pkg[]
  chain: ChainValidation
  packaging: PackagingScores
  classification: Classification
  worstPackage: Pkg
  qr: QrAssessment
  cold: ColdSummary
  days: number
  qty: QtyStep[]
  unaccounted: number
  anomalies: Anomaly[]
  trust: TrustResult
  stage: Stage
  currentLocation: string
  currentOwner: string
  status: BatchStatus
  scores: {
    authenticity: number; chainIntegrity: number; foodSafety: number
    packaging: number; storage: number; expiry: number; certification: number
  }
}

const SEV = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }
const sevMax = (a: Severity, b: Severity): Severity => (SEV[a] >= SEV[b] ? a : b)

export function analyzeBatch(batch: Batch, inp: EngineInput): BatchAnalysis {
  const events = inp.events.filter((e) => e.batchId === batch.batchId).sort((a, b) => a.index - b.index)
  const packages = inp.packages.filter((p) => p.batchId === batch.batchId)
  const chain = validateChain(events, KNOWN_ACTOR_IDS)
  const pkgScores = packages.map((p) => ({ p, s: packagingScores(p.mods, p.packageId) }))
  const worst = pkgScores.reduce((w, c) => (c.s.overall < w.s.overall ? c : w), pkgScores[0])
  const packaging = worst.s
  const classification = classify(packaging)
  // most concerning QR across all packages of the batch
  const rank = (a: QrAssessment) => (a.replay ? 4 : a.status === 'REVOKED' ? 3 : a.repeated ? 2 : a.scans.length ? 1 : 0)
  const qrs = packages.map((p) => assessQr(p.qrId, batch.batchId, inp))
  const qr = qrs.reduce((best, a) => (rank(a) > rank(best) ? a : best), qrs[0])
  const cold = coldSummary(inp.telemetry[batch.batchId] ?? [], inp.settings)
  const days = daysRemaining(batch.expiryDate)
  const qty = quantitySteps(events, inp.settings.quantityTolerancePct)
  const flaggedQty = qty.filter((s) => s.kind !== 'OK')
  const unaccounted = qty.filter((s) => s.kind === 'LOSS').reduce((a, s) => a + s.missing, 0)
  const stage: Stage = events.length ? events[events.length - 1].action : 'HARVESTED'
  const last = events[events.length - 1]

  // ----------------------------------------------------------- anomalies
  const anomalies: Anomaly[] = []
  const add = (a: Omit<Anomaly, 'id' | 'batchId'>) =>
    anomalies.push({ ...a, id: `AN-${batch.batchId.slice(-5)}-${anomalies.length + 1}`, batchId: batch.batchId })
  const stageOf = (e?: ChainEvent): Stage => e?.action ?? 'RETAILED'

  if (!chain.valid) {
    const bad = chain.checks[chain.brokenAt!]
    const ev = events[chain.brokenAt!]
    if (bad.status === 'UNAUTHORIZED_SIGNER') {
      add({
        type: 'UNAUTHORIZED_EVENT', severity: 'HIGH', confidence: 91, stage: stageOf(ev), eventId: ev.eventId,
        title: `Unrecognised actor signed block #${chain.brokenAt! + 1}`,
        evidence: [`Signer ${ev.actorId} is not in the actor registry`, `Block ${ev.eventId} (${ev.action}) in ${ev.location}`],
        recommended: 'Suspend the signing key and verify custody with the previous handler.',
      })
    } else {
      add({
        type: 'LEDGER_TAMPERING', severity: 'CRITICAL', confidence: 99, stage: stageOf(ev), eventId: ev.eventId,
        title: `Ledger mismatch at block #${chain.brokenAt! + 1}`,
        evidence: [`Block #${chain.brokenAt! + 1}: ${bad.status.replace(/_/g, ' ')}`, `${chain.invalidCount} of ${events.length} blocks untrusted`],
        recommended: 'Freeze batch; restore from immutable replica; audit the writing node.',
      })
    }
  }
  if (qr.replay) {
    const n = qr.cities.length
    add({
      type: 'QR_REPLAY', severity: n >= 4 ? 'CRITICAL' : 'HIGH', confidence: Math.min(98, 74 + n * 6), stage: 'RETAILED', qrId: qr.qrId,
      title: `Same package identity seen in ${n} cities`,
      evidence: qr.scans.map((s) => `${s.city} · ${fmtDate(s.timestamp)} ${fmtTime(s.timestamp)}`),
      recommended: 'Block batch, revoke QR, re-verify physical units.',
    })
  }
  qr.impossible.slice(0, 1).forEach((t) => {
    add({
      type: 'IMPOSSIBLE_TRAVEL', severity: 'HIGH', confidence: 96, stage: 'RETAILED', qrId: qr.qrId,
      title: `${t.from.city} → ${t.to.city} in ${t.minutes} min`,
      evidence: [`Distance ~${t.km.toLocaleString('en-US')} km`, `Elapsed ${t.minutes} min · expected ≥ ${Math.round(t.expectedMinutes / 60)} h`, `Implied speed ${t.speedKmh.toLocaleString('en-US')} km/h`],
      recommended: 'Likely QR duplication / identity cloning.',
    })
  })
  if (qr.repeated) {
    add({
      type: 'REPEATED_SCAN', severity: 'LOW', confidence: 72, stage: 'RETAILED', qrId: qr.qrId,
      title: `${qr.repeated.count} scans of one QR in 60 min (${qr.repeated.city})`,
      evidence: ['Burst of scans from a single city'], recommended: 'Monitor; may be shelf-audit or reconnaissance.',
    })
  }
  flaggedQty.forEach((s) => {
    const loss = s.kind === 'LOSS'
    add({
      type: 'QUANTITY_ANOMALY', severity: s.pct > 20 || !loss ? 'HIGH' : 'MEDIUM', confidence: Math.min(97, 80 + Math.round(s.pct / 2)),
      stage: s.to.action, eventId: s.to.eventId,
      title: loss ? `${Math.abs(s.missing).toLocaleString('en-US')} ${batch.unit} unaccounted for` : `Quantity increased by ${Math.abs(s.missing).toLocaleString('en-US')} ${batch.unit}`,
      evidence: [
        `${s.from.actor}: ${s.from.quantity.toLocaleString('en-US')} ${batch.unit}`,
        `${s.to.actor}: ${s.to.quantity.toLocaleString('en-US')} ${batch.unit}`,
        `Difference ${s.pct.toFixed(1)}% (tolerance ${inp.settings.quantityTolerancePct}%)`,
      ],
      recommended: loss ? 'Reconcile with the custodian; request delivery proofs.' : 'Inflated quantity may indicate injection of foreign goods.',
    })
  })
  if (cold.violation) {
    const r = cold.runs.reduce((a, b) => (b.peak > a.peak ? b : a))
    add({
      type: 'COLD_CHAIN_VIOLATION', severity: r.peak - inp.settings.maxTempC > 5 ? 'CRITICAL' : 'HIGH', confidence: 97, stage: 'STORED',
      title: `${r.peak.toFixed(1)}°C for ${r.minutes} min`,
      evidence: [`Safe range ${inp.settings.minTempC}–${inp.settings.maxTempC}°C`, `Excursion ${fmtTime(r.start)}–${fmtTime(r.end)}`],
      recommended: 'Isolate for lab testing; review refrigeration unit.',
    })
  }
  if (days < 0 && STAGES.indexOf(stage) >= 3) {
    add({
      type: 'EXPIRED_PRODUCT', severity: 'MEDIUM', confidence: 100, stage: 'RETAILED',
      title: `Expired ${Math.abs(days)} day(s) ago but still in the chain`, evidence: [`Expiry ${fmtDate(batch.expiryDate)}`],
      recommended: 'Pull stock and notify retailer.',
    })
  }
  if (classification.label !== 'AUTHENTIC' || !packaging.watermarkValid || !packaging.qrValid) {
    add({
      type: 'COUNTERFEIT_PACKAGING', severity: classification.label === 'COUNTERFEIT' ? 'CRITICAL' : 'HIGH',
      confidence: Math.round(classification.label === 'AUTHENTIC' ? 80 : classification.confidence), stage: 'RETAILED',
      title: `Packaging match ${packaging.overall.toFixed(0)}% — ${classification.label}`,
      evidence: [
        `Tampered regions: ${[...new Set(packaging.tamperedRegions)].join(', ') || 'none'}`,
        `Watermark ${packaging.watermarkValid ? 'valid' : 'INVALID'} · QR ${packaging.qrValid ? 'valid' : 'distorted'}`,
      ],
      recommended: 'Quarantine units and collect a physical sample.',
    })
  }
  if (!batch.certValid) {
    add({
      type: 'CERTIFICATION_TAMPERING', severity: 'HIGH', confidence: 93, stage: 'HARVESTED',
      title: `${batch.certification} certificate ${batch.certId} failed verification`,
      evidence: ['Certificate hash mismatch with registry'], recommended: 'Suspend organic/premium claims.',
    })
  }

  // ----------------------------------------------------------- trust engine
  const worstSev = anomalies.reduce<Severity | null>((a, x) => (a ? sevMax(a, x.severity) : x.severity), null)
  const chainScore = events.length ? (100 * (events.length - chain.invalidCount)) / events.length : 100
  const qrScore = qr.status === 'REVOKED' || qr.status === 'UNKNOWN' ? 0 : qr.replay ? 18 : qr.repeated ? 85 : 98
  const wmScore = packaging.watermarkValid ? 97 : 20
  const locationScore = qr.impossible.length ? 22 : qr.replay ? 40 : 100
  const qtyScore = clamp(100 - qty.reduce((a, s) => a + (s.kind === 'OK' ? 0 : s.pct), 0) * 3)
  const supplyScore = clamp(100 - (chain.valid ? 0 : 35) - (qty.some((s) => s.kind === 'GAIN') ? 15 : 0))
  const components: Record<TrustKey, number> = {
    packaging: Math.round(packaging.overall * 10) / 10,
    qr: qrScore,
    watermark: wmScore,
    blockchain: Math.round(chainScore * 10) / 10,
    supplyChain: supplyScore,
    location: locationScore,
    quantity: Math.round(qtyScore),
    temperature: cold.storageScore,
    expiry: expiryScore(days),
    certification: batch.certValid ? 100 : 15,
  }
  const keys = Object.keys(components) as TrustKey[]
  const risks = Object.fromEntries(keys.map((k) => [k, Math.round(100 - components[k])])) as Record<TrustKey, number>
  let trust = keys.reduce((a, k) => a + components[k] * WEIGHTS[k], 0)
  // authenticity = "is the physical + digital identity genuine" (excludes freshness signals)
  let authenticity =
    components.packaging * 0.27 + components.qr * 0.15 + components.watermark * 0.14 + components.blockchain * 0.2 +
    components.supplyChain * 0.1 + components.location * 0.07 + components.certification * 0.07
  const caps: string[] = []
  const cap = (limit: number, why: string) => {
    if (authenticity > limit) authenticity = limit
    if (trust > limit + 5) trust = limit + 5
    caps.push(why)
  }
  if (!chain.valid) cap(38, 'Hash chain compromised')
  if (!packaging.watermarkValid) cap(52, 'Watermark invalid')
  if (qr.replay) cap(48, 'QR replay detected')
  if (classification.label === 'COUNTERFEIT') cap(40, 'Packaging classified counterfeit')
  if (!batch.certValid) cap(62, 'Certification failed verification')
  if (cold.violation) trust = Math.min(trust, 68)
  if (days < 0) trust = Math.min(trust, 55)
  authenticity = Math.round(authenticity * 0.99 * 10) / 10 // calibration: the model never claims certainty
  trust = Math.round(trust)
  const verdict = authenticity >= 85 ? 'AUTHENTIC' : authenticity >= 55 ? 'SUSPICIOUS' : 'COUNTERFEIT'
  const security: TrustResult['security'] =
    worstSev === 'CRITICAL' || worstSev === 'HIGH' ? 'UNDER ATTACK' : worstSev ? 'WATCH' : 'SECURE'
  const truths = {
    physical: Math.round((components.packaging + components.watermark) / 2),
    digital: Math.round((components.qr + components.blockchain + components.certification) / 3),
    supply: Math.round((components.supplyChain + components.location + components.quantity + components.temperature + components.expiry) / 5),
  }
  const physicalBad = truths.physical < 75, digitalBad = truths.digital < 75, supplyBad = truths.supply < 75
  let conclusion = 'Physical, digital and supply-chain truth all agree — product is authentic.'
  if (qr.replay && physicalBad) conclusion = 'QR is valid but the packaging fingerprint mismatches and scan locations are suspicious — possible counterfeit / QR replay attack.'
  else if (qr.replay) conclusion = 'A valid QR identity is being presented from inconsistent locations — possible QR replay / identity cloning.'
  else if (physicalBad && !digitalBad) conclusion = 'The digital record is intact but the physical package disagrees with it — a copied QR on counterfeit packaging is likely.'
  else if (digitalBad && !physicalBad) conclusion = 'The package looks genuine but the cryptographic record is compromised — investigate ledger tampering.'
  else if (supplyBad && !physicalBad && !digitalBad) conclusion = 'Identity checks pass, but the supply-chain history (storage / quantity / expiry) disagrees — a safety risk rather than forgery.'
  else if (physicalBad && digitalBad) conclusion = 'Physical and digital truth both fail — treat as compromised or counterfeit.'

  // ----------------------------------------------------------- status & scores
  let status: BatchStatus
  const serious = anomalies.some((a) =>
    ['COUNTERFEIT_PACKAGING', 'QR_REPLAY', 'IMPOSSIBLE_TRAVEL', 'CERTIFICATION_TAMPERING', 'QUANTITY_ANOMALY', 'UNEXPECTED_LOCATION'].includes(a.type))
  if (batch.hold === 'RECALLED') status = 'RECALLED'
  else if (batch.hold === 'BLOCKED') status = 'BLOCKED'
  else if (!chain.valid) status = 'COMPROMISED'
  else if (days < 0) status = 'EXPIRED'
  else if (serious) status = 'SUSPICIOUS'
  else if (cold.violation) status = 'COLD VIOLATION'
  else if (STAGES.indexOf(stage) < 4) status = 'IN TRANSIT'
  else status = 'VERIFIED'

  const scores = {
    authenticity: Math.round(authenticity),
    chainIntegrity: Math.round(chainScore),
    packaging: Math.round(packaging.overall),
    storage: cold.storageScore,
    expiry: expiryScore(days),
    certification: components.certification,
    foodSafety: 0,
  }
  scores.foodSafety = Math.round(
    (scores.authenticity + scores.chainIntegrity + scores.storage + scores.certification + scores.expiry + scores.packaging) / 6,
  )

  return {
    batch, events, packages, chain, packaging, classification, worstPackage: worst.p, qr, cold, days, qty, unaccounted, anomalies,
    trust: { components, risks, trust, authenticity, verdict, security, truths, conclusion, caps },
    stage, currentLocation: last?.location ?? batch.origin, currentOwner: last?.actor ?? batch.farm, status, scores,
  }
}

export interface GlobalAnalysis {
  byId: Record<string, BatchAnalysis>
  list: BatchAnalysis[]
  anomalies: Anomaly[]
  totalBlocks: number
  invalidBlocks: number
  chainIntegrity: number
  authenticRate: number
  flaggedPackages: number
}

export function analyzeAll(inp: EngineInput): GlobalAnalysis {
  const list = inp.batches.map((b) => analyzeBatch(b, inp))
  const byId = Object.fromEntries(list.map((a) => [a.batch.batchId, a]))
  const anomalies = list.flatMap((a) => a.anomalies)
  const totalBlocks = list.reduce((a, x) => a + x.events.length, 0)
  const invalidBlocks = list.reduce((a, x) => a + x.chain.invalidCount, 0)
  const flaggedPackages = inp.packages.filter(
    (p) => !p.qrRevoked && classify(packagingScores(p.mods, p.packageId)).label !== 'AUTHENTIC',
  ).length
  return {
    byId, list, anomalies, totalBlocks, invalidBlocks,
    chainIntegrity: totalBlocks ? (100 * (totalBlocks - invalidBlocks)) / totalBlocks : 100,
    authenticRate: inp.packages.length ? (100 * (inp.packages.length - flaggedPackages)) / inp.packages.length : 100,
    flaggedPackages,
  }
}
