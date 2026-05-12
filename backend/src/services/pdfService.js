const PDFDocument = require('pdfkit')
const { downloadFile } = require('../config/storage')
const { query } = require('../config/database')

// ── Colours ──────────────────────────────────────────────────────────────────
const C = {
  primary:   '#1e3a5f',
  accent:    '#2563eb',
  light:     '#f1f5f9',
  border:    '#cbd5e1',
  text:      '#1e293b',
  muted:     '#64748b',
  white:     '#ffffff',
  approved:  '#16a34a',
  pending:   '#d97706',
  rejected:  '#dc2626',
}

const PAGE = { size: 'A4', margins: { top: 30, bottom: 50, left: 50, right: 50 } }
const W = 595.28 - 100  // content width

// ── Wrap in promise ───────────────────────────────────────────────────────────
const makePDF = (drawFn) => new Promise((resolve, reject) => {
  const doc = new PDFDocument(PAGE)
  const bufs = []
  doc.on('data', c => bufs.push(c))
  doc.on('end', () => resolve(Buffer.concat(bufs)))
  doc.on('error', reject)
  try { drawFn(doc) } catch (e) { reject(e) }
  doc.end()
})

// ── Helpers ───────────────────────────────────────────────────────────────────
const hr = (doc, y, color = C.border) => {
  doc.save().strokeColor(color).lineWidth(0.5)
    .moveTo(50, y).lineTo(545, y).stroke().restore()
}

const field = (doc, label, value, x, y, labelW = 130) => {
  doc.save()
    .font('Helvetica-Bold').fontSize(7.5).fillColor(C.muted)
    .text(label.toUpperCase(), x, y, { width: labelW, lineBreak: false })
    .font('Helvetica').fontSize(9).fillColor(C.text)
    .text(value || '—', x + labelW, y, { width: W - labelW - (x - 50), lineBreak: false })
    .restore()
  return y + 14
}

const sectionTitle = (doc, title, y) => {
  doc.save()
    .rect(50, y, W, 16).fill(C.primary)
    .font('Helvetica-Bold').fontSize(8).fillColor(C.white)
    .text(title.toUpperCase(), 56, y + 4, { width: W - 12, lineBreak: false })
    .restore()
  return y + 22
}

const statusColor = (s) => {
  if (!s) return C.muted
  if (s === 'completed' || s === 'approved') return C.approved
  if (s === 'rejected') return C.rejected
  return C.pending
}

// ── Letterhead ────────────────────────────────────────────────────────────────
async function drawLetterhead(doc, company, logoBuffer) {
  const startY = 30
  let textX = 50

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, 50, startY, { height: 55, fit: [120, 55] })
      textX = 180
    } catch (_) { /* skip if image fails */ }
  }

  const s = company.settings || {}

  doc.save()
    .font('Helvetica-Bold').fontSize(16).fillColor(C.primary)
    .text(company.name || 'ADESO Africa', textX, startY + 2, { width: 545 - textX })

  doc.font('Helvetica').fontSize(8).fillColor(C.muted)

  const lines = []
  if (s.letterheadSubtitle) lines.push(s.letterheadSubtitle)
  if (company.address) lines.push(company.address)
  if (s.poBox) lines.push(s.poBox)

  const contactParts = []
  if (company.phone) contactParts.push(`Tel: ${company.phone}`)
  if (company.email) contactParts.push(`Email: ${company.email}`)
  if (s.website) contactParts.push(s.website)
  if (contactParts.length) lines.push(contactParts.join('   ·   '))

  lines.forEach((l, i) => {
    doc.text(l, textX, startY + 22 + i * 11, { width: 545 - textX, lineBreak: false })
  })

  doc.restore()

  const lineY = Math.max(startY + 70, startY + 22 + lines.length * 11 + 8)
  doc.save().strokeColor(C.primary).lineWidth(2)
    .moveTo(50, lineY).lineTo(545, lineY).stroke()
    .strokeColor(C.accent).lineWidth(0.5)
    .moveTo(50, lineY + 3).lineTo(545, lineY + 3).stroke()
    .restore()

  return lineY + 12
}

// ── Document title block ───────────────────────────────────────────────────────
function drawDocTitle(doc, title, docNumber, date, y) {
  doc.save()
    .font('Helvetica-Bold').fontSize(14).fillColor(C.primary)
    .text(title.toUpperCase(), 50, y, { width: W, align: 'center' })
    .restore()

  y += 20

  doc.save()
    .font('Helvetica').fontSize(8.5).fillColor(C.muted)
    .text(`Ref: ${docNumber || '—'}`, 50, y, { width: W / 2, lineBreak: false })
    .text(`Date: ${date ? new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`, 50 + W / 2, y, { width: W / 2, align: 'right', lineBreak: false })
    .restore()

  hr(doc, y + 14, C.accent)
  return y + 22
}

