import { databasePool, migrate } from "./repository";
const pool = databasePool();
try {
  await migrate(pool);
  console.log("MYMARKET: private workbook table ready (additive migration).");
} finally {
  await pool.end();
}
