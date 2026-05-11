const { PDFDocument, StandardFonts, rgb } = require('pdf-lib')
const { query } = require('../config/database')
const { downloadFile, uploadFile } = require('../config/storage')

const embedSignatures = async (documentId) => {
  const { rows: [doc] } = await query(`SELECT * FROM sign_documents WHERE id=$1`, [documentId])
  if (!doc) throw new Error('Document not found')

  const { rows: recipients } = await query(
    `SELECT sr.*, json_agg(sf.* ORDER BY sf.page_number, sf.y_pct) AS fields
     FROM sign_recipients sr
     LEFT JOIN sign_fields sf ON sf.recipient_id = sr.id AND sf.document_id = $1
     WHERE sr.document_id = $1 AND sr.status = 'completed'
     GROUP BY sr.id`,
    [documentId]
  )

  const pdfBytes = await downloadFile(doc.file_url)
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()
  const italicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic)

  for (const recipient of recipients) {
    const fields = recipient.fields?.filter(Boolean) || []
    for (const field of fields) {
      const page = pages[field.page_number - 1]
      if (!page) continue
      const { width, height } = page.getSize()
      const x = (field.x_pct / 100) * width
      const fieldH = (field.h_pct / 100) * height
      const fieldW = (field.w_pct / 100) * width
      // pdf-lib y=0 is bottom; convert from top-down percentage
      const y = height - ((field.y_pct / 100) * height) - fieldH

      const sigData = recipient.signature_data || ''

      if (sigData.startsWith('data:image/png')) {
        try {
          const base64 = sigData.replace(/^data:image\/png;base64,/, '')
          const pngImage = await pdfDoc.embedPng(Buffer.from(base64, 'base64'))
          page.drawImage(pngImage, { x, y, width: fieldW, height: fieldH })
        } catch {
          drawTextSig(page, recipient.name, x, y, fieldW, fieldH, italicFont)
        }
      } else {
        const name = sigData || recipient.name
        drawTextSig(page, name, x, y, fieldW, fieldH, italicFont)
      }

      page.drawLine({
        start: { x, y },
        end: { x: x + fieldW, y },
        thickness: 0.5,
        color: rgb(0.75, 0.75, 0.75),
      })
    }
  }

  const finalBytes = await pdfDoc.save()
  const safeName = (doc.file_name || 'document.pdf').replace(/[^a-z0-9._-]/gi, '_')
  const key = await uploadFile(Buffer.from(finalBytes), `signed_${safeName}`, 'sign-documents/final')
  return key
}

function drawTextSig(page, name, x, y, w, h, font) {
  const fontSize = Math.min(Math.max(h * 0.55, 10), 28)
  try {
    page.drawText(name || 'Signed', {
      x: x + 4,
      y: y + (h - fontSize) / 2 + 2,
      size: fontSize,
      font,
      color: rgb(0.118, 0.227, 0.533),
      maxWidth: w - 8,
    })
  } catch {}
}

module.exports = { embedSignatures }
