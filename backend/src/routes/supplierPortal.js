const express = require('express')
const router = express.Router()
const { v4: uuidv4 } = require('uuid')
const { authenticate } = require('../middleware/auth')
const { asyncHandler } = require('../middleware/errorHandler')
const { query } = require('../config/database')
const { sendEmail } = require('../config/email')
const { templates } = require('../services/emailService')
const { upload } = require('../middleware/upload')
const { uploadFile } = require('../config/storage')

// Create supplier portal link (Operations user only)
router.post('/links', authenticate, asyncHandler(async (req, res) => {
  const { documentId, supplierEmail, supplierName, purpose } = req.body
  const token = uuidv4() + '-' + uuidv4()

  const { rows: [link] } = await query(
    `INSERT INTO supplier_portal_links (token, document_id, company_id, supplier_email, supplier_name, purpose, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [token, documentId, req.user.companyId, supplierEmail, supplierName, purpose, req.user.id]
  )

  const portalUrl = `${process.env.APP_URL}/supplier-portal/${token}`

  // Fetch RFQ details for email
  const { rows: [doc] } = await query('SELECT * FROM documents WHERE id=$1', [documentId])
  const { rows: [company] } = await query('SELECT name FROM companies WHERE id=$1', [req.user.companyId])

  const template = templates.supplierRFQ({
    supplierName: supplierName || supplierEmail,
    companyName: company.name,
    rfqNumber: doc.document_number,
    deadline: req.body.deadline || 'As soon as possible',
    portalLink: portalUrl,
  })

  await sendEmail({ to: supplierEmail, ...template })

  res.json({ link, portalUrl })
}))

// Close a supplier portal link manually
router.put('/links/:id/close', authenticate, asyncHandler(async (req, res) => {
  const { rows: [link] } = await query(
    `UPDATE supplier_portal_links SET status='closed', closed_by=$1, closed_at=NOW()
     WHERE id=$2 AND company_id=$3 RETURNING *`,
    [req.user.id, req.params.id, req.user.companyId]
  )
  if (!link) return res.status(404).json({ error: 'Link not found' })
  res.json(link)
}))

// Public: supplier accesses their portal (no auth)
router.get('/access/:token', asyncHandler(async (req, res) => {
  const { rows: [link] } = await query(
    `SELECT spl.*, d.title, d.document_number, d.document_type, d.metadata,
            c.name AS company_name, c.logo_url
     FROM supplier_portal_links spl
     JOIN documents d ON spl.document_id = d.id
     JOIN companies c ON spl.company_id = c.id
     WHERE spl.token=$1`,
    [req.params.token]
  )

  if (!link) return res.status(404).json({ error: 'Invalid link' })
  if (link.status === 'closed') return res.status(403).json({ error: 'This link has been closed by the issuer' })
  if (link.status === 'completed') return res.status(403).json({ error: 'You have already submitted a response for this link' })

  await query('UPDATE supplier_portal_links SET accessed_at=NOW() WHERE token=$1', [req.params.token])

  const { rows: rfqItems } = await query(
    'SELECT items FROM rfq WHERE document_id=$1',
    [link.document_id]
  )

  res.json({ link, rfqItems: rfqItems[0]?.items || [] })
}))

// Public: supplier submits quote
router.post('/submit/:token', upload.array('attachments', 10), asyncHandler(async (req, res) => {
  const { rows: [link] } = await query(
    'SELECT * FROM supplier_portal_links WHERE token=$1 AND status=\'active\'',
    [req.params.token]
  )

  if (!link) return res.status(403).json({ error: 'Invalid or expired link' })

  const { rows: [rfq] } = await query('SELECT id FROM rfq WHERE document_id=$1', [link.document_id])
  if (!rfq) return res.status(400).json({ error: 'RFQ not found' })

  const attachmentUrls = []
  if (req.files?.length > 0) {
    for (const file of req.files) {
      const key = await uploadFile(file.buffer, file.originalname, `supplier-quotes/${link.id}`)
      attachmentUrls.push({ name: file.originalname, url: key })
    }
  }

  const { rows: [quote] } = await query(
    `INSERT INTO supplier_quotes (rfq_id, supplier_portal_link_id, company_id, supplier_name, supplier_email, currency, total_amount, delivery_days, validity_days, payment_terms, items, notes, attachments)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [
      rfq.id, link.id, link.company_id,
      link.supplier_name, link.supplier_email,
      req.body.currency || 'KES',
      req.body.totalAmount,
      req.body.deliveryDays,
      req.body.validityDays,
      req.body.paymentTerms,
      JSON.stringify(JSON.parse(req.body.items || '[]')),
      req.body.notes,
      JSON.stringify(attachmentUrls),
    ]
  )

  await query(
    'UPDATE supplier_portal_links SET status=\'completed\', completed_at=NOW() WHERE token=$1',
    [req.params.token]
  )

  res.json({ message: 'Quote submitted successfully. Thank you.', quoteId: quote.id })
}))

module.exports = router
