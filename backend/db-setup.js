'use strict';

const sql = require('mssql');

const config = {
  server: '13.234.241.125',
  database: 'ERP-Dev',
  user: 'eljossqladmin',
  password: '@#syghe884osk',
  port: 1433,
  options: {
    trustServerCertificate: true,
  },
};

const modules = [
  'Dashboard',
  'Production Timesheets',
  'Installation Timesheets',
  'Employee Master',
  'Item Master',
  'Machinery Master',
  'Vehicle Master',
  'Project Master',
  'Work Orders',
  'Reports',
];

async function run() {
  let pool;
  try {
    pool = await sql.connect(config);
    console.log('Connected to database.');

    // ─── Create Tables ────────────────────────────────────────────────────────

    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PSTsRoles')
      CREATE TABLE PSTsRoles (
        roleCode  NVARCHAR(30)  NOT NULL PRIMARY KEY,
        roleName  NVARCHAR(100) NOT NULL,
        deptScope NVARCHAR(30)  NOT NULL DEFAULT 'All',
        status    NVARCHAR(10)  NOT NULL DEFAULT 'Active',
        createdAt DATETIME2     DEFAULT GETDATE(),
        updatedAt DATETIME2     DEFAULT GETDATE()
      )
    `);
    console.log('PSTsRoles: table ready.');

    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PSTsRolePermissions')
      CREATE TABLE PSTsRolePermissions (
        roleCode  NVARCHAR(30) NOT NULL REFERENCES PSTsRoles(roleCode),
        module    NVARCHAR(50) NOT NULL,
        canCreate BIT DEFAULT 0,
        canRead   BIT DEFAULT 0,
        canWrite  BIT DEFAULT 0,
        canDelete BIT DEFAULT 0,
        canReport BIT DEFAULT 0,
        PRIMARY KEY (roleCode, module)
      )
    `);
    console.log('PSTsRolePermissions: table ready.');

    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PSTsUsers')
      CREATE TABLE PSTsUsers (
        userId       NVARCHAR(30)  NOT NULL PRIMARY KEY,
        username     NVARCHAR(50)  NOT NULL UNIQUE,
        displayName  NVARCHAR(100) NOT NULL,
        passwordHash NVARCHAR(64)  NOT NULL,
        roleCode     NVARCHAR(30)  NOT NULL REFERENCES PSTsRoles(roleCode),
        email        NVARCHAR(150) NULL,
        phone        NVARCHAR(30)  NULL,
        status       NVARCHAR(10)  NOT NULL DEFAULT 'Active',
        createdAt    DATETIME2     DEFAULT GETDATE(),
        updatedAt    DATETIME2     DEFAULT GETDATE()
      )
    `);
    console.log('PSTsUsers: table ready.');

    // ─── Seed PSTsRoles ───────────────────────────────────────────────────────

    const rolesCount = (await pool.request().query(`SELECT COUNT(*) AS cnt FROM PSTsRoles`)).recordset[0].cnt;
    if (rolesCount === 0) {
      await pool.request().query(`
        INSERT INTO PSTsRoles (roleCode, roleName, deptScope, status) VALUES
          ('ROLE-001', 'Admin',          'All', 'Active'),
          ('ROLE-002', 'Supervisor',     'All', 'Active'),
          ('ROLE-003', 'Report Viewer',  'All', 'Active')
      `);
      console.log('PSTsRoles: seeded 3 rows.');
    } else {
      console.log(`PSTsRoles: already has ${rolesCount} row(s), skipping seed.`);
    }

    // ─── Seed PSTsRolePermissions ─────────────────────────────────────────────

    const permCount = (await pool.request().query(`SELECT COUNT(*) AS cnt FROM PSTsRolePermissions`)).recordset[0].cnt;
    if (permCount === 0) {
      // ROLE-001 Admin — all 1s
      for (const mod of modules) {
        const req = pool.request();
        req.input('mod', sql.NVarChar(50), mod);
        await req.query(`
          INSERT INTO PSTsRolePermissions (roleCode, module, canCreate, canRead, canWrite, canDelete, canReport)
          VALUES ('ROLE-001', @mod, 1, 1, 1, 1, 1)
        `);
      }
      console.log('PSTsRolePermissions: seeded ROLE-001 (Admin).');

      // ROLE-002 Supervisor
      const supervisorFull = ['Production Timesheets', 'Installation Timesheets'];
      for (const mod of modules) {
        const isFull = supervisorFull.includes(mod);
        const req = pool.request();
        req.input('mod', sql.NVarChar(50), mod);
        req.input('canCreate', sql.Bit, isFull ? 1 : 0);
        req.input('canWrite',  sql.Bit, isFull ? 1 : 0);
        req.input('canDelete', sql.Bit, 0);
        req.input('canReport', sql.Bit, isFull ? 1 : 0);
        await req.query(`
          INSERT INTO PSTsRolePermissions (roleCode, module, canCreate, canRead, canWrite, canDelete, canReport)
          VALUES ('ROLE-002', @mod, @canCreate, 1, @canWrite, @canDelete, @canReport)
        `);
      }
      console.log('PSTsRolePermissions: seeded ROLE-002 (Supervisor).');

      // ROLE-003 Report Viewer — canRead=1, canReport=1 for all
      for (const mod of modules) {
        const req = pool.request();
        req.input('mod', sql.NVarChar(50), mod);
        await req.query(`
          INSERT INTO PSTsRolePermissions (roleCode, module, canCreate, canRead, canWrite, canDelete, canReport)
          VALUES ('ROLE-003', @mod, 0, 1, 0, 0, 1)
        `);
      }
      console.log('PSTsRolePermissions: seeded ROLE-003 (Report Viewer).');
    } else {
      console.log(`PSTsRolePermissions: already has ${permCount} row(s), skipping seed.`);
    }

    // ─── Seed PSTsUsers ───────────────────────────────────────────────────────

    const usersCount = (await pool.request().query(`SELECT COUNT(*) AS cnt FROM PSTsUsers`)).recordset[0].cnt;
    if (usersCount === 0) {
      const pwHash = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a';
      await pool.request().query(`
        INSERT INTO PSTsUsers (userId, username, displayName, passwordHash, roleCode, email, phone, status) VALUES
          ('USR-0001', 'admin',  'System Admin', '${pwHash}', 'ROLE-001', 'admin@company.com', NULL, 'Active'),
          ('USR-0002', 'sara.k', 'Sara Khalid',  '${pwHash}', 'ROLE-002', 'sara@company.com',  NULL, 'Active')
      `);
      console.log('PSTsUsers: seeded 2 rows.');
    } else {
      console.log(`PSTsUsers: already has ${usersCount} row(s), skipping seed.`);
    }

    console.log('\nAll done.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

run();
