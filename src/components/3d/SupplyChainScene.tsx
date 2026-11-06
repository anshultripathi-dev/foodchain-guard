import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Grid, Html, Line, OrbitControls, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'

import { NODE_KEYS, type NodeKey, type NodeStatus } from './nodes'
export type { NodeKey, NodeStatus }
export { NODE_KEYS }

const POS: Record<NodeKey, [number, number, number]> = {
  farm: [-17, 0, 3],
  processing: [-9, 0, -5],
  distribution: [-0.5, 0, 3.5],
  warehouse: [8, 0, -5],
  retail: [16.5, 0, 3],
  consumer: [24, 0, -4],
}
const STATUS_HEX: Record<NodeStatus, string> = { ok: '#34d399', warn: '#fbbf24', bad: '#f87171', idle: '#475569' }

export interface SceneProps {
  names: Record<NodeKey, string>
  statuses: Record<NodeKey, NodeStatus>
  /** number of stages reached by the selected batch (0 = none selected) */
  reached: number
  selected: NodeKey | null
  onSelect?: (k: NodeKey | null) => void
  follow?: { id: number; upTo: number } | null
  onArrive?: (index: number) => void
  onFollowDone?: () => void
  ambient?: boolean
  showLabels?: boolean
  height?: number | string
}

const V = (a: [number, number, number], dy = 0) => new THREE.Vector3(a[0], a[1] + dy, a[2])

function segCurve(i: number) {
  const a = V(POS[NODE_KEYS[i]], 0.6)
  const b = V(POS[NODE_KEYS[i + 1]], 0.6)
  const mid = a.clone().lerp(b, 0.5)
  mid.y += 3.2
  return new THREE.QuadraticBezierCurve3(a, mid, b)
}

// ---------------------------------------------------------------- primitives
function Box({ p = [0, 0, 0], s = [1, 1, 1], c = '#334155', e, o, r }: { p?: [number, number, number]; s?: [number, number, number]; c?: string; e?: string; o?: number; r?: [number, number, number] }) {
  return (
    <mesh position={p} rotation={r} castShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} emissive={e ?? '#000'} emissiveIntensity={e ? 0.6 : 0} transparent={o !== undefined} opacity={o ?? 1} roughness={0.7} metalness={0.1} />
    </mesh>
  )
}
function Cyl({ p, r = 0.4, h = 1, c = '#64748b', seg = 16, e }: { p: [number, number, number]; r?: number; h?: number; c?: string; seg?: number; e?: string }) {
  return (
    <mesh position={p} castShadow>
      <cylinderGeometry args={[r, r, h, seg]} />
      <meshStandardMaterial color={c} roughness={0.6} metalness={0.25} emissive={e ?? '#000'} emissiveIntensity={e ? 0.5 : 0} />
    </mesh>
  )
}
function Roof({ p, w, d, h, c }: { p: [number, number, number]; w: number; d: number; h: number; c: string }) {
  return (
    <mesh position={p} rotation={[0, Math.PI / 4, 0]} scale={[w / 1.414, 1, d / 1.414]} castShadow>
      <coneGeometry args={[1, h, 4]} />
      <meshStandardMaterial color={c} roughness={0.8} />
    </mesh>
  )
}

function Moving({ from, to, speed = 0.4, offset = 0, children }: { from: [number, number, number]; to: [number, number, number]; speed?: number; offset?: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const u = (((clock.elapsedTime * speed + offset) % 1) + 1) % 1
    ref.current.position.set(from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, from[2] + (to[2] - from[2]) * u)
  })
  return <group ref={ref}>{children}</group>
}

