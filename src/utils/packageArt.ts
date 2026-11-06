import type { Batch, PackageMods } from '../models/types'
import { REGIONS, type RegionKey, watermarkBits } from '../services/packaging'
import { hashSeed, mulberry32 } from './prng'
import { fmtDate } from './format'

export const PKG_W = 360
export const PKG_H = 540

/** Deterministic pseudo-QR matrix (25x25) with real finder patterns. */
export function qrMatrix(seed: string, distort = false, n = 25): boolean[][] {
  const r = mulberry32(hashSeed('qr' + seed))
  const m: boolean[][] = Array.from({ length: n }, () => Array.from({ length: n }, () => r() > 0.52))
  const finder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
      const edge = x === 0 || y === 0 || x === 6 || y === 6
      const core = x >= 2 && x <= 4 && y >= 2 && y <= 4
      m[oy + y][ox + x] = edge || core
    }
    for (let i = 0; i < 8; i++) {
      if (oy + 7 < n && ox + i < n) m[oy + 7][Math.min(n - 1, ox + i)] = false
      if (ox + 7 < n && oy + i < n) m[Math.min(n - 1, oy + i)][ox + 7] = false
    }
  }
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7)
  if (distort) {
    const rr = mulberry32(hashSeed('distort' + seed))
    for (let y = 8; y < n - 2; y++) {
      const shift = Math.floor(rr() * 4)
      if (y % 3 === 0) m[y] = [...m[y].slice(shift), ...m[y].slice(0, shift)]
    }
    for (let i = 0; i < 40; i++) { const x = Math.floor(rr() * n), y = Math.floor(rr() * n); if (x > 8 || y > 8) m[y][x] = !m[y][x] }
    for (let y = 0; y < 7; y++) for (let x = n - 7; x < n; x++) if (x === n - 4 && y === 3) m[y][x] = false // damaged finder core
  }
  return m
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export interface Rect { x: number; y: number; w: number; h: number }
export function regionRect(key: RegionKey, w = PKG_W, h = PKG_H): Rect {
  const g = REGIONS[key]
  return { x: g.x * w, y: g.y * h, w: g.w * w, h: g.h * h }
}

export interface DrawOpts {
  mods?: Partial<PackageMods>
  qrId: string
  watermarkId: string
  highlights?: Array<{ region: RegionKey; color: string }>
  revealWatermark?: boolean
}

