import type {
  Batch, ChainEvent, Incident, Notification, AuditEntry, Pkg, QrScan, TelemetryPoint, Stage, RecallRecord,
} from '../models/types'
import { NO_MODS, STAGES } from '../models/types'
import { ACTORS, ACTOR_BY_ID, PRODUCTS, actorsOf } from './catalog'
import { makeRng } from '../utils/prng'
import { NOW, DAY, HOUR, MIN } from '../utils/clock'
import { sha256 } from '../utils/sha256'
import { encryptRecord, sensitiveMetaFor, signSim } from '../services/crypto'
import { GENESIS_HASH, sealEvent } from '../services/ledger'
import { HERO_BATCH, makeIncident } from '../services/incidents'
import { packagingScores } from '../services/packaging'

export interface DataState {
  batches: Batch[]
  packages: Pkg[]
  events: ChainEvent[]
  scans: QrScan[]
  telemetry: Record<string, TelemetryPoint[]>
  incidents: Incident[]
  notifications: Notification[]
  audit: AuditEntry[]
  recalls: Record<string, RecallRecord>
  demoLoaded: boolean
}

/** Batches that the demo scenario turns into live incidents. */
export const DEMO_TARGETS = {
  hero: HERO_BATCH,
  quantity: 'FCG-2026-00420',
  cold: 'FCG-2026-00419',
  suspicious: 'FCG-2026-00418',
  replay: 'FCG-2026-00417',
  unauthorized: 'FCG-2026-00416',
  expired: 'FCG-2026-00415',
}

const OFFSETS = [0, 2, 4, 5, 7, 9] // days after harvest for each stage
const pad5 = (n: number) => String(n).padStart(5, '0')
const endOfDay = (ms: number) => Math.floor((ms + 5.5 * 3600_000) / DAY) * DAY - 5.5 * 3600_000 + DAY - 60_000

function pickCounts(rng: ReturnType<typeof makeRng>): number[] {
  // k = 0..5 are fixed demo targets, the remaining 23 batches share 89 events (total 125 events).
  const fixed = [5, 4, 5, 5, 5, 6]
  const rest = [6, 6, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 2, 2]
  let sum = rest.reduce((a, b) => a + b, 0)
  const target = 89
  while (sum < target) { const i = rng.int(0, rest.length - 1); if (rest[i] < 6) { rest[i]++; sum++ } }
  while (sum > target) { const i = rng.int(0, rest.length - 1); if (rest[i] > 2) { rest[i]--; sum-- } }
  // shuffle rest deterministically
  for (let i = rest.length - 1; i > 0; i--) { const j = rng.int(0, i); [rest[i], rest[j]] = [rest[j], rest[i]] }
  return [...fixed, ...rest]
}

