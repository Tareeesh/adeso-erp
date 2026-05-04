const { query } = require('../config/database')
const dayjs = require('dayjs')

const generateDocumentNumber = async (companyId, documentType, client) => {
  const db = client || { query: (text, params) => query(text, params) }

  const { rows } = await db.query(
    `UPDATE document_sequences SET last_number = last_number + 1
     WHERE company_id=$1 AND document_type=$2
     RETURNING prefix, last_number`,
    [companyId, documentType]
  )

  if (rows.length === 0) {
    throw new Error(`No document sequence configured for type: ${documentType}`)
  }

  const { prefix, last_number } = rows[0]
  const year = dayjs().format('YY')
  const padded = String(last_number).padStart(4, '0')
  return `${prefix}-${year}-${padded}`
}

module.exports = { generateDocumentNumber }
