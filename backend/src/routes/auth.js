const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const { asyncHandler } = require('../middleware/errorHandler')
const authController = require('../controllers/authController')

router.post('/login',           asyncHandler(authController.login))
router.post('/refresh',         asyncHandler(authController.refreshToken))
router.post('/logout',          authenticate, asyncHandler(authController.logout))
router.post('/forgot-password', asyncHandler(authController.forgotPassword))
router.post('/reset-password',  asyncHandler(authController.resetPassword))
router.get('/me',               authenticate, asyncHandler(authController.getMe))
router.put('/me',               authenticate, asyncHandler(authController.updateProfile))
router.put('/me/signature',     authenticate, asyncHandler(authController.saveSignature))
router.put('/me/password',      authenticate, asyncHandler(authController.changePassword))
router.post('/switch-company',  authenticate, asyncHandler(authController.switchCompany))

module.exports = router