function buildBase(): DataState {
  const rng = makeRng('foodchain-guard-2026')
  const counts = pickCounts(rng)
  const batches: Batch[] = []
  const packages: Pkg[] = []
  const events: ChainEvent[] = []
  const scans: QrScan[] = []
  const telemetry: Record<string, TelemetryPoint[]> = {}

  const processors = actorsOf('PROCESSOR')
  const distributors = actorsOf('DISTRIBUTOR')
  const warehouses = actorsOf('WAREHOUSE').filter((w) => w.id !== 'wh-5')
  const retailers = actorsOf('RETAILER').filter((r) => r.id !== 'ret-17')

  // product forced per demo target index
  const forced: Record<number, number> = { 0: 3, 1: 2, 5: 7 }
  const specs: Array<{ k: number; id: string; hero: boolean }> = [{ k: -1, id: HERO_BATCH, hero: true }]
  for (let k = 0; k < 29; k++) specs.push({ k, id: `FCG-2026-${pad5(420 - k)}`, hero: false })

  specs.forEach(({ k, id, hero }) => {
    const r = makeRng(id)
    const pIdx = hero ? 0 : forced[k] !== undefined ? forced[k] : r.int(0, PRODUCTS.length - 1)
    const spec = PRODUCTS[pIdx]
    const count = hero ? 6 : counts[k]
    const farm = hero ? ACTOR_BY_ID['farm-1'] : ACTOR_BY_ID[r.pick(spec.farmIds)]
    const age = hero ? 10 : OFFSETS[count - 1] + r.range(0.4, 1.4) // days since harvest
    const harvest = hero ? new Date('2026-10-08T08:32:00+05:30').getTime() : NOW - age * DAY
    const shelf = spec.shelfDays
    const quantity = hero ? 2400 : spec.qtyRange[0] === spec.qtyRange[1] ? spec.qtyRange[0] : Math.round(r.range(spec.qtyRange[0], spec.qtyRange[1]) / 10) * 10
    const route = hero
      ? { processorId: 'proc-1', distributorId: 'dist-1', warehouseId: 'wh-1', retailerId: 'ret-1' }
      : {
          processorId: (farm.region === 'Konkan' ? r.pick([processors[1], processors[0]]) : r.pick(processors)).id,
          distributorId: r.pick(distributors).id,
          warehouseId: r.pick(warehouses).id,
          retailerId: r.pick(retailers).id,
        }
    const processingDate = harvest + (hero ? 2 * DAY + 2.5 * HOUR : 2 * DAY)
    const certification = hero ? 'Organic' : r.pick(spec.certs)
    const batch: Batch = {
      batchId: id,
      product: spec.product,
      variety: spec.variety,
      emoji: spec.emoji,
      unit: spec.unit,
      quantity,
      packageCount: spec.unit === 'kg' ? Math.round(quantity / 0.5) : quantity,
      farmId: farm.id,
      farm: farm.name,
      origin: `${farm.city}, Maharashtra`,
      harvestDate: harvest,
      processingDate,
      expiryDate: endOfDay(harvest + shelf * DAY),
      certification,
      certId: `${certification.slice(0, 3).toUpperCase()}-IN-${r.int(100000, 999999)}`,
      certValid: true,
      qrId: '',
      packagingFingerprint: hero ? 'PF-7A91C42D8F' : 'PF-' + sha256('pf' + id).slice(0, 10).toUpperCase(),
      watermarkId: 'WM-' + sha256('wm' + id).slice(0, 8).toUpperCase(),
      route,
      storage: { minC: 2, maxC: 8, humidityMin: 70, humidityMax: 92 },
      hold: 'NONE',
      brand: spec.brand,
      createdAt: harvest,
    }
    batches.push(batch)

    // --- ledger events (hash chain)
    const actorFor: Record<Stage, string> = {
      HARVESTED: farm.id, PROCESSED: route.processorId, DISTRIBUTED: route.distributorId,
      STORED: route.warehouseId, RETAILED: route.retailerId, VERIFIED: 'cons-1',
    }
    let q = quantity
    let prev = GENESIS_HASH
    const batchEvents: ChainEvent[] = []
    for (let i = 0; i < count; i++) {
      const stage = STAGES[i]
      const actor = ACTOR_BY_ID[actorFor[stage]]
      const jitter = hero ? 0 : r.range(-0.3, 0.3)
      const ts = hero
        ? [
            '2026-10-08T08:32:00+05:30', '2026-10-10T14:05:00+05:30', '2026-10-12T07:40:00+05:30',
            '2026-10-13T16:20:00+05:30', '2026-10-15T09:10:00+05:30', '2026-10-17T18:20:00+05:30',
          ].map((s) => new Date(s).getTime())[i]
        : harvest + (OFFSETS[i] + (i === 0 ? 0 : jitter)) * DAY
      if (i > 0 && i < 5) q = Math.round(q * (1 - r.range(0, 0.012)))
      if (i === 5) q = batchEvents[4].quantity
      const base = {
        eventId: `EVT-${id.slice(-5)}-${i + 1}`,
        batchId: id, index: i,
        actorId: actor.id, actor: actor.name, actorType: actor.type, location: actor.city,
        timestamp: Math.min(ts, NOW - 5 * MIN), action: stage,
        quantity: q, unit: spec.unit,
        temperatureC: stage === 'HARVESTED' ? +r.range(26, 31).toFixed(1) : stage === 'PROCESSED' ? +r.range(9, 13).toFixed(1) : +r.range(3.8, 6.8).toFixed(1),
        payloadDigest: '', previousHash: prev,
      }
      const meta = sensitiveMetaFor(batch, base)
      const ev = sealEvent({ ...base, payloadDigest: encryptRecord(meta).digest })
      prev = ev.currentHash
      batchEvents.push(ev)
    }
    events.push(...batchEvents)

    // --- packages & QR identities
    const pkgCount = hero ? 4 : 2
    for (let p = 0; p < pkgCount; p++) {
      const qrId = hero && p === 0 ? 'QR-FCG-928371' : `QR-FCG-${r.int(100000, 999999)}`
      packages.push({
        packageId: `PKG-${id.slice(-5)}-${'ABCD'[p]}`,
        batchId: id, qrId,
        fingerprint: batch.packagingFingerprint,
        watermarkId: batch.watermarkId,
        mods: { ...NO_MODS },
        qrRevoked: false,
      })
      if (p === 0) batch.qrId = qrId
    }

    // --- scans: retail + consumer scans in the retailer's city
    const retailEv = batchEvents[4]
    if (retailEv) {
      packages.filter((x) => x.batchId === id).forEach((pk, pi) => {
        const nScans = hero ? (pi === 0 ? 2 : 0) : r.int(1, 2)
        for (let s = 0; s < nScans; s++) {
          const t = hero ? [new Date('2026-10-15T14:20:00+05:30').getTime(), new Date('2026-10-17T18:20:00+05:30').getTime()][s]
            : retailEv.timestamp + r.range(1, 40) * HOUR
          if (t > NOW) continue
          scans.push({ scanId: `SCN-${scans.length + 1}`, qrId: pk.qrId, batchId: id, city: retailEv.location, timestamp: t, source: s === 0 ? 'retailer' : 'consumer' })
        }
      })
    }
  })

  // --- IoT telemetry (15-minute grid, last 24h)
  batches.forEach((b) => {
    const r = makeRng('tel' + b.batchId)
    const centre = b.batchId === HERO_BATCH ? 6.1 : r.range(4.2, 6.1)
    const amp = b.batchId === HERO_BATCH ? 1.75 : r.range(0.3, 0.9)
    const pts: TelemetryPoint[] = []
    for (let i = 95; i >= 0; i--) {
      const t = NOW - i * 15 * MIN
      const wave = Math.sin(i / 9 + r.next()) * amp
      pts.push({ t, tempC: Math.min(7.7, +(centre + wave + r.range(-0.25, 0.25)).toFixed(1)), humidity: +(82 + Math.sin(i / 13) * 4 + r.range(-1.5, 1.5)).toFixed(0) as unknown as number })
    }
    if (b.batchId === HERO_BATCH) pts[pts.length - 1].tempC = 6.2
    telemetry[b.batchId] = pts
  })

  // --- historic (resolved) incidents so the SOC is never empty
  const incidents: Incident[] = []
  const hist: Array<[Parameters<typeof makeIncident>[1]['type'], number, Record<string, string | number>]> = [
    ['COUNTERFEIT_PACKAGING', 6, { similarity: 38, regions: 'Logo geometry and expiry label altered.' }],
    ['QR_REPLAY', 7, { cities: 'Pune, Hyderabad, Chennai' }],
    ['COUNTERFEIT_PACKAGING', 8, { similarity: 44, regions: 'Certification mark altered.' }],
    ['IMPOSSIBLE_TRAVEL', 8, { from: 'Nashik', to: 'Kolkata', minutes: 55, km: 1820 }],
    ['REPEATED_SCAN', 9, { count: 14, city: 'Pune' }],
    ['UNEXPECTED_LOCATION', 10, { city: 'Nagpur' }],
    ['COUNTERFEIT_PACKAGING', 10, { similarity: 51, regions: 'Colour profile and layout mismatch.' }],
    ['CERTIFICATION_TAMPERING', 11, { certId: 'ORG-IN-482912' }],
    ['QUANTITY_ANOMALY', 12, { missing: 120, unit: 'kg', from: 'Western Logistics', to: 'Organic Bazaar' }],
    ['QR_REPLAY', 12, { cities: 'Mumbai, Delhi, Kolkata' }],
    ['COUNTERFEIT_PACKAGING', 13, { similarity: 29, regions: 'Fake pouch with distorted QR.' }],
    ['IMPOSSIBLE_TRAVEL', 13, { from: 'Mumbai', to: 'Chennai', minutes: 80, km: 1340 }],
    ['REPEATED_SCAN', 14, { count: 11, city: 'Mumbai' }],
    ['UNEXPECTED_LOCATION', 15, { city: 'Ahmedabad' }],
    ['COUNTERFEIT_PACKAGING', 15, { similarity: 47, regions: 'Typography and security pattern mismatch.' }],
    ['EXPIRED_PRODUCT', 16, { days: 3, location: 'Pune' }],
  ]
  hist.forEach(([type, daysAgo, details], i) => {
    const b = batches[6 + ((i * 3) % 22)]
    incidents.push(
      makeIncident(`SEC-${1020 + i}`, {
        type, batchId: b.batchId, ts: NOW - daysAgo * DAY + i * 17 * MIN, location: ACTOR_BY_ID[b.route.retailerId].city,
        details, status: 'RESOLVED', qrId: type === 'QR_REPLAY' ? `QR-FCG-${400000 + i * 777}` : undefined,
      }),
    )
  })
  incidents.sort((a, b) => b.timestamp - a.timestamp)

  const notifications: Notification[] = [
    { id: 'N1', ts: NOW - 6 * MIN, level: 'success', title: 'Batch FCG-2026-00421 verified', body: 'All 10 trust signals agree. Trust score 94/100.', batchId: HERO_BATCH, read: false },
    { id: 'N2', ts: NOW - 52 * MIN, level: 'success', title: 'Ledger validation completed', body: 'All batch chains validated by the integrity worker.', read: false },
    { id: 'N3', ts: NOW - 3 * HOUR, level: 'warning', title: 'Batch approaching expiry', body: 'FCG-2026-00421 expires in 4 days.', batchId: HERO_BATCH, read: true },
  ]

  const audit: AuditEntry[] = [
    { id: 'A1', ts: NOW - 20 * HOUR, actor: 'KMS', batchId: '—', action: 'KEY ROTATION (kms/fcg-master-01)', location: 'Secure vault', hash: sha256('rot1'), status: 'VALID' },
    { id: 'A2', ts: NOW - 6 * HOUR, actor: 'Integrity Worker', batchId: '—', action: 'LEDGER VALIDATION SWEEP', location: 'Validator node', hash: sha256('sweep1'), status: 'VALID' },
  ]

  return { batches, packages, events, scans, telemetry, incidents, notifications, audit, recalls: {}, demoLoaded: false }
}

