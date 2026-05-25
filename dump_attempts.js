import pkg from 'pg';
const { Client } = pkg;
import 'dotenv/config';

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("railway.app") ? { rejectUnauthorized: false } : false
  });
  await client.connect();
  try {
    const res = await client.query('SELECT * FROM mains_answer_attempts ORDER BY updated_at DESC LIMIT 1');
    if (res.rows.length === 0) {
      console.log("No attempts found in database.");
      return;
    }
    const row = res.rows[0];
    console.log("=== LATEST ATTEMPT DB ROW ===");
    console.log("attempt_id:", row.attempt_id);
    console.log("question_key:", row.question_key);
    console.log("score:", row.current_score, "/", row.target_score);
    console.log("air1_parsed_json:", JSON.stringify(row.air1_parsed_json, null, 2));
    console.log("basic_review_json:", JSON.stringify(row.basic_review_json, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}
main();