// ── Signature blocks ────────────────────────────────────────────────────────────
function drawSignatures(doc, steps, y) {
  if (!steps || !steps.length) return y

  if (y > 680) { doc.addPage(); y = 50 }

  y = sectionTitle(doc, 'Authorisation & Signatures', y)

  const cols = Math.min(steps.length, 3)
  const colW = W / cols
  const sigH = 80

  steps.forEach((step, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const sx = 50 + col * colW
    const sy = y + row * (sigH + 20)

    if (sy + sigH + 60 > 790 && col === 0 && row > 0) {
      doc.addPage()
    }

    const bx = sx + 4
    const by = sy

    // Box background
    doc.save().rect(bx, by, colW - 8, sigH + 40).fill(C.light).restore()

    // Role label
    const color = statusColor(step.status)
    doc.save()
      .font('Helvetica-Bold').fontSize(7.5).fillColor(color)
      .text(step.step_name || 'Approver', bx + 4, by + 6, { width: colW - 20, lineBreak: false })
      .restore()

    // Status pill
    const statusLabel = step.status === 'completed' ? 'APPROVED'
      : step.status === 'rejected' ? 'REJECTED'
      : 'PENDING'
    doc.save()
      .rect(bx + colW - 60, by + 4, 52, 13).fill(color)
      .font('Helvetica-Bold').fontSize(6).fillColor(C.white)
      .text(statusLabel, bx + colW - 58, by + 7, { width: 48, align: 'center', lineBreak: false })
      .restore()

    // Name
    doc.save()
      .font('Helvetica-Bold').fontSize(8.5).fillColor(C.text)
      .text(step.assigned_user_name || step.external_name || '________________________', bx + 4, by + 22, { width: colW - 12, lineBreak: false })
      .restore()

    // Signature line
    doc.save().strokeColor(C.border).lineWidth(0.5)
      .moveTo(bx + 4, by + 44).lineTo(bx + colW - 12, by + 44).stroke().restore()
    doc.save().font('Helvetica').fontSize(7).fillColor(C.muted)
      .text('Signature', bx + 4, by + 46, { lineBreak: false }).restore()

    // Date
    const dateStr = step.completed_at
      ? new Date(step.completed_at).toLocaleDateString('en-GB')
      : '________________'
    doc.save().font('Helvetica').fontSize(7.5).fillColor(C.text)
      .text(`Date: ${dateStr}`, bx + 4, by + 60, { lineBreak: false }).restore()

    // Comments
    if (step.comments) {
      doc.save().font('Helvetica').fontSize(7).fillColor(C.muted)
        .text(`Note: ${step.comments.slice(0, 60)}`, bx + 4, by + 74, { width: colW - 12 }).restore()
    }
  })

  return y + Math.ceil(steps.length / cols) * (sigH + 24) + 10
}

