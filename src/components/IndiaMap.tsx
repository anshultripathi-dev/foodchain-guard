import { useMemo } from 'react'
import { CITIES, INDIA_OUTLINE, makeProjector } from '../utils/geo'
import { TONE_HEX, type Tone } from './ui'

export interface MapMarker { city: string; label?: string; tone?: Tone; r?: number; pulse?: boolean; sub?: string }
export interface MapRoute { from: string; to: string; tone?: Tone; dashed?: boolean; animated?: boolean; label?: string }

export function IndiaMap({
  markers, routes = [], height = 360, zoom, onMarker, className,
}: {
  markers: MapMarker[]
  routes?: MapRoute[]
  height?: number
  /** crop to western India for supply-chain level maps */
  zoom?: 'west' | 'all'
  onMarker?: (city: string) => void
  className?: string
}) {
  const W = 640, H = 640
  const west = zoom === 'west'
  const proj = useMemo(() => {
    const base = makeProjector(W, H)
    if (!west) return base
    // zoom: scale around Pune
    const [cx, cy] = base(18.9, 74.5)
    const k = 2.7
    return (lat: number, lng: number): [number, number] => {
      const [x, y] = base(lat, lng)
      return [W / 2 + (x - cx) * k, H / 2 + (y - cy) * k]
    }
  }, [west])
  const outline = INDIA_OUTLINE.map(([lng, lat], i) => `${i ? 'L' : 'M'}${proj(lat, lng).map((n) => n.toFixed(1)).join(',')}`).join(' ') + 'Z'
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} style={{ width: '100%', height }} preserveAspectRatio="xMidYMid meet">
      <defs>
        <pattern id="mapgrid" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="rgba(148,163,184,.07)" /></pattern>
        <linearGradient id="landg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#12203a" /><stop offset="1" stopColor="#0b1527" /></linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#mapgrid)" />
      <path d={outline} fill="url(#landg)" stroke="rgba(34,211,238,.35)" strokeWidth="1.4" />
      {routes.map((r, i) => {
        const a = CITIES[r.from], b = CITIES[r.to]
        if (!a || !b || r.from === r.to) return null
        const [x1, y1] = proj(a.lat, a.lng), [x2, y2] = proj(b.lat, b.lng)
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.18
        const col = TONE_HEX[r.tone ?? 'info']
        return (
          <g key={i}>
            <path d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} fill="none" stroke={col} strokeWidth={2} strokeOpacity={0.85} className={r.animated !== false ? 'anim-flow' : undefined} strokeDasharray={r.dashed ? '5 5' : undefined} />
            {r.label && <text x={mx} y={my - 6} fill={col} fontSize="11" textAnchor="middle" fontWeight={600}>{r.label}</text>}
          </g>
        )
      })}
      {markers.map((m, i) => {
        const c = CITIES[m.city]
        if (!c) return null
        const [x, y] = proj(c.lat, c.lng)
        const col = TONE_HEX[m.tone ?? 'info']
        const r = m.r ?? 6
        return (
          <g key={i} style={{ cursor: onMarker ? 'pointer' : 'default' }} onClick={() => onMarker?.(m.city)}>
            {m.pulse && <circle cx={x} cy={y} r={r} fill={col} opacity={0.4}><animate attributeName="r" from={r} to={r * 3.2} dur="1.8s" repeatCount="indefinite" /><animate attributeName="opacity" from="0.5" to="0" dur="1.8s" repeatCount="indefinite" /></circle>}
            <circle cx={x} cy={y} r={r} fill={col} stroke="#050914" strokeWidth={2} />
            <text x={x + r + 5} y={y + 4} fill="#cbd5e1" fontSize="12" fontWeight={600} style={{ paintOrder: 'stroke' }} stroke="#050914" strokeWidth="3">{m.label ?? m.city}</text>
            {m.sub && <text x={x + r + 5} y={y + 17} fill="#7e8fb0" fontSize="10" style={{ paintOrder: 'stroke' }} stroke="#050914" strokeWidth="3">{m.sub}</text>}
          </g>
        )
      })}
    </svg>
  )
}
