import { Inject, Injectable } from '@nestjs/common';
import type { ConnectionPool } from 'mssql';
import * as mssql from 'mssql';
import { DEV_SQL_POOL } from '../database/database.constants';

@Injectable()
export class AnalyticsService {
  constructor(@Inject(DEV_SQL_POOL) private readonly pool: ConnectionPool) {}

  async getAll(from: string, to: string) {
    const [
      prodStats, prodMonthly, prodDept,
      instStats, instMonthly, instDept,
      qcStats, qcMonthly, qcSection, qcWeeklyBySection,
      wocProdStats, wocProdMonthly,
      wocInstStats, wocInstMonthly,
    ] = await Promise.all([
      this.tsByTypeStats(from, to, 'PROD'),
      this.tsByTypeMonthly(from, to, 'PROD'),
      this.tsDeptByType(from, to, 'PROD'),
      this.tsByTypeStats(from, to, 'INST'),
      this.tsByTypeMonthly(from, to, 'INST'),
      this.tsDeptByType(from, to, 'INST'),
      this.qcStats(from, to),
      this.qcMonthly(from, to),
      this.qcSection(from, to),
      this.qcWeeklyBySection(from, to),
      this.wocTypeStats(from, to, 'production'),
      this.wocTypeMonthly(from, to, 'production'),
      this.wocTypeStats(from, to, 'installation'),
      this.wocTypeMonthly(from, to, 'installation'),
    ]);

    return {
      production:   { summary: prodStats, monthly: prodMonthly, byDepartment: prodDept },
      installation: { summary: instStats, monthly: instMonthly, byDepartment: instDept },
      qc:           { summary: qcStats,   monthly: qcMonthly,  bySection: qcSection, weeklyBySection: qcWeeklyBySection },
      wocProduction:   { summary: wocProdStats, monthly: wocProdMonthly },
      wocInstallation: { summary: wocInstStats, monthly: wocInstMonthly },
    };
  }

