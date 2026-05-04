const express = require('express')
const router = express.Router()
const { authenticate } = require('../../middleware/auth')
const { requireModule } = require('../../middleware/rbac')
const { asyncHandler } = require('../../middleware/errorHandler')
const { query, transaction } = require('../../config/database')
const { createWorkflow } = require('../../services/workflowEngine')
const { upload } = require('../../middleware/upload')
const { uploadFile } = require('../../config/storage')
const QRCode = require('qrcode')

const guard = [authenticate, requireModule('assets')]

// Auto-generate asset ID
const generateAssetId = async (companyId, categoryCode) => {
  const year = new Date().getFullYear().toString().slice(-2)
  const { rows } = await query(
    `SELECT COUNT(*) FROM assets WHERE company_id=$1 AND asset_id_code LIKE $2`,
    [companyId, `${categoryCode}-${year}-%`]
  )
  const count = parseInt(rows[0].count) + 1
  return `${categoryCode}-${year}-${String(count).padStart(4, '0')}`
}

// ---- CATEGORIES ----
router.get('/categories', ...guard, asyncHandler(async (req, res) => {
  const { rows } = await query('SELECT * FROM asset_categories WHERE company_id=$1 AND is_active=true ORDER BY name', [req.user.companyId])
  res.json(rows)
}))