/** Layer the live "security demo" scenario on top of the base dataset. */
export function applyDemo(base: DataState): DataState {
  const s: DataState = JSON.parse(JSON.stringify(base))
  const T = DEMO_TARGETS
  const byId = (id: string) => s.batches.find((b) => b.batchId === id)!
  const evOf = (id: string) => s.events.filter((e) => e.batchId === id)
  const replaceEvents = (id: string, evs: ChainEvent[]) => {
    s.events = s.events.filter((e) => e.batchId !== id).concat(evs)
  }
  const pkgOf = (id: string) => s.packages.filter((p) => p.batchId === id)
  const newIncs: Incident[] = []

  // 1) Quantity anomaly: 1000 → 1000 → 980 → 980 → 680 units
  {
    const evs = evOf(T.quantity)
    const qs = [1000, 1000, 980, 980, 680]
    let prev = GENESIS_HASH
    const rebuilt = evs.map((e, i) => {
      const ev = sealEvent({ ...e, quantity: qs[i], previousHash: prev })
      prev = ev.currentHash
      return ev
    })
    replaceEvents(T.quantity, rebuilt)
    newIncs.push(makeIncident('SEC-1038', {
      type: 'QUANTITY_ANOMALY', batchId: T.quantity, ts: NOW - 5 * HOUR, location: 'Pune', status: 'CONTAINED',
      details: { missing: 300, unit: 'units', from: rebuilt[3].actor, to: rebuilt[4].actor },
      evidence: [
        { label: 'Warehouse received', value: '980 units' }, { label: 'Retailer received', value: '680 units' },
        { label: 'Unaccounted', value: '300 units (30.6%)' }, { label: 'Event', value: rebuilt[4].eventId },
      ],
    }))
  }
  // 2) Cold-chain violation: 10.6°C for 90 minutes
  {
    const tel = s.telemetry[T.cold]
    for (let i = 0; i < 7; i++) { const p = tel[tel.length - 40 + i]; p.tempC = +(10.2 + (i % 3) * 0.3).toFixed(1) }
    newIncs.push(makeIncident('SEC-1037', {
      type: 'COLD_CHAIN_VIOLATION', batchId: T.cold, ts: NOW - 9 * HOUR, location: 'Nashik', status: 'CONTAINED',
      details: { peak: 10.8, minutes: 90, range: '2–8°C' },
    }))
  }
  // 3) Suspicious package (72% match) + blocked
  {
    const pk = pkgOf(T.suspicious)[0]
    pk.mods = { ...NO_MODS, expiry: true, color: true }
    byId(T.suspicious).hold = 'BLOCKED'
    newIncs.push(makeIncident('SEC-1036', {
      type: 'COUNTERFEIT_PACKAGING', batchId: T.suspicious, ts: NOW - 2 * DAY, location: 'Mumbai', status: 'CONTAINED', qrId: pk.qrId,
      details: { similarity: Math.round(packagingScores(pk.mods, pk.packageId).overall), regions: 'Expiry label reprinted; colour profile drift.' },
    }))
  }
  // 4) QR replay (existing, contained)
  {
    const pk = pkgOf(T.replay)[0]
    const rEv = evOf(T.replay)[4]
    const t0 = rEv.timestamp + 6 * HOUR
    const cities: Array<[string, number]> = [[rEv.location, 0], [rEv.location, 12], ['Bengaluru', 70], ['Ahmedabad', 130]]
    cities.forEach(([city, m], i) => s.scans.push({ scanId: `SCN-R${i}`, qrId: pk.qrId, batchId: T.replay, city, timestamp: t0 + m * MIN, source: i < 2 ? 'consumer' : 'unknown' }))
    byId(T.replay).hold = 'BLOCKED'
    newIncs.push(makeIncident('SEC-1039', {
      type: 'QR_REPLAY', batchId: T.replay, ts: t0 + 135 * MIN, location: `${rEv.location} → Bengaluru → Ahmedabad`, status: 'CONTAINED', qrId: pk.qrId,
      details: { cities: `${rEv.location}, Bengaluru, Ahmedabad` },
    }))
  }
  // 5) Unauthorized handler signs the last ledger block
  {
    const evs = evOf(T.unauthorized)
    const last = evs[evs.length - 1]
    const forged = sealEvent({ ...last, actorId: 'actor-x-77', actor: 'Unregistered Handler (LTX-77)', location: 'Thane' })
    forged.signature = signSim('actor-x-77', forged.currentHash)
    replaceEvents(T.unauthorized, [...evs.slice(0, -1), forged])
    newIncs.push(makeIncident('SEC-1040', {
      type: 'UNAUTHORIZED_EVENT', batchId: T.unauthorized, ts: NOW - 70 * MIN, location: 'Thane', status: 'INVESTIGATING',
      details: { actor: 'Unregistered Handler (LTX-77)' },
      evidence: [
        { label: 'Block', value: `#${evs.length} ${last.action}` }, { label: 'Signer', value: 'actor-x-77 (not in registry)' },
        { label: 'Recorded hash', value: forged.currentHash.slice(0, 24) + '…' }, { label: 'Hash chain', value: 'Linked but signer unauthorised' },
      ],
    }))
    byId(T.unauthorized).hold = 'BLOCKED'
  }
  // 6) Expired product still on shelf
  {
    const b = byId(T.expired)
    b.expiryDate = endOfDay(NOW - 2 * DAY)
    newIncs.push(makeIncident('SEC-1041', {
      type: 'EXPIRED_PRODUCT', batchId: T.expired, ts: NOW - 4 * HOUR, location: ACTOR_BY_ID[b.route.retailerId].city, status: 'CONTAINED',
      details: { days: 2, location: ACTOR_BY_ID[b.route.retailerId].name },
    }))
  }
  // low-level repeated scan signals
  const lowSignals: Array<[string, string]> = [['FCG-2026-00412', 'Pune'], ['FCG-2026-00409', 'Mumbai']]
  lowSignals.forEach(([bid, city], i) => {
    const pk = pkgOf(bid)[0]
    if (!pk) return
    for (let k = 0; k < 7; k++) s.scans.push({ scanId: `SCN-L${i}${k}`, qrId: pk.qrId, batchId: bid, city, timestamp: NOW - (3 + i) * HOUR + k * 6 * MIN, source: 'unknown' })
  })

  s.incidents = [...newIncs, ...s.incidents].sort((a, b) => b.timestamp - a.timestamp)
  const demoNotes: Notification[] = [
    { id: 'D1', ts: NOW - 70 * MIN, level: 'critical', title: 'Unauthorized ledger event', body: 'Block signed by unregistered handler on FCG-2026-00416.', batchId: T.unauthorized, read: false },
    { id: 'D2', ts: NOW - 4 * HOUR, level: 'warning', title: 'Expired product detected', body: 'FCG-2026-00415 scanned 2 days past expiry.', batchId: T.expired, read: false },
    { id: 'D3', ts: NOW - 5 * HOUR, level: 'warning', title: '300 units unaccounted for', body: 'FCG-2026-00420: warehouse 980 → retailer 680.', batchId: T.quantity, read: false },
    { id: 'D4', ts: NOW - 9 * HOUR, level: 'critical', title: 'Cold-chain violation detected', body: 'FCG-2026-00419 held at 10.8°C for 90 minutes.', batchId: T.cold, read: true },
    { id: 'D5', ts: NOW - 2 * DAY, level: 'critical', title: 'Packaging mismatch detected', body: 'FCG-2026-00418 package match only 72%.', batchId: T.suspicious, read: true },
    { id: 'D6', ts: NOW - 3 * HOUR, level: 'critical', title: 'QR replay attack detected', body: 'QR on FCG-2026-00417 seen in three cities within 2 hours.', batchId: T.replay, read: true },
  ]
  s.notifications = [...demoNotes, ...s.notifications].sort((a, b) => b.ts - a.ts)
  s.demoLoaded = true
  return s
}

let _base: DataState | null = null
export function getBaseData(): DataState {
  if (!_base) _base = buildBase()
  return JSON.parse(JSON.stringify(_base))
}
export function getDemoData(): DataState {
  if (!_base) _base = buildBase()
  return applyDemo(_base)
}

/** Pristine (pre-attack) slice of one batch – used by "restore" and "authentic" scenarios. */
export function pristine(batchId: string) {
  if (!_base) _base = buildBase()
  const b = _base
  const copy = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
  const batch = b.batches.find((x) => x.batchId === batchId)
  if (!batch) return null
  return {
    batch: copy(batch),
    events: copy(b.events.filter((e) => e.batchId === batchId)),
    packages: copy(b.packages.filter((p) => p.batchId === batchId)),
    scans: copy(b.scans.filter((s) => s.batchId === batchId)),
    telemetry: copy(b.telemetry[batchId] ?? []),
  }
}
