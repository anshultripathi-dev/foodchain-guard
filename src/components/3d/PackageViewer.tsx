import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, Line, OrbitControls, RoundedBox, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import type { Batch, PackageMods } from '../../models/types'
import { REGIONS, type RegionKey } from '../../services/packaging'
import { PKG_H, PKG_W, drawPackageBack, drawPackageFront, newCanvas } from '../../utils/packageArt'

export interface Highlight { region: RegionKey; color: string; label?: string }

const W = 2.0, H = W * (PKG_H / PKG_W), D = 0.62

function useCanvasTexture(draw: (ctx: CanvasRenderingContext2D) => void, deps: unknown[]) {
  const tex = useMemo(() => {
    const c = newCanvas()
    const t = new THREE.CanvasTexture(c)
    t.anisotropy = 8
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  useEffect(() => {
    const c = tex.image as HTMLCanvasElement
    draw(c.getContext('2d')!)
    tex.needsUpdate = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return tex
}

function rectToPlane(region: RegionKey) {
  const g = REGIONS[region]
  const x = (g.x + g.w / 2 - 0.5) * W
  const y = (0.5 - (g.y + g.h / 2)) * H
  return { x, y, w: g.w * W, h: g.h * H }
}

function Pouch({ batch, qrId, watermarkId, mods, highlights, scanning, autoRotate }: Omit<Props, 'height'>) {
  const group = useRef<THREE.Group>(null)
  const beam = useRef<THREE.Mesh>(null)
  const hlKey = JSON.stringify(highlights ?? [])
  const front = useCanvasTexture(
    (ctx) => drawPackageFront(ctx, batch, { mods, qrId, watermarkId }),
    [batch.batchId, batch.expiryDate, qrId, watermarkId, JSON.stringify(mods)],
  )
  const back = useCanvasTexture((ctx) => drawPackageBack(ctx, batch), [batch.batchId])
  useFrame(({ clock }, dt) => {
    if (group.current && autoRotate) group.current.rotation.y += dt * 0.45
    if (beam.current) {
      beam.current.visible = !!scanning
      beam.current.position.y = Math.sin(clock.elapsedTime * 2.2) * (H / 2 - 0.05)
    }
  })
  return (
    <group ref={group}>
      <RoundedBox args={[W, H, D]} radius={0.09} smoothness={4}>
        <meshStandardMaterial color="#fde68a" roughness={0.55} metalness={0.05} />
      </RoundedBox>
      <mesh position={[0, 0, D / 2 + 0.004]}>
        <planeGeometry args={[W - 0.02, H - 0.02]} />
        <meshStandardMaterial map={front} roughness={0.45} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0, -D / 2 - 0.004]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[W - 0.02, H - 0.02]} />
        <meshStandardMaterial map={back} roughness={0.45} />
      </mesh>
      {/* crimped seals */}
      <mesh position={[0, H / 2 + 0.03, 0]}><boxGeometry args={[W + 0.02, 0.12, D * 0.45]} /><meshStandardMaterial color="#facc15" roughness={0.4} metalness={0.3} /></mesh>
      <mesh position={[0, -H / 2 - 0.03, 0]}><boxGeometry args={[W + 0.02, 0.1, D * 0.45]} /><meshStandardMaterial color="#facc15" roughness={0.4} metalness={0.3} /></mesh>
      {/* verification highlights */}
      {highlights?.map((h) => {
        const r = rectToPlane(h.region)
        const pts: Array<[number, number, number]> = [
          [r.x - r.w / 2 - 0.03, r.y - r.h / 2 - 0.03, D / 2 + 0.02], [r.x + r.w / 2 + 0.03, r.y - r.h / 2 - 0.03, D / 2 + 0.02],
          [r.x + r.w / 2 + 0.03, r.y + r.h / 2 + 0.03, D / 2 + 0.02], [r.x - r.w / 2 - 0.03, r.y + r.h / 2 + 0.03, D / 2 + 0.02],
          [r.x - r.w / 2 - 0.03, r.y - r.h / 2 - 0.03, D / 2 + 0.02],
        ]
        return (
          <group key={h.region + hlKey}>
            <Line points={pts} color={h.color} lineWidth={3} />
            <mesh position={[r.x, r.y, D / 2 + 0.012]}>
              <planeGeometry args={[r.w + 0.06, r.h + 0.06]} />
              <meshBasicMaterial color={h.color} transparent opacity={0.18} depthWrite={false} />
            </mesh>
            <Html position={[r.x, r.y + r.h / 2 + 0.1, D / 2 + 0.05]} center distanceFactor={5.5} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
              <span className="whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-bold text-white shadow" style={{ background: h.color }}>{h.label ?? REGIONS[h.region].label}</span>
            </Html>
          </group>
        )
      })}
      <mesh ref={beam} position={[0, 0, D / 2 + 0.03]} visible={false}>
        <planeGeometry args={[W, 0.05]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.9} />
      </mesh>
    </group>
  )
}

interface Props {
  batch: Batch
  qrId: string
  watermarkId: string
  mods?: Partial<PackageMods>
  highlights?: Highlight[]
  scanning?: boolean
  autoRotate?: boolean
  height?: number | string
}

export function PackageViewer3D(p: Props) {
  return (
    <div style={{ height: p.height ?? 420 }} className="relative w-full overflow-hidden rounded-2xl bg-[radial-gradient(ellipse_at_50%_30%,#16233f,#050914)]">
      <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0.3, 5.2], fov: 36 }}>
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 4, 5]} intensity={1.4} />
        <pointLight position={[-4, -1, 3]} intensity={12} color="#22d3ee" />
        <pointLight position={[4, 2, -3]} intensity={10} color="#a78bfa" />
        <Pouch {...p} autoRotate={p.autoRotate ?? false} />
        <ContactShadows position={[0, -H / 2 - 0.25, 0]} opacity={0.5} scale={8} blur={2.6} far={3} />
        <OrbitControls enablePan={false} minDistance={3} maxDistance={8} enableDamping />
      </Canvas>
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-ink-900/70 px-2 py-1 text-[11px] text-slate-400 backdrop-blur">Drag to rotate · scroll to zoom</div>
    </div>
  )
}