// ── Footer ─────────────────────────────────────────────────────────────────────
function drawFooter(doc, pageNum, docNumber) {
  const y = 800
  hr(doc, y - 6, C.border)
  doc.save()
    .font('Helvetica').fontSize(7).fillColor(C.muted)
    .text(`${docNumber || ''}  ·  This is a system-generated document from ADESO ERP`, 50, y, { width: W - 60, lineBreak: false })
    .text(`Page ${pageNum}`, 50, y, { width: W, align: 'right', lineBreak: false })
    .restore()
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function getCompanyAndLogo(companyId) {
  const { rows: [company] } = await query('SELECT * FROM companies WHERE id=$1', [companyId])
  if (!company) return { company: {}, logo: null }

  let logo = null
  if (company.logo_url) {
    try { logo = await downloadFile(company.logo_url) } catch (_) {}
  }
  return { company, logo }
}

async function getWorkflowSteps(documentId) {
  const { rows } = await query(
    `SELECT ws.*, u.first_name || ' ' || u.last_name AS assigned_user_name
     FROM workflow_steps ws
     LEFT JOIN users u ON ws.assigned_user_id = u.id
     WHERE ws.document_id = $1
     ORDER BY ws.step_number`,
    [documentId]
  )
  return rows.filter(s => s.step_type !== 'cc')
}

// ══════════════════════════════════════════════════════════════════════════════
// DOCUMENT GENERATORS
// ══════════════════════════════════════════════════════════════════════════════

// ── Purchase Requisition ──────────────────────────────────────────────────────
async function generatePR(documentId, companyId) {
  const { rows: [pr] } = await query(
    `SELECT pr.*, d.document_number, d.created_at, d.status,
            u.first_name || ' ' || u.last_name AS requestor_name
     FROM purchase_requisitions pr
     JOIN documents d ON pr.document_id = d.id
     JOIN users u ON pr.requestor_id = u.id
     WHERE d.id = $1 AND pr.company_id = $2`,
    [documentId, companyId]
  )
  if (!pr) throw new Error('PR not found')

  const steps = await getWorkflowSteps(documentId)
  const { company, logo } = await getCompanyAndLogo(companyId)

  return makePDF(async (doc) => {
    let y = await drawLetterhead(doc, company, logo)
    y = drawDocTitle(doc, 'Purchase Requisition', pr.document_number, pr.created_at, y)

    y = sectionTitle(doc, 'Requisition Details', y)
    y = field(doc, 'Requested By', pr.requestor_name, 50, y)
    y = field(doc, 'Department', pr.department, 50, y)
    y = field(doc, 'Project / Programme', pr.project_programme || pr.project_code, 50, y)
    y = field(doc, 'Budget Line', pr.budget_line, 50, y)
    y = field(doc, 'Required By', pr.required_by ? new Date(pr.required_by).toLocaleDateString('en-GB') : null, 50, y)
    y = field(doc, 'Priority', pr.priority?.toUpperCase(), 50, y)
    y = field(doc, 'Category', pr.item_category, 50, y)
    y += 6

    y = sectionTitle(doc, 'Justification', y)
    doc.font('Helvetica').fontSize(9).fillColor(C.text)
      .text(pr.justification || '—', 54, y, { width: W - 8 })
    y = doc.y + 10

    // Items table
    const items = Array.isArray(pr.items) ? pr.items : []
    if (items.length > 0) {
      y = sectionTitle(doc, 'Items Requested', y)

      const cols = [
        { label: '#', w: 25 },
        { label: 'Description', w: 200 },
        { label: 'Qty', w: 40 },
        { label: 'Unit', w: 50 },
        { label: 'Est. Unit Price', w: 85 },
        { label: 'Est. Total', w: 85 },
      ]

      // Header row
      doc.save().rect(50, y, W, 16).fill(C.light).restore()
      let cx = 50
      doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor(C.text)
      cols.forEach(c => {
        doc.text(c.label, cx + 3, y + 4, { width: c.w - 4, lineBreak: false })
        cx += c.w
      })
      doc.restore()
      y += 16

      let totalEst = 0
      items.forEach((item, idx) => {
        const rowY = y
        const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
        totalEst += lineTotal

        cx = 50
        doc.save().font('Helvetica').fontSize(8.5).fillColor(C.text)
        const rowData = [
          String(idx + 1),
          item.description || item.name || '—',
          String(item.quantity || '—'),
          item.unit || '—',
          item.unitPrice ? `${pr.currency || 'KES'} ${Number(item.unitPrice).toLocaleString()}` : '—',
          lineTotal ? `${pr.currency || 'KES'} ${lineTotal.toLocaleString()}` : '—',
        ]
        rowData.forEach((val, ci) => {
          doc.text(val, cx + 3, rowY + 2, { width: cols[ci].w - 4, lineBreak: false })
          cx += cols[ci].w
        })
        doc.restore()

        hr(doc, rowY + 14, C.light)
        y = rowY + 16
      })

      // Total row
      doc.save().font('Helvetica-Bold').fontSize(9).fillColor(C.primary)
        .text(`Estimated Total: ${pr.currency || 'KES'} ${(pr.estimated_total || totalEst).toLocaleString()}`,
          50, y + 4, { width: W, align: 'right', lineBreak: false })
        .restore()
      y += 20
    }

    if (pr.consultancy_details && Object.keys(pr.consultancy_details).length > 0) {
      const cd = pr.consultancy_details
      y = sectionTitle(doc, 'Consultancy Details', y)
      if (cd.consultantName) y = field(doc, 'Consultant / Firm', cd.consultantName, 50, y)
      if (cd.serviceDescription) y = field(doc, 'Services', cd.serviceDescription, 50, y)
      if (cd.contractDuration) y = field(doc, 'Duration', cd.contractDuration, 50, y)
      if (cd.deliverables) y = field(doc, 'Deliverables', cd.deliverables, 50, y)
      y += 6
    }

    y = drawSignatures(doc, steps, y + 10)
    drawFooter(doc, 1, pr.document_number)
  })
}

// ── Payment Requisition ───────────────────────────────────────────────────────
async function generatePayment(documentId, companyId) {
  const { rows: [pm] } = await query(
    `SELECT pr.*, d.document_number, d.created_at, d.status,
            u.first_name || ' ' || u.last_name AS created_by_name
     FROM payment_requisitions pr
     JOIN documents d ON pr.document_id = d.id
     JOIN users u ON pr.created_by = u.id
     WHERE d.id = $1 AND pr.company_id = $2`,
    [documentId, companyId]
  )
  if (!pm) throw new Error('Payment not found')

  const steps = await getWorkflowSteps(documentId)
  const { company, logo } = await getCompanyAndLogo(companyId)

  return makePDF(async (doc) => {
    let y = await drawLetterhead(doc, company, logo)
    y = drawDocTitle(doc, 'Payment Requisition', pm.document_number, pm.created_at, y)

    y = sectionTitle(doc, 'Payee Information', y)
    y = field(doc, 'Payee Name', pm.payee_name, 50, y)
    y = field(doc, 'Paying Office', pm.paying_office, 50, y)
    y = field(doc, 'Bank Name', pm.payee_bank, 50, y)
    y = field(doc, 'Account Number', pm.payee_account, 50, y)
    y += 6

    y = sectionTitle(doc, 'Payment Details', y)
    y = field(doc, 'Currency', pm.currency, 50, y)
    y = field(doc, 'Amount', pm.amount != null ? `${pm.currency} ${Number(pm.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}` : '—', 50, y)

    if (pm.amount_in_words) {
      doc.save().rect(50, y, W, 22).fill(C.light).restore()
      doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor(C.muted)
        .text('AMOUNT IN WORDS', 56, y + 4, { lineBreak: false })
        .font('Helvetica').fontSize(9).fillColor(C.primary)
        .text(pm.amount_in_words, 56, y + 14, { width: W - 12, lineBreak: false })
        .restore()
      y += 28
    }

    y = field(doc, 'Mode of Payment', pm.payment_method?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase()), 50, y)
    y += 6

    y = sectionTitle(doc, 'Reason for Payment', y)
    doc.font('Helvetica').fontSize(9).fillColor(C.text)
      .text(pm.payment_purpose || '—', 54, y, { width: W - 8 })
    y = doc.y + 10

    y = sectionTitle(doc, 'Budget & Project Coding', y)
    y = field(doc, 'Budget Line', pm.budget_line, 50, y)
    y = field(doc, 'Budget Code', pm.budget_code, 50, y)
    y = field(doc, 'Project Code', pm.project_code, 50, y)
    y += 6

    if (pm.payment_voucher_number) {
      y = sectionTitle(doc, 'Payment Voucher', y)
      y = field(doc, 'Voucher Number', pm.payment_voucher_number, 50, y)
      y = field(doc, 'Payment Date', pm.payment_date ? new Date(pm.payment_date).toLocaleDateString('en-GB') : null, 50, y)
      y += 6
    }

    y = drawSignatures(doc, steps, y + 10)
    drawFooter(doc, 1, pm.document_number)
  })
}

