const PDFDocument = require('pdfkit')
const { query } = require('../config/database')
const { uploadFile } = require('../config/storage')

const BLUE = '#1e3a8a'
const LIGHT_BLUE = '#3b82f6'
const GRAY = '#64748b'
const LIGHT_GRAY = '#f8fafc'
const BORDER = '#e2e8f0'
const W = 495 // usable width (595 - 2*50)

// ── helpers ────────────────────────────────────────────────────────────────

const sectionHeading = (pdf, label, y) => {
  pdf.fontSize(7.5).font('Helvetica-Bold').fillColor(GRAY)
  pdf.text(label.toUpperCase(), 50, y, { characterSpacing: 0.8 })
  pdf.moveTo(50, y + 11).lineTo(545, y + 11).strokeColor(LIGHT_BLUE).lineWidth(0.5).stroke()
  return y + 18
}

const field = (pdf, label, value, x, y, width = 160) => {
  pdf.fontSize(7.5).font('Helvetica').fillColor(GRAY).text(label, x, y, { width })
  pdf.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a').text(value || '—', x, y + 11, { width })
  return y + 26
}

const drawTableHeader = (pdf, columns, y) => {
  const totalW = columns.reduce((s, c) => s + c.w, 0)
  pdf.rect(50, y, totalW, 18).fill('#e2e8f0')
  let x = 50
  columns.forEach(col => {
    pdf.fontSize(7.5).font('Helvetica-Bold').fillColor(GRAY)
    pdf.text(col.label.toUpperCase(), x + 4, y + 5, { width: col.w - 8, align: col.align || 'left' })
    x += col.w
  })
  return y + 18
}

const drawTableRow = (pdf, columns, row, y) => {
  if (y > 720) { pdf.addPage(); y = 50 }
  let x = 50
  columns.forEach((col, i) => {
    pdf.fontSize(9).font('Helvetica').fillColor('#0f172a')
    pdf.text(String(row[i] ?? '—'), x + 4, y + 4, { width: col.w - 8, align: col.align || 'left' })
    x += col.w
  })
  y += 18
  pdf.moveTo(50, y).lineTo(50 + columns.reduce((s, c) => s + c.w, 0), y).strokeColor(BORDER).lineWidth(0.3).stroke()
  return y
}

const fmt = (currency, amount) => amount != null
  ? `${currency || ''} ${Number(amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`.trim()
  : '—'

const fmtDate = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

// ── fetch type-specific record ────────────────────────────────────────────

const TYPE_QUERIES = {
  purchase_requisition: `SELECT pr.*, u.first_name || ' ' || u.last_name AS requestor_name FROM purchase_requisitions pr LEFT JOIN users u ON pr.requestor_id=u.id WHERE pr.document_id=$1`,
  travel_authorization: `SELECT ta.*, u.first_name || ' ' || u.last_name AS requestor_name FROM travel_authorizations ta LEFT JOIN users u ON ta.requestor_id=u.id WHERE ta.document_id=$1`,
  cab_request: `SELECT cr.*, u.first_name || ' ' || u.last_name AS requestor_name FROM cab_requests cr LEFT JOIN users u ON cr.requestor_id=u.id WHERE cr.document_id=$1`,
  rfq: `SELECT r.* FROM rfq r WHERE r.document_id=$1`,
  purchase_order: `SELECT po.*, COALESCE(po.supplier_name, s.name) AS supplier_name_full, s.email AS supplier_email, s.phone AS supplier_phone FROM purchase_orders po LEFT JOIN suppliers s ON po.supplier_id=s.id WHERE po.document_id=$1`,
  payment_requisition: `SELECT * FROM payment_requisitions WHERE document_id=$1`,
}

// ── header band (used by all types) ──────────────────────────────────────

