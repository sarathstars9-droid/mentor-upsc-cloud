import pg from 'pg';
const { Client } = pg;

const url = 'postgresql://postgres:oTppMQKCyrtAQQDbqKFBxJFbBkvnuiPw@maglev.proxy.rlwy.net:47713/railway';

async function testWithSsl(useSsl) {
  console.log(`Connecting to public database with ssl = ${useSsl ? 'enabled' : 'disabled'}...`);
  const client = new Client({
    connectionString: url,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000
  });
  try {
    await client.connect();
    console.log(`SUCCESS with ssl = ${useSsl ? 'enabled' : 'disabled'}!`);
    const res = await client.query('SELECT NOW()');
    console.log('Server time:', res.rows[0]);
    await client.end();
    return true;
  } catch (err) {
    console.error(`FAILED with ssl = ${useSsl ? 'enabled' : 'disabled'}:`, err.message);
    return false;
  }
}

async function main() {
  const ok1 = await testWithSsl(true);
  const ok2 = await testWithSsl(false);
  process.exit(ok1 || ok2 ? 0 : 1);
}

main();