// ── Purchase Order ────────────────────────────────────────────────────────────
async function generatePO(documentId, companyId) {
  const { rows: [po] } = await query(
    `SELECT po.*, d.document_number, d.created_at, d.status,
            s.name AS supplier_name_reg, s.email AS supplier_email_reg, s.phone AS supplier_phone
     FROM purchase_orders po
     JOIN documents d ON po.document_id = d.id
     LEFT JOIN suppliers s ON po.supplier_id = s.id
     WHERE d.id = $1 AND po.company_id = $2`,
    [documentId, companyId]
  )
  if (!po) throw new Error('PO not found')

  const steps = await getWorkflowSteps(documentId)
  const { company, logo } = await getCompanyAndLogo(companyId)

  return makePDF(async (doc) => {
    let y = await drawLetterhead(doc, company, logo)
    y = drawDocTitle(doc, 'Purchase Order', po.document_number, po.created_at, y)

    y = sectionTitle(doc, 'Supplier Information', y)
    y = field(doc, 'Supplier', po.supplier_name_reg || po.supplier_name, 50, y)
    y = field(doc, 'Email', po.supplier_email_reg, 50, y)
    y = field(doc, 'Phone', po.supplier_phone, 50, y)
    y += 6

    y = sectionTitle(doc, 'Order Details', y)
    y = field(doc, 'Delivery Address', po.delivery_address, 50, y)
    y = field(doc, 'Delivery Date', po.delivery_date ? new Date(po.delivery_date).toLocaleDateString('en-GB') : null, 50, y)
    y = field(doc, 'Payment Terms', po.payment_terms, 50, y)
    y += 6

    const items = Array.isArray(po.items) ? po.items : []
    if (items.length > 0) {
      y = sectionTitle(doc, 'Items Ordered', y)
      const cols = [
        { label: '#', w: 25 }, { label: 'Description', w: 190 },
        { label: 'Qty', w: 40 }, { label: 'Unit Price', w: 90 }, { label: 'Total', w: 90 },
      ]
      doc.save().rect(50, y, W, 16).fill(C.light).restore()
      let cx = 50
      doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor(C.text)
      cols.forEach(c => { doc.text(c.label, cx + 3, y + 4, { width: c.w - 4, lineBreak: false }); cx += c.w })
      doc.restore()
      y += 16

      items.forEach((item, idx) => {
        const lineTotal = (Number(item.quantity) || 0) * (Number(item.unitPrice) || Number(item.unit_price) || 0)
        cx = 50
        doc.save().font('Helvetica').fontSize(8.5).fillColor(C.text)
        const vals = [
          String(idx + 1),
          item.description || item.name || '—',
          String(item.quantity || '—'),
          item.unitPrice || item.unit_price ? `${po.currency} ${Number(item.unitPrice || item.unit_price).toLocaleString()}` : '—',
          lineTotal ? `${po.currency} ${lineTotal.toLocaleString()}` : '—',
        ]
        vals.forEach((v, ci) => { doc.text(v, cx + 3, y + 2, { width: cols[ci].w - 4, lineBreak: false }); cx += cols[ci].w })
        doc.restore()
        hr(doc, y + 14, C.light)
        y += 16
      })

      doc.save().font('Helvetica-Bold').fontSize(9).fillColor(C.primary)
        .text(`Subtotal: ${po.currency} ${(po.subtotal || 0).toLocaleString()}`, 50, y + 2, { width: W, align: 'right', lineBreak: false })
        .restore()
      y += 14
      if (po.tax_amount > 0) {
        doc.save().font('Helvetica').fontSize(8.5).fillColor(C.muted)
          .text(`Tax: ${po.currency} ${(po.tax_amount || 0).toLocaleString()}`, 50, y, { width: W, align: 'right', lineBreak: false })
          .restore()
        y += 12
      }
      doc.save().rect(50, y, W, 20).fill(C.primary).restore()
      doc.save().font('Helvetica-Bold').fontSize(11).fillColor(C.white)
        .text(`TOTAL: ${po.currency} ${(po.total_amount || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`,
          50, y + 5, { width: W - 6, align: 'right', lineBreak: false })
        .restore()
      y += 28
    }

    if (po.notes) {
      y = sectionTitle(doc, 'Notes & Conditions', y)
      doc.font('Helvetica').fontSize(9).fillColor(C.text).text(po.notes, 54, y, { width: W - 8 })
      y = doc.y + 10
    }

    y = drawSignatures(doc, steps, y + 10)
    drawFooter(doc, 1, po.document_number)
  })
}