// ---------------------------------------------------------------- facilities
function Farm() {
  const rows = useMemo(() => {
    const out: Array<[number, number]> = []
    for (let r = 0; r < 5; r++) for (let c = 0; c < 7; c++) out.push([-2.8 + c * 0.55, 0.5 + r * 0.55])
    return out
  }, [])
  return (
    <group>
      <Cyl p={[0, 0.08, 0]} r={4.4} h={0.16} c="#14532d" seg={48} />
      <mesh position={[0.2, 0.17, 1.6]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[4.4, 3]} /><meshStandardMaterial color="#365314" /></mesh>
      {rows.map(([x, z], i) => (
        <mesh key={i} position={[x - 0.4, 0.38, z + 0.7]} castShadow>
          <coneGeometry args={[0.16, 0.46, 6]} /><meshStandardMaterial color={i % 3 === 0 ? '#4ade80' : '#22c55e'} />
        </mesh>
      ))}
      {/* barn */}
      <Box p={[-2, 0.8, -1.8]} s={[2, 1.3, 1.5]} c="#9a3412" />
      <Roof p={[-2, 1.85, -1.8]} w={2.2} d={1.7} h={0.9} c="#7c2d12" />
      {/* silo */}
      <Cyl p={[0.2, 1.1, -2.2]} r={0.5} h={2} c="#cbd5e1" />
      <mesh position={[0.2, 2.1, -2.2]}><sphereGeometry args={[0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#94a3b8" /></mesh>
      {/* harvest crates */}
      {[0, 1, 2].map((i) => (
        <group key={i} position={[2.4 + i * 0.5, 0.3, -1.4 + (i % 2) * 0.5]}>
          <Box s={[0.42, 0.28, 0.42]} c="#b45309" />
          <mesh position={[0, 0.22, 0]}><sphereGeometry args={[0.18, 10, 8]} /><meshStandardMaterial color="#f59e0b" emissive="#b45309" emissiveIntensity={0.3} /></mesh>
        </group>
      ))}
      {/* mango trees */}
      {[[-3.4, 1.8], [-3.6, 0.2], [3.3, 1.9], [3.5, 0.3]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <Cyl p={[0, 0.5, 0]} r={0.09} h={1} c="#78350f" />
          <mesh position={[0, 1.25, 0]} castShadow><sphereGeometry args={[0.62, 12, 10]} /><meshStandardMaterial color="#15803d" roughness={0.9} /></mesh>
        </group>
      ))}
    </group>
  )
}

function Factory() {
  const smoke = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    smoke.current?.children.forEach((c, i) => {
      const t = (clock.elapsedTime * 0.35 + i * 0.33) % 1
      c.position.set(0.1 * Math.sin(t * 6 + i), t * 2.2, 0)
      const s = 0.2 + t * 0.55
      c.scale.setScalar(s)
      ;((c as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.5 * (1 - t)
    })
  })
  return (
    <group>
      <Cyl p={[0, 0.08, 0]} r={4.2} h={0.16} c="#1e293b" seg={48} />
      <Box p={[-0.6, 1, -0.6]} s={[3.2, 1.8, 2.1]} c="#64748b" />
      {[-1.7, -0.65, 0.4].map((x, i) => (
        <Box key={i} p={[x, 2.05, -0.6]} s={[0.95, 0.5, 2.1]} c="#475569" r={[0, 0, -0.18]} />
      ))}
      <Box p={[-0.6, 0.65, 0.5]} s={[1.2, 1, 0.08]} c="#0f172a" e="#22d3ee" />
      <Cyl p={[0.6, 2.4, -1.2]} r={0.2} h={2.4} c="#334155" />
      <Cyl p={[1.0, 2.1, -1.2]} r={0.16} h={1.8} c="#334155" />
      <group ref={smoke} position={[0.6, 3.6, -1.2]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i}><sphereGeometry args={[1, 10, 8]} /><meshStandardMaterial color="#cbd5e1" transparent opacity={0.4} depthWrite={false} /></mesh>
        ))}
      </group>
      {/* conveyor */}
      <Box p={[1.5, 0.35, 1.5]} s={[3.2, 0.14, 0.5]} c="#0f172a" />
      <Moving from={[0, 0.55, 1.5]} to={[3.0, 0.55, 1.5]} speed={0.22}>
        <Box s={[0.34, 0.3, 0.34]} c="#f59e0b" />
      </Moving>
      <Moving from={[0, 0.55, 1.5]} to={[3.0, 0.55, 1.5]} speed={0.22} offset={0.5}>
        <Box s={[0.34, 0.3, 0.34]} c="#fbbf24" />
      </Moving>
      {/* tanks */}
      {[-2.9, -2.3, 2.7].map((x, i) => (
        <Cyl key={i} p={[x, 0.7, i === 2 ? -1.9 : 1.6]} r={0.4} h={1.3} c="#94a3b8" />
      ))}
    </group>
  )
}