router.post('/categories', ...guard, asyncHandler(async (req, res) => {
  const { name, code, description, depreciationRate, usefulLifeYears } = req.body
  const { rows: [cat] } = await query(
    `INSERT INTO asset_categories (company_id, name, code, description, depreciation_rate, useful_life_years) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.user.companyId, name, code, description, depreciationRate, usefulLifeYears]
  )
  res.status(201).json(cat)
}))

// ---- ASSETS ----
router.get('/', ...guard, asyncHandler(async (req, res) => {
  const { status, departmentId, assignedTo, categoryId } = req.query
  const conditions = ['a.company_id=$1']
  const params = [req.user.companyId]

  if (status) conditions.push(`a.status=$${params.push(status)}`)
  if (departmentId) conditions.push(`a.department_id=$${params.push(departmentId)}`)
  if (assignedTo) conditions.push(`a.assigned_to=$${params.push(assignedTo)}`)
  if (categoryId) conditions.push(`a.category_id=$${params.push(categoryId)}`)

  const { rows } = await query(
    `SELECT a.*, ac.name AS category_name,
            u.first_name || ' ' || u.last_name AS assigned_to_name,
            dep.name AS department_name
     FROM assets a
     LEFT JOIN asset_categories ac ON a.category_id=ac.id
     LEFT JOIN employees e ON a.assigned_to=e.id
     LEFT JOIN users u ON e.user_id=u.id
     LEFT JOIN departments dep ON a.department_id=dep.id
     WHERE ${conditions.join(' AND ')}
     ORDER BY a.created_at DESC`,
    params
  )
  res.json(rows)
}))

router.post('/', ...guard, asyncHandler(async (req, res) => {
  const { categoryId, name, brand, model, serialNumber, purchaseDate, purchaseCost, currency, supplierId, supplierName, warrantyExpiry, condition, officeLocation, departmentId, notes } = req.body

  const { rows: [cat] } = await query('SELECT code FROM asset_categories WHERE id=$1', [categoryId])
  const assetIdCode = await generateAssetId(req.user.companyId, cat?.code || 'AST')

  const qrData = JSON.stringify({ assetId: assetIdCode, company: req.user.companyId })
  const qrBuffer = await QRCode.toBuffer(qrData, { type: 'png', width: 200 })
  const qrUrl = await uploadFile(qrBuffer, `${assetIdCode}-qr.png`, `asset-qr/${req.user.companyId}`)

  const { rows: [asset] } = await query(
    `INSERT INTO assets (company_id, asset_id_code, category_id, name, brand, model, serial_number, purchase_date, purchase_cost, currency, supplier_id, supplier_name, warranty_expiry, condition, office_location, department_id, notes, qr_code_url, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
    [req.user.companyId, assetIdCode, categoryId, name, brand, model, serialNumber, purchaseDate, purchaseCost, currency || 'KES', supplierId, supplierName, warrantyExpiry, condition || 'new', officeLocation, departmentId, notes, qrUrl, req.user.id]
  )
  res.status(201).json(asset)
}))

router.get('/:id', ...guard, asyncHandler(async (req, res) => {
  const { rows: [asset] } = await query(
    `SELECT a.*, ac.name AS category_name,
            u.first_name || ' ' || u.last_name AS assigned_to_name
     FROM assets a LEFT JOIN asset_categories ac ON a.category_id=ac.id
     LEFT JOIN employees e ON a.assigned_to=e.id LEFT JOIN users u ON e.user_id=u.id
     WHERE a.id=$1 AND a.company_id=$2`,
    [req.params.id, req.user.companyId]
  )
  if (!asset) return res.status(404).json({ error: 'Not found' })

  const { rows: assignments } = await query(
    `SELECT aa.*, u.first_name || ' ' || u.last_name AS employee_name
     FROM asset_assignments aa JOIN employees e ON aa.assigned_to=e.id LEFT JOIN users u ON e.user_id=u.id
     WHERE aa.asset_id=$1 ORDER BY aa.assignment_date DESC`,
    [req.params.id]
  )

  const { rows: maintenance } = await query(
    'SELECT * FROM asset_maintenance WHERE asset_id=$1 ORDER BY scheduled_date DESC',
    [req.params.id]
  )

  res.json({ ...asset, assignments, maintenanceHistory: maintenance })
}))

router.put('/:id', ...guard, asyncHandler(async (req, res) => {
  const { name, brand, model, serialNumber, condition, status, officeLocation, departmentId, notes, warrantyExpiry } = req.body
  const { rows: [asset] } = await query(
    `UPDATE assets SET name=$1, brand=$2, model=$3, serial_number=$4, condition=$5, status=$6, office_location=$7, department_id=$8, notes=$9, warranty_expiry=$10, updated_at=NOW()
     WHERE id=$11 AND company_id=$12 RETURNING *`,
    [name, brand, model, serialNumber, condition, status, officeLocation, departmentId, notes, warrantyExpiry, req.params.id, req.user.companyId]
  )
  res.json(asset)
}))

// Asset documents upload
router.post('/:id/documents', ...guard, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' })
  const key = await uploadFile(req.file.buffer, req.file.originalname, `asset-docs/${req.params.id}`)

  const { rows: [asset] } = await query('SELECT documents FROM assets WHERE id=$1', [req.params.id])
  const docs = JSON.parse(asset.documents || '[]')
  docs.push({ name: req.file.originalname, url: key, type: req.body.docType, uploadedAt: new Date().toISOString() })

  await query('UPDATE assets SET documents=$1 WHERE id=$2', [JSON.stringify(docs), req.params.id])
  res.json({ documents: docs })
}))