// ── Travel Authorization ──────────────────────────────────────────────────────
async function generateTravel(documentId, companyId) {
  const { rows: [ta] } = await query(
    `SELECT ta.*, d.document_number, d.created_at, d.status,
            u.first_name || ' ' || u.last_name AS traveller_name
     FROM travel_authorizations ta
     JOIN documents d ON ta.document_id = d.id
     JOIN users u ON ta.traveller_id = u.id
     WHERE d.id = $1 AND ta.company_id = $2`,
    [documentId, companyId]
  )
  if (!ta) throw new Error('Travel authorization not found')

  const steps = await getWorkflowSteps(documentId)
  const { company, logo } = await getCompanyAndLogo(companyId)

  return makePDF(async (doc) => {
    let y = await drawLetterhead(doc, company, logo)
    y = drawDocTitle(doc, 'Travel Authorization', ta.document_number, ta.created_at, y)

    y = sectionTitle(doc, 'Traveller Information', y)
    y = field(doc, 'Traveller', ta.traveller_name, 50, y)
    y = field(doc, 'Department', ta.department, 50, y)
    y = field(doc, 'Job Title', ta.job_title, 50, y)
    y += 6

    y = sectionTitle(doc, 'Trip Details', y)
    y = field(doc, 'Purpose of Travel', ta.purpose, 50, y)
    y = field(doc, 'Destination', ta.destination, 50, y)
    y = field(doc, 'Travel Type', ta.travel_type === 'international' ? 'International' : 'Domestic', 50, y)
    y = field(doc, 'Departure Date', ta.departure_date ? new Date(ta.departure_date).toLocaleDateString('en-GB') : null, 50, y)
    y = field(doc, 'Return Date', ta.return_date ? new Date(ta.return_date).toLocaleDateString('en-GB') : null, 50, y)
    y = field(doc, 'Transport Mode', ta.transport_mode, 50, y)
    y += 6

    y = sectionTitle(doc, 'Financial Details', y)
    y = field(doc, 'Currency', ta.currency, 50, y)
    y = field(doc, 'Daily Per Diem Rate', ta.per_diem_rate != null ? `${ta.currency} ${Number(ta.per_diem_rate).toLocaleString()}` : '—', 50, y)
    y = field(doc, 'Number of Days', String(ta.duration_days || '—'), 50, y)
    y = field(doc, 'Total Per Diem', ta.total_per_diem != null ? `${ta.currency} ${Number(ta.total_per_diem).toLocaleString()}` : '—', 50, y)
    y = field(doc, 'Estimated Airfare', ta.estimated_airfare != null ? `${ta.currency} ${Number(ta.estimated_airfare).toLocaleString()}` : '—', 50, y)
    y = field(doc, 'Other Costs', ta.other_costs != null ? `${ta.currency} ${Number(ta.other_costs).toLocaleString()}` : '—', 50, y)
    y = field(doc, 'Budget Line', ta.budget_line, 50, y)
    y = field(doc, 'Project Code', ta.project_code, 50, y)
    y += 6

    if (ta.additional_notes) {
      y = sectionTitle(doc, 'Additional Notes', y)
      doc.font('Helvetica').fontSize(9).fillColor(C.text).text(ta.additional_notes, 54, y, { width: W - 8 })
      y = doc.y + 10
    }

    y = drawSignatures(doc, steps, y + 10)
    drawFooter(doc, 1, ta.document_number)
  })
}

