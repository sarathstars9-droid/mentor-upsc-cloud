import pg from 'pg';
const { Client } = pg;

const url = 'postgresql://postgres:oTppMQKCyrtAQQDbqKFBxJFbBkvnuiPw@maglev.proxy.rlwy.net:47713/railway';

async function main() {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to production DB');
    await client.query(`
      ALTER TABLE public.study_blocks 
      ADD COLUMN IF NOT EXISTS completion_source text DEFAULT 'manual',
      ADD COLUMN IF NOT EXISTS completed_by text,
      ADD COLUMN IF NOT EXISTS proof_required boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS proof_uploaded boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS proof_status text,
      ADD COLUMN IF NOT EXISTS is_test_data boolean DEFAULT false;
    `);
    console.log('Successfully altered study_blocks table schema.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}
main();
