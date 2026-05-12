const { query, transaction } = require('../config/database')
const { sendWorkflowNotification, sendExternalSignNotification } = require('./emailService')
const { auditLog } = require('../middleware/audit')
const { generateDocumentNumber } = require('../utils/documentNumber')
const { getFileUrl } = require('../config/storage')

const createWorkflow = async ({ companyId, documentType, title, createdBy, steps, ccUsers = [], collaboratingCompanies = [], metadata = {}, client }) => {
  const db = client || { query: (text, params) => query(text, params) }

  const docNumber = await generateDocumentNumber(companyId, documentType, client)

  const { rows: [doc] } = await db.query(
    `INSERT INTO documents (company_id, document_number, document_type, title, created_by, total_steps, cc_users, collaborating_companies, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [companyId, docNumber, documentType, title, createdBy, steps.length, JSON.stringify(ccUsers), collaboratingCompanies, JSON.stringify(metadata)]
  )

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    await db.query(
      `INSERT INTO workflow_steps (document_id, step_number, step_name, step_type, assigned_user_id, assigned_role, external_name, external_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [doc.id, i + 1, step.name, step.type || 'approval', step.userId || null, step.role || null, step.externalName || null, step.externalEmail || null]
    )
  }

  return doc
}

const submitWorkflow = async ({ documentId, userId, req }) => {
  return transaction(async (client) => {
    const { rows: [doc] } = await client.query(
      'SELECT * FROM documents WHERE id=$1', [documentId]
    )
    if (!doc) throw Object.assign(new Error('Document not found'), { status: 404 })
    if (doc.created_by !== userId) throw Object.assign(new Error('Only the creator can submit'), { status: 403 })
    if (doc.status !== 'draft') throw Object.assign(new Error('Document already submitted'), { status: 400 })

    await client.query(
      `UPDATE documents SET status='pending', is_locked=true, current_step=1 WHERE id=$1`,
      [documentId]
    )

    const { rows: [firstStep] } = await client.query(
      `UPDATE workflow_steps SET status='in_progress' WHERE document_id=$1 AND step_number=1 RETURNING *`,
      [documentId]
    )

    auditLog({ userId, companyId: doc.company_id, action: 'DOCUMENT_SUBMITTED', entityType: 'document', entityId: documentId, req })

    if (firstStep?.external_email) {
      await sendExternalSignNotification({
        email: firstStep.external_email, name: firstStep.external_name,
        token: firstStep.external_token,
        documentTitle: doc.title, documentNumber: doc.document_number, documentType: doc.document_type,
      })
    } else if (firstStep?.assigned_user_id) {
      await sendWorkflowNotification({
        documentId, stepId: firstStep.id, recipientUserId: firstStep.assigned_user_id,
        type: 'workflowAction',
        data: { documentTitle: doc.title, documentNumber: doc.document_number, documentType: doc.document_type, companyId: doc.company_id, action: firstStep.step_name },
      })
    }

    return { ...doc, status: 'pending' }
  })
}

