require('dotenv').config();
const sql = require('mssql');

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

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='PSTsVehicles')
    CREATE TABLE PSTsVehicles (
      vehicleId   NVARCHAR(30)  NOT NULL PRIMARY KEY,
      plateNo     NVARCHAR(30)  NOT NULL,
      vehicleType NVARCHAR(50)  NOT NULL,
      make        NVARCHAR(80)  NULL,
      model       NVARCHAR(80)  NULL,
      yearModel   INT           NULL,
      status      NVARCHAR(10)  NOT NULL DEFAULT 'Active',
      remarks     NVARCHAR(250) NULL,
      createdAt   DATETIME2     NOT NULL DEFAULT GETDATE(),
      updatedAt   DATETIME2     NOT NULL DEFAULT GETDATE()
    )
  `);
  console.log('PSTsVehicles ensured');
  await pool.close();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
