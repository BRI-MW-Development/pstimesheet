-- Clear all timesheet, QC, and WO Complete data for fresh testing
-- Run against the DEV database
-- Does NOT touch: users, employees, projects, work orders, departments, approval settings

BEGIN TRANSACTION;

-- Audit trail
DELETE FROM PSTsAuditLog;

-- Login history & failed attempts
DELETE FROM PSTsLoginHistory;
DELETE FROM PSTsFailedAttempts;

-- WO Complete
DELETE FROM PsWoCompleteAttachment;
DELETE FROM PsWoComplete;

-- QC
DELETE FROM PsQcAttachment;
DELETE FROM PsQcComment;
DELETE FROM PsQcRecord;

-- Timesheets (child tables first, then header)
DELETE FROM PSTsProjLineAttachment;
DELETE FROM PSTsSystemHistory;
DELETE FROM PSTsLabourLine;
DELETE FROM PSTsMaterialLine;
DELETE FROM PSTsEquipmentLine;
DELETE FROM PSTsHeader;

-- Reset document number counters so numbering restarts from 0001
UPDATE psTsDocSequence SET currentNo = 0;

COMMIT;

-- Verify everything is empty
SELECT 'PSTsHeader'            AS tbl, COUNT(*) AS remaining FROM PSTsHeader
UNION ALL
SELECT 'PSTsLabourLine',               COUNT(*) FROM PSTsLabourLine
UNION ALL
SELECT 'PSTsMaterialLine',             COUNT(*) FROM PSTsMaterialLine
UNION ALL
SELECT 'PSTsEquipmentLine',            COUNT(*) FROM PSTsEquipmentLine
UNION ALL
SELECT 'PSTsProjLineAttachment',       COUNT(*) FROM PSTsProjLineAttachment
UNION ALL
SELECT 'PSTsSystemHistory',            COUNT(*) FROM PSTsSystemHistory
UNION ALL
SELECT 'PsQcRecord',                   COUNT(*) FROM PsQcRecord
UNION ALL
SELECT 'PsQcAttachment',               COUNT(*) FROM PsQcAttachment
UNION ALL
SELECT 'PsQcComment',                  COUNT(*) FROM PsQcComment
UNION ALL
SELECT 'PsWoComplete',                 COUNT(*) FROM PsWoComplete
UNION ALL
SELECT 'PsWoCompleteAttachment',       COUNT(*) FROM PsWoCompleteAttachment
UNION ALL
SELECT 'PSTsLoginHistory',             COUNT(*) FROM PSTsLoginHistory
UNION ALL
SELECT 'PSTsFailedAttempts',           COUNT(*) FROM PSTsFailedAttempts
UNION ALL
SELECT 'PSTsAuditLog',                 COUNT(*) FROM PSTsAuditLog;

SELECT docType, prefix, currentNo FROM psTsDocSequence ORDER BY docType;
