import { createHash } from "node:crypto";
import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";
export type WorkbookRecord = {
  name: string;
  size: number;
  sha256: string;
  savedAt: string;
  buffer: Buffer;
};
export type WorkbookMeta = Omit<WorkbookRecord, "buffer">;
export interface WorkbookRepository {
  get(owner: string): Promise<WorkbookRecord | null>;
  meta(owner: string): Promise<WorkbookMeta | null>;
  save(
    owner: string,
    record: WorkbookRecord,
    expected: string,
  ): Promise<WorkbookMeta>;
}
export class WorkbookConflict extends Error {}
export function databasePool(): Pool {
  if (!process.env.DATABASE_URL) throw new Error("Base privée non configurée.");
  return mysql.createPool({
    uri: process.env.DATABASE_URL,
    connectionLimit: 5,
    timezone: "Z",
    connectTimeout: 10000,
  });
}
export async function migrate(pool: Pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS mymarket_private_workbooks (
    owner_open_id VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    file_size INT UNSIGNED NOT NULL,
    sha256 CHAR(64) CHARACTER SET ascii NOT NULL,
    saved_at DATETIME(3) NOT NULL,
    workbook_bytes MEDIUMBLOB NOT NULL
  ) ENGINE=InnoDB`);
}
function metaOf(row: RowDataPacket): WorkbookMeta {
  return {
    name: row.file_name,
    size: row.file_size,
    sha256: row.sha256,
    savedAt: new Date(row.saved_at).toISOString(),
  };
}
export function mysqlRepository(pool: Pool): WorkbookRepository {
  return {
    async get(owner) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        "SELECT file_name,file_size,sha256,saved_at,workbook_bytes FROM mymarket_private_workbooks WHERE owner_open_id=?",
        [owner],
      );
      return rows[0]
        ? { ...metaOf(rows[0]), buffer: rows[0].workbook_bytes }
        : null;
    },
    async meta(owner) {
      const [rows] = await pool.execute<RowDataPacket[]>(
        "SELECT file_name,file_size,sha256,saved_at FROM mymarket_private_workbooks WHERE owner_open_id=?",
        [owner],
      );
      return rows[0] ? metaOf(rows[0]) : null;
    },
    async save(owner, record, expected) {
      const connection = await pool.getConnection();
      const lockName =
        "mmwb:" + createHash("sha256").update(owner).digest("hex").slice(0, 59);
      let locked = false;
      let inTransaction = false;
      try {
        const [lockRows] = await connection.execute<RowDataPacket[]>(
          "SELECT GET_LOCK(?, 10) AS acquired",
          [lockName],
        );
        if (Number(lockRows[0]?.acquired) !== 1)
          throw new WorkbookConflict(
            "Une sauvegarde de votre classeur est en cours. Réessayez dans quelques instants.",
          );
        locked = true;
        await connection.beginTransaction();
        inTransaction = true;
        const [existing] = await connection.execute<RowDataPacket[]>(
          "SELECT sha256 FROM mymarket_private_workbooks WHERE owner_open_id=? FOR UPDATE",
          [owner],
        );
        const current = existing[0]?.sha256 || "none";
        if (current !== expected)
          throw new WorkbookConflict(
            "Un autre appareil a changé votre fichier. Rechargez l’import cloud avant de le remplacer.",
          );
        if (existing[0]) {
          await connection.execute(
            "UPDATE mymarket_private_workbooks SET file_name=?,file_size=?,sha256=?,saved_at=?,workbook_bytes=? WHERE owner_open_id=? AND sha256=?",
            [
              record.name,
              record.size,
              record.sha256,
              new Date(record.savedAt),
              record.buffer,
              owner,
              current,
            ],
          );
        } else {
          if (expected !== "none")
            throw new WorkbookConflict(
              "Un autre appareil a changé votre fichier. Rechargez l’import cloud avant de le remplacer.",
            );
          try {
            await connection.execute(
              "INSERT INTO mymarket_private_workbooks (owner_open_id,file_name,file_size,sha256,saved_at,workbook_bytes) VALUES (?,?,?,?,?,?)",
              [
                owner,
                record.name,
                record.size,
                record.sha256,
                new Date(record.savedAt),
                record.buffer,
              ],
            );
          } catch (error) {
            if (
              error &&
              typeof error === "object" &&
              "code" in error &&
              error.code === "ER_DUP_ENTRY"
            )
              throw new WorkbookConflict(
                "Un autre appareil a déjà enregistré un classeur. Rechargez l’état cloud avant de le remplacer.",
              );
            throw error;
          }
        }
        await connection.commit();
        inTransaction = false;
        const { buffer: _, ...meta } = record;
        return meta;
      } catch (e) {
        if (inTransaction) await connection.rollback();
        throw e;
      } finally {
        if (locked) {
          try {
            await connection.execute("SELECT RELEASE_LOCK(?)", [lockName]);
          } catch {
            // La fermeture de la connexion libère aussi le verrou nommé.
          }
        }
        connection.release();
      }
    },
  };
}
