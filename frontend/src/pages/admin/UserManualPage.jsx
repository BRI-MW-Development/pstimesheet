import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SECTIONS = [
  {
    id: 'overview',
    icon: '📖',
    title: 'Overview',
    content: <OverviewSection />,
  },
  {
    id: 'timesheets',
    icon: '📋',
    title: 'Timesheets',
    content: <TimesheetsSection />,
  },
  {
    id: 'qc',
    icon: '🔍',
    title: 'QC Records',
    content: <QCSection />,
  },
  {
    id: 'reports',
    icon: '📈',
    title: 'Reports & Analytics',
    content: <ReportsSection />,
  },
  {
    id: 'users',
    icon: '👤',
    title: 'Users & Access',
    content: <UsersSection />,
  },
  {
    id: 'roles',
    icon: '🔐',
    title: 'Roles & Permissions',
    content: <RolesSection />,
  },
  {
    id: 'shifts',
    icon: '🕐',
    title: 'Shift Setup',
    content: <ShiftsSection />,
  },
  {
    id: 'hod-teams',
    icon: '👥',
    title: 'HOD Teams',
    content: <HodTeamsSection />,
  },
  {
    id: 'approvals',
    icon: '✅',
    title: 'Approval Settings',
    content: <ApprovalsSection />,
  },
  {
    id: 'email',
    icon: '📧',
    title: 'Email Settings',
    content: <EmailSection />,
  },
  {
    id: 'doc-numbering',
    icon: '🔢',
    title: 'Document Numbering',
    content: <DocNumberingSection />,
  },
  {
    id: 'notifications',
    icon: '🔔',
    title: 'Notifications',
    content: <NotificationsSection />,
  },
];

function Tip({ children }) {
  return (
    <div style={{
      background: 'var(--accent-glow, rgba(15,113,115,0.08))',
      border: '1px solid var(--accent, #0f7173)',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 13,
      color: 'var(--text)',
      marginTop: 10,
      display: 'flex',
      gap: 8,
      alignItems: 'flex-start',
      lineHeight: 1.55,
    }}>
      <span style={{ flexShrink: 0 }}>💡</span>
      <span>{children}</span>
    </div>
  );
}

function Warn({ children }) {
  return (
    <div style={{
      background: 'rgba(234,179,8,0.08)',
      border: '1px solid #ca8a04',
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: 13,
      color: 'var(--text)',
      marginTop: 10,
      display: 'flex',
      gap: 8,
      alignItems: 'flex-start',
      lineHeight: 1.55,
    }}>
      <span style={{ flexShrink: 0 }}>⚠️</span>
      <span>{children}</span>
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: '22px 0 8px', borderBottom: '1px solid var(--border2)', paddingBottom: 6 }}>
      {children}
    </h3>
  );
}

function Step({ n, children }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'flex-start' }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', background: 'var(--accent, #0f7173)',
        color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexShrink: 0, marginTop: 1,
      }}>{n}</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, flex: 1 }}>{children}</div>
    </div>
  );
}

function FieldRow({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 13, lineHeight: 1.55 }}>
      <span style={{ fontWeight: 600, color: 'var(--text)', minWidth: 140, flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--text2)' }}>{children}</span>
    </div>
  );
}

/* ─── Section content components ─── */

