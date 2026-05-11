const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const { asyncHandler } = require('../middleware/errorHandler')
const { upload } = require('../middleware/upload')
const { uploadFile, getFileUrl } = require('../config/storage')
const { query } = require('../config/database')
const { sendSignDocNotification } = require('../services/emailService')

// GET / - list documents
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT sd.id, sd.title, sd.status, sd.file_name, sd.created_at, sd.completed_at,
     u.first_name || ' ' || u.last_name AS created_by_name,
     COUNT(DISTINCT sr.id) AS recipient_count,
     COUNT(DISTINCT CASE WHEN sr.status='completed' THEN sr.id END) AS signed_count
     FROM sign_documents sd
     LEFT JOIN users u ON sd.created_by = u.id
     LEFT JOIN sign_recipients sr ON sr.document_id = sd.id
     WHERE sd.company_id = $1
     GROUP BY sd.id, u.first_name, u.last_name
     ORDER BY sd.created_at DESC`,
    [req.user.companyId]
  )
  res.json(rows)
}))

// POST / - upload new document
router.post('/', authenticate, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' })
  const { title } = req.body
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' })
  if (req.file.mimetype !== 'application/pdf') return res.status(400).json({ error: 'Only PDF files are supported' })

  const key = await uploadFile(req.file.buffer, req.file.originalname, 'sign-documents')
  const { rows: [doc] } = await query(
    `INSERT INTO sign_documents (company_id, created_by, title, file_url, file_name, file_type)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.companyId, req.user.id, title.trim(), key, req.file.originalname, req.file.mimetype]
  )
  res.status(201).json(doc)
}))

// GET /:id - get document with recipients and fields
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const { rows: [doc] } = await query(
    `SELECT * FROM sign_documents WHERE id=$1 AND company_id=$2`,
    [req.params.id, req.user.companyId]
  )
  if (!doc) return res.status(404).json({ error: 'Document not found' })

  const [{ rows: recipients }, { rows: fields }] = await Promise.all([
    query(`SELECT * FROM sign_recipients WHERE document_id=$1 ORDER BY order_num`, [req.params.id]),
    query(
      `SELECT sf.*, sr.name AS recipient_name FROM sign_fields sf
       JOIN sign_recipients sr ON sf.recipient_id=sr.id
       WHERE sf.document_id=$1 ORDER BY sf.page_number, sf.y_pct`,
      [req.params.id]
    ),
  ])

  const [fileUrl, finalUrl] = await Promise.all([
    getFileUrl(doc.file_url, 7200),
    doc.final_pdf_url ? getFileUrl(doc.final_pdf_url, 7200) : Promise.resolve(null),
  ])

  res.json({ ...doc, file_url_signed: fileUrl, final_pdf_url_signed: finalUrl, recipients, fields })
}))

// PUT /:id/recipients — save recipients + fields (replaces existing)
router.put('/:id/recipients', authenticate, asyncHandler(async (req, res) => {
  const { recipients = [], fields = [] } = req.body

  const { rows: [doc] } = await query(
    `SELECT id FROM sign_documents WHERE id=$1 AND company_id=$2 AND status='draft'`,
    [req.params.id, req.user.companyId]
  )
  if (!doc) return res.status(404).json({ error: 'Document not found or not editable' })

  // Delete all existing recipients (cascades to fields)
  await query(`DELETE FROM sign_recipients WHERE document_id=$1`, [req.params.id])

  const recipientIds = []
  for (const r of recipients) {
    const { rows: [rec] } = await query(
      `INSERT INTO sign_recipients (document_id, name, email, order_num)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [req.params.id, r.name.trim(), r.email.trim().toLowerCase(), r.order_num || recipientIds.length + 1]
    )
    recipientIds.push(rec.id)
  }

  for (const f of fields) {
    const rid = recipientIds[f.recipient_index]
    if (!rid) continue
    await query(
      `INSERT INTO sign_fields (document_id, recipient_id, page_number, x_pct, y_pct, w_pct, h_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [req.params.id, rid, f.page_number, f.x_pct, f.y_pct, f.w_pct, f.h_pct]
    )
  }

  res.json({ success: true, recipientCount: recipientIds.length, fieldCount: fields.length })
}))

// POST /:id/send — send to first recipient
router.post('/:id/send', authenticate, asyncHandler(async (req, res) => {
  const { rows: [doc] } = await query(
    `SELECT * FROM sign_documents WHERE id=$1 AND company_id=$2 AND status='draft'`,
    [req.params.id, req.user.companyId]
  )
  if (!doc) return res.status(404).json({ error: 'Document not found or already sent' })

  const { rows: recipients } = await query(
    `SELECT * FROM sign_recipients WHERE document_id=$1 ORDER BY order_num`, [req.params.id]
  )
  if (recipients.length === 0) return res.status(400).json({ error: 'Add at least one recipient before sending' })

  const { rows: fields } = await query(
    `SELECT id FROM sign_fields WHERE document_id=$1 LIMIT 1`, [req.params.id]
  )
  if (fields.length === 0) return res.status(400).json({ error: 'Add at least one signature field before sending' })

  await query(`UPDATE sign_documents SET status='sent' WHERE id=$1`, [req.params.id])

  // Send to first recipient (lowest order_num)
  const first = recipients.reduce((a, b) => a.order_num <= b.order_num ? a : b)
  await sendSignDocNotification({ email: first.email, name: first.name, token: first.sign_token, documentTitle: doc.title }).catch(() => {})

  res.json({ success: true })
}))

// DELETE /:id
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  const { rows: [doc] } = await query(
    `DELETE FROM sign_documents WHERE id=$1 AND company_id=$2 RETURNING id`,
    [req.params.id, req.user.companyId]
  )
  if (!doc) return res.status(404).json({ error: 'Document not found' })
  res.json({ success: true })
}))

module.exports = router
