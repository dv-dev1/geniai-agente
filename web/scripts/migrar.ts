import { readFileSync } from 'node:fs'
import { Pool } from '@neondatabase/serverless'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
await pool.query(readFileSync('db/schema.sql', 'utf8'))
await pool.end()
console.log('schema aplicado')