export function drawPackageFront(ctx: CanvasRenderingContext2D, b: Pick<Batch, 'product' | 'emoji' | 'brand' | 'batchId' | 'expiryDate' | 'certification'>, o: DrawOpts, w = PKG_W, h = PKG_H) {
  const m = o.mods ?? {}
  ctx.save()
  ctx.clearRect(0, 0, w, h)
  // body
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  if (m.color) { bg.addColorStop(0, '#ede9fe'); bg.addColorStop(1, '#c4b5fd') } else { bg.addColorStop(0, '#fffbeb'); bg.addColorStop(1, '#fde68a') }
  ctx.fillStyle = bg
  rr(ctx, 0, 0, w, h, 22); ctx.fill()
  // structure: border treatment
  ctx.lineWidth = m.structure ? 3 : 6
  ctx.strokeStyle = m.structure ? '#64748b' : '#15803d'
  rr(ctx, 8, 8, w - 16, h - 16, 18); ctx.stroke()
  ctx.fillStyle = m.structure ? 'rgba(100,116,139,.12)' : 'rgba(21,128,61,.07)'
  ctx.fillRect(w * 0.04, h * 0.5, w * 0.92, 2)

  // ---- logo
  {
    const r = regionRect('logo', w, h)
    ctx.save()
    if (m.logo) {
      ctx.fillStyle = '#1d4ed8'; ctx.fillRect(r.x, r.y + 4, r.h - 8, r.h - 8) // square instead of leaf
      ctx.fillStyle = '#fff'; ctx.font = `800 ${r.h * 0.34}px Inter, sans-serif`; ctx.textBaseline = 'middle'
      ctx.fillText('GREEN', r.x + r.h - 2, r.y + r.h * 0.32)
      ctx.fillText('VALLY', r.x + r.h - 2, r.y + r.h * 0.7)
      ctx.fillStyle = '#1d4ed8'; ctx.fillText('GREEN', r.x + r.h - 2, r.y + r.h * 0.32)
    } else {
      ctx.fillStyle = '#15803d'
      ctx.beginPath(); ctx.ellipse(r.x + r.h / 2, r.y + r.h / 2, r.h * 0.42, r.h * 0.42, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#bbf7d0'
      ctx.beginPath(); ctx.moveTo(r.x + r.h * 0.28, r.y + r.h * 0.65); ctx.quadraticCurveTo(r.x + r.h * 0.3, r.y + r.h * 0.25, r.x + r.h * 0.72, r.y + r.h * 0.3); ctx.quadraticCurveTo(r.x + r.h * 0.7, r.y + r.h * 0.7, r.x + r.h * 0.28, r.y + r.h * 0.65); ctx.fill()
      ctx.fillStyle = '#14532d'; ctx.font = `800 ${r.h * 0.3}px Inter, sans-serif`; ctx.textBaseline = 'middle'
      ctx.fillText(b.brand.toUpperCase().split(' ')[0], r.x + r.h + 4, r.y + r.h * 0.34)
      ctx.fillStyle = '#65a30d'; ctx.font = `600 ${r.h * 0.2}px Inter, sans-serif`
      ctx.fillText('FARM FRESH · EST. 2011', r.x + r.h + 4, r.y + r.h * 0.76)
    }
    ctx.restore()
  }
  // ---- certification
  {
    const r = regionRect('cert', w, h)
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = Math.min(r.w, r.h) / 2 - 2
    ctx.save()
    ctx.fillStyle = m.cert ? '#fef2f2' : '#f0fdf4'; ctx.strokeStyle = m.cert ? '#b91c1c' : '#16a34a'; ctx.lineWidth = 3
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.arc(cx, cy, rad - 5, 0, Math.PI * 2); ctx.lineWidth = 1; ctx.stroke()
    ctx.fillStyle = m.cert ? '#b91c1c' : '#15803d'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = `800 ${rad * 0.38}px Inter, sans-serif`
    ctx.fillText(m.cert ? 'ORGANlC' : b.certification.slice(0, 8).toUpperCase(), cx, cy - 3)
    ctx.font = `700 ${rad * 0.24}px Inter, sans-serif`
    ctx.fillText(m.cert ? '✕ UNVERIFIED' : '✓ CERTIFIED', cx, cy + rad * 0.42)
    ctx.restore()
  }
  // ---- product art
  {
    const r = regionRect('product', w, h)
    ctx.save()
    const g = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, 10, r.x + r.w / 2, r.y + r.h / 2, r.w / 1.6)
    if (m.color) { g.addColorStop(0, '#a5b4fc'); g.addColorStop(1, '#6366f1') } else { g.addColorStop(0, '#fed7aa'); g.addColorStop(1, '#fb923c') }
    ctx.fillStyle = g; rr(ctx, r.x, r.y, r.w, r.h, 16); ctx.fill()
    ctx.font = `${r.h * 0.62}px "Apple Color Emoji","Segoe UI Emoji",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(b.emoji, r.x + r.w / 2, r.y + r.h * 0.46)
    ctx.fillStyle = m.color ? '#312e81' : '#7c2d12'; ctx.font = `700 ${r.h * 0.12}px Inter, sans-serif`
    ctx.fillText(b.product.toUpperCase().slice(0, 28), r.x + r.w / 2, r.y + r.h * 0.9)
    ctx.restore()
  }
  // ---- batch
  {
    const r = regionRect('batch', w, h)
    ctx.save(); ctx.fillStyle = '#292524'
    ctx.font = `600 ${m.structure ? r.h * 0.46 : r.h * 0.36}px "JetBrains Mono", monospace`; ctx.textBaseline = 'middle'
    ctx.fillText(`BATCH ${b.batchId}`, r.x + (m.structure ? 6 : 0), r.y + r.h * (m.structure ? 0.35 : 0.3))
    ctx.fillStyle = '#78716c'; ctx.font = `500 ${r.h * 0.26}px Inter, sans-serif`
    ctx.fillText('Net wt. 500 g · Packed in India', r.x, r.y + r.h * 0.76)
    ctx.restore()
  }
  // ---- expiry
  {
    const r = regionRect('expiry', w, h)
    ctx.save(); ctx.textBaseline = 'middle'
    if (m.expiry) {
      ctx.fillStyle = '#fee2e2'; ctx.fillRect(r.x - 3, r.y, r.w + 6, r.h)
      ctx.fillStyle = '#b91c1c'; ctx.font = `700 ${r.h * 0.42}px Arial, sans-serif`
      ctx.fillText('BEST BEFORE 30 NOV 2026', r.x, r.y + r.h * 0.5)
    } else {
      ctx.fillStyle = '#14532d'; ctx.font = `700 ${r.h * 0.4}px "JetBrains Mono", monospace`
      ctx.fillText(`EXP ${fmtDate(b.expiryDate).toUpperCase()}`, r.x, r.y + r.h * 0.34)
      ctx.fillStyle = '#78716c'; ctx.font = `500 ${r.h * 0.26}px Inter, sans-serif`
      ctx.fillText('Store at 2–8 °C', r.x, r.y + r.h * 0.78)
    }
    ctx.restore()
  }
  // ---- QR
  {
    const r = regionRect('qr', w, h)
    ctx.save(); ctx.fillStyle = '#fff'; rr(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 6); ctx.fill()
    const mat = qrMatrix(o.qrId, !!m.qr)
    const cell = Math.min(r.w, r.h) / mat.length
    const ox = r.x + (r.w - cell * mat.length) / 2, oy = r.y + (r.h - cell * mat.length) / 2
    ctx.fillStyle = m.qr ? '#1f2937' : '#0b1220'
    mat.forEach((row, y) => row.forEach((v, x) => { if (v) ctx.fillRect(ox + x * cell, oy + y * cell, cell + 0.3, cell + 0.3) }))
    ctx.restore()
  }
  // ---- security marking
  {
    const r = regionRect('security', w, h)
    ctx.save(); ctx.strokeStyle = m.structure ? '#94a3b8' : '#0f766e'; ctx.lineWidth = 1
    const lines = m.structure ? 2 : 6
    for (let i = 0; i < lines; i++) {
      ctx.beginPath()
      for (let x = 0; x <= r.w; x += 2) {
        const y = r.y + r.h * 0.5 + Math.sin(x / 9 + i * 0.9) * (r.h * (m.structure ? 0.12 : 0.34)) * Math.cos(x / (30 + i * 3))
        x === 0 ? ctx.moveTo(r.x + x, y) : ctx.lineTo(r.x + x, y)
      }
      ctx.stroke()
    }
    ctx.fillStyle = '#0f766e'; ctx.font = `700 ${r.h * 0.2}px "JetBrains Mono", monospace`
    ctx.fillText(m.structure ? 'FCG FCG' : 'FCG•FCG•FCG•FCG', r.x, r.y + r.h * 0.95)
    ctx.restore()
  }
  // ---- watermark zone
  {
    const r = regionRect('watermark', w, h)
    ctx.save()
    const bits = watermarkBits(o.watermarkId)
    const cols = 16, rows = 8
    const cw = r.w / cols, ch = r.h / rows
    ctx.fillStyle = 'rgba(21,128,61,0.10)'; ctx.fillRect(r.x, r.y, r.w, r.h)
    const visible = !m.watermark
    bits.forEach((bit, i) => {
      const x = r.x + (i % cols) * cw, y = r.y + Math.floor(i / cols) * ch
      let on = bit === 1
      if (!visible) {
        const row = Math.floor(i / cols), col = i % cols
        if (row >= 2 && row <= 6 && col >= 8 && col <= 14) on = false
      }
      ctx.fillStyle = on ? (o.revealWatermark ? 'rgba(13,148,136,.95)' : 'rgba(21,128,61,.28)') : o.revealWatermark ? 'rgba(15,23,42,.12)' : 'rgba(21,128,61,.05)'
      ctx.fillRect(x + 0.5, y + 0.5, cw - 1, ch - 1)
    })
    ctx.restore()
  }
  // ---- highlights
  o.highlights?.forEach(({ region, color }) => {
    const r = regionRect(region, w, h)
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.setLineDash([8, 5])
    ctx.fillStyle = color + '22'
    rr(ctx, r.x - 4, r.y - 4, r.w + 8, r.h + 8, 8); ctx.fill(); ctx.stroke(); ctx.restore()
  })
  ctx.restore()
}

export function drawPackageBack(ctx: CanvasRenderingContext2D, b: Pick<Batch, 'product' | 'batchId' | 'farm' | 'origin'>, w = PKG_W, h = PKG_H) {
  ctx.clearRect(0, 0, w, h)
  const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#fffbeb'); bg.addColorStop(1, '#fde68a')
  ctx.fillStyle = bg; rr(ctx, 0, 0, w, h, 22); ctx.fill()
  ctx.strokeStyle = '#15803d'; ctx.lineWidth = 6; rr(ctx, 8, 8, w - 16, h - 16, 18); ctx.stroke()
  ctx.fillStyle = '#14532d'; ctx.font = '800 20px Inter, sans-serif'; ctx.fillText('NUTRITION FACTS', 28, 56)
  ctx.font = '500 12px Inter, sans-serif'; ctx.fillStyle = '#44403c'
  ;['Energy 60 kcal', 'Carbohydrate 15 g', 'Sugars 13.7 g', 'Fibre 1.6 g', 'Protein 0.8 g', 'Fat 0.4 g', 'Vitamin C 36 mg'].forEach((t, i) => {
    ctx.fillText(t, 28, 88 + i * 24)
    ctx.fillStyle = 'rgba(21,128,61,.2)'; ctx.fillRect(28, 94 + i * 24, w - 56, 1); ctx.fillStyle = '#44403c'
  })
  ctx.fillStyle = '#292524'; ctx.font = '600 12px "JetBrains Mono", monospace'
  ctx.fillText(`Grown at ${b.farm}`, 28, 300); ctx.fillText(b.origin, 28, 320); ctx.fillText(b.batchId, 28, 340)
  // barcode
  const r = mulberry32(hashSeed(b.batchId))
  ctx.fillStyle = '#0b1220'
  for (let x = 28; x < w - 120; x += 3) if (r() > 0.4) ctx.fillRect(x, 380, 1 + Math.floor(r() * 2), 70)
  // hologram
  const g = ctx.createLinearGradient(w - 110, 360, w - 30, 440)
  g.addColorStop(0, '#22d3ee'); g.addColorStop(0.5, '#a78bfa'); g.addColorStop(1, '#34d399')
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(w - 70, 400, 38, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = '800 14px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('FCG', w - 70, 398); ctx.font = '700 9px Inter, sans-serif'; ctx.fillText('SECURE', w - 70, 412); ctx.textAlign = 'left'
  ctx.fillStyle = '#78716c'; ctx.font = '500 10px Inter, sans-serif'
  ctx.fillText('Verify authenticity: scan the QR on the front. FoodChain Guard — Trust Every Bite.', 28, h - 34, w - 56)
}

// ------------------------------------------------------------------ diff / heatmap
export interface DiffResult {
  diff: HTMLCanvasElement
  heat: HTMLCanvasElement
  regionScores: Record<RegionKey, number>
  ranked: Array<{ region: RegionKey; score: number }>
  flagged: Array<{ region: RegionKey; score: number }>
}

export function newCanvas(w = PKG_W, h = PKG_H): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  return c
}

export function computeDiff(a: HTMLCanvasElement, b: HTMLCanvasElement): DiffResult {
  const w = a.width, h = a.height
  const A = a.getContext('2d')!.getImageData(0, 0, w, h).data
  const B = b.getContext('2d')!.getImageData(0, 0, w, h).data
  const d = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    const k = i * 4
    const df = (Math.abs(A[k] - B[k]) + Math.abs(A[k + 1] - B[k + 1]) + Math.abs(A[k + 2] - B[k + 2])) / (3 * 255)
    d[i] = df
  }
  // box-blur twice for a smooth heat field
  const blur = (src: Float32Array, rad: number) => {
    const out = new Float32Array(src.length), tmp = new Float32Array(src.length)
    for (let y = 0; y < h; y++) {
      let acc = 0
      for (let x = -rad; x <= rad; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))]
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = acc / (2 * rad + 1)
        acc += src[y * w + Math.min(w - 1, x + rad + 1)] - src[y * w + Math.max(0, x - rad)]
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0
      for (let y = -rad; y <= rad; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc / (2 * rad + 1)
        acc += tmp[Math.min(h - 1, y + rad + 1) * w + x] - tmp[Math.max(0, y - rad) * w + x]
      }
    }
    return out
  }
  const field = blur(blur(d, 7), 7)
  const diff = newCanvas(w, h), heat = newCanvas(w, h)
  const dctx = diff.getContext('2d')!, hctx = heat.getContext('2d')!
  const di = dctx.createImageData(w, h), hi = hctx.createImageData(w, h)
  for (let i = 0; i < w * h; i++) {
    const v = Math.min(1, d[i] * 3.2)
    di.data[i * 4] = v * 255; di.data[i * 4 + 1] = v * 255; di.data[i * 4 + 2] = v * 255; di.data[i * 4 + 3] = 255
    const f = Math.min(1, field[i] * 6.5)
    let r = 0, g = 0, bl = 0, al = 0
    if (f > 0.08) {
      if (f < 0.35) { r = 250; g = 204; bl = 21; al = (f - 0.08) * 2.6 } else { const t = Math.min(1, (f - 0.35) / 0.4); r = 250 - 10 * t; g = 204 - 140 * t; bl = 21 + 30 * t; al = 0.7 + 0.2 * t }
    } else { r = 52; g = 211; bl = 153; al = 0.07 }
    hi.data[i * 4] = r; hi.data[i * 4 + 1] = g; hi.data[i * 4 + 2] = bl; hi.data[i * 4 + 3] = Math.min(1, al) * 255
  }
  dctx.putImageData(di, 0, 0); hctx.putImageData(hi, 0, 0)

  const regionScores = {} as Record<RegionKey, number>
  ;(Object.keys(REGIONS) as RegionKey[]).forEach((k) => {
    const r = regionRect(k, w, h)
    let s = 0, n = 0
    for (let y = Math.floor(r.y); y < Math.ceil(r.y + r.h); y += 2) for (let x = Math.floor(r.x); x < Math.ceil(r.x + r.w); x += 2) { s += d[y * w + x]; n++ }
    regionScores[k] = Math.min(1, (s / Math.max(1, n)) * 5.5)
  })
  const ranked = (Object.keys(regionScores) as RegionKey[]).map((region) => ({ region, score: regionScores[region] })).sort((x, y) => y.score - x.score)
  return { diff, heat, regionScores, ranked, flagged: ranked.filter((x) => x.score > 0.3) }
}
