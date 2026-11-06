import type { Batch, ChainEvent, Incident, ThreatType } from '../models/types'
import type { GlobalAnalysis } from './analysis'
import { isOpen } from './incidents'
import { DAY, NOW } from '../utils/clock'
import { fmtShortDate } from '../utils/format'
import { mulberry32, hashSeed } from '../utils/prng'

/** The prototype tracks a 30-batch live sample on top of a simulated national network baseline. */
export const NETWORK_BASE_BATCHES = 12812
export const NETWORK_BASE_PRODUCTS = 427381 - 62 * 0 // baseline of tracked product units

export interface NetworkMetrics {
  totalBatches: number
  productsTracked: number
  activeShipments: number
  verifiedProducts: number
  suspiciousProducts: number
  counterfeitAlerts: number
  coldViolations: number
  openIncidents: number
  activeThreats: number
  chainIntegrity: number
  authenticRate: number
  counts: Record<ThreatType, number>
}

export function networkMetrics(an: GlobalAnalysis, incidents: Incident[], batches: Batch[]): NetworkMetrics {
  const counts = {} as Record<ThreatType, number>
  incidents.forEach((i) => { counts[i.type] = (counts[i.type] ?? 0) + 1 })
  const extraUnits = batches.slice(30).reduce((a, b) => a + b.packageCount, 0)
  const flaggedUnits = an.list.filter((a) => ['SUSPICIOUS', 'BLOCKED', 'COMPROMISED', 'RECALLED'].includes(a.status)).reduce((s, a) => s + a.batch.packageCount, 0)
  const products = NETWORK_BASE_PRODUCTS + extraUnits
  return {
    totalBatches: NETWORK_BASE_BATCHES + batches.length,
    productsTracked: products,
    activeShipments: an.list.filter((a) => a.status === 'IN TRANSIT').length,
    verifiedProducts: products - flaggedUnits,
    suspiciousProducts: flaggedUnits,
    counterfeitAlerts: incidents.filter((i) => i.type === 'COUNTERFEIT_PACKAGING' && isOpen(i)).length + an.anomalies.filter((a) => a.type === 'COUNTERFEIT_PACKAGING').length,
    coldViolations: an.anomalies.filter((a) => a.type === 'COLD_CHAIN_VIOLATION').length,
    openIncidents: incidents.filter(isOpen).length,
    activeThreats: an.anomalies.length + incidents.filter(isOpen).filter((i) => !an.anomalies.some((a) => a.batchId === i.batchId)).length,
    chainIntegrity: an.chainIntegrity,
    authenticRate: an.authenticRate,
    counts,
  }
}

export function activitySeries(events: ChainEvent[], days = 14) {
  const out: Array<{ day: string; events: number; verified: number }> = []
  for (let i = days - 1; i >= 0; i--) {
    const start = NOW - i * DAY - (NOW % DAY)
    const inDay = events.filter((e) => e.timestamp >= start && e.timestamp < start + DAY)
    out.push({ day: fmtShortDate(start + DAY / 2), events: inDay.length, verified: inDay.filter((e) => e.action === 'VERIFIED' || e.action === 'RETAILED').length })
  }
  return out
}

export function authenticitySeries(current: number, days = 14) {
  const r = mulberry32(hashSeed('auth-trend'))
  const out: Array<{ day: string; authentic: number; integrity: number }> = []
  for (let i = days - 1; i >= 0; i--) {
    const noise = (r() - 0.5) * 0.9
    out.push({ day: fmtShortDate(NOW - i * DAY), authentic: i === 0 ? +current.toFixed(1) : +(Math.min(99.5, 97.6 + noise + (days - i) * 0.04)).toFixed(1), integrity: i === 0 ? 0 : +(99.1 + (r() - 0.5) * 0.5).toFixed(1) })
  }
  return out
}

export function anomalySeries(incidents: Incident[], days = 14) {
  const out: Array<{ day: string; LOW: number; MEDIUM: number; HIGH: number; CRITICAL: number }> = []
  for (let i = days - 1; i >= 0; i--) {
    const start = NOW - i * DAY - (NOW % DAY)
    const inDay = incidents.filter((x) => x.timestamp >= start && x.timestamp < start + DAY)
    out.push({
      day: fmtShortDate(start + DAY / 2),
      LOW: inDay.filter((x) => x.severity === 'LOW').length, MEDIUM: inDay.filter((x) => x.severity === 'MEDIUM').length,
      HIGH: inDay.filter((x) => x.severity === 'HIGH').length, CRITICAL: inDay.filter((x) => x.severity === 'CRITICAL').length,
    })
  }
  return out
}
