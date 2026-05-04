const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const { asyncHandler } = require('../middleware/errorHandler')
const { query } = require('../config/database')

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  )
  res.json(rows)
}))

router.get('/unread-count', authenticate, asyncHandler(async (req, res) => {
  const { rows } = await query(
    'SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=false',
    [req.user.id]
  )
  res.json({ count: parseInt(rows[0].count) })
}))

router.put('/:id/read', authenticate, asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id])
  res.json({ message: 'Marked as read' })
}))

router.put('/read-all', authenticate, asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET is_read=true WHERE user_id=$1', [req.user.id])
  res.json({ message: 'All marked as read' })
}))

module.exports = router
