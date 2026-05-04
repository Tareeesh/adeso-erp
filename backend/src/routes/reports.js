const express = require('express')
const router = express.Router()
const { authenticate } = require('../middleware/auth')
const { requireModule } = require('../middleware/rbac')
const { asyncHandler } = require('../middleware/errorHandler')
const { query } = require('../config/database')
const ExcelJS = require('exceljs')
const { Parser } = require('json2csv')
const PDFDocument = require('pdfkit')

const BRAND_COLOR = '#1d4ed8'

router.get('/inventory/stock-levels', authenticate, requireModule('inventory'), asyncHandler(async (req, res) => {
  const { format = 'json', warehouseId } = req.query
  const { rows } = await query(
    `SELECT ii.sku, ii.name, ii.unit_of_measure, ii.unit_price, ii.currency, ii.reorder_level,
            ic.name AS category, w.name AS warehouse, sl.quantity, sl.expiry_date,
            CASE WHEN sl.quantity <= ii.reorder_level THEN 'Low Stock' ELSE 'OK' END AS stock_status
     FROM stock_levels sl
     JOIN inventory_items ii ON sl.item_id=ii.id
     LEFT JOIN inventory_categories ic ON ii.category_id=ic.id
     JOIN warehouses w ON sl.warehouse_id=w.id
     WHERE sl.company_id=$1 ${warehouseId ? 'AND sl.warehouse_id=$2' : ''}
     ORDER BY ii.name`,
    warehouseId ? [req.user.companyId, warehouseId] : [req.user.companyId]
  )
  await sendReport(res, rows, format, 'Stock Levels Report')
}))

router.get('/assets/summary', authenticate, requireModule('assets'), asyncHandler(async (req, res) => {
  const { format = 'json' } = req.query
  const { rows } = await query(
    `SELECT a.asset_id_code, a.name, ac.name AS category, a.brand, a.model, a.serial_number,
            a.status, a.condition, a.purchase_cost, a.currency, a.purchase_date, a.warranty_expiry,
            a.office_location, dep.name AS department,
            u.first_name || ' ' || u.last_name AS assigned_to
     FROM assets a
     LEFT JOIN asset_categories ac ON a.category_id=ac.id
     LEFT JOIN departments dep ON a.department_id=dep.id
     LEFT JOIN employees e ON a.assigned_to=e.id
     LEFT JOIN users u ON e.user_id=u.id
     WHERE a.company_id=$1 ORDER BY a.name`,
    [req.user.companyId]
  )
  await sendReport(res, rows, format, 'Asset Summary Report')
}))

router.get('/operations/purchase-summary', authenticate, requireModule('operations'), asyncHandler(async (req, res) => {
  const { format = 'json', from, to } = req.query
  const { rows } = await query(
    `SELECT d.document_number, d.title, d.status, d.created_at,
            po.currency, po.total_amount, po.delivery_status,
            s.name AS supplier_name,
            u.first_name || ' ' || u.last_name AS created_by
     FROM purchase_orders po
     JOIN documents d ON po.document_id=d.id
     LEFT JOIN suppliers s ON po.supplier_id=s.id
     JOIN users u ON d.created_by=u.id
     WHERE po.company_id=$1
       ${from ? "AND d.created_at >= $2" : ''}
       ${to ? `AND d.created_at <= $${from ? 3 : 2}` : ''}
     ORDER BY d.created_at DESC`,
    [req.user.companyId, ...(from ? [from] : []), ...(to ? [to] : [])]
  )
  await sendReport(res, rows, format, 'Purchase Orders Report')
}))

router.get('/hr/recruitment-pipeline', authenticate, requireModule('hr'), asyncHandler(async (req, res) => {
  const { format = 'json' } = req.query
  const { rows } = await query(
    `SELECT rr.position_title, rr.urgency, d.status, d.created_at,
            dep.name AS department,
            (SELECT COUNT(*) FROM job_postings jp WHERE jp.recruitment_request_id=rr.id) AS postings,
            (SELECT COUNT(*) FROM job_applications ja JOIN job_postings jp ON ja.job_posting_id=jp.id WHERE jp.recruitment_request_id=rr.id) AS applications
     FROM recruitment_requests rr
     JOIN documents d ON rr.document_id=d.id
     LEFT JOIN departments dep ON rr.department_id=dep.id
     WHERE rr.company_id=$1 ORDER BY d.created_at DESC`,
    [req.user.companyId]
  )
  await sendReport(res, rows, format, 'Recruitment Pipeline Report')
}))

const sendReport = async (res, data, format, title) => {
  if (format === 'json') {
    return res.json(data)
  }

  if (format === 'csv') {
    const parser = new Parser()
    const csv = parser.parse(data)
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s/g, '_')}.csv"`)
    return res.send(csv)
  }

  if (format === 'excel') {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet(title)

    if (data.length > 0) {
      sheet.columns = Object.keys(data[0]).map(key => ({
        header: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        key,
        width: 20,
      }))

      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } }
      sheet.addRows(data)
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s/g, '_')}.xlsx"`)
    await workbook.xlsx.write(res)
    return res.end()
  }

  if (format === 'pdf') {
    const pdf = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' })
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/\s/g, '_')}.pdf"`)
    pdf.pipe(res)

    pdf.rect(0, 0, pdf.page.width, 60).fill(BRAND_COLOR)
    pdf.fillColor('white').fontSize(16).font('Helvetica-Bold').text(title, 40, 20)
    pdf.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString('en-GB')}`, 40, 42)
    pdf.fillColor('black').moveDown(2)

    if (data.length > 0) {
      const keys = Object.keys(data[0])
      const colWidth = (pdf.page.width - 80) / Math.min(keys.length, 8)
      const displayKeys = keys.slice(0, 8)

      pdf.fontSize(8).font('Helvetica-Bold')
      displayKeys.forEach((key, i) => {
        pdf.text(key.replace(/_/g, ' ').toUpperCase(), 40 + i * colWidth, pdf.y, { width: colWidth, lineBreak: false })
      })
      pdf.moveDown()
      pdf.moveTo(40, pdf.y).lineTo(pdf.page.width - 40, pdf.y).stroke()
      pdf.moveDown(0.3)

      pdf.font('Helvetica').fontSize(7)
      data.forEach(row => {
        if (pdf.y > pdf.page.height - 60) { pdf.addPage({ layout: 'landscape' }) }
        const y = pdf.y
        displayKeys.forEach((key, i) => {
          const val = row[key] !== null && row[key] !== undefined ? String(row[key]).substring(0, 30) : '-'
          pdf.text(val, 40 + i * colWidth, y, { width: colWidth - 2, lineBreak: false })
        })
        pdf.moveDown()
      })
    }

    pdf.end()
  }
}

module.exports = router
