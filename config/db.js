const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'interview_coach',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'abdu123',
});

pool.connect()
  .then(() => console.log('✅ PostgreSQL connected!'))
  .catch(err => console.error('❌ DB Error:', err));

module.exports = pool;