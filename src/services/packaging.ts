import type { PackageMods, Pkg } from '../models/types'
import { sha256 } from '../utils/sha256'
import { hashSeed, mulberry32 } from '../utils/prng'
import { clamp } from '../utils/format'

/** Fractional layout of the package face (x, y, w, h in 0..1). Shared by drawing, 3D overlays and the heatmap. */
export const REGIONS = {
  logo:      { x: 0.08, y: 0.06, w: 0.5,  h: 0.17, label: 'Logo' },
  product:   { x: 0.08, y: 0.26, w: 0.84, h: 0.27, label: 'Product art' },
  cert:      { x: 0.66, y: 0.06, w: 0.26, h: 0.17, label: 'Certification' },
  batch:     { x: 0.08, y: 0.56, w: 0.5,  h: 0.1,  label: 'Batch ID' },
  expiry:    { x: 0.08, y: 0.68, w: 0.5,  h: 0.1,  label: 'Expiry label' },
  qr:        { x: 0.64, y: 0.55, w: 0.28, h: 0.23, label: 'QR code' },
  security:  { x: 0.08, y: 0.82, w: 0.52, h: 0.1,  label: 'Security marking' },
  watermark: { x: 0.64, y: 0.82, w: 0.28, h: 0.12, label: 'Watermark zone' },
} as const
export type RegionKey = keyof typeof REGIONS

/** Which mods touch which regions. */
export const MOD_REGIONS: Record<keyof PackageMods, RegionKey[]> = {
  logo: ['logo'],
  expiry: ['expiry'],
  cert: ['cert'],
  qr: ['qr'],
  color: ['product'],
  structure: ['security', 'batch'],
  watermark: ['watermark'],
}

export interface PackagingScores {
  logo: number
  typography: number
  color: number
  layout: number
  pattern: number
  overall: number
  qrValid: boolean
  watermarkValid: boolean
  certMatch: boolean
  tamperedRegions: RegionKey[]
}

export const anyMods = (m: PackageMods) => Object.values(m).some(Boolean)

export function packagingScores(mods: PackageMods, seed = 'x'): PackagingScores {
  const rnd = mulberry32(hashSeed(seed))
  const jit = () => (rnd() - 0.5) * 1.2
  let logo = 98 + jit(), typography = 96 + jit(), color = 91 + jit(), layout = 94 + jit(), pattern = 88 + jit()
  if (mods.logo) { logo = 41 + jit() * 3; typography -= 12 }
  if (mods.expiry) { typography = Math.min(typography, 38 + jit() * 3); layout = Math.min(layout, 80); pattern = Math.min(pattern, 82) }
  if (mods.color) { color = 35 + jit() * 3 }
  if (mods.structure) { layout = 49 + jit() * 3; pattern = Math.min(pattern, 52) }
  if (mods.watermark) { pattern = Math.min(pattern, 46) }
  if (mods.cert) { layout -= 6; pattern -= 8 }
  if (mods.qr) { pattern -= 6 }
  const overall = logo * 0.3 + typography * 0.2 + color * 0.1 + layout * 0.25 + pattern * 0.15
  const tamperedRegions = (Object.keys(mods) as Array<keyof PackageMods>)
    .filter((k) => mods[k])
    .flatMap((k) => MOD_REGIONS[k])
  return {
    logo: clamp(logo), typography: clamp(typography), color: clamp(color), layout: clamp(layout), pattern: clamp(pattern),
    overall: clamp(overall),
    qrValid: !mods.qr, watermarkValid: !mods.watermark, certMatch: !mods.cert,
    tamperedRegions,
  }
}

export type PkgClass = 'AUTHENTIC' | 'SUSPICIOUS' | 'COUNTERFEIT'

const sig = (x: number) => 1 / (1 + Math.exp(-x))

export interface Classification {
  label: PkgClass
  probs: { AUTHENTIC: number; SUSPICIOUS: number; COUNTERFEIT: number }
  confidence: number
}