// ---- ASSET ASSIGNMENTS ----
router.post('/assignments', ...guard, asyncHandler(async (req, res) => {
  const { assetId, assignedTo, assignmentDate, expectedReturnDate, purpose, conditionAtAssignment, handoverNotes, lineManagerId, steps, ccUsers } = req.body

  const result = await transaction(async (client) => {
    const { rows: [asset] } = await client.query('SELECT name, asset_id_code FROM assets WHERE id=$1', [assetId])

    const doc = await createWorkflow({
      companyId: req.user.companyId, documentType: 'asset_assignment',
      title: `Asset Assignment — ${asset.name} (${asset.asset_id_code})`,
      createdBy: req.user.id,
      steps: steps || [{ name: 'Line Manager Approval', type: 'approval', userId: lineManagerId }].filter(s => s.userId),
      ccUsers, client,
    })

    const { rows: [aa] } = await client.query(
      `INSERT INTO asset_assignments (document_id, asset_id, company_id, assigned_to, assigned_by, assignment_date, expected_return_date, purpose, condition_at_assignment, handover_notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [doc.id, assetId, req.user.companyId, assignedTo, req.user.id, assignmentDate, expectedReturnDate, purpose, conditionAtAssignment, handoverNotes]
    )

    await client.query(
      `UPDATE assets SET assigned_to=$1, status='assigned', assigned_at=NOW() WHERE id=$2`,
      [assignedTo, assetId]
    )

    await client.query(
      `INSERT INTO asset_movements (asset_id, company_id, from_status, to_status, to_employee, reason, performed_by)
       VALUES ($1,$2,'available','assigned',$3,$4,$5)`,
      [assetId, req.user.companyId, assignedTo, purpose, req.user.id]
    )

    return { document: doc, assignment: aa }
  })

  res.status(201).json(result)
}))

router.put('/assignments/:id/return', ...guard, asyncHandler(async (req, res) => {
  const { conditionAtReturn, returnNotes } = req.body
  const { rows: [aa] } = await query(
    `UPDATE asset_assignments SET actual_return_date=NOW(), condition_at_return=$1, return_notes=$2, status='returned'
     WHERE id=$3 RETURNING *`,
    [conditionAtReturn, returnNotes, req.params.id]
  )

  await query(
    `UPDATE assets SET assigned_to=NULL, status='available', assigned_at=NULL WHERE id=$1`,
    [aa.asset_id]
  )
  res.json(aa)
}))

// ---- MAINTENANCE ----
router.post('/maintenance', ...guard, asyncHandler(async (req, res) => {
  const { assetId, maintenanceType, title, description, scheduledDate, vendorName, vendorContact, cost, currency, nextMaintenanceDate } = req.body

  await query(`UPDATE assets SET status='under_maintenance' WHERE id=$1`, [assetId])

  const { rows: [m] } = await query(
    `INSERT INTO asset_maintenance (asset_id, company_id, maintenance_type, title, description, scheduled_date, vendor_name, vendor_contact, cost, currency, next_maintenance_date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [assetId, req.user.companyId, maintenanceType, title, description, scheduledDate, vendorName, vendorContact, cost, currency || 'KES', nextMaintenanceDate, req.user.id]
  )
  res.status(201).json(m)
}))

router.put('/maintenance/:id/complete', ...guard, asyncHandler(async (req, res) => {
  const { completedDate, notes } = req.body
  const { rows: [m] } = await query(
    `UPDATE asset_maintenance SET status='completed', completed_date=$1, notes=$2 WHERE id=$3 RETURNING *`,
    [completedDate, notes, req.params.id]
  )

  await query(`UPDATE assets SET status='available' WHERE id=$1`, [m.asset_id])
  res.json(m)
}))

// ---- AUDITS ----
router.post('/audits', ...guard, asyncHandler(async (req, res) => {
  const { auditDate, departmentId, location } = req.body
  const { rows: [audit] } = await query(
    `INSERT INTO asset_audits (company_id, conducted_by, audit_date, department_id, location) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [req.user.companyId, req.user.id, auditDate, departmentId, location]
  )

  const { rows: assets } = await query(
    `SELECT id, office_location FROM assets WHERE company_id=$1 AND status!='disposed' AND status!='retired'
     ${departmentId ? 'AND department_id=$2' : ''}`,
    departmentId ? [req.user.companyId, departmentId] : [req.user.companyId]
  )

  for (const asset of assets) {
    await query(
      `INSERT INTO asset_audit_items (audit_id, asset_id, expected_location) VALUES ($1,$2,$3)`,
      [audit.id, asset.id, asset.office_location]
    )
  }

  await query('UPDATE asset_audits SET total_assets=$1 WHERE id=$2', [assets.length, audit.id])
  res.status(201).json({ ...audit, totalAssets: assets.length })
}))

router.put('/audits/:id/items/:itemId', ...guard, asyncHandler(async (req, res) => {
  const { foundLocation, conditionFound, isMissing, notes } = req.body
  const { rows: [item] } = await query(
    `UPDATE asset_audit_items SET found_location=$1, condition_found=$2, is_missing=$3, notes=$4, is_verified=true, verified_at=NOW()
     WHERE id=$5 AND audit_id=$6 RETURNING *`,
    [foundLocation, conditionFound, isMissing || false, notes, req.params.itemId, req.params.id]
  )
  res.json(item)
}))

module.exports = router
