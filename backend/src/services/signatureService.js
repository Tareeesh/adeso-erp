const crypto = require('crypto')
const { query } = require('../config/database')
const { uploadFile } = require('../config/storage')
const { auditLog } = require('../middleware/audit')

const signDocument = async ({ documentId, stepId, userId, signatureType, signatureData, typedName, ipAddress, userAgent, req }) => {
  const { rows: [step] } = await query(
    `SELECT ws.*, d.company_id, d.document_number FROM workflow_steps ws
     JOIN documents d ON ws.document_id=d.id
     WHERE ws.id=$1`,
    [stepId]
  )

  if (!step) throw Object.assign(new Error('Workflow step not found'), { status: 404 })
  if (step.assigned_user_id !== userId) throw Object.assign(new Error('This step is not assigned to you'), { status: 403 })
  if (step.status !== 'in_progress') throw Object.assign(new Error('Step is not currently awaiting your signature'), { status: 400 })

  // Check no prior signature exists from this user on this step
  const { rows: existing } = await query(
    'SELECT id FROM signatures WHERE document_id=$1 AND workflow_step_id=$2 AND user_id=$3',
    [documentId, stepId, userId]
  )
  if (existing.length > 0) throw Object.assign(new Error('You have already signed this step'), { status: 400 })

  let finalSignatureData = signatureData
  if (signatureType === 'drawn' || signatureType === 'uploaded') {
    const buffer = Buffer.from(signatureData.replace(/^data:image\/\w+;base64,/, ''), 'base64')
    finalSignatureData = await uploadFile(buffer, 'signature.png', `document-signatures/${documentId}`)
  }

  const integrityHash = crypto
    .createHash('sha256')
    .update(`${documentId}:${stepId}:${userId}:${new Date().toISOString()}:${signatureData.substring(0, 100)}`)
    .digest('hex')

  const { rows: [sig] } = await query(
    `INSERT INTO signatures (document_id, workflow_step_id, user_id, signature_type, signature_data, typed_name, ip_address, user_agent, integrity_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [documentId, stepId, userId, signatureType, finalSignatureData, typedName, ipAddress, userAgent, integrityHash]
  )

  // Save to user profile for reuse (if not already saved or newer)
  if (signatureType !== 'typed') {
    await query(
      'UPDATE users SET signature_url=$1, signature_type=$2 WHERE id=$3 AND (signature_url IS NULL OR signature_type = $4)',
      [finalSignatureData, signatureType, userId, 'typed']
    )
  }

  auditLog({
    userId, companyId: step.company_id, action: 'DOCUMENT_SIGNED',
    entityType: 'document', entityId: documentId,
    newValues: { stepId, signatureType, integrityHash }, req,
  })

  return sig
}

const verifySignatureIntegrity = async (signatureId) => {
  const { rows: [sig] } = await query('SELECT * FROM signatures WHERE id=$1', [signatureId])
  if (!sig) return { valid: false, reason: 'Signature not found' }
  return { valid: sig.is_valid, signature: sig, integrityHash: sig.integrity_hash }
}

module.exports = { signDocument, verifySignatureIntegrity }