function Hub() {
  return (
    <group>
      <Cyl p={[0, 0.08, 0]} r={4.2} h={0.16} c="#1e293b" seg={48} />
      <Box p={[0, 0.8, -1.4]} s={[5, 1.4, 1.8]} c="#475569" />
      <Box p={[0, 1.55, -1.4]} s={[5.2, 0.12, 2]} c="#1e293b" />
      {[-1.6, 0, 1.6].map((x, i) => (<Box key={i} p={[x, 0.55, -0.48]} s={[1.0, 0.95, 0.06]} c="#0b1220" e="#22d3ee" />))}
      {/* trucks */}
      {[-1.6, 0].map((x, i) => (
        <group key={i} position={[x, 0, 0.8]}>
          <Box p={[0, 0.5, 0]} s={[1.1, 0.7, 0.62]} c="#e2e8f0" />
          <Box p={[0.7, 0.4, 0]} s={[0.4, 0.5, 0.58]} c="#22d3ee" />
          {[-0.35, 0.35, 0.72].map((wx, k) => (<Cyl key={k} p={[wx, 0.14, 0.3]} r={0.14} h={0.1} c="#0b1220" />))}
        </group>
      ))}
      <Moving from={[-3.6, 0, 2.6]} to={[3.6, 0, 2.6]} speed={0.12}>
        <Box p={[0, 0.4, 0]} s={[0.9, 0.55, 0.5]} c="#e2e8f0" />
        <Box p={[0.55, 0.32, 0]} s={[0.3, 0.4, 0.46]} c="#fbbf24" />
      </Moving>
      {/* pallets */}
      {[1.7, 2.3].map((x, i) => (<Box key={i} p={[x, 0.2, 0.6]} s={[0.5, 0.35, 0.5]} c="#b45309" />))}
    </group>
  )
}

function Warehouse() {
  const fan = useRef<THREE.Mesh>(null)
  useFrame((_, d) => { if (fan.current) fan.current.rotation.z += d * 6 })
  const shelves = [-1.7, -0.6, 0.5]
  return (
    <group>
      <Cyl p={[0, 0.08, 0]} r={4.2} h={0.16} c="#1e293b" seg={48} />
      {/* shell – glass walls so the interior is visible */}
      <Box p={[0, 1.15, -0.2]} s={[5, 2, 3.2]} c="#38bdf8" o={0.08} />
      {[[-2.5, -1.8], [2.5, -1.8], [-2.5, 1.4], [2.5, 1.4]].map(([x, z], i) => (<Cyl key={i} p={[x, 1.1, z]} r={0.06} h={2.2} c="#94a3b8" />))}
      <Box p={[0, 2.25, -0.2]} s={[5.1, 0.1, 3.3]} c="#334155" />
      {/* shelves */}
      {shelves.map((x, i) => (
        <group key={i} position={[x, 0, -0.6]}>
          {[0.25, 0.85, 1.45].map((y, k) => (<Box key={k} p={[0, y, 0]} s={[0.9, 0.05, 1.8]} c="#94a3b8" />))}
          {[-0.4, 0.4].map((px, k) => (<Box key={k} p={[px, 0.85, 0]} s={[0.05, 1.3, 1.8]} c="#64748b" />))}
          {[0.4, 1.0, 1.6].map((y, k) => (
            <group key={k}>
              <Box p={[-0.2, y - 0.1, -0.5]} s={[0.35, 0.3, 0.35]} c={(i + k) % 2 ? '#f59e0b' : '#d97706'} />
              <Box p={[0.2, y - 0.1, 0.1]} s={[0.35, 0.3, 0.35]} c={(i + k) % 3 ? '#fbbf24' : '#fb923c'} />
              <Box p={[-0.1, y - 0.1, 0.6]} s={[0.35, 0.3, 0.35]} c="#f59e0b" />
            </group>
          ))}
        </group>
      ))}
      {/* refrigerated section */}
      <Box p={[1.85, 0.8, 0.2]} s={[1.3, 1.5, 2]} c="#7dd3fc" o={0.35} e="#0ea5e9" />
      <Box p={[1.85, 0.4, 0.2]} s={[1.0, 0.5, 1.4]} c="#bae6fd" />
      <mesh ref={fan} position={[1.85, 1.7, 1.22]}><torusGeometry args={[0.18, 0.04, 6, 4]} /><meshStandardMaterial color="#e0f2fe" emissive="#38bdf8" emissiveIntensity={0.8} /></mesh>
      <pointLight position={[1.85, 1.4, 0.2]} color="#38bdf8" intensity={5} distance={4} />
    </group>
  )
}

