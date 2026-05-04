const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const { asyncHandler } = require('../middleware/errorHandler')
const { submitWorkflow, processStep, getDocumentWithSteps } = require('../services/workflowEngine')
const { generateDocumentPDF } = require('../services/pdfService')
const { upload } = require('../middleware/upload')
const { uploadFile, getFileUrl } = require('../config/storage')
const { query } = require('../config/database')

router.get('/my-tasks', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT ws.*, d.title, d.document_number, d.document_type, d.status AS doc_status,
            d.created_at AS doc_created_at, u.first_name || ' ' || u.last_name AS created_by_name
     FROM workflow_steps ws
     JOIN documents d ON ws.document_id = d.id
     JOIN users u ON d.created_by = u.id
     WHERE ws.assigned_user_id=$1 AND ws.status='in_progress'
       AND d.status NOT IN ('deleted','cancelled')
     ORDER BY d.created_at DESC`,
    [req.user.id]
  )
  res.json(rows)
}))

router.get('/my-documents', authenticate, asyncHandler(async (req, res) => {
  const { status, type, page = 1, limit = 20 } = req.query
  const offset = (page - 1) * limit
  const conditions = ['d.company_id=$1', "d.status != 'deleted'"]
  const params = [req.user.companyId]

  if (req.query.mine === 'true') {
    conditions.push(`d.created_by=$${params.push(req.user.id)}`)
  }
  if (status) conditions.push(`d.status=$${params.push(status)}`)
  if (type) conditions.push(`d.document_type=$${params.push(type)}`)

  const { rows } = await query(
    `SELECT d.*, u.first_name || ' ' || u.last_name AS created_by_name
     FROM documents d JOIN users u ON d.created_by=u.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY d.created_at DESC LIMIT $${params.push(limit)} OFFSET $${params.push(offset)}`,
    params
  )
  res.json(rows)
}))

router.get('/:documentId', authenticate, asyncHandler(async (req, res) => {
  const doc = await getDocumentWithSteps(req.params.documentId, req.user.id)
  if (!doc) return res.status(404).json({ error: 'Document not found' })
  res.json(doc)
}))

router.post('/:documentId/submit', authenticate, asyncHandler(async (req, res) => {
  const result = await submitWorkflow({ documentId: req.params.documentId, userId: req.user.id, req })
  res.json(result)
}))

router.post('/:documentId/steps/:stepId/approve', authenticate, asyncHandler(async (req, res) => {
  const result = await processStep({
    documentId: req.params.documentId, stepId: req.params.stepId,
    userId: req.user.id, action: 'approve', comments: req.body.comments, req,
  })
  res.json(result)
}))

router.post('/:documentId/steps/:stepId/reject', authenticate, asyncHandler(async (req, res) => {
  if (!req.body.comments) return res.status(400).json({ error: 'Rejection reason required' })
  const result = await processStep({
    documentId: req.params.documentId, stepId: req.params.stepId,
    userId: req.user.id, action: 'reject', comments: req.body.comments, req,
  })
  res.json(result)
}))

router.post('/:documentId/attachments', authenticate, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' })
  const key = await uploadFile(req.file.buffer, req.file.originalname, `attachments/${req.params.documentId}`)
  const { rows: [att] } = await query(
    `INSERT INTO document_attachments (document_id, workflow_step_id, uploaded_by, file_name, file_url, file_size, file_type, attachment_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.params.documentId, req.body.stepId || null, req.user.id, req.file.originalname, key, req.file.size, req.file.mimetype, req.body.attachmentType || 'supporting']
  )
  res.json(att)
}))

router.post('/:documentId/comments', authenticate, asyncHandler(async (req, res) => {
  const { rows: [comment] } = await query(
    `INSERT INTO document_comments (document_id, user_id, workflow_step_id, comment, is_internal)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.params.documentId, req.user.id, req.body.stepId || null, req.body.comment, req.body.isInternal || false]
  )
  res.json(comment)
}))

router.get('/:documentId/pdf', authenticate, asyncHandler(async (req, res) => {
  const key = await generateDocumentPDF(req.params.documentId)
  const url = await getFileUrl(key, 3600)
  res.json({ url })
}))

module.exports = router
