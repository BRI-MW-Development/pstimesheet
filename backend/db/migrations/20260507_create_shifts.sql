/*
  Migration: Create shifts master and enforce safe references from timesheet entries.
  Target: Microsoft SQL Server
*/

SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID('dbo.shifts', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.shifts (
    id UNIQUEIDENTIFIER NOT NULL
      CONSTRAINT PK_shifts PRIMARY KEY
      CONSTRAINT DF_shifts_id DEFAULT NEWID(),

    shift_code NVARCHAR(30) NOT NULL,
    shift_name NVARCHAR(120) NOT NULL,
    start_time TIME(0) NOT NULL,
    end_time TIME(0) NOT NULL,
    grace_minutes INT NOT NULL
      CONSTRAINT DF_shifts_grace_minutes DEFAULT (0),

    status NVARCHAR(10) NOT NULL
      CONSTRAINT DF_shifts_status DEFAULT ('Active'),

    created_at DATETIME2(0) NOT NULL
      CONSTRAINT DF_shifts_created_at DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2(0) NOT NULL
      CONSTRAINT DF_shifts_updated_at DEFAULT SYSUTCDATETIME(),

    CONSTRAINT UQ_shifts_shift_code UNIQUE (shift_code),
    CONSTRAINT CK_shifts_status CHECK (status IN ('Active', 'Inactive')),
    CONSTRAINT CK_shifts_grace_minutes CHECK (grace_minutes >= 0 AND grace_minutes <= 180)
  );
END;

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE object_id = OBJECT_ID('dbo.shifts')
    AND name = 'IX_shifts_status_shift_code'
)
BEGIN
  CREATE INDEX IX_shifts_status_shift_code ON dbo.shifts(status, shift_code);
END;

/* Seed baseline shifts only when missing */
IF NOT EXISTS (SELECT 1 FROM dbo.shifts WHERE shift_code = 'SHIFT-A')
BEGIN
  INSERT INTO dbo.shifts (shift_code, shift_name, start_time, end_time, grace_minutes, status)
  VALUES ('SHIFT-A', 'Morning Shift', '06:00', '14:00', 10, 'Active');
END;

IF NOT EXISTS (SELECT 1 FROM dbo.shifts WHERE shift_code = 'SHIFT-B')
BEGIN
  INSERT INTO dbo.shifts (shift_code, shift_name, start_time, end_time, grace_minutes, status)
  VALUES ('SHIFT-B', 'Evening Shift', '14:00', '22:00', 10, 'Active');
END;

IF NOT EXISTS (SELECT 1 FROM dbo.shifts WHERE shift_code = 'SHIFT-C')
BEGIN
  INSERT INTO dbo.shifts (shift_code, shift_name, start_time, end_time, grace_minutes, status)
  VALUES ('SHIFT-C', 'Night Shift', '22:00', '06:00', 15, 'Inactive');
END;

/*
  Optional reference wiring for existing timesheet table.
  Uncomment after confirming table name/column names in your DB.

  -- 1) Add nullable FK column first (for safe rollout)
  ALTER TABLE dbo.timesheet_entries ADD shift_id UNIQUEIDENTIFIER NULL;

  -- 2) Backfill from existing shift_code column (if present)
  UPDATE te
  SET te.shift_id = s.id
  FROM dbo.timesheet_entries te
  JOIN dbo.shifts s
    ON s.shift_code = te.shift_code;

  -- 3) Add FK with NO ACTION on delete (prevents deleting in-use shifts)
  ALTER TABLE dbo.timesheet_entries
  ADD CONSTRAINT FK_timesheet_entries_shifts_shift_id
    FOREIGN KEY (shift_id) REFERENCES dbo.shifts(id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

  -- 4) Make shift_id NOT NULL only after backfill validation
  -- ALTER TABLE dbo.timesheet_entries ALTER COLUMN shift_id UNIQUEIDENTIFIER NOT NULL;
*/

COMMIT TRANSACTION;
GO

/*
  Trigger to keep updated_at fresh on modifications.
*/
CREATE OR ALTER TRIGGER dbo.trg_shifts_updated_at
ON dbo.shifts
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;

  UPDATE s
  SET updated_at = SYSUTCDATETIME()
  FROM dbo.shifts s
  INNER JOIN inserted i ON i.id = s.id;
END;
GO
