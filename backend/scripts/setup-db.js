import fs from 'fs';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

async function setupDatabase() {
  try {
    console.log('Setting up database...');

    // Read schema file
    const schemaPath = path.join(path.dirname(new URL(import.meta.url).pathname), '../src/db/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Execute schema
    await pool.query(schema);

    console.log('✓ Database schema created successfully');
    console.log('✓ Tool "Tool-1" seeded with wear_limit 170');
  } catch (err) {
    console.error('Error setting up database:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupDatabase();
