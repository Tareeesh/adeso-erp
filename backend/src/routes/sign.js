const express = require('express')
const router = express.Router()
const { asyncHandler } = require('../middleware/errorHandler')
const { query } = require('../config/database')
const { sendWorkflowNotification, sendExternalSignNotification } = require('../services/emailService')

// GET /api/sign/:token — public, no auth
router.get('/:token', asyncHandler(async (req, res) => {
  const { rows: [step] } = await query(
    `SELECT ws.id, ws.step_number, ws.step_name, ws.status, ws.external_name,
            d.id AS document_id, d.title, d.document_number, d.document_type, d.status AS doc_status,
            d.metadata
     FROM workflow_steps ws
     JOIN documents d ON ws.document_id = d.id
     WHERE ws.external_token = $1`,
    [req.params.token]
  )
  if (!step) return res.status(404).json({ error: 'Invalid or expired signing link' })
  if (step.status === 'completed') return res.status(400).json({ error: 'already_signed', message: 'This document has already been signed' })
  if (step.status !== 'in_progress') return res.status(400).json({ error: 'not_ready', message: 'This document is not yet ready for your signature' })

  res.json({
    step: { id: step.id, stepName: step.step_name, externalName: step.external_name },
    document: { title: step.title, documentNumber: step.document_number, documentType: step.document_type },
  })
}))

// POST /api/sign/:token — submit external signature
router.post('/:token', asyncHandler(async (req, res) => {
  const { typedName } = req.body
  if (!typedName || typedName.trim().length < 2) return res.status(400).json({ error: 'Please type your full name to sign' })

  const { rows: [step] } = await query(
    `SELECT ws.*, d.company_id, d.title, d.document_number, d.document_type,
            d.total_steps, d.current_step, d.created_by
     FROM workflow_steps ws
     JOIN documents d ON ws.document_id = d.id
     WHERE ws.external_token = $1 AND ws.status = 'in_progress'`,
    [req.params.token]
  )
  if (!step) return res.status(404).json({ error: 'Invalid link or already signed' })

  await query(
    `UPDATE workflow_steps SET status='completed', action_taken='signed',
     comments=$1, completed_at=NOW() WHERE id=$2`,
    [`Signed by ${typedName.trim()} via secure link`, step.id]
  )

  const nextStepNumber = step.current_step + 1

  if (nextStepNumber > step.total_steps) {
    await query(`UPDATE documents SET status='completed', completed_at=NOW() WHERE id=$1`, [step.document_id])

    const { rows: allSteps } = await query(
      'SELECT DISTINCT assigned_user_id FROM workflow_steps WHERE document_id=$1 AND assigned_user_id IS NOT NULL',
      [step.document_id]
    )
    const recipients = [...new Set([...allSteps.map(s => s.assigned_user_id), step.created_by])]
    for (const uid of recipients) {
      if (uid) {
        await sendWorkflowNotification({
          documentId: step.document_id, stepId: step.id, recipientUserId: uid,
          type: 'workflowCompleted',
          data: { documentTitle: step.title, documentNumber: step.document_number, documentType: step.document_type, companyId: step.company_id },
        }).catch(() => {})
      }
    }
  } else {
    await query(`UPDATE documents SET current_step=$1 WHERE id=$2`, [nextStepNumber, step.document_id])
    const { rows: [nextStep] } = await query(
      `UPDATE workflow_steps SET status='in_progress' WHERE document_id=$1 AND step_number=$2 RETURNING *`,
      [step.document_id, nextStepNumber]
    )
    if (nextStep?.external_email) {
      await sendExternalSignNotification({
        email: nextStep.external_email, name: nextStep.external_name,
        token: nextStep.external_token,
        documentTitle: step.title, documentNumber: step.document_number, documentType: step.document_type,
      }).catch(() => {})
    } else if (nextStep?.assigned_user_id) {
      await sendWorkflowNotification({
        documentId: step.document_id, stepId: nextStep.id, recipientUserId: nextStep.assigned_user_id,
        type: 'workflowAction',
        data: { documentTitle: step.title, documentNumber: step.document_number, documentType: step.document_type, companyId: step.company_id, action: nextStep.step_name },
      }).catch(() => {})
    }
  }

  res.json({ message: 'Document signed successfully. Thank you.' })
}))

module.exports = router
