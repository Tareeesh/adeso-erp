// Renders a formatted, document-style view for every workflow document type.
// Props: doc (from getDocumentWithSteps), record (from GET /workflows/:id/record)

function DocHeader({ label, doc }) {
  const statusColors = {
    draft: 'bg-secondary-100 text-secondary-600',
    pending: 'bg-amber-100 text-amber-700',
    in_progress: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  }
  return (
    <div className="bg-primary-700 px-6 py-5 text-white">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-primary-300 uppercase tracking-widest">ADESO Africa · Official Document</p>
          <h2 className="text-xl font-bold mt-1">{label}</h2>
        </div>
        <div className="text-right">
          <p className="text-xs text-primary-300">Document No.</p>
          <p className="font-mono font-bold text-xl">{doc.document_number}</p>
          <p className="text-xs text-primary-300 mt-0.5">
            {new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="px-6 py-4 border-b border-secondary-100">
      {title && <p className="text-xs font-semibold text-secondary-400 uppercase tracking-widest mb-3">{title}</p>}
      {children}
    </div>
  )
}

function Field({ label, value, mono = false, className = '' }) {
  return (
    <div className={className}>
      <p className="text-xs text-secondary-400">{label}</p>
      <p className={`mt-0.5 text-secondary-900 font-medium ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  )
}

function fmt(currency, amount) {
  if (amount == null || amount === '') return '—'
  return `${currency || ''} ${Number(amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`.trim()
}

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(d) {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Purchase Requisition ────────────────────────────────────────────────────

function PurchaseRequisitionView({ doc, record }) {
  const items = Array.isArray(record.items) ? record.items
    : (typeof record.items === 'string' ? JSON.parse(record.items) : [])

  const total = items.reduce((s, i) => s + (Number(i.quantity || 0) * Number(i.unitPrice || 0)), 0)

  const priorityColors = {
    low: 'bg-secondary-100 text-secondary-600',
    normal: 'bg-blue-50 text-blue-700',
    high: 'bg-amber-50 text-amber-700',
    urgent: 'bg-red-50 text-red-700',
  }

  return (
    <div className="card overflow-hidden border border-secondary-200">
      <DocHeader label="PURCHASE REQUISITION" doc={doc} />

      <Section title="Requested By">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field label="Requestor" value={record.requestor_name} />
          <Field label="Department" value={record.department} />
          <Field label="Project Code" value={record.project_code} mono />
          <Field label="Budget Line" value={record.budget_line} mono />
          <Field label="Required By" value={fmtDate(record.required_by)} />
          <Field label="Currency" value={record.currency} />
          <div>
            <p className="text-xs text-secondary-400">Priority</p>
            <span className={`inline-block mt-0.5 text-xs rounded-full px-2.5 py-0.5 font-medium capitalize ${priorityColors[record.priority] || 'bg-secondary-100 text-secondary-600'}`}>
              {record.priority || 'normal'}
            </span>
          </div>
        </div>
      </Section>

      {record.justification && (
        <Section title="Justification">
          <p className="text-sm text-secondary-800 leading-relaxed whitespace-pre-line">{record.justification}</p>
        </Section>
      )}

      {items.length > 0 && (
        <Section title="Items Requested">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-secondary-400 uppercase tracking-wide border-b border-secondary-100">
                  <th className="text-left py-2">#</th>
                  <th className="text-left py-2">Description</th>
                  <th className="text-right py-2">Qty</th>
                  <th className="text-left py-2 pl-3">Unit</th>
                  <th className="text-right py-2">Unit Price</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2 text-secondary-400 text-xs">{i + 1}</td>
                    <td className="py-2 text-secondary-900">{item.description}</td>
                    <td className="py-2 text-right text-secondary-700">{item.quantity}</td>
                    <td className="py-2 pl-3 text-secondary-500 text-xs">{item.unit}</td>
                    <td className="py-2 text-right font-mono text-secondary-700">
                      {item.unitPrice != null ? Number(item.unitPrice).toLocaleString('en-GB', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="py-2 text-right font-mono font-medium text-secondary-900">
                      {(Number(item.quantity || 0) * Number(item.unitPrice || 0)).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-secondary-200">
                  <td colSpan={5} className="py-3 text-right text-sm font-semibold text-secondary-600 pr-3">Estimated Total</td>
                  <td className="py-3 text-right font-bold text-primary-700 font-mono text-base">
                    {record.currency} {total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Section>
      )}

      <div className="px-6 py-3 bg-secondary-50">
        <p className="text-xs text-secondary-400 italic">
          I certify that the above requisition is necessary for official ADESO activities and is within the approved budget.
        </p>
      </div>
    </div>
  )
}

// ─── Travel Authorization ────────────────────────────────────────────────────

function TravelAuthorizationView({ doc, record }) {
  const transportIcon = { road: '🚗', air: '✈️', rail: '🚂', sea: '🚢' }

  return (
    <div className="card overflow-hidden border border-secondary-200">
      <DocHeader label="TRAVEL AUTHORIZATION" doc={doc} />

      <Section title="Traveller & Destination">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Traveller Name" value={record.traveler_name || record.requestor_name} className="md:col-span-1" />
          <Field label="Destination" value={record.destination} className="md:col-span-2" />
          <Field label="Departure Date" value={fmtDate(record.departure_date)} />
          <Field label="Return Date" value={fmtDate(record.return_date)} />
          <Field label="Transport Mode" value={`${transportIcon[record.transportation_mode] || ''} ${record.transportation_mode || '—'}`.trim()} />
          <Field label="Accommodation" value={record.accommodation} className="md:col-span-2" />
        </div>
      </Section>

      {record.purpose && (
        <Section title="Purpose of Travel">
          <p className="text-sm text-secondary-800 leading-relaxed whitespace-pre-line">{record.purpose}</p>
        </Section>
      )}

      <Section title="Financial Summary">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-secondary-400">Estimated Cost</p>
            <p className="text-lg font-bold text-primary-700 mt-0.5">{fmt(record.currency, record.estimated_cost)}</p>
          </div>
          <Field label="Per Diem (daily)" value={fmt(record.currency, record.per_diem)} />
          <Field label="Cash Advance Requested" value={fmt(record.currency, record.advance_requested)} />
          <Field label="Budget Line" value={record.budget_line} mono />
        </div>
      </Section>

      {record.additional_notes && (
        <Section title="Additional Notes">
          <p className="text-sm text-secondary-700 leading-relaxed whitespace-pre-line">{record.additional_notes}</p>
        </Section>
      )}

      <div className="px-6 py-3 bg-secondary-50">
        <p className="text-xs text-secondary-400 italic">
          I certify that the travel described above is necessary for official ADESO duties and that the estimated costs are reasonable.
        </p>
      </div>
    </div>
  )
}

// ─── Cab Request ─────────────────────────────────────────────────────────────

function CabRequestView({ doc, record }) {
  const names = Array.isArray(record.passenger_names) ? record.passenger_names
    : (typeof record.passenger_names === 'string' && record.passenger_names.startsWith('[')
      ? JSON.parse(record.passenger_names) : [record.passenger_names].filter(Boolean))

  return (
    <div className="card overflow-hidden border border-secondary-200">
      <DocHeader label="CAB / TRANSPORT REQUEST" doc={doc} />

      <Section>
        <div className="flex items-center gap-4 py-2">
          <div className="flex-1 text-center">
            <p className="text-xs text-secondary-400 mb-1">Pick-up</p>
            <p className="font-semibold text-secondary-900">{record.pickup_location}</p>
            <p className="text-xs text-secondary-500 mt-0.5">{fmtDateTime(record.pickup_datetime)}</p>
          </div>
          <div className="text-2xl text-secondary-300 flex-shrink-0">→</div>
          <div className="flex-1 text-center">
            <p className="text-xs text-secondary-400 mb-1">Drop-off</p>
            <p className="font-semibold text-secondary-900">{record.dropoff_location}</p>
            {record.return_datetime && (
              <p className="text-xs text-secondary-500 mt-0.5">Return: {fmtDateTime(record.return_datetime)}</p>
            )}
          </div>
        </div>
      </Section>

      <Section title="Journey Details">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Requested By" value={record.requestor_name} />
          <Field label="Number of Passengers" value={record.passengers} />
          {names.length > 0 && (
            <div>
              <p className="text-xs text-secondary-400">Passenger Names</p>
              <p className="text-sm text-secondary-900 mt-0.5">{names.join(', ')}</p>
            </div>
          )}
        </div>
      </Section>

      {record.purpose && (
        <Section title="Purpose">
          <p className="text-sm text-secondary-800 leading-relaxed">{record.purpose}</p>
        </Section>
      )}

      {record.special_requirements && (
        <Section title="Special Requirements">
          <p className="text-sm text-secondary-700">{record.special_requirements}</p>
        </Section>
      )}

      {(record.assigned_vehicle || record.assigned_driver) && (
        <Section title="Vehicle Assignment">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Vehicle" value={record.assigned_vehicle} />
            <Field label="Driver" value={record.assigned_driver} />
          </div>
        </Section>
      )}
    </div>
  )
}

// ─── Request for Quotation ───────────────────────────────────────────────────

function RFQView({ doc, record }) {
  const items = Array.isArray(record.items) ? record.items
    : (typeof record.items === 'string' ? JSON.parse(record.items) : [])
  const suppliers = Array.isArray(record.invited_suppliers) ? record.invited_suppliers
    : (typeof record.invited_suppliers === 'string' ? JSON.parse(record.invited_suppliers) : [])

  return (
    <div className="card overflow-hidden border border-secondary-200">
      <DocHeader label="REQUEST FOR QUOTATION" doc={doc} />

      <Section title="RFQ Details">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Title" value={doc.title?.replace('Request for Quotation', '').replace('—', '').trim() || doc.title} className="md:col-span-2" />
          <Field label="Submission Deadline" value={fmtDate(record.deadline)} />
        </div>
      </Section>

      {items.length > 0 && (
        <Section title="Items / Services Required">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-secondary-400 uppercase tracking-wide border-b border-secondary-100">
                  <th className="text-left py-2">#</th>
                  <th className="text-left py-2">Description</th>
                  <th className="text-right py-2">Qty</th>
                  <th className="text-left py-2 pl-3">Unit</th>
                  <th className="text-left py-2 pl-3">Specifications</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2 text-secondary-400 text-xs">{i + 1}</td>
                    <td className="py-2 text-secondary-900">{item.description}</td>
                    <td className="py-2 text-right text-secondary-700">{item.quantity}</td>
                    <td className="py-2 pl-3 text-secondary-500 text-xs">{item.unit}</td>
                    <td className="py-2 pl-3 text-secondary-600 text-xs">{item.specifications}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {suppliers.length > 0 && (
        <Section title="Invited Suppliers">
          <div className="flex flex-wrap gap-2">
            {suppliers.map((s, i) => (
              <span key={i} className="text-xs bg-secondary-100 text-secondary-700 rounded-full px-3 py-1">{s}</span>
            ))}
          </div>
        </Section>
      )}

      {record.instructions && (
        <Section title="Instructions to Suppliers">
          <p className="text-sm text-secondary-700 leading-relaxed whitespace-pre-line">{record.instructions}</p>
        </Section>
      )}

      <div className="px-6 py-3 bg-secondary-50">
        <p className="text-xs text-secondary-400 italic">
          ADESO Africa invites qualified suppliers to submit quotations for the above. A minimum of three (3) quotations are required.
        </p>
      </div>
    </div>
  )
}

// ─── Purchase Order ───────────────────────────────────────────────────────────

function PurchaseOrderView({ doc, record }) {
  const items = Array.isArray(record.items) ? record.items
    : (typeof record.items === 'string' ? JSON.parse(record.items) : [])

  return (
    <div className="card overflow-hidden border border-secondary-200">
      <DocHeader label="LOCAL PURCHASE ORDER" doc={doc} />

      <Section title="Supplier Information">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Field label="Supplier" value={record.supplier_name_full || record.supplier_name} className="md:col-span-2" />
          {record.supplier_email && <Field label="Supplier Email" value={record.supplier_email} />}
          <Field label="Delivery Date" value={fmtDate(record.delivery_date)} />
          <Field label="Payment Terms" value={record.payment_terms} />
          <Field label="Delivery Address" value={record.delivery_address} className="md:col-span-2" />
        </div>
      </Section>

      {items.length > 0 && (
        <Section title="Items Ordered">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-secondary-400 uppercase tracking-wide border-b border-secondary-100">
                  <th className="text-left py-2">#</th>
                  <th className="text-left py-2">Description</th>
                  <th className="text-right py-2">Qty</th>
                  <th className="text-right py-2">Unit Price</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-50">
                {items.map((item, i) => (
                  <tr key={i}>
                    <td className="py-2 text-secondary-400 text-xs">{i + 1}</td>
                    <td className="py-2 text-secondary-900">{item.description || item.name}</td>
                    <td className="py-2 text-right text-secondary-700">{item.quantity}</td>
                    <td className="py-2 text-right font-mono text-secondary-700">
                      {item.unitPrice != null ? Number(item.unitPrice).toLocaleString('en-GB', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                    <td className="py-2 text-right font-mono font-medium text-secondary-900">
                      {(Number(item.quantity || 0) * Number(item.unitPrice || 0)).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-secondary-200">
                <tr>
                  <td colSpan={4} className="py-2 text-right text-xs text-secondary-500 pr-3">Subtotal</td>
                  <td className="py-2 text-right font-mono text-secondary-700">
                    {record.currency} {Number(record.subtotal || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
                {Number(record.tax_amount) > 0 && (
                  <tr>
                    <td colSpan={4} className="py-2 text-right text-xs text-secondary-500 pr-3">Tax</td>
                    <td className="py-2 text-right font-mono text-secondary-700">
                      {record.currency} {Number(record.tax_amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
                <tr className="border-t border-secondary-200">
                  <td colSpan={4} className="py-3 text-right font-semibold text-secondary-700 pr-3">Total Amount</td>
                  <td className="py-3 text-right font-bold text-primary-700 font-mono text-lg">
                    {record.currency} {Number(record.total_amount || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Section>
      )}

      {record.is_service && record.contract_url && (
        <Section title="Contract">
          <a href={record.contract_url} target="_blank" rel="noreferrer" className="text-sm text-primary-600 hover:underline">
            View Contract Document
          </a>
        </Section>
      )}

      <div className="px-6 py-3 bg-secondary-50">
        <p className="text-xs text-secondary-400 italic">
          This Local Purchase Order is issued by ADESO Africa. Please ensure delivery meets the specified terms and conditions.
        </p>
      </div>
    </div>
  )
}

// ─── Payment Requisition ─────────────────────────────────────────────────────

function PaymentRequisitionView({ doc, record }) {
  const meta = typeof doc.metadata === 'string' ? JSON.parse(doc.metadata || '{}') : (doc.metadata || {})
  const payeeName = meta.payeeName || record.payee_name
  const payeeBank = meta.payeeBank || record.payee_bank
  const payeeAccount = meta.payeeAccount || record.payee_account
  const currency = meta.currency || record.currency
  const amount = meta.amount ?? record.amount
  const paymentMethod = meta.paymentMethod || record.payment_method
  const paymentPurpose = meta.paymentPurpose || record.payment_purpose
  const budgetLine = meta.budgetLine || record.budget_line
  const poReference = meta.poReference

  return (
    <div className="card overflow-hidden border border-secondary-200">
      <DocHeader label="PAYMENT REQUISITION" doc={doc} />

      <Section title="Payee Information">
        <div className="grid grid-cols-3 gap-6">
          <Field label="Payee / Vendor Name" value={payeeName} />
          <Field label="Bank Name" value={payeeBank} />
          <Field label="Account / Reference No." value={payeeAccount} mono />
        </div>
      </Section>

      <Section title="Payment Details">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <div>
            <p className="text-xs text-secondary-400">Amount</p>
            <p className="text-3xl font-bold text-primary-700 mt-0.5">
              {currency} {amount != null ? Number(amount).toLocaleString('en-GB', { minimumFractionDigits: 2 }) : '—'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Payment Method" value={(paymentMethod || '').replace(/_/g, ' ')} />
            <Field label="Budget Line" value={budgetLine} mono />
            {poReference && <Field label="PO Reference" value={poReference} mono className="col-span-2" />}
          </div>
          <div className="col-span-2">
            <p className="text-xs text-secondary-400">Purpose of Payment</p>
            <p className="text-secondary-900 mt-0.5 leading-relaxed">{paymentPurpose || '—'}</p>
          </div>
        </div>
      </Section>

      <div className="px-6 py-3 bg-secondary-50">
        <p className="text-xs text-secondary-400 italic">
          I hereby certify that the above payment is correct, properly authorised, and in accordance with ADESO financial policies and donor requirements.
        </p>
      </div>
    </div>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────

const VIEWS = {
  purchase_requisition: PurchaseRequisitionView,
  travel_authorization: TravelAuthorizationView,
  cab_request: CabRequestView,
  rfq: RFQView,
  purchase_order: PurchaseOrderView,
  payment_requisition: PaymentRequisitionView,
}

export default function DocumentBodyRenderer({ doc, record }) {
  if (!doc || !record) return null
  const View = VIEWS[doc.document_type]
  if (!View) return null
  return <View doc={doc} record={record} />
}
