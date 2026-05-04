const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const { asyncHandler } = require('../middleware/errorHandler')
const { signDocument, verifySignatureIntegrity } = require('../services/signatureService')
const { processStep } = require('../services/workflowEngine')

router.post('/:documentId/sign/:stepId', authenticate, asyncHandler(async (req, res) => {
  const { documentId, stepId } = req.params
  const { signatureType, signatureData, typedName } = req.body

  if (!signatureType || !signatureData) {
    return res.status(400).json({ error: 'signatureType and signatureData are required' })
  }

  const sig = await signDocument({
    documentId, stepId, userId: req.user.id,
    signatureType, signatureData, typedName,
    ipAddress: req.ip, userAgent: req.headers['user-agent'], req,
  })

  const result = await processStep({
    documentId, stepId, userId: req.user.id, action: 'approve',
    comments: req.body.comments, req,
  })

  res.json({ signature: sig, workflow: result })
}))

router.get('/:signatureId/verify', authenticate, asyncHandler(async (req, res) => {
  const result = await verifySignatureIntegrity(req.params.signatureId)
  res.json(result)
}))

module.exports = router