  /* ── Timesheet stats ─────────────────────────────── */
  /* Stats for a specific tsType */
  private async tsByTypeStats(from: string, to: string, tsType: string) {
    const res = await this.pool.request()
      .input('from',   mssql.NVarChar(20), from)
      .input('to',     mssql.NVarChar(20), to)
      .input('tsType', mssql.NVarChar(10), tsType)
      .query(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status='Draft'     THEN 1 ELSE 0 END) AS draft,
          SUM(CASE WHEN status='Submitted' THEN 1 ELSE 0 END) AS submitted,
          SUM(CASE WHEN status='Approved'  THEN 1 ELSE 0 END) AS approved,
          SUM(CASE WHEN status='Rejected'  THEN 1 ELSE 0 END) AS rejected
        FROM PSTsHeader
        WHERE isDeleted = 0 AND tsType = @tsType AND entryDate >= @from AND entryDate <= @to
      `);
    return res.recordset[0] ?? {};
  }

  private async tsByTypeMonthly(from: string, to: string, tsType: string) {
    const res = await this.pool.request()
      .input('from',   mssql.NVarChar(20), from)
      .input('to',     mssql.NVarChar(20), to)
      .input('tsType', mssql.NVarChar(10), tsType)
      .query(`
        SELECT
          FORMAT(CAST(entryDate AS DATE), 'yyyy-MM') AS month,
          COUNT(*) AS total,
          SUM(CASE WHEN status='Approved'  THEN 1 ELSE 0 END) AS approved,
          SUM(CASE WHEN status='Submitted' THEN 1 ELSE 0 END) AS submitted,
          SUM(CASE WHEN status='Draft'     THEN 1 ELSE 0 END) AS draft,
          SUM(CASE WHEN status='Rejected'  THEN 1 ELSE 0 END) AS rejected
        FROM PSTsHeader
        WHERE isDeleted = 0 AND tsType = @tsType AND entryDate >= @from AND entryDate <= @to
        GROUP BY FORMAT(CAST(entryDate AS DATE), 'yyyy-MM')
        ORDER BY month
      `);
    return res.recordset;
  }

  private async tsDeptByType(from: string, to: string, tsType: string) {
    const res = await this.pool.request()
      .input('from',   mssql.NVarChar(20), from)
      .input('to',     mssql.NVarChar(20), to)
      .input('tsType', mssql.NVarChar(10), tsType)
      .query(`
        SELECT TOP 10
          ISNULL(department_code,'Unknown') AS name,
          COUNT(*) AS total,
          SUM(CASE WHEN status='Approved' THEN 1 ELSE 0 END) AS approved
        FROM PSTsHeader
        WHERE isDeleted = 0 AND tsType = @tsType AND entryDate >= @from AND entryDate <= @to
        GROUP BY department_code
        ORDER BY total DESC
      `);
    return res.recordset;
  }

  /* ── WO Complete by keyword type ───────────────────── */
  private wocTypeFilter(type: string): string {
    return type === 'production'
      ? `(LOWER(ISNULL(department,'')) LIKE '%production%' OR LOWER(ISNULL(sourceType,'')) LIKE '%operation%')`
      : `(LOWER(ISNULL(department,'')) LIKE '%installation%' OR LOWER(ISNULL(sourceType,'')) LIKE '%installation%')`;
  }

  private async wocTypeStats(from: string, to: string, type: string) {
    const filter = this.wocTypeFilter(type);
    const res = await this.pool.request()
      .input('from', mssql.NVarChar(20), from)
      .input('to',   mssql.NVarChar(20), to)
      .query(`SELECT COUNT(*) AS total FROM PsWoComplete WHERE isDeleted=0 AND completedDate>=@from AND completedDate<=@to AND ${filter}`);
    return res.recordset[0] ?? { total: 0 };
  }

  private async wocTypeMonthly(from: string, to: string, type: string) {
    const filter = this.wocTypeFilter(type);
    const res = await this.pool.request()
      .input('from', mssql.NVarChar(20), from)
      .input('to',   mssql.NVarChar(20), to)
      .query(`
        SELECT FORMAT(CAST(completedDate AS DATE),'yyyy-MM') AS month, COUNT(*) AS count
        FROM PsWoComplete
        WHERE isDeleted=0 AND completedDate>=@from AND completedDate<=@to AND ${filter}
        GROUP BY FORMAT(CAST(completedDate AS DATE),'yyyy-MM')
        ORDER BY month
      `);
    return res.recordset;
  }

  private async qcMonthly(from: string, to: string) {
    const res = await this.pool.request()
      .input('from', mssql.NVarChar(20), from).input('to', mssql.NVarChar(20), to)
      .query(`
        SELECT FORMAT(CAST(qcDate AS DATE),'yyyy-MM') AS month, COUNT(*) AS total,
          SUM(CASE WHEN status='Passed'      THEN 1 ELSE 0 END) AS passed,
          SUM(CASE WHEN status='Failed'      THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN status='In Progress' THEN 1 ELSE 0 END) AS inProgress
        FROM PsQcRecord WHERE isDeleted=0 AND qcDate>=@from AND qcDate<=@to
        GROUP BY FORMAT(CAST(qcDate AS DATE),'yyyy-MM') ORDER BY month
      `);
    return res.recordset;
  }

  private async qcSection(from: string, to: string) {
    const res = await this.pool.request()
      .input('from', mssql.NVarChar(20), from).input('to', mssql.NVarChar(20), to)
      .query(`SELECT checklistData FROM PsQcRecord WHERE isDeleted=0 AND checklistData IS NOT NULL AND qcDate>=@from AND qcDate<=@to`);
    const map: Record<string, { pass: number; fail: number; na: number }> = {};
    for (const row of res.recordset) {
      try {
        const cl = JSON.parse(row.checklistData);
        for (const [sec, items] of Object.entries(cl)) {
          if (sec === '__sectionNA') continue;
          if (!map[sec]) map[sec] = { pass: 0, fail: 0, na: 0 };
          for (const val of Object.values(items as Record<string, string>)) {
            if (val === 'Pass') map[sec].pass++;
            else if (val === 'Fail') map[sec].fail++;
            else map[sec].na++;
          }
        }
      } catch {}
    }
    return Object.entries(map).map(([name, c]) => ({
      name, pass: c.pass, fail: c.fail, na: c.na, total: c.pass + c.fail,
      passRate: c.pass + c.fail > 0 ? Math.round(c.pass / (c.pass + c.fail) * 100) : 100,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  private isoWeek(dateStr: string): number {
    const d = new Date(dateStr);
    const day = d.getDay() || 7;
    d.setDate(d.getDate() + 4 - day);
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  private async qcWeeklyBySection(from: string, to: string) {
    const res = await this.pool.request()
      .input('from', mssql.NVarChar(20), from)
      .input('to',   mssql.NVarChar(20), to)
      .query<{ qcDate: string; status: string; checklistData: string }>(`
        SELECT qcDate, status, checklistData
        FROM PsQcRecord
        WHERE isDeleted=0 AND checklistData IS NOT NULL AND qcDate>=@from AND qcDate<=@to
      `);

    const sectionMap: Record<string, Record<number, { passed: number; failed: number; inProgress: number }>> = {};
    const itemMap:    Record<string, Record<string, Record<number, number>>> = {};

    for (const row of res.recordset) {
      try {
        const cl   = JSON.parse(row.checklistData);
        const week = this.isoWeek(row.qcDate);

        for (const [sec, items] of Object.entries(cl)) {
          if (sec === '__sectionNA') continue;
          const vals = items as Record<string, string>;

          // Per-item failure counts
          for (const [item, val] of Object.entries(vals)) {
            if (val !== 'Fail') continue;
            if (!itemMap[sec])       itemMap[sec]       = {};
            if (!itemMap[sec][item]) itemMap[sec][item] = {};
            itemMap[sec][item][week] = (itemMap[sec][item][week] ?? 0) + 1;
          }

          // Section-level (record had at least one fail in this section)
          if (!Object.values(vals).some(v => v === 'Fail')) continue;
          if (!sectionMap[sec])       sectionMap[sec]       = {};
          if (!sectionMap[sec][week]) sectionMap[sec][week] = { passed: 0, failed: 0, inProgress: 0 };
          if (row.status === 'Passed')      sectionMap[sec][week].passed++;
          else if (row.status === 'Failed') sectionMap[sec][week].failed++;
          else                              sectionMap[sec][week].inProgress++;
        }
      } catch {}
    }

    const allSections = new Set([...Object.keys(sectionMap), ...Object.keys(itemMap)]);
    const result: Record<string, unknown> = {};
    for (const sec of allSections) {
      result[sec] = {
        weekly: Object.entries(sectionMap[sec] ?? {})
          .map(([w, c]) => ({ week: Number(w), ...c, total: c.passed + c.failed + c.inProgress }))
          .sort((a, b) => a.week - b.week),
        items: Object.fromEntries(
          Object.entries(itemMap[sec] ?? {}).map(([item, weeks]) => [
            item,
            Object.entries(weeks)
              .map(([w, count]) => ({ week: Number(w), count }))
              .sort((a, b) => a.week - b.week),
          ])
        ),
      };
    }
    return result;
  }

  private async qcStats(from: string, to: string) {
    const res = await this.pool.request()
      .input('from', mssql.NVarChar(20), from).input('to', mssql.NVarChar(20), to)
      .query(`
        SELECT COUNT(*) AS total,
          SUM(CASE WHEN status='Passed'      THEN 1 ELSE 0 END) AS passed,
          SUM(CASE WHEN status='Failed'      THEN 1 ELSE 0 END) AS failed,
          SUM(CASE WHEN status='In Progress' THEN 1 ELSE 0 END) AS inProgress,
          CASE WHEN COUNT(*)=0 THEN 0
               ELSE CAST(SUM(CASE WHEN status='Passed' THEN 1 ELSE 0 END)*100.0/COUNT(*) AS INT) END AS passRate
        FROM PsQcRecord WHERE isDeleted=0 AND qcDate>=@from AND qcDate<=@to
      `);
    return res.recordset[0] ?? {};
  }
}