function TimesheetsSection() {
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
        Timesheets record the daily work performed by employees. OpsDesk has three timesheet types:
        <strong> Production (PROD)</strong>, <strong>Installation (INST)</strong>, and
        <strong> Projects Team (PROJ)</strong>. Each follows the same lifecycle but captures
        different fields relevant to that department.
      </p>

      <SectionHeading>Timesheet lifecycle</SectionHeading>
      <div style={{ display: 'flex', gap: 0, marginTop: 10, flexWrap: 'wrap' }}>
        {[
          ['Draft', 'Saved but not submitted. Only visible to the employee.', 'var(--text3)'],
          ['Submitted', 'Sent for approval. Approvers notified by email.', '#d97706'],
          ['Approved', 'Accepted by approver. Record is locked.', '#16a34a'],
          ['Rejected', 'Returned with a reason. Employee can edit and resubmit.', '#dc2626'],
        ].map(([label, desc, color], i, arr) => (
          <div key={label} style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 130 }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 12px', flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{desc}</div>
            </div>
            {i < arr.length - 1 && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px', color: 'var(--text3)', fontSize: 14 }}>→</div>
            )}
          </div>
        ))}
      </div>

      <SectionHeading>Submitting a timesheet</SectionHeading>
      <Step n={1}>Go to <strong>Timesheets → Production</strong> (or Installation / Projects Team) and click <em>+ New Timesheet</em>.</Step>
      <Step n={2}>Select the <strong>Project</strong> and <strong>Work Order</strong> the work is being logged against.</Step>
      <Step n={3}>Choose a <strong>Shift</strong> — this controls what start/end time combinations are valid (including overnight for OPN shift).</Step>
      <Step n={4}>Add labour rows: select an employee, enter start time, end time, and task type. Repeat for each employee working on the day.</Step>
      <Step n={5}>Add resource rows if applicable (items, machinery, vehicles).</Step>
      <Step n={6}>Click <em>Save as Draft</em> to save without submitting, or <em>Submit</em> to send for approval.</Step>

      <Tip>
        A submitted timesheet cannot be edited. If a mistake is found after submission ask an approver to
        reject it — the employee can then correct and resubmit.
      </Tip>

      <SectionHeading>Labour rows — key fields</SectionHeading>
      <FieldRow label="Employee">Select from the active employee list. Only employees linked to the current department appear unless the user has full scope.</FieldRow>
      <FieldRow label="Start / End Time">HH:MM format. For OPN (Open Shift) end time can be earlier than start time — the system treats it as the following day and shows a 🌙 +1 day badge.</FieldRow>
      <FieldRow label="Task Type">Category of work performed (e.g. Fabrication, Painting, Installation). Managed under Master Data → Task Types.</FieldRow>
      <FieldRow label="Notes">Optional free-text notes for the labour line. Visible to approvers.</FieldRow>

      <SectionHeading>Overnight entries</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        When the <strong>OPN</strong> shift is selected, entering an end time before the start time is valid
        and represents a task spanning midnight. For example, Start 22:00 → End 06:00 = 8 hours. The
        <strong> 🌙 +1 day</strong> badge confirms the system has detected the overnight span. No need to
        split the task across two lines.
      </p>

      <SectionHeading>Pending Approvals</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        Approvers see all submitted timesheets waiting for action at <strong>Timesheets → Pending Approvals</strong>.
        Clicking a row opens the timesheet in view mode. Use <em>Approve</em> to accept or <em>Reject</em>
        (with a mandatory reason) to return it to the employee.
      </p>

      <SectionHeading>Timeline view</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        <strong>Timesheets → Timeline</strong> shows a visual calendar of all submitted and approved
        timesheets per employee for a selected date range. Each employee card shows a photo avatar (if
        uploaded), their name, and a colour-coded strip for each day worked. Click a strip to see the
        full day's detail. Use the <strong>HOD Team</strong> filter to narrow the view to a single team.
      </p>
      <Tip>
        Employees shown with a dashed red border in Timeline submitted no timesheet for that period.
        This makes it easy to spot attendance gaps without running a report.
      </Tip>
    </div>
  );
}

