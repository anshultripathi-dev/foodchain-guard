import type { BatchAnalysis, GlobalAnalysis } from './analysis'
import type { Incident, Pkg, ChainEvent } from '../models/types'
import { THREAT_LABEL } from '../models/types'
import { ACTORS } from '../data/catalog'

export interface SearchHit {
  kind: 'Batch' | 'QR' | 'Product' | 'Farm' | 'Retailer' | 'Incident' | 'Event' | 'Location'
  title: string
  sub: string
  to: string
  batchId?: string
}

export interface SearchResult { hits: SearchHit[]; rich: BatchAnalysis | null }

export function search(q: string, an: GlobalAnalysis, packages: Pkg[], incidents: Incident[], events: ChainEvent[]): SearchResult {
  const s = q.trim().toLowerCase()
  if (s.length < 2) return { hits: [], rich: null }
  const hits: SearchHit[] = []
  const seen = new Set<string>()
  const push = (h: SearchHit) => { const k = h.kind + h.title; if (!seen.has(k)) { seen.add(k); hits.push(h) } }

  let rich: BatchAnalysis | null = null
  an.list.forEach((a) => {
    const b = a.batch
    const hay = `${b.batchId} ${b.product} ${b.origin} ${b.farm} ${b.certification}`.toLowerCase()
    if (hay.includes(s) || b.batchId.slice(-5).includes(s)) {
      if (!rich && b.batchId.toLowerCase().includes(s)) rich = a
      push({ kind: 'Batch', title: b.batchId, sub: `${b.product} · ${a.currentLocation} · ${a.status}`, to: `/app/batches/${b.batchId}`, batchId: b.batchId })
    }
  })
  packages.forEach((p) => {
    if (p.qrId.toLowerCase().includes(s) || p.packageId.toLowerCase().includes(s) || p.fingerprint.toLowerCase().includes(s))
      push({ kind: 'QR', title: p.qrId, sub: `${p.packageId} · ${p.batchId}`, to: `/app/verification?qr=${p.qrId}`, batchId: p.batchId })
  })
  ACTORS.forEach((a) => {
    if (`${a.name} ${a.city}`.toLowerCase().includes(s)) {
      const kind = a.type === 'FARM' ? 'Farm' : a.type === 'RETAILER' ? 'Retailer' : 'Location'
      const b = an.list.find((x) => x.batch.farmId === a.id || x.batch.route.retailerId === a.id || x.events.some((e) => e.actorId === a.id))
      push({ kind, title: a.name, sub: `${a.type.toLowerCase()} · ${a.city}`, to: b ? `/app/batches/${b.batch.batchId}` : '/app/supply-chain', batchId: b?.batch.batchId })
    }
  })
  incidents.forEach((i) => {
    if (`${i.incidentId} ${THREAT_LABEL[i.type]} ${i.batchId} ${i.location}`.toLowerCase().includes(s))
      push({ kind: 'Incident', title: i.incidentId, sub: `${THREAT_LABEL[i.type]} · ${i.severity} · ${i.status}`, to: `/app/soc/${i.incidentId}`, batchId: i.batchId })
  })
  events.forEach((e) => {
    if (e.eventId.toLowerCase().includes(s) || e.currentHash.startsWith(s))
      push({ kind: 'Event', title: e.eventId, sub: `${e.action} · ${e.location} · ${e.batchId}`, to: `/app/blockchain`, batchId: e.batchId })
  })
  return { hits: hits.slice(0, 14), rich }
}
