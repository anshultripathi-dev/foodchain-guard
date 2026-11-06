import type { PackagingScores } from './packaging'
import { type RegionKey } from './packaging'
import type { DiffResult } from '../utils/packageArt'
import { clamp } from '../utils/format'

/** Convert pixel-level regional differences into the same feature scores the fingerprint comparison uses. */
export function scoresFromDiff(d: DiffResult): PackagingScores {
  const r = d.regionScores
  const inv = (x: number) => clamp(100 - x * 100)
  const logo = inv(r.logo * 1.15)
  const typography = inv((r.expiry + r.batch) / 2 * 1.2)
  const color = inv(r.product * 1.1)
  const layout = inv((r.security + r.batch + r.product) / 3 * 1.2)
  const pattern = inv((r.watermark * 0.6 + r.security * 0.4) * 1.2)
  const overall = logo * 0.3 + typography * 0.2 + color * 0.1 + layout * 0.25 + pattern * 0.15
  const tamperedRegions = d.ranked.filter((x) => x.score >= 0.3).map((x) => x.region) as RegionKey[]
  return { logo, typography, color, layout, pattern, overall: clamp(overall), qrValid: r.qr < 0.35, watermarkValid: r.watermark < 0.35, certMatch: r.cert < 0.35, tamperedRegions }
}

export const RISK = (score: number): 'RED' | 'YELLOW' | 'GREEN' => (score >= 0.45 ? 'RED' : score >= 0.18 ? 'YELLOW' : 'GREEN')
export const regionConfidence = (score: number) => Math.round(Math.min(99, 52 + score * 48))
