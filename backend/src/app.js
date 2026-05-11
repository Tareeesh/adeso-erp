require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const compression = require('compression')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')

const { errorHandler } = require('./middleware/errorHandler')
const { startReminderScheduler } = require('./services/reminderService')

// Routes
const authRoutes = require('./routes/auth')
const userRoutes = require('./routes/users')
const companyRoutes = require('./routes/companies')
const moduleRoutes = require('./routes/modules')
const workflowRoutes = require('./routes/workflows')
const signatureRoutes = require('./routes/signatures')
const externalSignRoutes = require('./routes/sign')
const notificationRoutes = require('./routes/notifications')
const auditRoutes = require('./routes/audit')
const reportRoutes = require('./routes/reports')
const supplierPortalRoutes = require('./routes/supplierPortal')
const attachmentRoutes = require('./routes/attachments')
const signDocsRoutes = require('./routes/signDocs')
const signExtRoutes = require('./routes/signExt')

// Operations
const purchaseRoutes = require('./routes/operations/purchase')
const travelRoutes = require('./routes/operations/travel')
const cabRoutes = require('./routes/operations/cab')

// HR
const recruitmentRoutes = require('./routes/hr/recruitment')
const onboardingRoutes = require('./routes/hr/onboarding')
const performanceRoutes = require('./routes/hr/performance')
const itRequestRoutes = require('./routes/hr/itRequests')
const inductionRoutes = require('./routes/hr/induction')

// Assets
const assetRoutes = require('./routes/assets/assets')

// Inventory
const inventoryRoutes = require('./routes/inventory/inventory')
const warehouseRoutes = require('./routes/inventory/warehouses')

const app = express()

app.set('trust proxy', 1)
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({
  origin: process.env.APP_URL || 'http://localhost:3000',
  credentials: true,
}))
app.use(compression())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(morgan('combined'))

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
})
app.use('/api/', limiter)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Core routes
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/companies', companyRoutes)
app.use('/api/modules', moduleRoutes)
app.use('/api/workflows', workflowRoutes)
app.use('/api/signatures', signatureRoutes)
app.use('/api/sign', externalSignRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/supplier-portal', supplierPortalRoutes)
app.use('/api/attachments', attachmentRoutes)
app.use('/api/sign-docs', signDocsRoutes)
app.use('/api/sign-ext', signExtRoutes)

// Operations
app.use('/api/operations/purchase', purchaseRoutes)
app.use('/api/operations/travel', travelRoutes)
app.use('/api/operations/cab', cabRoutes)

// HR
app.use('/api/hr/recruitment', recruitmentRoutes)
app.use('/api/hr/onboarding', onboardingRoutes)
app.use('/api/hr/performance', performanceRoutes)
app.use('/api/hr/it-requests', itRequestRoutes)
app.use('/api/hr/induction', inductionRoutes)

// Assets
app.use('/api/assets', assetRoutes)

// Inventory
app.use('/api/inventory', inventoryRoutes)
app.use('/api/inventory/warehouses', warehouseRoutes)

app.use(errorHandler)

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`ERP Server running on port ${PORT}`)
  startReminderScheduler()
})

module.exports = app
