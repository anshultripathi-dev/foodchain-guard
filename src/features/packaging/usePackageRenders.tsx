import { useEffect, useState } from 'react'
import type { Batch, PackageMods } from '../../models/types'
import { NO_MODS } from '../../models/types'
import { computeDiff, drawPackageFront, newCanvas, type DiffResult } from '../../utils/packageArt'

export interface Renders {
  registered: HTMLCanvasElement
  scanned: HTMLCanvasElement
  diff: DiffResult
}

/** Offscreen renders of the registered package and the scanned package, plus their pixel diff. */
export function usePackageRenders(batch: Batch, qrId: string, watermarkId: string, mods: PackageMods): Renders | null {
  const [r, setR] = useState<Renders | null>(null)
  const key = JSON.stringify(mods) + batch.batchId + batch.expiryDate + qrId
  useEffect(() => {
    let alive = true
    const go = () => {
      const reg = newCanvas(), scn = newCanvas()
      drawPackageFront(reg.getContext('2d')!, batch, { mods: NO_MODS, qrId, watermarkId })
      drawPackageFront(scn.getContext('2d')!, batch, { mods, qrId, watermarkId })
      if (alive) setR({ registered: reg, scanned: scn, diff: computeDiff(reg, scn) })
    }
    const fonts = (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts
    if (fonts?.ready) fonts.ready.then(go); else go()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return r
}

export function CanvasView({ canvas, className }: { canvas: HTMLCanvasElement; className?: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => setUrl(canvas.toDataURL('image/png')), [canvas])
  return <img src={url} alt="" className={className} draggable={false} />
}