function QCSection() {
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
        QC Records capture quality control inspections performed on work orders. Each record links to
        a specific work order and tracks inspection results, signoffs, and any punch list items.
        Go to <strong>QC → QC Records</strong>.
      </p>

      <SectionHeading>QC record lifecycle</SectionHeading>
      <div style={{ display: 'flex', gap: 0, marginTop: 10, flexWrap: 'wrap' }}>
        {[
          ['Draft', 'Saved locally, not finalised.', 'var(--text3)'],
          ['Submitted', 'Sent for client/supervisor review.', '#d97706'],
          ['Approved', 'Inspection passed and signed off.', '#16a34a'],
          ['Rejected', 'Issues found, record returned for correction.', '#dc2626'],
        ].map(([label, desc, color], i, arr) => (
          <div key={label} style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 130 }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 12px', flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{desc}</div>
            </div>
            {i < arr.length - 1 && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 4px', color: 'var(--text3)', fontSize: 14 }}>→</div>
            )}
          </div>
        ))}
      </div>

      <SectionHeading>Creating a QC record</SectionHeading>
      <Step n={1}>Go to <strong>QC → QC Records</strong> and click <em>+ New QC Record</em>.</Step>
      <Step n={2}>Select the <strong>Work Order</strong> and <strong>Project</strong> being inspected.</Step>
      <Step n={3}>Choose <strong>Partial</strong> or <strong>Full</strong> inspection type.</Step>
      <Step n={4}>Fill in inspection checklist items and mark each as Pass / Fail / N/A.</Step>
      <Step n={5}>Add any punch list items (defects or outstanding actions) with descriptions.</Step>
      <Step n={6}>Attach photos if required using the attachment section.</Step>
      <Step n={7}>Click <em>Save as Draft</em> or <em>Submit</em> when complete.</Step>

      <SectionHeading>Key fields</SectionHeading>
      <FieldRow label="Work Order">The ERP work order number being inspected. Drives project and client data.</FieldRow>
      <FieldRow label="Inspection Type">Partial — a mid-progress check. Full — final sign-off inspection.</FieldRow>
      <FieldRow label="Inspector">The employee conducting the inspection. Defaults to the logged-in user.</FieldRow>
      <FieldRow label="Punch List">Outstanding items that must be resolved before final sign-off. Each item has a description and status.</FieldRow>
      <FieldRow label="Client Signature">A sign-off field captured on-site. Required for Full inspections in most workflows.</FieldRow>

      <SectionHeading>Printing a QC record</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        Open any QC record and click <em>Print</em>. The record opens in a clean print-optimised layout
        in a new tab. Use your browser's print function (Ctrl/Cmd+P) to print or save as PDF.
      </p>

      <Tip>
        QC record IDs follow the document numbering sequence configured under Settings → Doc Numbering.
        The prefix for QC records is set there and applies to all new records going forward.
      </Tip>
    </div>
  );
}

function ReportsSection() {
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
        The Reports section provides pre-built and filterable exports for timesheets and project activity.
        Audit Trail records every action taken in the system for compliance purposes.
        Analytics is a separate top-level menu with visual charts across Production, Installation, QC, and WO Complete.
      </p>

      <SectionHeading>Reports (tabular export)</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        Go to <strong>Reports → Reports</strong>. Apply filters then click <em>Generate</em> to load the table.
        Use the <em>Export to Excel</em> button to download the result as a spreadsheet.
      </p>
      <FieldRow label="Report Type">Choose Production, Installation, or Projects Team timesheet data.</FieldRow>
      <FieldRow label="Date Range">Filter by timesheet date. Leave blank to return all dates.</FieldRow>
      <FieldRow label="Project / Work Order">Narrow to a specific job.</FieldRow>
      <FieldRow label="Department">Filter by ERP department code.</FieldRow>
      <FieldRow label="Status">Filter by Draft, Submitted, Approved, or Rejected.</FieldRow>
      <FieldRow label="Employee">Filter to a single employee's records.</FieldRow>

      <Tip>
        The report respects your data scope. HOD-scoped users only see records from their departments.
        Admins with All scope see the full dataset.
      </Tip>

      <SectionHeading>Analytics</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        Analytics is a separate top-level menu in the sidebar. Select a date range at the top of the page,
        then choose a sub-section. Requires the <strong>Analytics → canReport</strong> permission.
      </p>
      <FieldRow label="Production">
        Monthly Approval Rate % trend (line chart with visual gaps for months with no timesheets) and a
        Status Distribution donut showing the overall Draft / Submitted / Approved / Rejected split.
        KPI cards show totals for the period.
      </FieldRow>
      <FieldRow label="Installation">
        Same layout as Production but scoped to INST-type timesheets.
      </FieldRow>
      <FieldRow label="QC">
        Monthly QC trend (Passed / Failed / In Progress bars, nil months shown as zero). Below that,
        a <em>QC Rejections by Section</em> chart shows rejection counts per ISO week for each checklist
        section — always displayed even when there are no rejections. Click any section bar to expand
        a per-criteria breakdown: one ComposedChart per checklist item showing weekly fail counts as
        bars with a dashed trend line overlay.
      </FieldRow>
      <FieldRow label="WO Complete">
        Monthly completion count trend for Production and Installation WO completions.
      </FieldRow>

      <SectionHeading>Audit Trail</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        Go to <strong>Reports → Audit Trail</strong>. Every create, update, approve, reject, and delete
        action is logged with the user, timestamp, and a before/after snapshot of the changed fields.
        Use filters to narrow by user, action type, module, or date range.
      </p>

      <Warn>
        Audit Trail records cannot be edited or deleted — they are append-only for compliance. If you
        need to query historical data beyond the UI's date range, contact a database administrator for
        a direct report.
      </Warn>

      <SectionHeading>Detail Reports</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        From the INST and PROD timesheet lists, click the <em>Detail Report</em> button to generate a
        breakdown filtered by <strong>Project ID</strong> and <strong>Work Order number</strong>. This
        shows all labour and resource lines recorded against a specific job — useful for billing and
        project cost tracking.
      </p>
    </div>
  );
}

