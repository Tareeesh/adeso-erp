const express = require('express')
const router = express.Router()
const { asyncHandler } = require('../middleware/errorHandler')
const { query } = require('../config/database')
const { getFileUrl } = require('../config/storage')
const { embedSignatures } = require('../services/signEmbedService')
const { sendSignDocNotification } = require('../services/emailService')

// GET /:token — get signing page data
router.get('/:token', asyncHandler(async (req, res) => {
  const { rows: [recipient] } = await query(
    `SELECT sr.*, sd.title, sd.file_url, sd.status AS doc_status
     FROM sign_recipients sr
     JOIN sign_documents sd ON sr.document_id = sd.id
     WHERE sr.sign_token = $1`,
    [req.params.token]
  )
  if (!recipient) return res.status(404).json({ error: 'invalid_token', message: 'This link is invalid or has expired' })
  if (recipient.status === 'completed') return res.status(400).json({ error: 'already_signed', message: 'You have already signed this document' })

  // Check sequential order — ensure previous recipients have signed
  const { rows: [prev] } = await query(
    `SELECT status FROM sign_recipients WHERE document_id=$1 AND order_num < $2 ORDER BY order_num DESC LIMIT 1`,
    [recipient.document_id, recipient.order_num]
  )
  if (prev && prev.status !== 'completed') {
    return res.status(400).json({ error: 'not_ready', message: 'Waiting for earlier signers to complete first' })
  }

  const { rows: fields } = await query(
    `SELECT * FROM sign_fields WHERE document_id=$1 AND recipient_id=$2 ORDER BY page_number, y_pct`,
    [recipient.document_id, recipient.id]
  )

  const fileUrl = await getFileUrl(recipient.file_url, 7200)

  res.json({
    recipient: { id: recipient.id, name: recipient.name, email: recipient.email },
    documentTitle: recipient.title,
    documentId: recipient.document_id,
    fileUrl,
    fields,
  })
}))

// POST /:token — submit signature
router.post('/:token', asyncHandler(async (req, res) => {
  const { signatureData, signatureType, typedName } = req.body
  if (!signatureData) return res.status(400).json({ error: 'Signature is required' })

  const { rows: [recipient] } = await query(
    `SELECT sr.*, sd.title, sd.file_url
     FROM sign_recipients sr
     JOIN sign_documents sd ON sr.document_id = sd.id
     WHERE sr.sign_token = $1 AND sr.status != 'completed'`,
    [req.params.token]
  )
  if (!recipient) return res.status(404).json({ error: 'Invalid link or already signed' })

  // Save signature
  const storedData = signatureType === 'typed' ? (typedName || signatureData) : signatureData
  await query(
    `UPDATE sign_recipients SET status='completed', signed_at=NOW(), signature_data=$1, signature_type=$2 WHERE id=$3`,
    [storedData, signatureType || 'typed', recipient.id]
  )

  // Count remaining
  const { rows: [{ cnt }] } = await query(
    `SELECT COUNT(*) AS cnt FROM sign_recipients WHERE document_id=$1 AND status!='completed'`,
    [recipient.document_id]
  )

  if (parseInt(cnt) === 0) {
    // All signed — embed and finalize
    try {
      const finalKey = await embedSignatures(recipient.document_id)
      await query(
        `UPDATE sign_documents SET status='completed', completed_at=NOW(), final_pdf_url=$1 WHERE id=$2`,
        [finalKey, recipient.document_id]
      )
    } catch (err) {
      console.error('Embed error:', err)
      await query(`UPDATE sign_documents SET status='completed', completed_at=NOW() WHERE id=$1`, [recipient.document_id])
    }
  } else {
    // Send to next
    const { rows: [next] } = await query(
      `SELECT * FROM sign_recipients WHERE document_id=$1 AND status='pending' ORDER BY order_num LIMIT 1`,
      [recipient.document_id]
    )
    if (next) {
      await sendSignDocNotification({
        email: next.email, name: next.name, token: next.sign_token, documentTitle: recipient.title,
      }).catch(() => {})
    }
  }

  res.json({ message: 'Signed successfully. Thank you.' })
}))

module.exports = router
