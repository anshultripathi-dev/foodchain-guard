import type { BatchAnalysis } from './analysis'
import { ACTORS, ACTOR_BY_ID, actorsOf } from '../data/catalog'
import { makeRng } from '../utils/prng'
import { STAGES } from '../models/types'
import { HERO_BATCH } from './incidents'

export interface RecallNode { id: string; name: string; kind: 'batch' | 'farm' | 'processor' | 'distributor' | 'warehouse' | 'retailer'; city: string; units?: number; region?: string }
export interface RecallProfile {
  affectedUnits: number
  totalUnits: number
  retailers: Array<RecallNode & { units: number }>
  regions: string[]
  cities: string[]
  chain: RecallNode[]          // upstream path (farm → warehouse)
  order: string[]              // propagation order of node ids
}

const REGION_LABEL: Record<string, string> = { 'Mumbai MMR': 'Mumbai', 'Pune Region': 'Pune', 'North Maharashtra': 'Nashik', South: 'Bengaluru', Konkan: 'Konkan' }

export function recallProfile(a: BatchAnalysis): RecallProfile {
  const b = a.batch
  const r = makeRng('recall' + b.batchId)
  const reached = STAGES.indexOf(a.stage)
  const hero = b.batchId === HERO_BATCH
  const total = b.packageCount
  const inMarket = reached >= 3
  const affected = hero ? 1284 : inMarket ? Math.round(total * r.range(0.18, 0.4)) : Math.round(total * r.range(0.5, 0.9))
  const allRetailers = actorsOf('RETAILER')
  const picked = hero ? allRetailers : [ACTOR_BY_ID[b.route.retailerId], ...allRetailers.filter((x) => x.id !== b.route.retailerId).sort(() => r.next() - 0.5).slice(0, r.int(2, 5))]
  const weights = picked.map(() => r.range(0.4, 1.6))
  const wsum = weights.reduce((x, y) => x + y, 0)
  let remaining = affected
  const retailers = picked.map((p, i) => {
    const units = i === picked.length - 1 ? remaining : Math.round((affected * weights[i]) / wsum)
    remaining -= units
    return { id: p.id, name: p.name, kind: 'retailer' as const, city: p.city, region: p.region, units }
  })
  const chain: RecallNode[] = ([
    { id: ACTOR_BY_ID[b.farmId].id, name: b.farm, kind: 'farm', city: ACTOR_BY_ID[b.farmId].city },
    { id: b.route.processorId, name: ACTOR_BY_ID[b.route.processorId].name, kind: 'processor', city: ACTOR_BY_ID[b.route.processorId].city },
    { id: b.route.distributorId, name: ACTOR_BY_ID[b.route.distributorId].name, kind: 'distributor', city: ACTOR_BY_ID[b.route.distributorId].city },
    { id: b.route.warehouseId, name: ACTOR_BY_ID[b.route.warehouseId].name, kind: 'warehouse', city: ACTOR_BY_ID[b.route.warehouseId].city },
  ] as RecallNode[]).slice(0, Math.max(1, Math.min(4, reached + 1)))
  const regions = [...new Set(retailers.map((x) => REGION_LABEL[x.region ?? ''] ?? x.city))]
  return {
    affectedUnits: affected, totalUnits: total, retailers, regions, cities: [...new Set(retailers.map((x) => x.city))], chain,
    order: [...chain.map((c) => c.id), ...retailers.map((x) => x.id)],
  }
}
export { ACTORS }
