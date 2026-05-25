import { query } from './db/index.js';
import fs from 'fs';

async function main() {
  const res = await query("SELECT attempt_id, current_score, target_score, air1_parsed_json, air1_raw_review FROM mains_answer_attempts");
  console.log("Total rows:", res.rows.length);
  for (const row of res.rows) {
    const isScoreMatch = row.current_score === '5.5' || row.target_score === '10.5';
    const isJsonScoreMatch = row.air1_parsed_json && (row.air1_parsed_json.score === 5.5 || row.air1_parsed_json.potentialScore === 10.5);
    const isNestedJsonScoreMatch = row.air1_parsed_json && row.air1_parsed_json.card1_quickEvaluation && (row.air1_parsed_json.card1_quickEvaluation.estimatedScore === '5.5/15' || row.air1_parsed_json.card1_quickEvaluation.potentialScore === '10.5/15');
    if (isScoreMatch || isJsonScoreMatch || isNestedJsonScoreMatch) {
      console.log("MATCH FOUND:", row.attempt_id);
      fs.writeFileSync('matched_attempt.json', JSON.stringify(row, null, 2));
      return;
    }
  }
  console.log("No match found.");
}
main().catch(console.error);
