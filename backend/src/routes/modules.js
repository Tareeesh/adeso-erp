const express = require('express')
const router = express.Router()
const { authenticate, requireGlobalAdmin } = require('../middleware/auth')
const { asyncHandler } = require('../middleware/errorHandler')
const { query } = require('../config/database')

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM modules WHERE is_active=true ORDER BY name')
  res.json(rows)
}))

router.get('/roles', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM roles ORDER BY display_name')
  res.json(rows)
}))

module.exports = router