const processStep = async ({ documentId, stepId, userId, action, comments, req }) => {
  return transaction(async (client) => {
    const { rows: [step] } = await client.query(
      'SELECT ws.*, d.company_id, d.document_number, d.title, d.document_type, d.total_steps, d.current_step FROM workflow_steps ws JOIN documents d ON ws.document_id=d.id WHERE ws.id=$1',
      [stepId]
    )
    if (!step) throw Object.assign(new Error('Step not found'), { status: 404 })
    if (step.assigned_user_id !== userId) throw Object.assign(new Error('Not your step to action'), { status: 403 })
    if (step.status !== 'in_progress') throw Object.assign(new Error('Step is not pending your action'), { status: 400 })

    await client.query(
      `UPDATE workflow_steps SET status=$1, action_taken=$2, comments=$3, completed_at=NOW() WHERE id=$4`,
      [action === 'reject' ? 'rejected' : 'completed', action, comments, stepId]
    )

    auditLog({ userId, companyId: step.company_id, action: `STEP_${action.toUpperCase()}`, entityType: 'document', entityId: documentId, newValues: { stepId, comments }, req })

    if (action === 'reject') {
      await client.query(
        `UPDATE documents SET status='rejected', rejection_reason=$1 WHERE id=$2`,
        [comments, documentId]
      )

      const { rows: [doc] } = await client.query('SELECT created_by FROM documents WHERE id=$1', [documentId])
      await sendWorkflowNotification({
        documentId, stepId, recipientUserId: doc.created_by, type: 'workflowRejected',
        data: { documentTitle: step.title, documentNumber: step.document_number, documentType: step.document_type, companyId: step.company_id, rejectedBy: userId, reason: comments },
      })
      return { action: 'rejected' }
    }

    const nextStepNumber = step.current_step + 1

    if (nextStepNumber > step.total_steps) {
      await client.query(
        `UPDATE documents SET status='completed', current_step=$1, completed_at=NOW() WHERE id=$2`,
        [step.total_steps, documentId]
      )

      const { rows: allSteps } = await client.query(
        'SELECT DISTINCT assigned_user_id FROM workflow_steps WHERE document_id=$1 AND assigned_user_id IS NOT NULL',
        [documentId]
      )
      const { rows: [doc] } = await client.query('SELECT * FROM documents WHERE id=$1', [documentId])

      const ccList = (() => { try { return JSON.parse(doc.cc_users) || [] } catch { return [] } })()
      const recipients = [...new Set([...allSteps.map(s => s.assigned_user_id), doc.created_by, ...ccList])]

      for (const recipientId of recipients) {
        if (recipientId) {
          await sendWorkflowNotification({
            documentId, stepId, recipientUserId: recipientId, type: 'workflowCompleted',
            data: { documentTitle: step.title, documentNumber: step.document_number, documentType: step.document_type, companyId: step.company_id },
          })
        }
      }
      return { action: 'completed' }
    }

    await client.query(
      `UPDATE documents SET current_step=$1, status='in_progress' WHERE id=$2`,
      [nextStepNumber, documentId]
    )

    const { rows: [nextStep] } = await client.query(
      `UPDATE workflow_steps SET status='in_progress' WHERE document_id=$1 AND step_number=$2 RETURNING *`,
      [documentId, nextStepNumber]
    )

    if (nextStep?.external_email) {
      await sendExternalSignNotification({
        email: nextStep.external_email, name: nextStep.external_name,
        token: nextStep.external_token,
        documentTitle: step.title, documentNumber: step.document_number, documentType: step.document_type,
      })
    } else if (nextStep?.assigned_user_id) {
      await sendWorkflowNotification({
        documentId, stepId: nextStep.id, recipientUserId: nextStep.assigned_user_id, type: 'workflowAction',
        data: { documentTitle: step.title, documentNumber: step.document_number, documentType: step.document_type, companyId: step.company_id, action: nextStep.step_name },
      })
    }

    return { action: 'approved', nextStep }
  })
}

const getDocumentWithSteps = async (documentId, userId) => {
  const { rows: [doc] } = await query('SELECT * FROM documents WHERE id=$1', [documentId])
  if (!doc) return null

  const { rows: steps } = await query(
    `SELECT ws.*, u.first_name, u.last_name, u.email, u.signature_url
     FROM workflow_steps ws
     LEFT JOIN users u ON ws.assigned_user_id = u.id
     WHERE ws.document_id=$1 ORDER BY ws.step_number`,
    [documentId]
  )

  const { rows: sigRows } = await query(
    'SELECT s.*, u.first_name, u.last_name FROM signatures s JOIN users u ON s.user_id=u.id WHERE s.document_id=$1',
    [documentId]
  )

  const isKey = (v) => v && !v.startsWith('http')
  const signatures = await Promise.all(sigRows.map(async sig => {
    if (sig.signature_type !== 'typed' && isKey(sig.signature_data)) {
      try { sig = { ...sig, signature_data: await getFileUrl(sig.signature_data) } } catch {}
    }
    return sig
  }))

  const stepsWithSig = await Promise.all(steps.map(async s => {
    if (isKey(s.signature_url)) {
      try { s = { ...s, signature_url: await getFileUrl(s.signature_url) } } catch {}
    }
    const sig = signatures.find(r => r.workflow_step_id === s.id)
    return sig ? { ...s, signature: sig } : s
  }))

  const { rows: attachmentRows } = await query(
    'SELECT * FROM document_attachments WHERE document_id=$1 ORDER BY created_at',
    [documentId]
  )
  const attachments = await Promise.all(
    attachmentRows.map(async att => ({ ...att, download_url: await getFileUrl(att.file_url) }))
  )

  const { rows: comments } = await query(
    `SELECT dc.*, u.first_name, u.last_name FROM document_comments dc
     JOIN users u ON dc.user_id=u.id WHERE dc.document_id=$1 ORDER BY dc.created_at`,
    [documentId]
  )

  return { ...doc, steps: stepsWithSig, signatures, attachments, comments }
}

module.exports = { createWorkflow, submitWorkflow, processStep, getDocumentWithSteps }
