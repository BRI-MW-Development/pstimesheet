-- Performance indexes for PS TimeSheet
-- Run once against the DEV_SQL_POOL (PS-specific) database.
-- Each CREATE INDEX uses IF NOT EXISTS via the DROP/CREATE pattern to be re-runnable.
-- Estimated execution time: 5–30 seconds per index depending on table size; run during low-traffic.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. PSTsHeader — most-hit table: list(), filter, reportSummary, getPendingApprovals
--    Composite on (isDeleted, tsType, entryDate) covers the three most common WHERE
--    clauses; INCLUDE adds the columns needed for the SELECT so the query is covered.
-- ─────────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE  object_id = OBJECT_ID('PSTsHeader')
      AND  name      = 'IX_PSTsHeader_isDeleted_tsType_entryDate'
)
CREATE INDEX IX_PSTsHeader_isDeleted_tsType_entryDate
    ON PSTsHeader (isDeleted, tsType, entryDate DESC)
    INCLUDE (status, department_code, workOrderNo, projectId, tsDocNo, entered_by_user_id);
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PSTsLabourLine — every JOIN from PSTsHeader uses tsId; the INCLUDE avoids
--    a key lookup for the most common labour-line projections.
-- ─────────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE  object_id = OBJECT_ID('PSTsLabourLine')
      AND  name      = 'IX_PSTsLabourLine_tsId'
)
CREATE INDEX IX_PSTsLabourLine_tsId
    ON PSTsLabourLine (tsId)
    INCLUDE (employeeCode, employeeName, durationMinutes, lineNumber, startTime, endTime, projectId, taskTypeCode);
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PSTsLabourLine — getWeekEntries / getDayEntries / getWeekProjData filter by
--    employeeCode first, then join to PSTsHeader via tsId.
-- ─────────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE  object_id = OBJECT_ID('PSTsLabourLine')
      AND  name      = 'IX_PSTsLabourLine_employeeCode_tsId'
)
CREATE INDEX IX_PSTsLabourLine_employeeCode_tsId
    ON PSTsLabourLine (employeeCode, tsId);
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PsQcRecord — QC analytics GROUP BY over date ranges; isDeleted filter first.
-- ─────────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE  object_id = OBJECT_ID('PsQcRecord')
      AND  name      = 'IX_PsQcRecord_isDeleted_qcDate'
)
CREATE INDEX IX_PsQcRecord_isDeleted_qcDate
    ON PsQcRecord (isDeleted, qcDate)
    INCLUDE (status, partialFull, workOrderNo);
GO

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. PSTsHeader — getPendingApprovals and approval rule matching filter on
--    (status, tsType, isDeleted); the INCLUDE avoids key lookups for list projections.
-- ─────────────────────────────────────────────────────────────────────────────
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE  object_id = OBJECT_ID('PSTsHeader')
      AND  name      = 'IX_PSTsHeader_status_tsType_isDeleted'
)
CREATE INDEX IX_PSTsHeader_status_tsType_isDeleted
    ON PSTsHeader (status, tsType, isDeleted)
    INCLUDE (department_code, createdAt, entryDate, tsDocNo, entered_by_user_id);
GO
