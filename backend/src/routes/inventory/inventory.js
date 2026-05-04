const express = require('express')
const router = express.Router()
const { authenticate } = require('../../middleware/auth')
const { requireModule } = require('../../middleware/rbac')
const { asyncHandler } = require('../../middleware/errorHandler')
const { query, transaction } = require('../../config/database')
const { createWorkflow } = require('../../services/workflowEngine')
const QRCode = require('qrcode')
const { uploadFile } = require('../../config/storage')

const guard = [authenticate, requireModule('inventory')]

// ---- CATEGORIES ----
router.get('/categories', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM inventory_categories WHERE company_id=$1 ORDER BY name', [req.user.companyId])
  res.json(rows)
}))

router.post('/categories', ...guard, asyncHandler(async (req, res) => {
  const { rows: [cat] } = await query(
    `INSERT INTO inventory_categories (company_id, name, code, description) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.user.companyId, req.body.name, req.body.code, req.body.description]
  )
  res.status(201).json(cat)
}))

// ---- ITEMS ----
router.get('/items', ...guard, asyncHandler(async (req, res) => {
  const { categoryId, warehouseId, lowStock } = req.query
  const { rows } = await query(
    `SELECT ii.*, ic.name AS category_name,
            COALESCE(SUM(sl.quantity), 0) AS total_quantity
     FROM inventory_items ii
     LEFT JOIN inventory_categories ic ON ii.category_id=ic.id
     LEFT JOIN stock_levels sl ON ii.id=sl.item_id ${warehouseId ? 'AND sl.warehouse_id=$2' : ''}
     WHERE ii.company_id=$1 AND ii.is_active=true
     GROUP BY ii.id, ic.name
     ${lowStock === 'true' ? 'HAVING COALESCE(SUM(sl.quantity), 0) <= ii.reorder_level' : ''}
     ORDER BY ii.name`,
    warehouseId ? [req.user.companyId, warehouseId] : [req.user.companyId]
  )
  res.json(rows)
}))

router.post('/items', ...guard, asyncHandler(async (req, res) => {
  const { sku, name, description, categoryId, unitOfMeasure, unitPrice, currency, reorderLevel, isExpirable, notes } = req.body

  const qrData = JSON.stringify({ sku, company: req.user.companyId, type: 'inventory' })
  const qrBuffer = await QRCode.toBuffer(qrData, { type: 'png', width: 200 })
  const qrUrl = await uploadFile(qrBuffer, `${sku}-qr.png`, `inventory-qr/${req.user.companyId}`)

  const { rows: [item] } = await query(
    `INSERT INTO inventory_items (company_id, sku, name, description, category_id, unit_of_measure, unit_price, currency, reorder_level, is_expirable, qr_code_url, qr_code_data, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
    [req.user.companyId, sku, name, description, categoryId, unitOfMeasure, unitPrice, currency || 'KES', reorderLevel || 0, isExpirable || false, qrUrl, qrData, notes, req.user.id]
  )
  res.status(201).json(item)
}))

router.get('/items/:id', ...guard, asyncHandler(async (req, res) => {
  const { rows: [item] } = await query(
    `SELECT ii.*, ic.name AS category_name FROM inventory_items ii
     LEFT JOIN inventory_categories ic ON ii.category_id=ic.id
     WHERE ii.id=$1 AND ii.company_id=$2`,
    [req.params.id, req.user.companyId]
  )
  if (!item) return res.status(404).json({ error: 'Not found' })

  const { rows: stockLevels } = await query(
    `SELECT sl.*, w.name AS warehouse_name, w.location
     FROM stock_levels sl JOIN warehouses w ON sl.warehouse_id=w.id
     WHERE sl.item_id=$1`,
    [req.params.id]
  )

  const { rows: movements } = await query(
    `SELECT sm.*, u.first_name || ' ' || u.last_name AS performed_by_name, w.name AS warehouse_name
     FROM stock_movements sm JOIN users u ON sm.performed_by=u.id JOIN warehouses w ON sm.warehouse_id=w.id
     WHERE sm.item_id=$1 ORDER BY sm.created_at DESC LIMIT 50`,
    [req.params.id]
  )

  res.json({ ...item, stockLevels, recentMovements: movements })
}))

// QR lookup by sku/data
router.get('/items/qr/:qrData', ...guard, asyncHandler(async (req, res) => {
  let sku = req.params.qrData
  try {
    const parsed = JSON.parse(decodeURIComponent(req.params.qrData))
    sku = parsed.sku
  } catch {}

  const { rows: [item] } = await query(
    'SELECT * FROM inventory_items WHERE (sku=$1 OR qr_code_data LIKE $2) AND company_id=$3',
    [sku, `%"sku":"${sku}"%`, req.user.companyId]
  )
  if (!item) return res.status(404).json({ error: 'Item not found' })
  res.json(item)
}))

// ---- STOCK MOVEMENTS ----
router.post('/movements', ...guard, asyncHandler(async (req, res) => {
  const { itemId, warehouseId, toWarehouseId, movementType, quantity, unitPrice, currency, reason, batchNumber, expiryDate, notes } = req.body

  await transaction(async (client) => {
    const { rows: [mov] } = await client.query(
      `INSERT INTO stock_movements (company_id, item_id, warehouse_id, to_warehouse_id, movement_type, quantity, unit_price, currency, reason, batch_number, expiry_date, performed_by, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [req.user.companyId, itemId, warehouseId, toWarehouseId, movementType, quantity, unitPrice, currency || 'KES', reason, batchNumber, expiryDate, req.user.id, notes]
    )

    // Update stock levels
    if (['stock_in', 'return'].includes(movementType)) {
      await client.query(
        `INSERT INTO stock_levels (item_id, warehouse_id, company_id, quantity, batch_number, expiry_date)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (item_id, warehouse_id, batch_number)
         DO UPDATE SET quantity = stock_levels.quantity + $4, updated_at=NOW()`,
        [itemId, warehouseId, req.user.companyId, quantity, batchNumber || 'default', expiryDate]
      )
    } else if (['stock_out', 'damage', 'expired'].includes(movementType)) {
      await client.query(
        `UPDATE stock_levels SET quantity = GREATEST(0, quantity - $1), updated_at=NOW()
         WHERE item_id=$2 AND warehouse_id=$3`,
        [quantity, itemId, warehouseId]
      )
    } else if (movementType === 'transfer') {
      await client.query(
        `UPDATE stock_levels SET quantity = GREATEST(0, quantity - $1), updated_at=NOW()
         WHERE item_id=$2 AND warehouse_id=$3`,
        [quantity, itemId, warehouseId]
      )
      await client.query(
        `INSERT INTO stock_levels (item_id, warehouse_id, company_id, quantity)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (item_id, warehouse_id, batch_number) DO UPDATE SET quantity = stock_levels.quantity + $4, updated_at=NOW()`,
        [itemId, toWarehouseId, req.user.companyId, quantity]
      )
    }

    // Check for low stock alert
    const { rows: [sl] } = await client.query(
      `SELECT sl.quantity, ii.reorder_level FROM stock_levels sl
       JOIN inventory_items ii ON sl.item_id=ii.id
       WHERE sl.item_id=$1 AND sl.warehouse_id=$2`,
      [itemId, warehouseId]
    )
    if (sl && sl.quantity <= sl.reorder_level) {
      await client.query(
        `INSERT INTO low_stock_alerts (company_id, item_id, warehouse_id, current_quantity, reorder_level, alert_type)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT DO NOTHING`,
        [req.user.companyId, itemId, warehouseId, sl.quantity, sl.reorder_level, sl.quantity === 0 ? 'out_of_stock' : 'low_stock']
      )
    }

    res.status(201).json(mov)
  })
}))

// ---- STORE REQUESTS ----
router.get('/store-requests', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT sr.*, d.document_number, d.status, d.created_at,
            u.first_name || ' ' || u.last_name AS requestor_name,
            w.name AS warehouse_name
     FROM store_requests sr
     JOIN documents d ON sr.document_id=d.id
     JOIN users u ON sr.requestor_id=u.id
     LEFT JOIN warehouses w ON sr.warehouse_id=w.id
     WHERE sr.company_id=$1 AND d.status!='deleted' ORDER BY d.created_at DESC`,
    [req.user.companyId]
  )
  res.json(rows)
}))

router.post('/store-requests', ...guard, asyncHandler(async (req, res) => {
  const { warehouseId, departmentId, requiredBy, purpose, items, lineManagerId, inventoryOfficerId, ccUsers } = req.body

  const result = await transaction(async (client) => {
    const doc = await createWorkflow({
      companyId: req.user.companyId, documentType: 'store_request',
      title: `Store Request`, createdBy: req.user.id,
      steps: [
        { name: 'Line Manager Approval', type: 'approval', userId: lineManagerId },
        { name: 'Inventory Officer Issuance', type: 'action', userId: inventoryOfficerId },
      ].filter(s => s.userId),
      ccUsers, client,
    })

    const { rows: [sr] } = await client.query(
      `INSERT INTO store_requests (document_id, company_id, requestor_id, warehouse_id, department_id, required_by, purpose, items)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [doc.id, req.user.companyId, req.user.id, warehouseId, departmentId, requiredBy, purpose, JSON.stringify(items || [])]
    )

    return { document: doc, storeRequest: sr }
  })

  res.status(201).json(result)
}))

router.put('/store-requests/:id/issue', ...guard, asyncHandler(async (req, res) => {
  const { issuedItems, notes } = req.body

  await transaction(async (client) => {
    for (const issued of issuedItems) {
      await client.query(
        `INSERT INTO store_request_items (store_request_id, item_id, requested_quantity, issued_quantity, unit_price)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT DO NOTHING`,
        [req.params.id, issued.itemId, issued.requestedQuantity, issued.issuedQuantity, issued.unitPrice]
      )

      await client.query(
        `UPDATE stock_levels SET quantity = GREATEST(0, quantity - $1), updated_at=NOW()
         WHERE item_id=$2 AND warehouse_id=(SELECT warehouse_id FROM store_requests WHERE id=$3)`,
        [issued.issuedQuantity, issued.itemId, req.params.id]
      )

      await client.query(
        `INSERT INTO stock_movements (company_id, item_id, warehouse_id, movement_type, quantity, reference_type, reference_id, reason, performed_by)
         SELECT sr.company_id, $1, sr.warehouse_id, 'stock_out', $2, 'store_request', sr.id, 'Store request issuance', $3
         FROM store_requests sr WHERE sr.id=$4`,
        [issued.itemId, issued.issuedQuantity, req.user.id, req.params.id]
      )
    }

    await client.query(
      `UPDATE store_requests SET issued_by=$1, issued_at=NOW(), notes=$2 WHERE id=$3`,
      [req.user.id, notes, req.params.id]
    )
  })

  res.json({ message: 'Items issued successfully' })
}))

// ---- STOCK COUNTS ----
router.post('/counts', ...guard, asyncHandler(async (req, res) => {
  const { warehouseId, countDate } = req.body
  const { rows: [count] } = await query(
    `INSERT INTO stock_counts (company_id, warehouse_id, conducted_by, count_date) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.user.companyId, warehouseId, req.user.id, countDate]
  )

  const { rows: stockItems } = await query(
    'SELECT item_id, quantity FROM stock_levels WHERE warehouse_id=$1',
    [warehouseId]
  )
  for (const si of stockItems) {
    await query(
      `INSERT INTO stock_count_items (stock_count_id, item_id, system_quantity) VALUES ($1,$2,$3)`,
      [count.id, si.item_id, si.quantity]
    )
  }

  res.status(201).json(count)
}))

router.put('/counts/:id/items/:itemId', ...guard, asyncHandler(async (req, res) => {
  const { countedQuantity, notes } = req.body
  const { rows: [sci] } = await query(
    `UPDATE stock_count_items SET counted_quantity=$1, variance=($1 - system_quantity), notes=$2
     WHERE id=$3 AND stock_count_id=$4 RETURNING *`,
    [countedQuantity, notes, req.params.itemId, req.params.id]
  )
  res.json(sci)
}))

// ---- ALERTS ----
router.get('/alerts', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT lsa.*, ii.name AS item_name, ii.sku, w.name AS warehouse_name
     FROM low_stock_alerts lsa
     JOIN inventory_items ii ON lsa.item_id=ii.id
     JOIN warehouses w ON lsa.warehouse_id=w.id
     WHERE lsa.company_id=$1 AND lsa.is_resolved=false
     ORDER BY lsa.created_at DESC`,
    [req.user.companyId]
  )
  res.json(rows)
}))

module.exports = router
