const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const { asyncHandler } = require('../middleware/errorHandler')
const { upload } = require('../middleware/upload')
const { uploadFile, getFileUrl } = require('../config/storage')
const { query } = require('../config/database')

router.get('/:recordType/:recordId', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM record_attachments
     WHERE company_id=$1 AND record_type=$2 AND record_id=$3
     ORDER BY created_at DESC`,
    [req.user.companyId, req.params.recordType, req.params.recordId]
  )
  const withUrls = await Promise.all(rows.map(async att => ({
    ...att,
    download_url: await getFileUrl(att.file_url),
  })))
  res.json(withUrls)
}))

router.post('/:recordType/:recordId', authenticate, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' })
  const { recordType, recordId } = req.params
  const key = await uploadFile(req.file.buffer, req.file.originalname, `attachments/${recordType}/${recordId}`)
  const { rows: [att] } = await query(
    `INSERT INTO record_attachments (company_id, record_type, record_id, uploaded_by, file_name, file_url, file_size, file_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.user.companyId, recordType, recordId, req.user.id, req.file.originalname, key, req.file.size, req.file.mimetype]
  )
  res.json({ ...att, download_url: await getFileUrl(key) })
}))

router.delete('/:attachmentId', authenticate, asyncHandler(async (req, res) => {
  const { rows: [att] } = await query(
    `DELETE FROM record_attachments WHERE id=$1 AND company_id=$2 RETURNING id`,
    [req.params.attachmentId, req.user.companyId]
  )
  if (!att) return res.status(404).json({ error: 'Attachment not found' })
  res.json({ success: true })
}))

module.exports = router