// ── RFQ ───────────────────────────────────────────────────────────────────────
async function generateRFQ(documentId, companyId) {
  const { rows: [rfq] } = await query(
    `SELECT r.*, d.document_number, d.created_at, d.status,
            u.first_name || ' ' || u.last_name AS created_by_name,
            pr.department, pr.budget_line
     FROM rfq r
     JOIN documents d ON r.document_id = d.id
     JOIN users u ON r.created_by = u.id
     LEFT JOIN purchase_requisitions pr ON r.pr_id = pr.id
     WHERE d.id = $1 AND r.company_id = $2`,
    [documentId, companyId]
  )
  if (!rfq) throw new Error('RFQ not found')

  const steps = await getWorkflowSteps(documentId)
  const { company, logo } = await getCompanyAndLogo(companyId)

  return makePDF(async (doc) => {
    let y = await drawLetterhead(doc, company, logo)
    y = drawDocTitle(doc, 'Request for Quotation', rfq.document_number, rfq.created_at, y)

    y = sectionTitle(doc, 'RFQ Details', y)
    y = field(doc, 'Created By', rfq.created_by_name, 50, y)
    y = field(doc, 'Department', rfq.department, 50, y)
    y = field(doc, 'Budget Line', rfq.budget_line, 50, y)
    y = field(doc, 'Submission Deadline', rfq.deadline ? new Date(rfq.deadline).toLocaleDateString('en-GB') : null, 50, y)
    y += 6

    if (rfq.instructions) {
      y = sectionTitle(doc, 'Instructions to Suppliers', y)
      doc.font('Helvetica').fontSize(9).fillColor(C.text).text(rfq.instructions, 54, y, { width: W - 8 })
      y = doc.y + 10
    }

    const items = Array.isArray(rfq.items) ? rfq.items : []
    if (items.length > 0) {
      y = sectionTitle(doc, 'Items Required', y)
      const cols = [{ label: '#', w: 25 }, { label: 'Description', w: 240 }, { label: 'Qty', w: 50 }, { label: 'Unit', w: 60 }, { label: 'Specifications', w: 120 }]
      doc.save().rect(50, y, W, 16).fill(C.light).restore()
      let cx = 50
      doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor(C.text)
      cols.forEach(c => { doc.text(c.label, cx + 3, y + 4, { width: c.w - 4, lineBreak: false }); cx += c.w })
      doc.restore()
      y += 16
      items.forEach((item, idx) => {
        cx = 50
        doc.save().font('Helvetica').fontSize(8.5).fillColor(C.text)
        const vals = [String(idx + 1), item.description || item.name || '—', String(item.quantity || '—'), item.unit || '—', item.specifications || '—']
        vals.forEach((v, ci) => { doc.text(v, cx + 3, y + 2, { width: cols[ci].w - 4, lineBreak: false }); cx += cols[ci].w })
        doc.restore()
        hr(doc, y + 14, C.light)
        y += 16
      })
      y += 6
    }

    y = drawSignatures(doc, steps, y + 10)
    drawFooter(doc, 1, rfq.document_number)
  })
}