const renderHeader = (pdf, typeLabel, doc) => {
  pdf.rect(0, 0, pdf.page.width, 85).fill(BLUE)
  pdf.fillColor('white').fontSize(8).font('Helvetica').text('ADESO Africa · African Development Solutions', 50, 18)
  pdf.fontSize(20).font('Helvetica-Bold').text(typeLabel, 50, 30)
  // right side
  pdf.fontSize(8).fillColor('#93c5fd').font('Helvetica').text('Document No.', pdf.page.width - 180, 22, { width: 130, align: 'right' })
  pdf.fontSize(14).font('Helvetica-Bold').fillColor('white').text(doc.document_number, pdf.page.width - 180, 34, { width: 130, align: 'right' })
  pdf.fontSize(8).font('Helvetica').fillColor('#93c5fd')
  pdf.text(fmtDate(doc.created_at), pdf.page.width - 180, 54, { width: 130, align: 'right' })
  const statusColor = doc.status === 'completed' ? '#4ade80' : doc.status === 'rejected' ? '#f87171' : '#fbbf24'
  pdf.fontSize(8).fillColor(statusColor).text(doc.status.toUpperCase().replace(/_/g, ' '), pdf.page.width - 180, 66, { width: 130, align: 'right' })
  pdf.fillColor('#0f172a')
  return 100
}

// ── per-type body renderers ───────────────────────────────────────────────

