import { useEffect, useRef } from 'react'
import type { Batch, PackageMods } from '../models/types'
import type { RegionKey } from '../services/packaging'
import { PKG_H, PKG_W, drawPackageFront } from '../utils/packageArt'
import { cn } from '../utils/format'

export function PackageImage({
  batch, qrId, watermarkId, mods, highlights, revealWatermark, className, scanning, onCanvas,
}: {
  batch: Batch
  qrId: string
  watermarkId: string
  mods?: Partial<PackageMods>
  highlights?: Array<{ region: RegionKey; color: string }>
  revealWatermark?: boolean
  className?: string
  scanning?: boolean
  onCanvas?: (c: HTMLCanvasElement) => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const hl = JSON.stringify(highlights ?? [])
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    drawPackageFront(ctx, batch, { mods, qrId, watermarkId, highlights, revealWatermark })
    onCanvas?.(c)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch.batchId, batch.expiryDate, batch.certification, qrId, watermarkId, JSON.stringify(mods), hl, revealWatermark])
  return (
    <div className={cn('relative overflow-hidden rounded-[18px]', className)} style={{ aspectRatio: `${PKG_W}/${PKG_H}` }}>
      <canvas ref={ref} width={PKG_W} height={PKG_H} className="h-full w-full" />
      {scanning && <div className="scanline" />}
    </div>
  )
}
