const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const { asyncHandler } = require('../middleware/errorHandler')
const { generatePR, generatePayment, generatePO, generateTravel, generateRFQ, generateDelivery, generateBidAnalysis } = require('../services/pdfService')

const send = (res, buffer, filename) => {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': buffer.length,
  })
  res.send(buffer)
}

router.get('/pr/:documentId', authenticate, asyncHandler(async (req, res) => {
  const buf = await generatePR(req.params.documentId, req.user.companyId)
  send(res, buf, `PR-${req.params.documentId.slice(0, 8)}.pdf`)
}))

router.get('/payment/:documentId', authenticate, asyncHandler(async (req, res) => {
  const buf = await generatePayment(req.params.documentId, req.user.companyId)
  send(res, buf, `Payment-${req.params.documentId.slice(0, 8)}.pdf`)
}))

router.get('/po/:documentId', authenticate, asyncHandler(async (req, res) => {
  const buf = await generatePO(req.params.documentId, req.user.companyId)
  send(res, buf, `PO-${req.params.documentId.slice(0, 8)}.pdf`)
}))

router.get('/travel/:documentId', authenticate, asyncHandler(async (req, res) => {
  const buf = await generateTravel(req.params.documentId, req.user.companyId)
  send(res, buf, `TA-${req.params.documentId.slice(0, 8)}.pdf`)
}))

router.get('/rfq/:documentId', authenticate, asyncHandler(async (req, res) => {
  const buf = await generateRFQ(req.params.documentId, req.user.companyId)
  send(res, buf, `RFQ-${req.params.documentId.slice(0, 8)}.pdf`)
}))

router.get('/delivery/:deliveryId', authenticate, asyncHandler(async (req, res) => {
  const buf = await generateDelivery(req.params.deliveryId, req.user.companyId)
  send(res, buf, `GRN-${req.params.deliveryId.slice(0, 8)}.pdf`)
}))

router.get('/bid-analysis/:baId', authenticate, asyncHandler(async (req, res) => {
  const buf = await generateBidAnalysis(req.params.baId, req.user.companyId)
  send(res, buf, `BidAnalysis-${req.params.baId.slice(0, 8)}.pdf`)
}))

module.exports = router
