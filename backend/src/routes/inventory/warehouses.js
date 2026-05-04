const express = require('express')
const router = express.Router()
const { authenticate } = require('../../middleware/auth')
const { requireModule } = require('../../middleware/rbac')
const { asyncHandler } = require('../../middleware/errorHandler')
const { query } = require('../../config/database')

const guard = [authenticate, requireModule('inventory')]

router.get('/', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT w.*, u.first_name || ' ' || u.last_name AS manager_name,
            (SELECT COUNT(*) FROM stock_levels sl WHERE sl.warehouse_id=w.id AND sl.quantity > 0) AS item_count
     FROM warehouses w LEFT JOIN users u ON w.manager_id=u.id
     WHERE w.company_id=$1 AND w.is_active=true ORDER BY w.name`,
    [req.user.companyId]
  )
  res.json(rows)
}))

router.post('/', ...guard, asyncHandler(async (req, res) => {
  const { name, code, type, location, managerId } = req.body
  const { rows: [w] } = await query(
    `INSERT INTO warehouses (company_id, name, code, type, location, manager_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.companyId, name, code, type || 'warehouse', location, managerId]
  )
  res.status(201).json(w)
}))

router.get('/:id/stock', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT sl.*, ii.name AS item_name, ii.sku, ii.unit_of_measure, ii.reorder_level,
            ic.name AS category_name
     FROM stock_levels sl
     JOIN inventory_items ii ON sl.item_id=ii.id
     LEFT JOIN inventory_categories ic ON ii.category_id=ic.id
     WHERE sl.warehouse_id=$1 ORDER BY ii.name`,
    [req.params.id]
  )
  res.json(rows)
}))

module.exports = router