function OverviewSection() {
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 14 }}>
        Welcome to the <strong>OpsDesk Settings</strong> guide. This manual is intended for system administrators
        and covers all configuration areas of the application. Use the menu on the left to jump to any topic.
      </p>

      <SectionHeading>What admins can configure</SectionHeading>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginTop: 8 }}>
        {[
          ['📋', 'Timesheets', 'Log daily labour and resources per work order'],
          ['🔍', 'QC Records', 'Capture inspection results and punch lists'],
          ['📈', 'Reports', 'Export timesheet data, analytics, and audit trail'],
          ['👤', 'Users', 'Create and manage login accounts'],
          ['🔐', 'Roles', 'Define what each user can see and do'],
          ['🕐', 'Shifts', 'Set up work shifts including overnight'],
          ['👥', 'HOD Teams', 'Organise department-head visibility groups'],
          ['✅', 'Approvals', 'Route timesheet approvals to the right people'],
          ['📧', 'Email', 'Configure SMTP for notification emails'],
          ['🔢', 'Doc Numbering', 'Control document ID sequences and prefixes'],
          ['🔔', 'Notifications', 'Set personal notification preferences'],
        ].map(([icon, title, desc]) => (
          <div key={title} style={{
            background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8,
            padding: '12px 14px',
          }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{title}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{desc}</div>
          </div>
        ))}
      </div>

      <SectionHeading>Getting around</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
        All Settings pages are accessed from the top navigation bar under the <strong>Settings</strong> and
        <strong> Access Control</strong> menus. They are only visible to users whose role includes the
        appropriate read permission.
      </p>

      <Tip>
        Changes take effect immediately — there is no separate "publish" or "deploy" step.
        Users may need to refresh their browser to see permission changes.
      </Tip>
    </div>
  );
}

function UsersSection() {
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
        The <strong>Users</strong> page (Access Control → Users) lets you create login accounts,
        link them to employee records, assign roles, reset passwords, and impersonate users for support.
      </p>

      <SectionHeading>Creating a new user</SectionHeading>
      <Step n={1}>Go to <strong>Access Control → Users</strong> and click <em>+ Add User</em>.</Step>
      <Step n={2}>Fill in the user's details — display name, username, email, and initial password.</Step>
      <Step n={3}>Select a <strong>Role</strong> from the dropdown. The role determines what the user can see.</Step>
      <Step n={4}>Optionally link an <strong>Employee Code</strong> to connect the account to an employee record (required for profile photo sync and timesheet submissions).</Step>
      <Step n={5}>Click <em>Create User</em>. The user can log in immediately with the provided password.</Step>

      <Tip>
        Tick <strong>Must change password on next login</strong> when creating accounts so users set their own password before doing any work.
      </Tip>

      <SectionHeading>Editing a user</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        Click the pencil icon on any row to edit. You can change the role, email, display name, and employee
        link at any time. To reset a password, open the edit panel and use the <em>Reset Password</em> action.
      </p>

      <SectionHeading>Impersonating a user</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        The impersonate button (person icon) opens a separate browser tab logged in as that user. This is
        useful for troubleshooting permission issues. Your own admin session is not affected — close the
        impersonation tab to end it.
      </p>

      <Warn>
        Impersonation creates a short-lived session token. The tab expires automatically and cannot be
        used to perform irreversible actions on behalf of the user beyond what their role allows.
      </Warn>

      <SectionHeading>Deactivating a user</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        Set the user's status to <strong>Inactive</strong> to prevent login without deleting the account.
        All their historical data (timesheets, QC records) is preserved.
      </p>
    </div>
  );
}

