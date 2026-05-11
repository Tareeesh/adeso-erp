import { getProcurementTier, getTierColorClass } from '../../utils/procurementThresholds'
import { CheckCircle, AlertCircle } from 'lucide-react'

export default function ProcurementTierBadge({ amount, currency = 'KES' }) {
  if (!amount || Number(amount) <= 0) return null
  const tier = getProcurementTier(Number(amount), currency)

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${getTierColorClass(tier.color)}`}>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">Procurement Threshold: {tier.label}</span>
        <span className="text-xs opacity-75">Tier {tier.tier}</span>
      </div>
      <div className="space-y-1.5 text-xs">
        <p><strong>Solicitation:</strong> {tier.solicitation}</p>
        {tier.committee && <p><strong>Committee:</strong> Minimum {tier.committee.members} members required</p>}
      </div>
      <div>
        <p className="text-xs font-medium mb-1.5">Required documents:</p>
        <div className="flex flex-wrap gap-1.5">
          {tier.documents.map(d => (
            <span key={d} className="inline-flex items-center gap-1 bg-white bg-opacity-60 rounded px-2 py-0.5 text-xs">
              <CheckCircle size={10} /> {d}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