function Retail() {
  return (
    <group>
      <Cyl p={[0, 0.08, 0]} r={4.2} h={0.16} c="#1e293b" seg={48} />
      <Box p={[0, 1, -1]} s={[4.2, 1.8, 2.4]} c="#334155" />
      <Box p={[0, 1, 0.22]} s={[4.0, 1.6, 0.05]} c="#7dd3fc" o={0.22} />
      <Box p={[0, 1.95, 0.35]} s={[4.3, 0.3, 0.9]} c="#16a34a" />
      <Box p={[0, 2.35, 0.1]} s={[2.2, 0.28, 0.06]} c="#0b1220" e="#34d399" />
      {[-1.2, 0, 1.2].map((x, i) => (
        <group key={i} position={[x, 0, -0.5]}>
          <Box p={[0, 0.3, 0]} s={[0.9, 0.08, 0.5]} c="#94a3b8" />
          <Box p={[0, 0.75, 0]} s={[0.9, 0.08, 0.5]} c="#94a3b8" />
          <Box p={[0, 1.2, 0]} s={[0.9, 0.08, 0.5]} c="#94a3b8" />
          {[0.38, 0.83, 1.28].map((y, k) => [-0.28, 0, 0.28].map((px, m) => (<Box key={`${k}${m}`} p={[px, y, 0]} s={[0.2, 0.2, 0.2]} c={(k + m + i) % 2 ? '#f59e0b' : '#ef4444'} />)))}
        </group>
      ))}
      <Box p={[-2.6, 0.35, 1.4]} s={[0.7, 0.5, 0.7]} c="#f59e0b" />
    </group>
  )
}

function Consumer() {
  const pack = useRef<THREE.Group>(null)
  useFrame(({ clock }) => { if (pack.current) { pack.current.rotation.y = clock.elapsedTime * 0.8; pack.current.position.y = 2.6 + Math.sin(clock.elapsedTime * 1.6) * 0.12 } })
  return (
    <group>
      <Cyl p={[0, 0.08, 0]} r={3.4} h={0.16} c="#1e293b" seg={48} />
      <Box p={[0, 0.75, -0.6]} s={[2.2, 1.3, 1.8]} c="#475569" />
      <Roof p={[0, 1.95, -0.6]} w={2.6} d={2.2} h={1.1} c="#9a3412" />
      <Box p={[0, 0.5, 0.32]} s={[0.5, 0.9, 0.06]} c="#0b1220" e="#fbbf24" />
      <Box p={[-0.75, 0.9, 0.32]} s={[0.4, 0.4, 0.05]} c="#7dd3fc" o={0.5} e="#38bdf8" />
      <group ref={pack} position={[0, 2.6, 1.3]}>
        <Box s={[0.5, 0.65, 0.2]} c="#fde68a" e="#f59e0b" />
        <Box p={[0, 0.2, 0.11]} s={[0.3, 0.12, 0.01]} c="#16a34a" />
        <Box p={[0.12, -0.15, 0.11]} s={[0.16, 0.16, 0.01]} c="#0b1220" />
      </group>
    </group>
  )
}

const FACILITY: Record<NodeKey, () => JSX.Element> = { farm: Farm, processing: Factory, distribution: Hub, warehouse: Warehouse, retail: Retail, consumer: Consumer }

