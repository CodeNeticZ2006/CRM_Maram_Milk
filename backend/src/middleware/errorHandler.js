const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);

  let status = err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Handle PostgreSQL specific error codes cleanly
  if (err.code === '23505') {
    status = 409; // Conflict
    const detail = err.detail || '';
    if (detail.includes('customer_code')) {
      message = 'Customer code conflict detected. A unique code has been generated, please try submitting again.';
    } else if (detail.includes('phone')) {
      message = 'A customer with this phone number already exists.';
    } else {
      message = 'A record with this unique detail already exists.';
    }
  } else if (err.code === '23503') {
    status = 400;
    message = 'Referenced item does not exist or is in use.';
  } else if (err.code === '22P02') {
    status = 400;
    message = 'Invalid ID or data format provided.';
  } else if (err.code === '23502') {
    status = 400;
    message = `Required field "${err.column || 'value'}" cannot be empty.`;
  }

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { rawError: err.message, stack: err.stack }),
  });
};

module.exports = { errorHandler };
