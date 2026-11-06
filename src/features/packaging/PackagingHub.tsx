import { useState } from 'react'
import { Boxes, Brain, Fingerprint, Flame, ScanLine, FileCheck2, Droplets } from 'lucide-react'
import { PageHeader, Tabs, StatusBadge } from '../../components/ui'
import { useAnalysis, useSelectedAnalysis } from '../../state/selectors'
import { useStore } from '../../state/store'
import { PackagingVerification } from './PackagingVerification'
import { Fingerprint as FingerprintView } from './Fingerprint'
import { Watermark } from './Watermark'
import { AiDetection } from './AiDetection'
import { Heatmap } from './Heatmap'
import { AuthenticityReport } from '../verification/AuthenticityReport'

export type PackagingTab = 'verify' | 'viewer' | 'fingerprint' | 'watermark' | 'ai' | 'heatmap' | 'report'

export function PackagingHub({ initialTab = 'verify' }: { initialTab?: PackagingTab }) {
  const [tab, setTab] = useState<PackagingTab>(initialTab)
  const a = useSelectedAnalysis()
  const an = useAnalysis()
  const select = useStore((s) => s.selectBatch)
  return (
    <>
      <PageHeader
        eyebrow="Physical truth"
        title="Packaging intelligence"
        subtitle="Computer-vision verification of the physical package against the fingerprint sealed at processing."
        actions={
          <>
            <StatusBadge status={a.classification.label} />
            <select className="input mono !w-[290px]" value={a.batch.batchId} onChange={(e) => select(e.target.value)}>{an.list.map((x) => <option key={x.batch.batchId} value={x.batch.batchId}>{x.batch.batchId} · {x.batch.product}</option>)}</select>
          </>
        }
      />
      <Tabs
        value={tab} onChange={setTab}
        items={[
          { id: 'verify', label: <><ScanLine size={14} />Verification</> },
          { id: 'viewer', label: <><Boxes size={14} />3D package</> },
          { id: 'fingerprint', label: <><Fingerprint size={14} />Fingerprint</> },
          { id: 'watermark', label: <><Droplets size={14} />Watermark</> },
          { id: 'ai', label: <><Brain size={14} />AI detection</> },
          { id: 'heatmap', label: <><Flame size={14} />Tampering heatmap</> },
          { id: 'report', label: <><FileCheck2 size={14} />Report</> },
        ]}
      />
      {tab === 'verify' && <PackagingVerification />}
      {tab === 'viewer' && <PackagingVerification view3d />}
      {tab === 'fingerprint' && <FingerprintView />}
      {tab === 'watermark' && <Watermark />}
      {tab === 'ai' && <AiDetection />}
      {tab === 'heatmap' && <Heatmap />}
      {tab === 'report' && <AuthenticityReport a={a} />}
    </>
  )
}