const renderPurchaseRequisition = (pdf, doc, record) => {
  let y = renderHeader(pdf, 'PURCHASE REQUISITION', doc)

  y = sectionHeading(pdf, 'Requested By', y)
  const py = y
  field(pdf, 'Requestor', record.requestor_name, 50, py)
  field(pdf, 'Department', record.department, 220, py)
  field(pdf, 'Project Code', record.project_code, 390, py, 155)
  y = py + 30
  field(pdf, 'Budget Line', record.budget_line, 50, y)
  field(pdf, 'Required By', fmtDate(record.required_by), 220, y)
  field(pdf, 'Priority', (record.priority || 'normal').toUpperCase(), 390, y, 155)
  y += 35

  if (record.justification) {
    y = sectionHeading(pdf, 'Justification', y)
    pdf.fontSize(9).font('Helvetica').fillColor('#0f172a').text(record.justification, 50, y, { width: W })
    y = pdf.y + 10
  }

  const items = Array.isArray(record.items) ? record.items : (typeof record.items === 'string' ? JSON.parse(record.items) : [])
  if (items.length > 0) {
    y = sectionHeading(pdf, 'Items Requested', y)
    const cols = [
      { label: '#', w: 25 }, { label: 'Description', w: 200 },
      { label: 'Qty', w: 45, align: 'right' }, { label: 'Unit', w: 55 },
      { label: 'Unit Price', w: 85, align: 'right' }, { label: 'Total', w: 85, align: 'right' },
    ]
    y = drawTableHeader(pdf, cols, y)
    let total = 0
    items.forEach((item, i) => {
      const lineTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0)
      total += lineTotal
      y = drawTableRow(pdf, cols, [
        i + 1, item.description, item.quantity, item.unit,
        item.unitPrice != null ? Number(item.unitPrice).toLocaleString('en-GB', { minimumFractionDigits: 2 }) : '—',
        lineTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 }),
      ], y)
    })
    pdf.fontSize(10).font('Helvetica-Bold').fillColor(BLUE)
    pdf.text(`ESTIMATED TOTAL: ${record.currency || ''} ${total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, 50, y + 6, { align: 'right', width: W })
    y = pdf.y + 12
  }

  pdf.rect(50, y + 5, W, 30).fillAndStroke(LIGHT_GRAY, BORDER)
  pdf.fontSize(8).font('Helvetica-Oblique').fillColor(GRAY)
  pdf.text('I certify that the above requisition is necessary for official ADESO activities and is within the approved budget.', 58, y + 12, { width: W - 16 })
  return y + 45
}

const renderTravelAuthorization = (pdf, doc, record) => {
  let y = renderHeader(pdf, 'TRAVEL AUTHORIZATION', doc)

  y = sectionHeading(pdf, 'Traveller & Destination', y)
  let py = y
  field(pdf, 'Traveller', record.traveler_name || record.requestor_name, 50, py)
  field(pdf, 'Destination', record.destination, 220, py, 325)
  y = py + 30
  field(pdf, 'Departure', fmtDate(record.departure_date), 50, y)
  field(pdf, 'Return', fmtDate(record.return_date), 220, y)
  field(pdf, 'Transport Mode', record.transportation_mode || '—', 390, y, 155)
  y += 30
  if (record.accommodation) {
    field(pdf, 'Accommodation', record.accommodation, 50, y, W)
    y += 30
  }

  if (record.purpose) {
    y = sectionHeading(pdf, 'Purpose of Travel', y)
    pdf.fontSize(9).font('Helvetica').fillColor('#0f172a').text(record.purpose, 50, y, { width: W })
    y = pdf.y + 10
  }

  y = sectionHeading(pdf, 'Financial Summary', y)
  py = y
  field(pdf, 'Estimated Cost', fmt(record.currency, record.estimated_cost), 50, py)
  field(pdf, 'Per Diem (daily)', fmt(record.currency, record.per_diem), 220, py)
  field(pdf, 'Cash Advance', fmt(record.currency, record.advance_requested), 390, py, 155)
  y = py + 30
  field(pdf, 'Budget Line', record.budget_line || '—', 50, y, W)
  y += 30

  pdf.rect(50, y + 5, W, 30).fillAndStroke(LIGHT_GRAY, BORDER)
  pdf.fontSize(8).font('Helvetica-Oblique').fillColor(GRAY)
  pdf.text('I certify that the travel described above is necessary for official ADESO duties and that the estimated costs are reasonable.', 58, y + 12, { width: W - 16 })
  return y + 45
}

const renderCabRequest = (pdf, doc, record) => {
  let y = renderHeader(pdf, 'CAB / TRANSPORT REQUEST', doc)

  // Route display
  pdf.rect(50, y, W, 55).fill(LIGHT_GRAY)
  pdf.fontSize(8).font('Helvetica').fillColor(GRAY).text('PICK-UP', 65, y + 8)
  pdf.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(record.pickup_location || '—', 65, y + 20, { width: 160 })
  pdf.fontSize(8).fillColor(GRAY).font('Helvetica').text(record.pickup_datetime ? fmtDate(record.pickup_datetime) : '', 65, y + 36)
  pdf.fontSize(18).fillColor('#94a3b8').text('→', 260, y + 16, { width: 30, align: 'center' })
  pdf.fontSize(8).font('Helvetica').fillColor(GRAY).text('DROP-OFF', 310, y + 8)
  pdf.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(record.dropoff_location || '—', 310, y + 20, { width: 180 })
  y += 65

  y = sectionHeading(pdf, 'Journey Details', y)
  let py = y
  field(pdf, 'Requested By', record.requestor_name, 50, py)
  field(pdf, 'Passengers', String(record.passengers || '—'), 220, py)
  field(pdf, 'Purpose', record.purpose || '—', 390, py, 155)
  y = py + 30

  const names = Array.isArray(record.passenger_names) ? record.passenger_names
    : (typeof record.passenger_names === 'string' && record.passenger_names.startsWith('[')
      ? JSON.parse(record.passenger_names) : [])
  if (names.length > 0) {
    field(pdf, 'Passenger Names', names.join(', '), 50, y, W)
    y += 30
  }

  if (record.assigned_vehicle || record.assigned_driver) {
    y = sectionHeading(pdf, 'Vehicle Assignment', y)
    py = y
    field(pdf, 'Vehicle', record.assigned_vehicle, 50, py)
    field(pdf, 'Driver', record.assigned_driver, 220, py)
    y = py + 30
  }
  return y
}

const renderRFQ = (pdf, doc, record) => {
  let y = renderHeader(pdf, 'REQUEST FOR QUOTATION', doc)

  y = sectionHeading(pdf, 'RFQ Details', y)
  field(pdf, 'Submission Deadline', fmtDate(record.deadline), 50, y, W)
  y += 30

  const items = Array.isArray(record.items) ? record.items : (typeof record.items === 'string' ? JSON.parse(record.items) : [])
  if (items.length > 0) {
    y = sectionHeading(pdf, 'Items / Services Required', y)
    const cols = [
      { label: '#', w: 25 }, { label: 'Description', w: 195 },
      { label: 'Qty', w: 45, align: 'right' }, { label: 'Unit', w: 55 },
      { label: 'Specifications', w: 175 },
    ]
    y = drawTableHeader(pdf, cols, y)
    items.forEach((item, i) => {
      y = drawTableRow(pdf, cols, [i + 1, item.description, item.quantity, item.unit, item.specifications || ''], y)
    })
    y += 8
  }

  const suppliers = Array.isArray(record.invited_suppliers) ? record.invited_suppliers
    : (typeof record.invited_suppliers === 'string' ? JSON.parse(record.invited_suppliers) : [])
  if (suppliers.length > 0) {
    y = sectionHeading(pdf, 'Invited Suppliers', y)
    pdf.fontSize(9).font('Helvetica').fillColor('#0f172a').text(suppliers.join(' · '), 50, y, { width: W })
    y = pdf.y + 10
  }

  if (record.instructions) {
    y = sectionHeading(pdf, 'Instructions to Suppliers', y)
    pdf.fontSize(9).font('Helvetica').fillColor('#0f172a').text(record.instructions, 50, y, { width: W })
    y = pdf.y + 10
  }

  pdf.rect(50, y + 5, W, 30).fillAndStroke(LIGHT_GRAY, BORDER)
  pdf.fontSize(8).font('Helvetica-Oblique').fillColor(GRAY)
  pdf.text('ADESO Africa invites qualified suppliers to submit quotations. A minimum of three (3) quotations are required.', 58, y + 12, { width: W - 16 })
  return y + 45
}

const renderPurchaseOrder = (pdf, doc, record) => {
  let y = renderHeader(pdf, 'LOCAL PURCHASE ORDER', doc)

  y = sectionHeading(pdf, 'Supplier Information', y)
  let py = y
  field(pdf, 'Supplier', record.supplier_name_full || record.supplier_name, 50, py, 280)
  field(pdf, 'Delivery Date', fmtDate(record.delivery_date), 345, py, 200)
  y = py + 30
  field(pdf, 'Payment Terms', record.payment_terms || '—', 50, y)
  field(pdf, 'Delivery Address', record.delivery_address || '—', 220, y, 325)
  y += 30

  const items = Array.isArray(record.items) ? record.items : (typeof record.items === 'string' ? JSON.parse(record.items) : [])
  if (items.length > 0) {
    y = sectionHeading(pdf, 'Items Ordered', y)
    const cols = [
      { label: '#', w: 25 }, { label: 'Description', w: 235 },
      { label: 'Qty', w: 45, align: 'right' },
      { label: 'Unit Price', w: 95, align: 'right' },
      { label: 'Total', w: 95, align: 'right' },
    ]
    y = drawTableHeader(pdf, cols, y)
    items.forEach((item, i) => {
      const lineTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0)
      y = drawTableRow(pdf, cols, [
        i + 1, item.description || item.name, item.quantity,
        item.unitPrice != null ? Number(item.unitPrice).toLocaleString('en-GB', { minimumFractionDigits: 2 }) : '—',
        lineTotal.toLocaleString('en-GB', { minimumFractionDigits: 2 }),
      ], y)
    })

    y += 4
    const labelX = 50 + 25 + 235 + 45
    if (Number(record.subtotal) > 0) {
      pdf.fontSize(8).fillColor(GRAY).font('Helvetica').text('Subtotal', labelX, y + 3, { width: 95, align: 'right' })
      pdf.fontSize(9).fillColor('#0f172a').font('Helvetica').text(fmt(record.currency, record.subtotal), labelX + 95, y + 3, { width: 95, align: 'right' })
      y += 16
    }
    if (Number(record.tax_amount) > 0) {
      pdf.fontSize(8).fillColor(GRAY).font('Helvetica').text('Tax', labelX, y + 3, { width: 95, align: 'right' })
      pdf.fontSize(9).fillColor('#0f172a').font('Helvetica').text(fmt(record.currency, record.tax_amount), labelX + 95, y + 3, { width: 95, align: 'right' })
      y += 16
    }
    pdf.rect(labelX, y, 190, 22).fill(BLUE)
    pdf.fontSize(9).font('Helvetica-Bold').fillColor('white')
    pdf.text('TOTAL', labelX + 4, y + 6, { width: 91, align: 'right' })
    pdf.text(fmt(record.currency, record.total_amount), labelX + 95, y + 6, { width: 91, align: 'right' })
    y += 30
  }

  pdf.rect(50, y + 5, W, 30).fillAndStroke(LIGHT_GRAY, BORDER)
  pdf.fontSize(8).font('Helvetica-Oblique').fillColor(GRAY)
  pdf.text('This Local Purchase Order is issued by ADESO Africa. Please ensure delivery meets the specified terms and conditions.', 58, y + 12, { width: W - 16 })
  return y + 45
}

const renderPaymentRequisition = (pdf, doc, record) => {
  let y = renderHeader(pdf, 'PAYMENT REQUISITION', doc)
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

  y = sectionHeading(pdf, 'Payee Information', y)
  let py = y
  field(pdf, 'Payee / Vendor Name', payeeName, 50, py)
  field(pdf, 'Bank Name', payeeBank, 220, py)
  field(pdf, 'Account / Reference No.', payeeAccount, 390, py, 155)
  y = py + 35

  y = sectionHeading(pdf, 'Payment Details', y)
  pdf.fontSize(8).fillColor(GRAY).font('Helvetica').text('AMOUNT', 50, y)
  pdf.fontSize(24).fillColor(BLUE).font('Helvetica-Bold')
  pdf.text(fmt(currency, amount), 50, y + 10, { width: 220 })
  const amountBottom = pdf.y + 4

  let rx = 280, ry = y
  field(pdf, 'Payment Method', (paymentMethod || '').replace(/_/g, ' '), rx, ry, 130)
  field(pdf, 'Budget Line', budgetLine, rx + 135, ry, 130)
  ry += 30
  if (poReference) { field(pdf, 'PO Reference', poReference, rx, ry, 265); ry += 30 }

  y = Math.max(amountBottom, ry) + 5
  pdf.fontSize(8).fillColor(GRAY).font('Helvetica').text('PURPOSE OF PAYMENT', 50, y)
  pdf.fontSize(10).fillColor('#0f172a').font('Helvetica').text(paymentPurpose || '—', 50, y + 12, { width: W })
  y = pdf.y + 15

  pdf.rect(50, y, W, 32).fillAndStroke(LIGHT_GRAY, BORDER)
  pdf.fontSize(8).font('Helvetica-Oblique').fillColor(GRAY)
  pdf.text('I hereby certify that the above payment is correct, properly authorised, and in accordance with ADESO financial policies and donor requirements.', 58, y + 8, { width: W - 16 })
  return y + 42
}

// ── signature trail ───────────────────────────────────────────────────────

const renderSignatureTrail = (pdf, steps, startY) => {
  let y = startY + 10
  if (y > 680) { pdf.addPage(); y = 50 }

  pdf.fontSize(10).font('Helvetica-Bold').fillColor(BLUE).text('AUTHORISATIONS & SIGNATURE TRAIL', 50, y)
  pdf.moveTo(50, y + 14).lineTo(545, y + 14).strokeColor(BLUE).lineWidth(1).stroke()
  y += 22

  const colW = (W - 10) / 2
  let col = 0

  steps.forEach(step => {
    if (y > 680) { pdf.addPage(); y = 50; col = 0 }
    const x = col === 0 ? 50 : 50 + colW + 10
    const boxH = 80

    const isDone = step.status === 'completed'
    pdf.rect(x, y, colW, boxH).fillAndStroke(isDone ? '#f0fdf4' : LIGHT_GRAY, BORDER)

    pdf.fontSize(7.5).font('Helvetica-Bold').fillColor(GRAY)
    pdf.text(step.step_name?.toUpperCase() || 'STEP', x + 8, y + 7, { width: colW - 16, characterSpacing: 0.5 })
    pdf.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a')
    pdf.text(
      step.first_name ? `${step.first_name} ${step.last_name}` : step.external_name || 'Pending assignment',
      x + 8, y + 19, { width: colW - 16 }
    )

    if (isDone) {
      if (step.typed_name || (step.action_taken === 'signed')) {
        const sigName = step.typed_name || (step.first_name ? `${step.first_name} ${step.last_name}` : '')
        pdf.fontSize(16).font('Helvetica-BoldOblique').fillColor(BLUE)
        pdf.text(sigName, x + 8, y + 35, { width: colW - 16 })
      } else {
        pdf.fontSize(9).fillColor('#16a34a').font('Helvetica-Bold')
        pdf.text('✓ ' + (step.action_taken === 'approve' ? 'Approved' : 'Completed'), x + 8, y + 38)
      }
      if (step.completed_at) {
        pdf.fontSize(7).fillColor(GRAY).font('Helvetica')
        pdf.text(fmtDate(step.completed_at), x + 8, y + 65, { width: colW - 16 })
      }
    } else {
      pdf.fontSize(8).fillColor('#94a3b8').font('Helvetica')
      pdf.text(step.status === 'in_progress' ? 'Awaiting signature / approval' : 'Pending', x + 8, y + 40)
    }

    col = 1 - col
    if (col === 0) y += boxH + 8
  })
  if (col === 1) y += boxH + 8
  return y
}

// ── main export ───────────────────────────────────────────────────────────

const generateDocumentPDF = async (documentId) => {
  const { rows: [doc] } = await query(
    `SELECT d.*, c.name AS company_name FROM documents d JOIN companies c ON d.company_id=c.id WHERE d.id=$1`,
    [documentId]
  )
  if (!doc) throw new Error('Document not found')

  const { rows: steps } = await query(
    `SELECT ws.*, u.first_name, u.last_name, s.signature_type, s.typed_name, s.signed_at
     FROM workflow_steps ws
     LEFT JOIN users u ON ws.assigned_user_id = u.id
     LEFT JOIN signatures s ON s.workflow_step_id = ws.id
     WHERE ws.document_id=$1 ORDER BY ws.step_number`,
    [documentId]
  )

  let record = {}
  const sql = TYPE_QUERIES[doc.document_type]
  if (sql) {
    const { rows: [r] } = await query(sql, [documentId])
    record = r || {}
  }

  const pdf = new PDFDocument({ margin: 50, size: 'A4' })
  const chunks = []
  pdf.on('data', c => chunks.push(c))

  await new Promise((resolve, reject) => {
    pdf.on('end', resolve)
    pdf.on('error', reject)

    let contentBottom
    switch (doc.document_type) {
      case 'purchase_requisition':  contentBottom = renderPurchaseRequisition(pdf, doc, record); break
      case 'travel_authorization':  contentBottom = renderTravelAuthorization(pdf, doc, record); break
      case 'cab_request':           contentBottom = renderCabRequest(pdf, doc, record); break
      case 'rfq':                   contentBottom = renderRFQ(pdf, doc, record); break
      case 'purchase_order':        contentBottom = renderPurchaseOrder(pdf, doc, record); break
      case 'payment_requisition':   contentBottom = renderPaymentRequisition(pdf, doc, record); break
      default:
        contentBottom = renderHeader(pdf, doc.document_type.replace(/_/g, ' ').toUpperCase(), doc)
    }

    if (contentBottom > 650) pdf.addPage()
    renderSignatureTrail(pdf, steps, contentBottom > 650 ? 50 : contentBottom)

    // Footer
    pdf.fontSize(7.5).fillColor(GRAY).font('Helvetica')
    pdf.text(
      `Generated by ADESO ERP on ${new Date().toLocaleString('en-GB')}`,
      50, pdf.page.height - 30, { align: 'center', width: W }
    )

    pdf.end()
  })

  const buffer = Buffer.concat(chunks)
  const key = await uploadFile(buffer, `${doc.document_number}.pdf`, `pdfs/${documentId}`)
  await query('UPDATE documents SET generated_pdf_url=$1 WHERE id=$2', [key, documentId])
  return key
}

module.exports = { generateDocumentPDF }