// ── Delivery / GRN ────────────────────────────────────────────────────────────
async function generateDelivery(deliveryId, companyId) {
  const { rows: [di] } = await query(
    `SELECT di.*,
            po.supplier_name, po.currency, d.document_number AS po_number,
            u.first_name || ' ' || u.last_name AS inspector_name
     FROM delivery_inspections di
     JOIN purchase_orders po ON di.po_id = po.id
     JOIN documents d ON po.document_id = d.id
     JOIN users u ON di.inspected_by = u.id
     WHERE di.id = $1 AND di.company_id = $2`,
    [deliveryId, companyId]
  )
  if (!di) throw new Error('Delivery not found')

  const { company, logo } = await getCompanyAndLogo(companyId)

  return makePDF(async (doc) => {
    let y = await drawLetterhead(doc, company, logo)
    y = drawDocTitle(doc, 'Goods Received Note (GRN)', `GRN-${di.id.slice(0, 8).toUpperCase()}`, di.created_at, y)

    y = sectionTitle(doc, 'Delivery Information', y)
    y = field(doc, 'Purchase Order', di.po_number, 50, y)
    y = field(doc, 'Supplier', di.supplier_name, 50, y)
    y = field(doc, 'Date Received', new Date(di.received_date).toLocaleDateString('en-GB'), 50, y)
    y = field(doc, 'Inspected By', di.inspector_name, 50, y)
    y = field(doc, 'Inspection Outcome', di.inspection_status?.toUpperCase(), 50, y)
    y += 6

    const items = Array.isArray(di.items_received) ? di.items_received : []
    if (items.length > 0) {
      y = sectionTitle(doc, 'Items Received', y)
      const cols = [{ label: '#', w: 25 }, { label: 'Description', w: 180 }, { label: 'Qty Ordered', w: 75 }, { label: 'Qty Received', w: 75 }, { label: 'Condition', w: 70 }, { label: 'Remarks', w: 70 }]
      doc.save().rect(50, y, W, 16).fill(C.light).restore()
      let cx = 50
      doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor(C.text)
      cols.forEach(c => { doc.text(c.label, cx + 3, y + 4, { width: c.w - 4, lineBreak: false }); cx += c.w })
      doc.restore()
      y += 16
      items.forEach((item, idx) => {
        cx = 50
        doc.save().font('Helvetica').fontSize(8.5).fillColor(C.text)
        const vals = [String(idx + 1), item.description || '—', String(item.quantityOrdered || '—'), String(item.quantityReceived || '—'), item.condition || '—', item.remarks || '—']
        vals.forEach((v, ci) => { doc.text(v, cx + 3, y + 2, { width: cols[ci].w - 4, lineBreak: false }); cx += cols[ci].w })
        doc.restore()
        hr(doc, y + 14, C.light)
        y += 16
      })
      y += 6
    }

    if (di.inspection_notes) {
      y = sectionTitle(doc, 'Inspection Notes', y)
      doc.font('Helvetica').fontSize(9).fillColor(C.text).text(di.inspection_notes, 54, y, { width: W - 8 })
      y = doc.y + 10
    }

    // Manual signature blocks for delivery
    const signers = [
      { step_name: 'Procurement Officer', status: null, assigned_user_name: di.inspector_name },
      { step_name: 'Vendor Representative', status: null, assigned_user_name: '' },
    ]
    y = drawSignatures(doc, signers, y + 10)
    drawFooter(doc, 1, `GRN-${di.id.slice(0, 8).toUpperCase()}`)
  })
}