// ---------------------------------------------------------------- node wrapper
function NodeWrap({
  k, name, status, selected, dim, onSelect, showLabel,
}: { k: NodeKey; name: string; status: NodeStatus; selected: boolean; dim: boolean; onSelect?: (k: NodeKey) => void; showLabel: boolean }) {
  const ring = useRef<THREE.Mesh>(null)
  const beacon = useRef<THREE.Mesh>(null)
  const [hover, setHover] = useState(false)
  const Facility = FACILITY[k]
  const col = STATUS_HEX[status]
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (ring.current) {
      const s = 1 + Math.sin(t * 2.4 + POS[k][0]) * 0.025 + (selected ? 0.08 : 0) + (hover ? 0.05 : 0)
      ring.current.scale.set(s, s, s)
    }
    if (beacon.current) {
      beacon.current.rotation.y = t * 1.2
      beacon.current.position.y = 4.6 + Math.sin(t * 2 + POS[k][2]) * 0.14
    }
  })
  return (
    <group
      position={POS[k]}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect?.(k) }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = onSelect ? 'pointer' : 'auto' }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
    >
      <group scale={dim ? 0.98 : 1}><Facility /></group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
        <torusGeometry args={[k === 'consumer' ? 3.5 : 4.35, selected ? 0.1 : 0.055, 8, 72]} />
        <meshBasicMaterial color={col} transparent opacity={status === 'idle' ? 0.45 : 0.95} />
      </mesh>
      <mesh position={[0, 2.6, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 4, 6]} />
        <meshBasicMaterial color={col} transparent opacity={0.35} />
      </mesh>
      <mesh ref={beacon} position={[0, 4.6, 0]}>
        <octahedronGeometry args={[0.34]} />
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={1.4} />
      </mesh>
      {(selected || status === 'bad') && <pointLight position={[0, 3, 0]} color={col} intensity={selected ? 18 : 10} distance={9} />}
      {showLabel && (
        <Html position={[0, 5.5, 0]} center distanceFactor={15} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-[12px] font-semibold backdrop-blur ${selected ? 'border-brand/70 bg-ink-900/90 text-white' : 'border-white/10 bg-ink-900/70 text-slate-200'}`}>
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: col, boxShadow: `0 0 8px ${col}` }} />
            {name}
          </div>
        </Html>
      )}
    </group>
  )
}

// ---------------------------------------------------------------- routes & shipments
function Routes({ reached, follow, onArrive, onFollowDone, controlsRef }: {
  reached: number; follow?: SceneProps['follow']; onArrive?: (i: number) => void; onFollowDone?: () => void; controlsRef: React.RefObject<OrbitControlsImpl>
}) {
  const curves = useMemo(() => [0, 1, 2, 3, 4].map(segCurve), [])
  const pts = useMemo(() => curves.map((c) => c.getPoints(40)), [curves])
  const lines = useRef<Array<any>>([])
  const ambient = useRef<THREE.Group>(null)
  const ship = useRef<THREE.Group>(null)
  const st = useRef({ active: false, t: 0, upTo: 0, fired: -1, id: -1 })
  const SEG = 2.4

  useFrame((_, dt) => {
    lines.current.forEach((l, i) => { if (l?.material) l.material.dashOffset -= dt * (i < reached - 1 ? 1.4 : 0.5) })
    // ambient shipments
    ambient.current?.children.forEach((c, i) => {
      const seg = i % 5
      const u = (((performance.now() / 1000) * (0.07 + (i % 3) * 0.02) + i * 0.37) % 1)
      c.position.copy(curves[seg].getPoint(u))
    })
    // route follow
    if (follow && follow.id !== st.current.id) st.current = { active: true, t: 0, upTo: follow.upTo, fired: -1, id: follow.id }
    const s = st.current
    if (s.active && ship.current) {
      s.t += dt
      const total = Math.max(1, s.upTo) * SEG
      const tt = Math.min(s.t, total)
      const seg = Math.min(s.upTo - 1, Math.floor(tt / SEG))
      if (s.upTo === 0) { s.active = false; onArrive?.(0); onFollowDone?.(); return }
      const u = (tt - seg * SEG) / SEG
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2
      const p = curves[seg].getPoint(e)
      ship.current.position.copy(p)
      ship.current.visible = true
      if (controlsRef.current) controlsRef.current.target.lerp(new THREE.Vector3(p.x, 0.5, p.z), 0.05)
      const arrived = Math.floor(s.t / SEG)
      while (s.fired < Math.min(arrived, s.upTo)) { s.fired++; onArrive?.(s.fired) }
      if (s.t >= total + 0.4) { s.active = false; onFollowDone?.() }
    } else if (ship.current && !s.active) {
      ship.current.visible = false
    }
  })

  return (
    <group>
      {pts.map((p, i) => {
        const lit = i < reached - 1
        return (
          <Line
            key={i}
            ref={(r) => { lines.current[i] = r }}
            points={p}
            color={lit ? '#22d3ee' : '#3b5b8a'}
            lineWidth={lit ? 3 : 1.4}
            dashed
            dashSize={0.5}
            gapSize={0.35}
            transparent
            opacity={lit ? 1 : 0.65}
          />
        )
      })}
      <group ref={ambient}>
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh key={i}><boxGeometry args={[0.28, 0.2, 0.2]} /><meshStandardMaterial color="#7dd3fc" emissive="#22d3ee" emissiveIntensity={0.8} /></mesh>
        ))}
      </group>
      <group ref={ship} visible={false}>
        <mesh><boxGeometry args={[0.62, 0.42, 0.42]} /><meshStandardMaterial color="#fde68a" emissive="#f59e0b" emissiveIntensity={1.2} /></mesh>
        <mesh scale={1.9}><sphereGeometry args={[0.4, 12, 12]} /><meshBasicMaterial color="#fbbf24" transparent opacity={0.18} /></mesh>
        <pointLight color="#fbbf24" intensity={12} distance={7} />
      </group>
    </group>
  )
}

// ---------------------------------------------------------------- camera rig
const HOME_POS = new THREE.Vector3(3, 15, 27)
const HOME_TARGET = new THREE.Vector3(3.5, 0, 0)

function CameraRig({ selected, controlsRef, following }: { selected: NodeKey | null; controlsRef: React.RefObject<OrbitControlsImpl>; following: boolean }) {
  const { camera } = useThree()
  const anim = useRef(false)
  const dest = useRef({ pos: HOME_POS.clone(), target: HOME_TARGET.clone() })
  useEffect(() => {
    if (following) return
    if (selected) {
      const p = V(POS[selected])
      dest.current = { pos: new THREE.Vector3(p.x + 3.5, 8, p.z + 11), target: new THREE.Vector3(p.x, 1.2, p.z) }
    } else dest.current = { pos: HOME_POS.clone(), target: HOME_TARGET.clone() }
    anim.current = true
  }, [selected, following])
  useFrame(() => {
    const c = controlsRef.current
    if (!c || !anim.current) return
    camera.position.lerp(dest.current.pos, 0.07)
    c.target.lerp(dest.current.target, 0.09)
    c.update()
    if (camera.position.distanceTo(dest.current.pos) < 0.05) anim.current = false
  })
  return null
}

function AmbientSpin({ controlsRef, on }: { controlsRef: React.RefObject<OrbitControlsImpl>; on: boolean }) {
  useFrame(({ clock }) => {
    if (!on) return
    const t = clock.elapsedTime * 0.12
    const c = controlsRef.current
    if (c) { c.object.position.x = 3.5 + Math.sin(t) * 26; c.object.position.z = 30 + Math.cos(t) * 8; c.object.position.y = 17; c.update() }
  })
  return null
}

// ---------------------------------------------------------------- scene
export function SupplyChainScene(p: SceneProps) {
  const controls = useRef<OrbitControlsImpl>(null)
  const [following, setFollowing] = useState(false)
  useEffect(() => { if (p.follow) setFollowing(true) }, [p.follow?.id])
  return (
    <div style={{ height: p.height ?? '100%', width: '100%' }} className="relative">
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: HOME_POS.toArray() as [number, number, number], fov: 38, near: 0.1, far: 200 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onPointerMissed={() => p.onSelect?.(null)}
      >
        <color attach="background" args={['#050914']} />
        <fog attach="fog" args={['#050914', 38, 85]} />
        <ambientLight intensity={0.55} />
        <hemisphereLight args={['#7dd3fc', '#0f172a', 0.5]} />
        <directionalLight position={[10, 18, 12]} intensity={1.1} color="#dbeafe" />
        <Suspense fallback={null}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[3.5, -0.02, 0]}>
            <planeGeometry args={[120, 70]} />
            <meshStandardMaterial color="#070d1b" roughness={1} />
          </mesh>
          <Grid position={[3.5, 0, 0]} args={[120, 70]} cellSize={1.5} cellThickness={0.5} cellColor="#12203c" sectionSize={7.5} sectionThickness={1} sectionColor="#1d3a63" fadeDistance={60} fadeStrength={1.4} infiniteGrid={false} />
          <Sparkles count={70} scale={[50, 8, 30]} position={[3.5, 4, 0]} size={2.4} speed={0.25} color="#7dd3fc" opacity={0.5} />
          {NODE_KEYS.map((k, i) => (
            <NodeWrap
              key={k}
              k={k}
              name={p.names[k]}
              status={p.reached === 0 ? 'idle' : i < p.reached ? p.statuses[k] : 'idle'}
              selected={p.selected === k}
              dim={p.reached > 0 && i >= p.reached}
              onSelect={p.onSelect}
              showLabel={p.showLabels !== false}
            />
          ))}
          <Routes
            reached={p.reached}
            follow={p.follow}
            onArrive={p.onArrive}
            onFollowDone={() => { setFollowing(false); p.onFollowDone?.() }}
            controlsRef={controls}
          />
        </Suspense>
        <OrbitControls ref={controls} enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2.15} minDistance={6} maxDistance={55} target={HOME_TARGET.toArray() as [number, number, number]} enablePan />
        <CameraRig selected={p.selected} controlsRef={controls} following={following} />
        <AmbientSpin controlsRef={controls} on={!!p.ambient} />
      </Canvas>
    </div>
  )
}
