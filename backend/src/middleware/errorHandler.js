const errorHandler = (err, req, res, next) => {
  console.error(err.stack)

  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry — record already exists' })
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record does not exist' })
  }
  if (err.code === '22P02') {
    return res.status(400).json({ error: 'Invalid ID format' })
  }

  const status = err.status || err.statusCode || 500
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
}

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

module.exports = { errorHandler, asyncHandler }