// ── Bid Analysis Report ────────────────────────────────────────────────────────
async function generateBidAnalysis(baId, companyId) {
  const { rows: [ba] } = await query(
    `SELECT ba.*, d.document_number AS rfq_number, d.title AS rfq_title, d.created_at AS rfq_date,
            rs.name AS rec_supplier_name,
            u.first_name || ' ' || u.last_name AS created_by_name
     FROM bid_analysis ba
     JOIN rfq r ON ba.rfq_id = r.id
     JOIN documents d ON r.document_id = d.id
     LEFT JOIN suppliers rs ON ba.recommended_supplier_id = rs.id
     LEFT JOIN users u ON ba.created_by = u.id
     WHERE ba.id = $1 AND ba.company_id = $2`,
    [baId, companyId]
  )
  if (!ba) throw new Error('Bid analysis not found')

  const { rows: quotes } = await query(
    `SELECT sq.*, COALESCE(s.name, sq.supplier_name) AS display_name
     FROM supplier_quotes sq LEFT JOIN suppliers s ON sq.supplier_id = s.id
     WHERE sq.rfq_id = $1 ORDER BY sq.total_amount ASC NULLS LAST`,
    [ba.rfq_id]
  )

  const { company, logo } = await getCompanyAndLogo(companyId)

  return makePDF(async (doc) => {
    let y = await drawLetterhead(doc, company, logo)
    y = drawDocTitle(doc, 'Bid Analysis Report', ba.rfq_number, ba.created_at, y)

    y = sectionTitle(doc, 'Summary', y)
    y = field(doc, 'RFQ Reference', ba.rfq_number, 50, y)
    y = field(doc, 'Prepared By', ba.created_by_name, 50, y)
    y = field(doc, 'Status', ba.status?.toUpperCase(), 50, y)
    y = field(doc, 'Recommended Supplier', ba.rec_supplier_name, 50, y)
    y += 6

    if (quotes.length > 0) {
      y = sectionTitle(doc, 'Quotation Comparison', y)
      const cols = [{ label: 'Supplier', w: 160 }, { label: 'Currency', w: 55 }, { label: 'Total Amount', w: 100 }, { label: 'Delivery Days', w: 80 }, { label: 'Payment Terms', w: 100 }]
      doc.save().rect(50, y, W, 16).fill(C.light).restore()
      let cx = 50
      doc.save().font('Helvetica-Bold').fontSize(7.5).fillColor(C.text)
      cols.forEach(c => { doc.text(c.label, cx + 3, y + 4, { width: c.w - 4, lineBreak: false }); cx += c.w })
      doc.restore()
      y += 16

      quotes.forEach((q, idx) => {
        const isRec = ba.recommended_quote_id === q.id
        if (isRec) { doc.save().rect(50, y, W, 16).fill('#eff6ff').restore() }
        cx = 50
        doc.save().font(isRec ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(isRec ? C.accent : C.text)
        const vals = [
          (isRec ? '★ ' : '') + (q.display_name || '—'),
          q.currency || '—',
          q.total_amount != null ? Number(q.total_amount).toLocaleString() : '—',
          q.delivery_days ? `${q.delivery_days} days` : '—',
          q.payment_terms || '—',
        ]
        vals.forEach((v, ci) => { doc.text(v, cx + 3, y + 3, { width: cols[ci].w - 4, lineBreak: false }); cx += cols[ci].w })
        doc.restore()
        hr(doc, y + 16, C.light)
        y += 18
      })
      y += 6
    }

    if (ba.committee_notes) {
      y = sectionTitle(doc, 'Committee Notes', y)
      doc.font('Helvetica').fontSize(9).fillColor(C.text).text(ba.committee_notes, 54, y, { width: W - 8 })
      y = doc.y + 10
    }

    if (ba.override_justification) {
      y = sectionTitle(doc, 'Override Justification', y)
      doc.font('Helvetica').fontSize(9).fillColor(C.text).text(ba.override_justification, 54, y, { width: W - 8 })
      y = doc.y + 10
    }

    const signers = [
      { step_name: 'Evaluation Committee', status: ba.status === 'approved' ? 'completed' : null, assigned_user_name: ba.created_by_name },
      { step_name: 'Chairperson', status: ba.status === 'approved' ? 'completed' : null, assigned_user_name: '' },
    ]
    y = drawSignatures(doc, signers, y + 10)
    drawFooter(doc, 1, ba.rfq_number)
  })
}

module.exports = { generatePR, generatePayment, generatePO, generateTravel, generateRFQ, generateDelivery, generateBidAnalysis }
