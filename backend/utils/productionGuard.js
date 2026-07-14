export function isProduction() {
  return process.env.NODE_ENV === 'production' ||
         process.env.RAILWAY_ENVIRONMENT_NAME === 'production' ||
         process.env.RAILWAY_ENVIRONMENT === 'production';
}

export function rejectInProduction(_req, res, next) {
  if (isProduction()) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}
