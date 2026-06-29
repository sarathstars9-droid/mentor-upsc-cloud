import pg from 'pg';
const { Client } = pg;

const url = 'postgresql://postgres:oTppMQKCyrtAQQDbqKFBxJFbBkvnuiPw@maglev.proxy.rlwy.net:47713/railway';

async function main() {
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'study_blocks'
      ORDER BY ordinal_position;
    `);
    console.log('--- study_blocks columns ---');
    console.log(res.rows.map(r => `${r.column_name} (${r.data_type})`).join('\n'));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
main();
