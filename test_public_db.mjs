import pg from 'pg';
const { Client } = pg;

const url = 'postgresql://postgres:oTppMQKCyrtAQQDbqKFBxJFbBkvnuiPw@maglev.proxy.rlwy.net:47713/railway';

async function main() {
  console.log('Connecting to public database...');
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });
  try {
    await client.connect();
    console.log('CONNECTED successfully!');
    const res = await client.query('SELECT NOW()');
    console.log('Server time:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('Connection failed:', err.message);
  }
}

main();
