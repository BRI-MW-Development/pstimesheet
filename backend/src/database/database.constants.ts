export const SQL_POOL = Symbol('SQL_POOL');       // Live DB — masters (read-only)
export const DEV_SQL_POOL = Symbol('DEV_SQL_POOL'); // Dev DB — timesheets (read/write)
