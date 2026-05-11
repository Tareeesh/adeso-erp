const PDFDocument = require('pdfkit')
const { query } = require('../config/database')
const { uploadFile, getFileUrl } = require('../config/storage')

const BRAND_COLOR = '#1d4ed8'
const GRAY = '#64748b'

const generateDocumentPDF = async (documentId) => {
  const { rows: [doc] } = await query(
    `SELECT d.*, c.name AS company_name, c.logo_url, c.address AS company_address,
            u.first_name || ' ' || u.last_name AS created_by_name
     FROM documents d
     JOIN companies c ON d.company_id = c.id
     JOIN users u ON d.created_by = u.id
     WHERE d.id=$1`,
    [documentId]
  )
  if (!doc) throw new Error('Document not found')

  const { rows: steps } = await query(
    `SELECT ws.*, u.first_name || ' ' || u.last_name AS signer_name,
            s.signature_data, s.signature_type, s.typed_name, s.signed_at
     FROM workflow_steps ws
     LEFT JOIN users u ON ws.assigned_user_id = u.id
     LEFT JOIN signatures s ON s.workflow_step_id = ws.id
     WHERE ws.document_id=$1 ORDER BY ws.step_number`,
    [documentId]
  )

  const pdf = new PDFDocument({ margin: 50, size: 'A4' })
  const chunks = []
  pdf.on('data', chunk => chunks.push(chunk))

  await new Promise((resolve, reject) => {
    pdf.on('end', resolve)
    pdf.on('error', reject)

    const meta = typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : (doc.metadata || {})

    if (doc.document_type === 'payment_requisition') {
      // ── PAYMENT REQUISITION layout ──────────────────────────────────────

      // Header band
      pdf.rect(0, 0, pdf.page.width, 90).fill(BRAND_COLOR)
      pdf.fillColor('white').fontSize(20).font('Helvetica-Bold')
      pdf.text('PAYMENT REQUISITION', 50, 22)
      pdf.fontSize(10).font('Helvetica').fillColor('#bfdbfe')
      pdf.text(doc.company_name, 50, 50)
      // Right-side ref block
      pdf.fontSize(9).fillColor('#bfdbfe').text('Document No.', pdf.page.width - 180, 22, { width: 130, align: 'right' })
      pdf.fontSize(14).font('Helvetica-Bold').fillColor('white')
      pdf.text(doc.document_number, pdf.page.width - 180, 36, { width: 130, align: 'right' })
      pdf.fontSize(9).font('Helvetica').fillColor('#bfdbfe')
      pdf.text(new Date(doc.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), pdf.page.width - 180, 56, { width: 130, align: 'right' })
      pdf.fillColor('black')

      pdf.y = 110

      // Status bar
      const statusColor = doc.status === 'completed' ? '#16a34a' : doc.status === 'rejected' ? '#dc2626' : '#d97706'
      pdf.fontSize(9).fillColor(statusColor).font('Helvetica-Bold')
      pdf.text(`STATUS: ${doc.status.toUpperCase().replace(/_/g, ' ')}`, 50, pdf.y, { align: 'right' })
      pdf.moveDown(1)

      // ── PAYEE section ──
      const sectionY = (label) => {
        pdf.fontSize(8).fillColor('#64748b').font('Helvetica-Bold')
        pdf.text(label.toUpperCase(), 50, pdf.y, { characterSpacing: 1 })
        pdf.moveTo(50, pdf.y).lineTo(545, pdf.y).strokeColor(BRAND_COLOR).lineWidth(0.5).stroke()
        pdf.moveDown(0.5)
        pdf.fontSize(10).fillColor('black').font('Helvetica')
      }

      const field = (label, value, x, y, width) => {
        pdf.fontSize(8).fillColor(GRAY).font('Helvetica').text(label, x, y, { width })
        pdf.fontSize(10).fillColor('black').font('Helvetica-Bold')
        pdf.text(value || '—', x, y + 12, { width })
      }

      sectionY('Payee Information')
      const py = pdf.y
      field('Payee / Vendor Name', meta.payeeName, 50, py, 200)
      field('Bank Name', meta.payeeBank, 260, py, 150)
      field('Account / Reference No.', meta.payeeAccount, 420, py, 125)
      pdf.y = py + 42

      pdf.moveDown(1)
      sectionY('Payment Details')

      const amountStr = meta.amount != null
        ? `${meta.currency || 'KES'} ${Number(meta.amount).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
        : '—'

      // Amount — large
      pdf.fontSize(9).fillColor(GRAY).font('Helvetica').text('AMOUNT', 50, pdf.y)
      pdf.fontSize(22).fillColor(BRAND_COLOR).font('Helvetica-Bold')
      pdf.text(amountStr, 50, pdf.y + 10)
      const amountBlockBottom = pdf.y + 8

      // Method + Budget
      const detailY = amountBlockBottom - 38
      field('Payment Method', (meta.paymentMethod || '').replace(/_/g, ' '), 280, detailY, 120)
      field('Budget Line', meta.budgetLine, 420, detailY, 125)
      if (meta.poReference) {
        field('PO Reference', meta.poReference, 280, detailY + 36, 265)
      }
      pdf.y = amountBlockBottom + 8

      // Purpose
      pdf.fontSize(8).fillColor(GRAY).font('Helvetica').text('PURPOSE OF PAYMENT', 50, pdf.y)
      pdf.moveDown(0.3)
      pdf.fontSize(10).fillColor('black').font('Helvetica').text(meta.paymentPurpose || '—', 50, pdf.y, { width: 495 })
      pdf.moveDown(1.5)

      // Certification
      pdf.rect(50, pdf.y, 495, 40).fillAndStroke('#f8fafc', '#e2e8f0')
      pdf.fontSize(9).fillColor(GRAY).font('Helvetica-Oblique')
      pdf.text(
        'I hereby certify that the above payment is correct, properly authorised, and in accordance with ADESO financial policies and donor requirements.',
        58, pdf.y + 4, { width: 479 }
      )
      pdf.y += 50
    } else {
      // ── GENERIC layout (all other document types) ────────────────────────

      // Header band
      pdf.rect(0, 0, pdf.page.width, 80).fill(BRAND_COLOR)
      pdf.fillColor('white').fontSize(18).font('Helvetica-Bold')
      pdf.text(doc.company_name, 50, 25)
      pdf.fontSize(11).font('Helvetica').text(doc.document_type.replace(/_/g, ' ').toUpperCase(), 50, 50)
      pdf.fillColor('black')

      pdf.moveDown(2)

      // Document info
      pdf.fontSize(10).fillColor(GRAY).text(`Reference: ${doc.document_number}   |   Date: ${new Date(doc.created_at).toLocaleDateString('en-GB')}   |   Status: ${doc.status.toUpperCase()}`)
      pdf.moveDown()

      pdf.fontSize(14).fillColor(BRAND_COLOR).font('Helvetica-Bold').text(doc.title)
      pdf.moveDown(0.5)

      // Metadata
      if (meta && Object.keys(meta).length > 0) {
        pdf.fontSize(10).fillColor('black').font('Helvetica')
        Object.entries(meta).forEach(([key, val]) => {
          if (val && typeof val !== 'object') {
            pdf.text(`${key.replace(/_/g, ' ')}: ${val}`)
          }
        })
      }

      pdf.moveDown(2)
    }

    // ── APPROVAL & SIGNATURE TRAIL (all types) ───────────────────────────
    pdf.fontSize(12).fillColor(BRAND_COLOR).font('Helvetica-Bold').text('APPROVAL & SIGNATURE TRAIL')
    pdf.moveDown(0.5)
    pdf.moveTo(50, pdf.y).lineTo(545, pdf.y).stroke(BRAND_COLOR)
    pdf.moveDown(0.5)

    steps.forEach((step, i) => {
      pdf.fontSize(10).fillColor('black').font('Helvetica-Bold')
      pdf.text(`Step ${step.step_number}: ${step.step_name}`)
      pdf.font('Helvetica').fillColor(GRAY)
      pdf.text(`Assigned to: ${step.signer_name || 'Pending assignment'}`)

      if (step.signed_at) {
        pdf.text(`Signed: ${new Date(step.signed_at).toLocaleString('en-GB')}`)
        if (step.typed_name) pdf.text(`Name: ${step.typed_name}`)
        if (step.signature_type === 'typed') {
          pdf.fillColor(BRAND_COLOR).fontSize(14).font('Helvetica-BoldOblique')
          pdf.text(step.typed_name || step.signer_name)
          pdf.font('Helvetica').fontSize(10).fillColor('black')
        }
      } else {
        pdf.fillColor(step.status === 'pending' ? '#94a3b8' : '#f59e0b')
        pdf.text(`Status: ${step.status.toUpperCase()}`)
        pdf.fillColor('black')
      }
      pdf.moveDown(0.5)
      pdf.moveTo(50, pdf.y).lineTo(545, pdf.y).strokeColor('#e2e8f0').stroke()
      pdf.moveDown(0.5)
    })

    // Footer
    pdf.moveDown(2)
    pdf.fontSize(8).fillColor(GRAY)
    pdf.text(`Generated by ${process.env.APP_NAME || 'ERP System'} on ${new Date().toLocaleString('en-GB')}`, { align: 'center' })

    pdf.end()
  })

  const buffer = Buffer.concat(chunks)
  const key = await uploadFile(buffer, `${doc.document_number}.pdf`, `pdfs/${documentId}`)

  await query('UPDATE documents SET generated_pdf_url=$1 WHERE id=$2', [key, documentId])

  return key
}

module.exports = { generateDocumentPDF }
