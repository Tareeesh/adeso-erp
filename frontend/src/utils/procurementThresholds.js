export const TIERS = [
  {
    tier: 0,
    label: 'Up to USD 99',
    range: [0, 99],
    prRequired: false,
    solicitation: 'Not required',
    cba: false,
    committee: null,
    contract: false,
    documents: ['Receipt'],
    color: 'gray',
  },
  {
    tier: 1,
    label: 'USD 100 – 499',
    range: [100, 499],
    prRequired: true,
    solicitation: 'Not required',
    cba: false,
    committee: null,
    contract: false,
    documents: ['Purchase Requisition', 'Receipt'],
    color: 'blue',
  },
  {
    tier: 2,
    label: 'USD 500 – 24,999',
    range: [500, 24999],
    prRequired: true,
    solicitation: 'Closed Tender — RFQ/RFP, Min. 3 written bids',
    cba: true,
    committee: null,
    contract: true,
    documents: ['Purchase Requisition', 'RFQ/RFP', 'Comparative Bid Analysis', 'PO/Contract', 'GRN / Certificate of Completion'],
    color: 'yellow',
  },
  {
    tier: 3,
    label: 'USD 25,000 – 99,999',
    range: [25000, 99999],
    prRequired: true,
    solicitation: 'Open Tender — RFQ/RFP, Min. 3 written bids',
    cba: true,
    committee: { members: 3 },
    contract: true,
    documents: ['Purchase Requisition', 'RFQ/RFP', 'Comparative Bid Analysis', 'Procurement Committee (3 members)', 'PO/Contract', 'GRN / Certificate of Completion'],
    color: 'orange',
  },
  {
    tier: 4,
    label: 'USD 100,000 – 299,999',
    range: [100000, 299999],
    prRequired: true,
    solicitation: 'Open Tender — RFQ/RFP, Min. 3 written bids',
    cba: true,
    committee: { members: 5 },
    contract: true,
    documents: ['Purchase Requisition', 'RFQ/RFP', 'Comparative Bid Analysis', 'Procurement Committee (5 members)', 'PO/Contract', 'GRN / Certificate of Completion'],
    color: 'red',
  },
  {
    tier: 5,
    label: 'USD 300,000 and above',
    range: [300000, Infinity],
    prRequired: true,
    solicitation: 'International Open Tender — RFP only, Min. 3 written bids',
    cba: true,
    committee: { members: 7 },
    contract: true,
    documents: ['Purchase Requisition', 'RFQ/RFP (International)', 'Comparative Bid Analysis', 'Procurement Committee (7 members)', 'PO/Contract', 'GRN / Certificate of Completion'],
    color: 'purple',
  },
]

const EXCHANGE_RATES = { USD: 1, KES: 0.0077, EUR: 1.09, GBP: 1.27, UGX: 0.00027, TZS: 0.00039 }

export function toUSD(amount, currency) {
  const rate = EXCHANGE_RATES[currency] || 1
  return amount * rate
}

export function getProcurementTier(amount, currency = 'USD') {
  const usd = toUSD(amount, currency)
  return TIERS.find(t => usd >= t.range[0] && usd <= t.range[1]) || TIERS[TIERS.length - 1]
}

const tierColors = {
  gray: 'bg-secondary-50 border-secondary-200 text-secondary-700',
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  orange: 'bg-orange-50 border-orange-200 text-orange-700',
  red: 'bg-red-50 border-red-200 text-red-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
}
export const getTierColorClass = (color) => tierColors[color] || tierColors.gray