function RolesSection() {
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
        Roles define exactly what each user group can read, write, and report on.
        Go to <strong>Access Control → Roles</strong> to manage them.
      </p>

      <SectionHeading>Understanding permissions</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 10 }}>
        Each module (e.g. PROD, INST, QC, REPORTS) has up to three permission flags:
      </p>
      <FieldRow label="Can Read">User can view the list and open records. Without this, the menu link is hidden.</FieldRow>
      <FieldRow label="Can Write">User can create and edit records. Editing is blocked in view-only mode if this is off.</FieldRow>
      <FieldRow label="Can Report">User can access the Reports and Analytics pages for this module.</FieldRow>

      <SectionHeading>Creating a role</SectionHeading>
      <Step n={1}>Click <em>+ Add Role</em> and give the role a code (e.g. <code>ROLE-EMP</code>) and a descriptive name.</Step>
      <Step n={2}>Tick the permissions each module should have for this role. Only tick what is actually needed.</Step>
      <Step n={3}>Click <em>Save Role</em>. You can then assign this role to users immediately.</Step>

      <SectionHeading>Data scope</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        The <strong>Data Scope</strong> setting on a role controls which records a user sees:
      </p>
      <FieldRow label="All">User sees every record in the system regardless of department or team.</FieldRow>
      <FieldRow label="Own">User sees only records they personally submitted.</FieldRow>
      <FieldRow label="HOD">User sees records from the departments in their HOD Team. Use this for department heads.</FieldRow>

      <Tip>
        HOD data scope only works if the user's employee code is added to at least one HOD Team. If a HOD
        user can't see their team's timesheets, check the HOD Teams configuration.
      </Tip>
    </div>
  );
}

function ShiftsSection() {
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
        Shifts define the standard working hours employees select when submitting timesheets.
        Go to <strong>Settings → Shift Setup</strong>.
      </p>

      <SectionHeading>Shift fields</SectionHeading>
      <FieldRow label="Shift Code">Unique identifier (e.g. <code>SHIFT-A</code>, <code>OPN</code>). Cannot be changed after creation.</FieldRow>
      <FieldRow label="Shift Name">Human-readable label shown in timesheet dropdowns (e.g. "Morning Shift").</FieldRow>
      <FieldRow label="Start / End Time">Expected start and end of the shift in HH:MM format. Night shifts (e.g. 22:00–06:00) are valid.</FieldRow>
      <FieldRow label="Grace Period">Minutes of tolerance before a late arrival is flagged. Set to 0 to disable.</FieldRow>
      <FieldRow label="Allow overnight entries">When ticked, employees selecting this shift can enter tasks where the end time is before the start time (spanning midnight). The system automatically adds 24 h to calculate the correct duration.</FieldRow>
      <FieldRow label="Status">Active shifts appear in timesheet dropdowns. Inactive shifts are hidden from employees.</FieldRow>

      <SectionHeading>Overnight (Open Shift)</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        The <strong>OPN</strong> (Open Shift) code is pre-configured with <em>Allow overnight entries</em> enabled.
        When an employee selects this shift they can enter a task that starts at, say, 21:00 and ends at 06:00
        the following morning without splitting it into two lines.
      </p>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginTop: 8 }}>
        A <strong>🌙 +1 day</strong> badge appears next to the end-time field as a visual reminder that the
        task ends the following calendar day. The system records the correct duration automatically.
      </p>

      <Tip>
        Only enable overnight entries on shifts where it makes sense operationally. For all other shifts the
        validation rule remains: end time must be after start time.
      </Tip>

      <SectionHeading>Deactivating a shift</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        Setting a shift to <em>Inactive</em> hides it from new timesheets but does not affect existing
        records that already reference it. Shift codes cannot be deleted once used.
      </p>
    </div>
  );
}

