const { Pool } = require('pg');
require('dotenv').config(); // reads backend/.env

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || '127.0.0.1',
  database: process.env.DB_NAME || 'sports_fans_united',
  password: process.env.DB_PASSWORD || '',
  port: Number(process.env.DB_PORT) || 5432,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000, // fail fast instead of hanging
});

pool.on('connect', () => console.log('[pg] connected'));
pool.on('error', (err) => console.error('[pg] unexpected error:', err));

// TEMP: verify we actually loaded envs
console.log('[pg] env', {
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  DB_USER: process.env.DB_USER,
  DB_NAME: process.env.DB_NAME,
});

module.exports = pool;