/** Simulated CNN head: maps component similarity to calibrated class probabilities. */
export function classify(scores: PackagingScores): Classification {
  const s = scores.overall
  let a = sig((s - 78) / 4.5)
  let c = sig((52 - s) / 6) + 0.004
  if (!scores.watermarkValid) a *= 0.35
  if (!scores.qrValid) a *= 0.7
  let sus = Math.max(0.004, 1 - a - c)
  const tot = a + c + sus
  a /= tot; c /= tot; sus /= tot
  const label: PkgClass = a >= sus && a >= c ? 'AUTHENTIC' : c >= sus ? 'COUNTERFEIT' : 'SUSPICIOUS'
  const probs = { AUTHENTIC: a * 100, SUSPICIOUS: sus * 100, COUNTERFEIT: c * 100 }
  return { label, probs, confidence: probs[label] }
}

export function pkgClassOf(p: Pkg): PkgClass {
  return classify(packagingScores(p.mods, p.packageId)).label
}

// ---------------------------------------------------------------- fingerprint
export interface FingerprintComponents {
  logoGeometry: number[]      // polygon radii
  typography: string[]        // font metrics summary
  palette: string[]           // hex colours
  layoutGrid: number[]        // 4x6 occupancy
  microPattern: number[]      // 8x8 bits
  securityMarkers: string[]
}

export function fingerprintComponents(seed: string, mods?: Partial<PackageMods>): FingerprintComponents {
  const r = mulberry32(hashSeed('fp' + seed))
  const logoGeometry = Array.from({ length: 10 }, () => 0.5 + r() * 0.5)
  if (mods?.logo) logoGeometry.forEach((_, i) => { logoGeometry[i] = 0.35 + ((i * 37) % 10) / 14 })
  const basePalette = ['#f59e0b', '#16a34a', '#0f172a', '#fef3c7', '#dc2626']
  const palette = mods?.color ? ['#7c3aed', '#0ea5e9', '#111827', '#e5e7eb', '#f97316'] : basePalette
  const layoutGrid = Array.from({ length: 24 }, (_, i) => (r() > 0.45 || [0, 1, 5, 18, 19, 23].includes(i) ? 1 : 0))
  if (mods?.structure) layoutGrid.forEach((v, i) => { if (i % 5 === 0) layoutGrid[i] = v ? 0 : 1 })
  const microPattern = Array.from({ length: 64 }, () => (r() > 0.5 ? 1 : 0))
  if (mods?.watermark) for (let i = 40; i < 56; i++) microPattern[i] = microPattern[i] ? 0 : 1
  return {
    logoGeometry,
    typography: mods?.expiry
      ? ['Sans-serif / 11.4pt / kern −0.2', 'Mono / 7.8pt / kern 0.6', 'Date font drift: +9%']
      : ['Humanist sans / 12pt / kern 0.0', 'Mono / 8pt / kern 0.5', 'Date glyph metrics stable'],
    palette,
    layoutGrid,
    microPattern,
    securityMarkers: mods?.watermark ? ['Guilloche line (partial)', 'Void-pantograph MISSING'] : ['Guilloche line', 'Void-pantograph', 'Micro-text “FCG”'],
  }
}

/** 256-bit digest of all fingerprint features – the "full" packaging fingerprint. */
export function fingerprintDigest(c: FingerprintComponents): string {
  return sha256(JSON.stringify([c.logoGeometry.map((x) => x.toFixed(2)), c.typography, c.palette, c.layoutGrid, c.microPattern, c.securityMarkers]))
}

// ---------------------------------------------------------------- watermark
export function watermarkBits(wmId: string): number[] {
  const h = sha256('wmbits:' + wmId)
  const bits: number[] = []
  for (let i = 0; i < 32; i++) {
    const n = parseInt(h[i], 16)
    for (let b = 3; b >= 0; b--) bits.push((n >> b) & 1)
  }
  return bits // 128 bits laid out 16 x 8
}

export function extractWatermark(wmId: string, mods: PackageMods): { expected: number[]; extracted: number[]; errors: number[] } {
  const expected = watermarkBits(wmId)
  const extracted = expected.slice()
  const errors: number[] = []
  if (mods.watermark) {
    // contiguous damaged block (a reprinted region destroys the embedded signal)
    for (let i = 0; i < 128; i++) {
      const row = Math.floor(i / 16), col = i % 16
      if (row >= 2 && row <= 6 && col >= 8 && col <= 14 && (i * 7) % 5 !== 0) { extracted[i] = expected[i] ? 0 : 1; errors.push(i) }
    }
  } else if (mods.structure) {
    ;[18, 77].forEach((i) => { extracted[i] = expected[i] ? 0 : 1; errors.push(i) })
  }
  return { expected, extracted, errors }
}
