import { useState } from 'react'
import { Cpu, FileCheck2, QrCode, Workflow, Scale } from 'lucide-react'
import { PageHeader, Tabs, StatusBadge } from '../../components/ui'
import { useAnalysis, useSelectedAnalysis } from '../../state/selectors'
import { useStore } from '../../state/store'
import { QrVerification } from './QrVerification'
import { TrustEngine } from './TrustEngine'
import { DigitalTwin } from './DigitalTwin'
import { AuthenticityReport } from './AuthenticityReport'
import { CrossVerify } from './CrossVerify'

export type VerifyTab = 'qr' | 'cross' | 'engine' | 'twin' | 'report'

export function VerificationHub({ initialTab = 'qr' }: { initialTab?: VerifyTab }) {
  const [tab, setTab] = useState<VerifyTab>(initialTab)
  const a = useSelectedAnalysis()
  const an = useAnalysis()
  const select = useStore((s) => s.selectBatch)
  return (
    <>
      <PageHeader
        eyebrow="Cross-verified trust"
        title="Verification"
        subtitle="QR scan, trust engine and report — all driven by the same shared data as every other screen."
        actions={<><StatusBadge status={a.status} /><select className="input mono !w-[290px]" value={a.batch.batchId} onChange={(e) => select(e.target.value)}>{an.list.map((x) => <option key={x.batch.batchId} value={x.batch.batchId}>{x.batch.batchId} · {x.batch.product}</option>)}</select></>}
      />
      <Tabs value={tab} onChange={setTab} items={[
        { id: 'qr', label: <><QrCode size={14} />QR verification</> },
        { id: 'cross', label: <><Scale size={14} />Three truths</> },
        { id: 'engine', label: <><Cpu size={14} />Trust engine</> },
        { id: 'twin', label: <><Workflow size={14} />Digital twin pipeline</> },
        { id: 'report', label: <><FileCheck2 size={14} />Authenticity report</> },
      ]} />
      {tab === 'qr' && <QrVerification />}
      {tab === 'cross' && <CrossVerify a={a} />}
      {tab === 'engine' && <TrustEngine />}
      {tab === 'twin' && <DigitalTwin />}
      {tab === 'report' && <AuthenticityReport a={a} />}
    </>
  )
}