function HodTeamsSection() {
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
        HOD Teams group departments under a department head so that a HOD-scoped user only sees
        timesheets for their own departments. Go to <strong>Access Control → HOD Teams</strong>.
      </p>

      <SectionHeading>Creating a HOD Team</SectionHeading>
      <Step n={1}>Click <em>+ Add Team</em>.</Step>
      <Step n={2}>Enter a team name and select the <strong>HOD Employee</strong> — this must match the employee code linked to the HOD's user account.</Step>
      <Step n={3}>Add one or more <strong>Department Codes</strong> that this HOD oversees.</Step>
      <Step n={4}>Save. The HOD user will immediately only see timesheets from the listed departments.</Step>

      <Tip>
        An employee can appear in more than one HOD Team. This is useful for acting heads or shared oversight.
        Their combined department list determines what they see.
      </Tip>

      <SectionHeading>HOD scope in Timeline</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        The Timeline view respects HOD scope. When a HOD-scoped user opens Timeline they see only employees
        from their departments. The <strong>HOD Team</strong> filter chip in Timeline lets admins switch
        between teams for a broader overview.
      </p>

      <Warn>
        If a user with HOD scope cannot see any employees in Timeline or timesheets, confirm that their
        employee code is correctly set on their user account and that the HOD Team is active.
      </Warn>
    </div>
  );
}

function ApprovalsSection() {
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
        Approval Settings control which email addresses receive approval notifications when a timesheet
        is submitted. Go to <strong>Settings → Approval Settings</strong>.
      </p>

      <SectionHeading>How it works</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        When an employee submits a timesheet the system looks for a matching row in Approval Settings.
        It first tries to match the employee's department code, then falls back to any row where
        Department Code is blank (global fallback). The matched approvers receive a notification email.
      </p>

      <SectionHeading>Adding an approval rule</SectionHeading>
      <Step n={1}>Click <em>+ Add Row</em>.</Step>
      <Step n={2}><strong>Department Code</strong> — enter the exact ERP department code (e.g. <code>INST</code>), or leave blank to create a global fallback rule.</Step>
      <Step n={3}><strong>Approver Names</strong> — enter the approver's name (informational only, shown in emails).</Step>
      <Step n={4}><strong>Approver Emails</strong> — enter one or more email addresses separated by commas. All addresses receive the notification.</Step>
      <Step n={5}>Click <em>Save All</em>. All rows are saved together.</Step>

      <Tip>
        You can have both a department-specific rule and a global fallback. Only the most specific match
        is used — if a department row matches, the fallback is not triggered.
      </Tip>

      <SectionHeading>Removing a rule</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        Click the <strong>✕</strong> button on any saved row and confirm the deletion.
        Rows that haven't been saved yet can be removed by clicking ✕ without a confirmation.
      </p>
    </div>
  );
}

function EmailSection() {
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
        Email Settings configure the SMTP server that OpsDesk uses to send approval notifications
        and system alerts. Go to <strong>Settings → Email Settings</strong>.
      </p>

      <SectionHeading>SMTP fields</SectionHeading>
      <FieldRow label="SMTP Host">The mail server hostname (e.g. <code>smtp.office365.com</code> or <code>smtp.gmail.com</code>).</FieldRow>
      <FieldRow label="SMTP Port">Usually 587 for TLS or 465 for SSL. Ask your IT team if unsure.</FieldRow>
      <FieldRow label="Username">The sending email address used to authenticate with the SMTP server.</FieldRow>
      <FieldRow label="Password">SMTP account password or app-specific password. Stored encrypted.</FieldRow>
      <FieldRow label="From Name">The display name recipients see (e.g. "OpsDesk Notifications").</FieldRow>
      <FieldRow label="From Email">The reply-to address (can differ from the username).</FieldRow>

      <SectionHeading>Testing the configuration</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        After saving, use the <em>Send Test Email</em> button to verify the settings work. A test message
        will be sent to the From Email address. Check your inbox (and spam folder) to confirm delivery.
      </p>

      <Warn>
        If emails are not arriving after configuration, confirm that the SMTP port is not blocked by the
        server firewall and that the credentials are correct. Check backend logs for SMTP error details.
      </Warn>
    </div>
  );
}

