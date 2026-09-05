import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env explicitly first
dotenv.config({ path: path.join(__dirname, "..", ".env") });
// Fallback to default .env if present
dotenv.config();
