// backend/config/db.js
// --------------------------------------------------------------------------------------
// PostgreSQL connection pool
// - In production (Render), uses process.env.DATABASE_URL from Aiven
// - In local dev, falls back to individual .env values
// --------------------------------------------------------------------------------------

const { Pool } = require('pg');
require('dotenv').config(); // reads backend/.env

let poolConfig;

if (process.env.DATABASE_URL) {
  // Production (Render + Aiven)
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false, // allow Aiven's managed certs
    },
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  };
} else {
  // Local dev fallback
  poolConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || '127.0.0.1',
    database: process.env.DB_NAME || 'sports_fans_united',
    password: process.env.DB_PASSWORD || '',
    port: Number(process.env.DB_PORT) || 5432,
    ssl: false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

const pool = new Pool(poolConfig);

pool.on('connect', () => console.log('[pg] connected to database'));
pool.on('error', (err) => console.error('[pg] error:', err));

module.exports = pool;