function DocNumberingSection() {
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
        Document Numbering controls how document IDs are generated for timesheets, QC records, and
        WO Complete records. Go to <strong>Settings → Doc Numbering</strong>.
      </p>

      <SectionHeading>How document IDs work</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        Each document type (PROD, INST, QC, WOC) has its own sequence. A document ID is built from:
      </p>
      <FieldRow label="Prefix">A short text label (e.g. <code>TS-PROD</code>).</FieldRow>
      <FieldRow label="Year segment">The current 4-digit year, automatically inserted.</FieldRow>
      <FieldRow label="Sequence">A zero-padded counter that resets each year (e.g. <code>0001</code>).</FieldRow>
      <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8 }}>
        Example: <code>TS-PROD-2026-0042</code>
      </p>

      <SectionHeading>Changing the prefix</SectionHeading>
      <Step n={1}>Open the doc numbering rule for the module you want to change.</Step>
      <Step n={2}>Edit the <strong>Prefix</strong> field. The new prefix applies to the next document created.</Step>
      <Step n={3}>Save. Existing documents keep their original IDs.</Step>

      <SectionHeading>Resetting the counter</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        The counter resets automatically at the start of each year. If you need to reset it manually
        (e.g. after a data migration) contact a database administrator — this cannot be done from the UI.
      </p>

      <Warn>
        Changing the prefix mid-year will create a gap in the sequence for that year. This can cause
        confusion in audits. Only change prefixes at the beginning of a new year if possible.
      </Warn>
    </div>
  );
}

function NotificationsSection() {
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
        Notification preferences let each user control which in-app alerts they receive.
        Go to <strong>Settings → Notifications</strong>. Each user manages their own preferences —
        admins can view the page but cannot change settings on behalf of other users.
      </p>

      <SectionHeading>Notification types</SectionHeading>
      <FieldRow label="Timesheet submitted">Triggered when an employee submits a timesheet for approval.</FieldRow>
      <FieldRow label="Timesheet approved">Triggered when an approver marks a timesheet as approved.</FieldRow>
      <FieldRow label="Timesheet rejected">Triggered when an approver rejects a timesheet with a reason.</FieldRow>
      <FieldRow label="System alerts">Infrastructure or configuration warnings from the backend.</FieldRow>

      <SectionHeading>In-app bell vs email</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        The bell icon in the top bar shows unread in-app notifications. Email notifications depend on
        both the Approval Settings rules (which addresses receive them) and the Email Settings
        configuration (SMTP must be working).
      </p>

      <Tip>
        If a user is not receiving email notifications, first confirm their email address is correct in
        Approval Settings, then verify Email Settings with the <em>Send Test Email</em> button.
      </Tip>

      <SectionHeading>Clearing notifications</SectionHeading>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
        Clicking a notification in the bell panel marks it as read. Use <em>Mark all read</em> to clear the
        badge in bulk. All notifications are also accessible at <strong>Notifications</strong> (profile menu).
      </p>
    </div>
  );
}

/* ─── Main page ─── */
export default function UserManualPage() {
  const [active, setActive] = useState('overview');
  const navigate = useNavigate();

  const section = SECTIONS.find((s) => s.id === active);

  return (
    <div className="page-content" style={{ maxWidth: 'none', padding: '20px 24px' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>Admin User Manual</h2>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
            Settings &amp; configuration guide — admin access only
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Sidebar TOC */}
        <nav style={{
          width: 200,
          flexShrink: 0,
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 10,
          padding: '10px 0',
          position: 'sticky',
          top: 80,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text3)', padding: '4px 14px 8px' }}>
            Contents
          </div>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', textAlign: 'left', padding: '8px 14px',
                background: active === s.id ? 'var(--accent-glow, rgba(15,113,115,0.1))' : 'none',
                border: 'none',
                borderLeft: active === s.id ? '3px solid var(--accent, #0f7173)' : '3px solid transparent',
                fontSize: 13,
                fontWeight: active === s.id ? 600 : 400,
                color: active === s.id ? 'var(--accent, #0f7173)' : 'var(--text2)',
                cursor: 'pointer',
                transition: 'background .15s, color .15s',
              }}
            >
              <span style={{ fontSize: 14 }}>{s.icon}</span>
              {s.title}
            </button>
          ))}
        </nav>

        {/* Content area */}
        <div style={{
          flex: 1,
          minWidth: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border2)',
          borderRadius: 10,
          padding: '24px 28px',
        }}>
          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 24 }}>{section.icon}</span>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{section.title}</h2>
          </div>

          {section.content}
        </div>
      </div>
    </div>
  );
}
