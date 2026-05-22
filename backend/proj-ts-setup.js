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

  // Insert PROJ doc sequence row if missing
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM psTsDocSequence WHERE docType = 'PROJ')
      INSERT INTO psTsDocSequence (docType, prefix, yearNo, currentNo, sequenceDigits)
      VALUES ('PROJ', 'TS-PROJ-', ${new Date().getFullYear()}, 0, 4)
  `);
  console.log('✓ psTsDocSequence PROJ row ensured');

  await pool.close();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
