// backend/config/db.js
// --------------------------------------------------------------------------------------
// PostgreSQL connection pool
// - In production (Render), uses process.env.DATABASE_URL from Aiven
// - In local dev, falls back to individual .env values
// --------------------------------------------------------------------------------------

const { Pool } = require('pg');
require('dotenv').config(); // reads backend/.env

// Prefer DATABASE_URL if present (Render/Aiven)
let poolConfig;

if (process.env.DATABASE_URL) {
  // Render / Aiven connection
  poolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }, // required by Aiven
    max: 5,                             // stay below free-tier limit
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  };
} else {
  // Local development fallback
  poolConfig = {
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || '127.0.0.1',
    database: process.env.DB_NAME || 'sports_fans_united',
    password: process.env.DB_PASSWORD || '',
    port: Number(process.env.DB_PORT) || 5432,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

const pool = new Pool(poolConfig);

// Basic logs for debugging
pool.on('connect', () => console.log('[pg] connected'));
pool.on('error', (err) => console.error('[pg] unexpected error:', err));

// Show environment source (only once, useful during deploy)
console.log('[pg] using config', process.env.DATABASE_URL ? '→ DATABASE_URL (Render/Aiven)' : '→ .env local file');

module.exports = pool;
