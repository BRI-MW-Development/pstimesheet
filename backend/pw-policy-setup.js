/**
 * Run once: adds mustChangePassword column to PSTsUsers,
 * creates PSTsPasswordHistory table.
 */
const sql = require('mssql');

require('dotenv').config();

const cfg = {
  server:   process.env.DEV_DB_SERVER,
  database: process.env.DEV_DB_NAME,
  user:     process.env.DEV_DB_USER,
  password: process.env.DEV_DB_PASSWORD,
  port:     Number(process.env.DEV_DB_PORT || 1433),
  options:  { trustServerCertificate: true, encrypt: true },
};

async function run() {
  const pool = await sql.connect(cfg);

  // Add mustChangePassword if missing
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME='PSTsUsers' AND COLUMN_NAME='mustChangePassword'
    )
    ALTER TABLE PSTsUsers ADD mustChangePassword BIT NOT NULL DEFAULT 0
  `);
  console.log('PSTsUsers.mustChangePassword ensured');

  // Password history table
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='PSTsPasswordHistory')
    CREATE TABLE PSTsPasswordHistory (
      id           INT IDENTITY(1,1) PRIMARY KEY,
      userId       NVARCHAR(30)  NOT NULL,
      passwordHash NVARCHAR(64)  NOT NULL,
      changedAt    DATETIME2     NOT NULL DEFAULT GETDATE(),
      CONSTRAINT FK_PwHist_User FOREIGN KEY (userId) REFERENCES PSTsUsers(userId) ON DELETE CASCADE
    )
  `);
  console.log('PSTsPasswordHistory ensured');

  await pool.close();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
