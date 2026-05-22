
// ── Navigation ──
function showPage(id) {
  // Modal-based pages: open overlay without navigating away
  if (id === 'new-prod') {
    initNewProdPage().then(() => openProdEntryModal());
    return;
  }
  if (id === 'new-inst') {
    initNewInstPage().then(() => openInstEntryModal());
    return;
  }

  document.querySelectorAll('.top-group.open').forEach(g => g.classList.remove('open'));
  closeMobileMenu();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    const fn = item.getAttribute('onclick');
    if (fn && fn.includes("'" + id + "'")) item.classList.add('active');
  });
  document.querySelectorAll('.top-menu-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.page === id) link.classList.add('active');
  });
  document.querySelector('.main-content').scrollTo(0, 0);
  if (id === 'workorders' && !workOrdersLoaded) {
    loadWorkOrders();
  }
  if (id === 'projects' && !projectsLoaded) {
    loadProjects();
  }
  if (id === 'departments' && !departmentsLoaded) {
    loadDepartments();
  }
  if (id === 'machinery' && !machineryLoaded) {
    loadMachinery();
  }
  if (id === 'access-equipment' && !accessEquipmentLoaded) {
    loadAccessEquipment();
  }
  if (id === 'task-type-master' && !taskTypesLoaded) {
    loadTaskTypes();
  }
  if (id === 'items' && !itemsLoaded) {
    loadItems();
  }
  if (id === 'employees' && !employeesLoaded) {
    loadEmployees();
  }
  if (id === 'prod-list' && !prodListLoaded) {
    loadProdTimesheets();
  }
  if (id === 'inst-list' && !instListLoaded) {
    loadInstTimesheets();
  }
  if (id === 'doc-numbering') {
    loadDocNumberingSettings();
  }
  if (id === 'shift-setup') {
    loadShiftSetupPage();
  }
  if (id === 'user-list') {
    loadUserList();
  }
  if (id === 'role-list') {
    loadRoleList();
  }
  if (id === 'login-history') {
    loadLoginHistory();
  }
  if (id === 'vehicles' && !vehiclesLoaded) {
    loadVehicles();
  }
  if (id === 'projects-team') {
    loadProjTimesheets();
  }
  if (id === 'wo-complete') {
    loadWoComplete();
  }
  if (id === 'dashboard') {
    loadDashboard();
  }
  if (id === 'audit') {
    loadAuditTrail();
  }
  if (id === 'report-summary') {
    _initReportDeptFilter();
    if (!document.getElementById('rptDateFrom')?.value) {
      const year = new Date().getFullYear();
      const df = document.getElementById('rptDateFrom');
      const dt = document.getElementById('rptDateTo');
      if (df) df.value = `${year}-01-01`;
      if (dt) dt.value = new Date().toISOString().slice(0, 10);
    }
    loadReport();
  }
  if (id === 'report-detail') {
    _initDetailReportDeptFilter();
    if (!document.getElementById('drptDateFrom')?.value) {
      const year = new Date().getFullYear();
      const df = document.getElementById('drptDateFrom');
      const dt = document.getElementById('drptDateTo');
      if (df) df.value = `${year}-01-01`;
      if (dt) dt.value = new Date().toISOString().slice(0, 10);
    }
    const typeLabels = { PROD: 'Production', INST: 'Installation', PROJ: 'Project' };
    const preset = window._detailReportPresetType || '';
    const isProj = preset === 'PROJ';
    const typeEl = document.getElementById('drptType');
    const typeWrap = document.getElementById('drptTypeWrap');
    if (typeEl) typeEl.value = preset;
    if (typeWrap) typeWrap.style.display = preset ? 'none' : '';
    // PROJ-specific filter visibility
    const show = el => { const e = document.getElementById(el); if (e) e.style.display = ''; };
    const hide = el => { const e = document.getElementById(el); if (e) e.style.display = 'none'; };
    if (isProj) {
      hide('drptStatusWrap'); hide('drptDeptWrap'); hide('drptLineTypeWrap');
      show('drptEmployeeWrap');
    } else {
      show('drptStatusWrap'); show('drptDeptWrap'); show('drptLineTypeWrap');
      hide('drptEmployeeWrap');
    }
    // Column headers
    const thDept     = document.getElementById('drptThDept');
    const thWO       = document.getElementById('drptThWO');
    const thLineType = document.getElementById('drptThLineType');
    const thEmployee = document.getElementById('drptThEmployee');
    const thDuration = document.getElementById('drptThDuration');
    const thUOM      = document.getElementById('drptThUOM');
    if (thDept)     thDept.style.display     = isProj ? 'none' : '';
    if (thWO)       thWO.textContent          = isProj ? 'Project ID' : 'Work Order / Project';
    if (thLineType) thLineType.style.display  = isProj ? 'none' : '';
    if (thEmployee) thEmployee.textContent    = isProj ? 'Employee' : 'Employee / Item / Equipment';
    if (thDuration) thDuration.textContent    = isProj ? 'Duration' : 'Duration / Qty';
    if (thUOM)      thUOM.style.display       = isProj ? 'none' : '';
    const label = typeLabels[preset] || '';
    const titleEl = document.getElementById('drptTitle');
    const subEl   = document.getElementById('drptSub');
    if (titleEl) titleEl.textContent = label ? `${label} Detail Report` : 'Timesheet Detail Report';
    if (subEl)   subEl.textContent   = label ? `Line-level breakdown for ${label} timesheets` : 'Line-level breakdown — labour, materials and equipment per timesheet';
    loadDetailReport();
  }
  if (id === 'pending-approvals') {
    loadPendingApprovals();
  }
  if (id === 'approval-settings') {
    loadApprovalSettings();
  }
  if (id === 'email-settings') {
    loadEmailSettings();
  }
  initResizableColumns();
  if (id === 'projects' || id === 'workorders') {
    initResizableMasterTables();
  }
  if (id === 'departments' || id === 'machinery' || id === 'access-equipment' || id === 'task-type-master' || id === 'items' || id === 'vehicles') {
    initResizableMasterTables();
  }
}

function toggleMobileMenu() {
  document.body.classList.toggle('mobile-menu-open');
}

function closeMobileMenu() {
  document.body.classList.remove('mobile-menu-open');
}

function toggleTopGroup(el) {
  const isOpen = el.classList.contains('open');
  document.querySelectorAll('.top-group.open').forEach(g => g.classList.remove('open'));
  if (!isOpen) el.classList.add('open');
}
document.addEventListener('click', function(e) {
  if (!e.target.closest('.top-group')) {
    document.querySelectorAll('.top-group.open').forEach(g => g.classList.remove('open'));
  }
});

function togglePage(id) {
  const page = document.getElementById('page-' + id);
  if (!page) return;
  const isActive = page.classList.contains('active');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  if (!isActive) page.classList.add('active');
}

// ── Tabs ──
function showTab(groupId, tabId, btn) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  // find and activate the button
  let clicked = null;
  group.querySelectorAll('.tab-btn').forEach(b => {
    if (b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + tabId + "'")) {
      b.classList.add('active');
      clicked = b;
    }
  });

  // deactivate all tab content siblings (search parent)
  const tabEl = document.getElementById(tabId);
  if (!tabEl) return;
  const parent = tabEl.parentElement;
  parent.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
  tabEl.classList.add('active');
}

// ── Modals ──
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function hideProfileMenu() {
  const menu = document.getElementById('profileMenu');
  if (menu) menu.style.display = 'none';
}

function applyUserTheme(theme) {
  const allowed = ['industrial', 'ocean', 'forest', 'graphite'];
  const nextTheme = allowed.includes(theme) ? theme : 'industrial';
  document.body.setAttribute('data-theme', nextTheme);
  localStorage.setItem('timesheetpro.theme', nextTheme);
}

function initUserTheme() {
  const saved = localStorage.getItem('timesheetpro.theme') || 'industrial';
  applyUserTheme(saved);
}

function changeUserTheme(theme) {
  applyUserTheme(theme);
  const msg = document.getElementById('profileMessage');
  if (msg) msg.textContent = `Theme changed to ${theme}.`;
  const quick = document.getElementById('quickThemeSelect');
  if (quick) quick.value = theme;
  const profile = document.getElementById('profileTheme');
  if (profile) profile.value = theme;
}

function toggleProfileMenu(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('profileMenu');
  if (!menu) return;
  menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function openProfileView() {
  hideProfileMenu();
  const name = document.querySelector('.user-name')?.textContent?.trim() || 'User';
  const role = document.querySelector('.user-role')?.textContent?.trim() || '-';
  const nameEl = document.getElementById('profileUserName');
  const roleEl = document.getElementById('profileRole');
  const msgEl = document.getElementById('profileMessage');
  const themeEl = document.getElementById('profileTheme');
  if (nameEl) nameEl.value = name;
  if (roleEl) roleEl.value = role;
  if (msgEl) msgEl.textContent = '';
  if (themeEl) themeEl.value = document.body.getAttribute('data-theme') || 'industrial';

  const topImg = document.getElementById('topbarAvatarImage');
  const preview = document.getElementById('profilePreview');
  if (preview) {
    if (topImg && topImg.style.display !== 'none' && topImg.src) {
      preview.src = topImg.src;
    } else {
      preview.src = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22%3E%3Crect width=%22100%25%22 height=%22100%25%22 fill=%22%23d9d0c2%22/%3E%3Ctext x=%2250%25%22 y=%2255%25%22 font-size=%2222%22 text-anchor=%22middle%22 fill=%22%236b5e4a%22 font-family=%22Arial%22%3E%F0%9F%91%A4%3C/text%3E%3C/svg%3E';
    }
  }
  openModal('profileModal');
}

function onProfileImageSelected(event) {
  const file = event?.target?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const src = reader.result;
    const topImg = document.getElementById('topbarAvatarImage');
    const topAvatar = document.getElementById('topbarAvatar');
    const preview = document.getElementById('profilePreview');
    if (preview) preview.src = src;
    if (topImg) {
      topImg.src = src;
      topImg.style.display = 'block';
    }
    if (topAvatar) topAvatar.style.display = 'none';
  };
  reader.readAsDataURL(file);
}

function resetProfilePassword() {
  const pwd = document.getElementById('profileNewPassword')?.value || '';
  const confirm = document.getElementById('profileConfirmPassword')?.value || '';
  const msg = document.getElementById('profileMessage');
  if (!pwd || !confirm) {
    if (msg) msg.textContent = 'Please enter both password fields.';
    return;
  }
  if (pwd.length < 8) {
    if (msg) msg.textContent = 'Password must be at least 8 characters.';
    return;
  }
  if (pwd !== confirm) {
    if (msg) msg.textContent = 'Passwords do not match.';
    return;
  }
  if (msg) msg.textContent = 'Password reset successfully.';
  document.getElementById('profileNewPassword').value = '';
  document.getElementById('profileConfirmPassword').value = '';
}

async function logoutUser(msg) {
  hideProfileMenu();
  const token = getSessionToken();
  if (token) {
    await apiFetch(`${getApiBaseUrl()}/auth/logout`, { method: 'POST' }).catch(() => {});
  }
  clearSession();
  showLoginOverlay(msg || '');
}

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open');
  });
});

// ── Labour line add ──
let labourCount = 1;
function addLabourLine() {
  labourCount++;
  const tbody = document.getElementById('labourLines');
  const row = document.createElement('tr');
  row.innerHTML = `
    <td><select class="line-input"><option>EMP-0023 Ahmed M.</option><option>EMP-0044 Bilal S.</option></select></td>
    <td><select class="line-input"><option>Welder</option><option>Fitter</option><option>Electrician</option></select></td>
    <td><input type="time" class="line-input" value="06:00"/></td>
    <td><input type="time" class="line-input" value="14:00"/></td>
    <td><input class="line-input" style="background:rgba(79,125,255,0.06);border-color:rgba(79,125,255,0.2);color:var(--accent);font-family:var(--font-mono);font-size:12px" value="8h 00m" readonly/></td>
    <td><input type="number" class="line-input" value="0" min="0" style="width:60px"/></td>
    <td><input class="line-input" placeholder="Task description…" style="min-width:160px"/></td>
    <td><button class="btn btn-ghost btn-sm btn-icon" style="color:var(--red)" onclick="this.closest('tr').remove()">🗑</button></td>
  `;
  tbody.appendChild(row);
  // update tab label
  const btn = document.querySelector('#formTabs .tab-btn:nth-child(2)');
  if (btn) btn.textContent = `👷 Labour (${labourCount})`;
}

// ── Duration calc ──
function calcDuration(input) {
  const row = input.closest('tr');
  const times = row.querySelectorAll('input[type="time"]');
  if (times.length < 2) return;
  const [h1, m1] = times[0].value.split(':').map(Number);
  const [h2, m2] = times[1].value.split(':').map(Number);
  let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (mins < 0) mins += 1440;
  const durInput = row.querySelectorAll('.line-input')[4];
  if (durInput) durInput.value = `${Math.floor(mins/60)}h ${String(mins%60).padStart(2,'0')}m`;
}

// ── Filter tags ──
document.querySelectorAll('.filter-tag').forEach(tag => {
  tag.addEventListener('click', function() {
    const siblings = this.parentElement.querySelectorAll('.filter-tag');
    siblings.forEach(s => s.classList.remove('active'));
    this.classList.add('active');
  });
});

// ── Keyboard shortcut ──
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  }
});

// ── Access control demo data & edit flows ──
const userData = {
  'USR-0101': { userId: 'USR-0101', username: 'admin', displayName: 'System Admin', role: 'Admin', email: 'admin@company.com', phone: '+971 50 000 0001', status: 'Active' },
  'USR-0102': { userId: 'USR-0102', username: 'sara.k', displayName: 'Sara Khalid', role: 'Supervisor', email: 'sara@company.com', phone: '+971 50 000 0002', status: 'Active' },
  'USR-0103': { userId: 'USR-0103', username: 'report.view', displayName: 'Report Viewer', role: 'Report Viewer', email: 'reports@company.com', phone: '+971 50 000 0003', status: 'Inactive' }
};

const roleData = {
  'ROLE-001': { roleCode: 'ROLE-001', roleName: 'Admin', roleScope: 'All', roleStatus: 'Active' },
  'ROLE-002': { roleCode: 'ROLE-002', roleName: 'Supervisor', roleScope: 'Production', roleStatus: 'Active' },
  'ROLE-003': { roleCode: 'ROLE-003', roleName: 'Report Viewer', roleScope: 'All', roleStatus: 'Inactive' }
};

const machineData = {
  'MCH-001': { id: 'MCH-001', name: 'Tower Crane TC-50', dept: 'Production', status: 'Operational' },
  'MCH-002': { id: 'MCH-002', name: 'Excavator EX-320', dept: 'Production', status: 'Service Due' },
  'EQ-0017': { id: 'EQ-0017', name: 'Rough Terrain Crane', dept: 'Installation', status: 'Off-service' },
  'EQ-0042': { id: 'EQ-0042', name: 'Scissor Lift SL-19', dept: 'Installation', status: 'Cert. Due' }
};

const employeeData = {
  'EMP-0023': { code: 'EMP-0023', name: 'Ahmed Mohammed', dept: 'Production', subDept: 'Fabrication', category: 'Management', status: 'Active' },
  'EMP-0044': { code: 'EMP-0044', name: 'Bilal Siddiqui', dept: 'Production', subDept: 'Welding', category: 'Welder', status: 'Active' },
  'EMP-0055': { code: 'EMP-0055', name: 'Hassan Al-Amin', dept: 'Production', subDept: 'Operations', category: 'Operator', status: 'Active' },
  'EMP-0061': { code: 'EMP-0061', name: 'Sara Khalid', dept: 'Installation', subDept: 'Electrical', category: 'Electrician', status: 'Active' },
  'EMP-0072': { code: 'EMP-0072', name: 'Ravi Prakash', dept: 'Installation', subDept: 'Site Support', category: 'Helper', status: 'Inactive' }
};

const instProjects = [
  { id: 'PJT-1001', name: 'Al Maktoum Terminal Block C', customer: 'DCAA', salesperson: 'Ali Kareem' },
  { id: 'PJT-1002', name: 'Dubai South Warehouse', customer: 'DP World', salesperson: 'Fatima Noor' },
  { id: 'PJT-1003', name: 'KSA Logistics Hub', customer: 'SABIC', salesperson: 'Rashid Khan' }
];

const instWorkOrders = [
  { wo: 'WO-2026-0042', projectId: 'PJT-1001', dept: 'Installation' },
  { wo: 'WO-2026-0043', projectId: 'PJT-1001', dept: 'Digital' },
  { wo: 'WO-2026-0038', projectId: 'PJT-1002', dept: 'Installation' },
  { wo: 'WO-2026-0040', projectId: 'PJT-1002', dept: 'Digital' },
  { wo: 'WO-2026-0031', projectId: 'PJT-1003', dept: 'Installation' }
];

const itemLookup = {
  'ITM-001': { desc: 'Steel Rebar 16mm', uom: 'KG' },
  'ITM-002': { desc: 'Portland Cement OPC', uom: 'BAG' },
  'ITM-003': { desc: 'Welding Electrodes E7018', uom: 'BOX' },
  'ITM-004': { desc: 'Safety Helmets', uom: 'NOS' }
};

let pendingTimesheetType = 'prod';
let selectedPTProjectId = '';
let projTsLoaded = false;
let _editingProjDocNo = null;
let workOrdersLoaded = false;
let projectsLoaded = false;
let departmentsLoaded = false;
let machineryLoaded = false;
let accessEquipmentLoaded = false;
let taskTypesLoaded = false;
let itemsLoaded = false;
let employeesLoaded = false;
let globalSearchDebounce = null;
let searchMasterPrefetchStarted = false;
const MASTER_CACHE_TTL_MS = 2 * 60 * 1000;
let masterProjects = [];
let masterWorkOrders = [];
let masterMachinery = [];
let masterTaskTypes = [];
let masterShifts = [];
let masterProdDepartments = [];
let masterItems = [];
let masterEmployees = [];
let masterTsEmployees = [];   // employees from PROD/INST timesheet labour lines
let masterVehicles = [];
let masterAccessEquipment = [];
let prodDepartmentsLoaded = false;
let masterVehiclesLoaded = false;
let masterAccessEquipmentLoaded = false;
let woCompleteLoaded = false;

// ── Searchable select helper ──────────────────────────────────────────
// Options stored here, keyed by inputId: [{value, label}]
const _srchOpts = {};
function setSrchOptions(inputId, opts) { _srchOpts[inputId] = opts || []; }

function setupSearchSel(inputId, menuId, onChangeFn) {
  const inputEl = document.getElementById(inputId);
  const menuEl  = document.getElementById(menuId);
  if (!inputEl || !menuEl) return;

  function renderMenu() {
    const q    = (inputEl.value || '').toLowerCase();
    const opts = (_srchOpts[inputId] || []).filter(o =>
      !q || (o.value || '').toLowerCase().includes(q) || (o.label || '').toLowerCase().includes(q)
    );
    if (!opts.length) { menuEl.style.display = 'none'; menuEl.innerHTML = ''; return; }
    menuEl.innerHTML = opts.slice(0, 300).map(o =>
      `<div class="srch-opt" data-val="${o.value.replace(/"/g,'&quot;')}">${o.label}</div>`
    ).join('');
    const rect = inputEl.getBoundingClientRect();
    menuEl.style.position = 'fixed';
    menuEl.style.top   = (rect.bottom + 2) + 'px';
    menuEl.style.left  = rect.left + 'px';
    menuEl.style.width = rect.width + 'px';
    menuEl.style.zIndex = '9999';
    menuEl.style.display = 'block';
    menuEl.querySelectorAll('.srch-opt').forEach(el => {
      el.addEventListener('mousedown', e => {
        e.preventDefault();
        inputEl.value = el.dataset.val;
        menuEl.style.display = 'none';
        if (onChangeFn) onChangeFn(el.dataset.val);
      });
    });
  }

  if (!inputEl.dataset.srchBound) {
    inputEl.dataset.srchBound = '1';
    inputEl.addEventListener('focus', renderMenu);
    inputEl.addEventListener('input', renderMenu);
    inputEl.addEventListener('blur',  () => setTimeout(() => { menuEl.style.display = 'none'; }, 160));
  }
}

// Employees for Production & Installation labour rows — loaded once, stored here
let _prodInstEmployeeList = [];
let _instEmployeeList = [];
let _projectEmployeeList = [];

async function _ensureProdInstEmployees() {
  if (_prodInstEmployeeList.length) return;
  try {
    const rows = await fetchJson(`${getApiBaseUrl()}/employees?regionIds=1,3&deptFilter=prod-inst`);
    _prodInstEmployeeList = Array.isArray(rows) ? rows : [];
  } catch {
    _prodInstEmployeeList = masterEmployees;
  }
}

async function _ensureInstEmployees() {
  if (_instEmployeeList.length) return;
  try {
    const rows = await fetchJson(`${getApiBaseUrl()}/employees?regionIds=1,3&deptFilter=inst`);
    _instEmployeeList = Array.isArray(rows) ? rows : [];
  } catch {
    _instEmployeeList = masterEmployees;
  }
}

function _empListToOpts(source) {
  return source.map(e => {
    const name = [e.firstName, e.lastname].filter(Boolean).join(' ');
    const code = e.employeeNo || '';
    return { value: code, name, label: `${code} - ${name}`.trim() };
  }).filter(o => o.value);
}

function _getProdInstEmployees() {
  return _empListToOpts(_prodInstEmployeeList.length ? _prodInstEmployeeList : masterEmployees);
}

function _getInstEmployees() {
  return _empListToOpts(_instEmployeeList.length ? _instEmployeeList : masterEmployees);
}

async function _ensureProjectEmployees() {
  if (_projectEmployeeList.length) return;
  try {
    const rows = await fetchJson(`${getApiBaseUrl()}/employees?regionIds=1,3&deptFilter=projects`);
    _projectEmployeeList = Array.isArray(rows) ? rows : [];
  } catch {
    _projectEmployeeList = masterEmployees;
  }
}

function _getProjectEmployees() {
  return _empListToOpts(_projectEmployeeList.length ? _projectEmployeeList : masterEmployees);
}

function _bindPTEmployeeSearch(inputId, menuId) {
  const inp  = document.getElementById(inputId);
  const menu = document.getElementById(menuId);
  if (!inp || !menu) return;

  function positionMenu() {
    const rect = inp.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top   = (rect.bottom + 2) + 'px';
    menu.style.left  = rect.left + 'px';
    menu.style.width = Math.max(rect.width, 240) + 'px';
    menu.style.zIndex = '9999';
  }

  async function renderPTEmp() {
    await _ensureProjectEmployees();
    const q = (inp.value || '').toLowerCase();
    const opts = _getProjectEmployees().filter(o => !q || o.label.toLowerCase().includes(q));
    if (!opts.length) { menu.style.display = 'none'; return; }
    menu.innerHTML = opts.slice(0, 150).map(o =>
      `<div class="srch-opt" data-val="${o.value.replace(/"/g,'&quot;')}" data-name="${(o.name||'').replace(/"/g,'&quot;')}">${o.label}</div>`
    ).join('');
    positionMenu();
    menu.style.display = 'block';
    menu.querySelectorAll('.srch-opt').forEach(el => {
      el.addEventListener('mousedown', ev => {
        ev.preventDefault();
        inp.dataset.empCode = el.dataset.val;
        inp.value = el.dataset.name || el.dataset.val;
        menu.style.display = 'none';
      });
    });
  }

  if (!inp.dataset.boundPTEmpSearch) {
    inp.addEventListener('focus', renderPTEmp);
    inp.addEventListener('input', renderPTEmp);
    inp.addEventListener('blur',  () => setTimeout(() => { menu.style.display = 'none'; }, 160));
    inp.dataset.boundPTEmpSearch = '1';
  }
}

function _bindEmpSearchRow(tr, getEmpsFn, ensureEmpsFn) {
  const _getEmps   = getEmpsFn   || _getProdInstEmployees;
  const _ensureEmps = ensureEmpsFn || _ensureProdInstEmployees;

  const inp  = tr.querySelector('.ts-emp-inp');
  const menu = tr.querySelector('.ts-emp-menu');
  if (!inp || !menu) return;

  function positionMenu() {
    const rect = inp.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top   = (rect.bottom + 2) + 'px';
    menu.style.left  = rect.left + 'px';
    menu.style.width = Math.max(rect.width, 240) + 'px';
    menu.style.zIndex = '9999';
  }

  async function renderEmp() {
    await _ensureEmps();
    const q    = (inp.value || '').toLowerCase();
    const opts = _getEmps().filter(o => !q || o.label.toLowerCase().includes(q));
    if (!opts.length) { menu.style.display = 'none'; return; }
    menu.innerHTML = opts.slice(0, 150).map(o =>
      `<div class="srch-opt" data-val="${o.value.replace(/"/g,'&quot;')}" data-name="${(o.name||'').replace(/"/g,'&quot;')}">${o.label}</div>`
    ).join('');
    positionMenu();
    menu.style.display = 'block';
    menu.querySelectorAll('.srch-opt').forEach(el => {
      el.addEventListener('mousedown', ev => {
        ev.preventDefault();
        inp.dataset.empCode = el.dataset.val;
        inp.value = el.dataset.name || el.dataset.val;
        menu.style.display = 'none';
      });
    });
  }

  inp.addEventListener('focus', renderEmp);
  inp.addEventListener('input', renderEmp);
  inp.addEventListener('blur',  () => setTimeout(() => { menu.style.display = 'none'; }, 160));
}

function getApiBaseUrl() {
  const host = window.location.hostname || '127.0.0.1';
  return `http://${host}:3000/api`;
}

function getCacheKey(key) {
  return `timesheetpro.master.${key}`;
}

function readMasterCache(key) {
  try {
    const raw = localStorage.getItem(getCacheKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.data) || typeof parsed.ts !== 'number') return null;
    if (Date.now() - parsed.ts > MASTER_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeMasterCache(key, data) {
  try {
    localStorage.setItem(getCacheKey(key), JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // ignore cache write errors
  }
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
const AUTH_TOKEN_KEY   = 'psTimesheet.sessionToken';
const AUTH_USER_KEY    = 'psTimesheet.currentUser';
const INACTIVITY_MS    = 8 * 60 * 60 * 1000; // 8 hours
let   _inactivityTimer = null;

function getSessionToken() { return localStorage.getItem(AUTH_TOKEN_KEY); }

function getAuthHeaders() {
  const t = getSessionToken();
  return t ? { 'Authorization': `Bearer ${t}` } : {};
}

function saveSession(token, user) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem(AUTH_USER_KEY) || 'null'); } catch { return null; }
}

function handleUnauthorized() {
  clearSession();
  showLoginOverlay('Session expired. Please sign in again.');
}

function resetInactivityTimer() {
  clearTimeout(_inactivityTimer);
  _inactivityTimer = setTimeout(() => {
    logoutUser('Session timed out due to inactivity.');
  }, INACTIVITY_MS);
}

async function fetchJson(url) {
  const res = await apiFetch(url, { headers: getAuthHeaders() });
  if (res.status === 401) { handleUnauthorized(); throw new Error('Unauthorized'); }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiFetch(url, options = {}) {
  const res = await window.fetch(url, {
    cache: 'no-store',
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });
  if (res.status === 401) { handleUnauthorized(); }
  return res;
}

function safeText(v) {
  return (v || '').toString().trim();
}

function collectProdTransactions() {
  return Array.from(document.querySelectorAll('#page-prod-list tbody tr')).map((tr) => {
    const tds = tr.querySelectorAll('td');
    return {
      type: 'Production TS',
      docNo: safeText(tds[0]?.textContent),
      projectId: '',
      projectName: safeText(tds[2]?.textContent),
      workOrder: safeText(tds[3]?.textContent),
      employee: safeText(tds[6]?.textContent),
      pageId: 'prod-list',
    };
  }).filter((r) => r.docNo);
}

function collectInstTransactions() {
  return Array.from(document.querySelectorAll('#page-inst-list tbody tr')).map((tr) => {
    const tds = tr.querySelectorAll('td');
    return {
      type: 'Installation TS',
      docNo: safeText(tds[1]?.textContent),
      projectId: safeText(tds[3]?.textContent),
      projectName: '',
      workOrder: safeText(tds[2]?.textContent),
      employee: safeText(tds[4]?.textContent),
      pageId: 'inst-list',
    };
  }).filter((r) => r.docNo);
}

function collectProjectsFromTable() {
  return Array.from(document.querySelectorAll('#projectsBody tr')).map((tr) => {
    const tds = tr.querySelectorAll('td');
    return {
      projectId: safeText(tds[0]?.textContent),
      projectName: safeText(tds[1]?.textContent),
      employee: safeText(tds[2]?.textContent),
      pageId: 'projects',
    };
  }).filter((r) => r.projectId);
}

function collectWorkOrdersFromTable() {
  return Array.from(document.querySelectorAll('#workOrdersBody tr')).map((tr) => {
    const tds = tr.querySelectorAll('td');
    return {
      workOrder: safeText(tds[0]?.textContent),
      projectId: safeText(tds[1]?.textContent),
      projectName: safeText(tds[2]?.textContent),
      employee: '',
      pageId: 'workorders',
    };
  }).filter((r) => r.workOrder);
}

function collectEmployees() {
  return Object.values(employeeData).map((e) => ({
    code: safeText(e.code),
    name: safeText(e.name),
    dept: safeText(e.dept),
    pageId: 'employees',
  }));
}

function buildGlobalSearchRows() {
  return {
    transactions: [...collectProdTransactions(), ...collectInstTransactions()],
    projects: collectProjectsFromTable(),
    workOrders: collectWorkOrdersFromTable(),
    employees: collectEmployees(),
  };
}

function renderGlobalSearchResults(results, q) {
  const panel = document.getElementById('globalSearchResults');
  if (!panel) return;
  if (!q) {
    panel.style.display = 'none';
    panel.innerHTML = '';
    return;
  }

  if (results.length === 0) {
    panel.style.display = 'block';
    panel.innerHTML = `<div class="gs-header">No match for "${q}"</div>`;
    return;
  }

  panel.style.display = 'block';
  panel.innerHTML = `<div class="gs-header">${results.length} result(s) for "${q}"</div>` + results.map((r) => `
    <div class="gs-item" data-page="${r.pageId}">
      <div class="gs-title">${r.title}</div>
      <div class="gs-meta">${r.meta}</div>
    </div>
  `).join('');

  panel.querySelectorAll('.gs-item').forEach((el) => {
    el.addEventListener('click', () => {
      const page = el.getAttribute('data-page');
      if (page) showPage(page);
      panel.style.display = 'none';
    });
  });
}

function runGlobalSearch(query) {
  const q = safeText(query).toLowerCase();
  if (!q) {
    renderGlobalSearchResults([], '');
    return;
  }
  const run = () => {
    const data = buildGlobalSearchRows();
    const results = [];

    data.transactions.forEach((t) => {
      const hay = `${t.docNo} ${t.workOrder} ${t.projectId} ${t.projectName} ${t.employee}`.toLowerCase();
      if (hay.includes(q)) {
        results.push({
          pageId: t.pageId,
          title: `${t.type} • ${t.docNo || '-'}`,
          meta: `WO: ${t.workOrder || '-'} | Project: ${t.projectId || t.projectName || '-'} | Employee: ${t.employee || '-'}`,
        });
      }
    });

    data.workOrders.forEach((w) => {
      const hay = `${w.workOrder} ${w.projectId} ${w.projectName}`.toLowerCase();
      if (hay.includes(q)) {
        results.push({
          pageId: 'workorders',
          title: `Work Order • ${w.workOrder}`,
          meta: `Project: ${w.projectId || '-'} ${w.projectName ? `| ${w.projectName}` : ''}`,
        });
      }
    });

    data.projects.forEach((p) => {
      const hay = `${p.projectId} ${p.projectName} ${p.employee}`.toLowerCase();
      if (hay.includes(q)) {
        results.push({
          pageId: 'projects',
          title: `Project • ${p.projectId}`,
          meta: `${p.projectName || '-'} | Salesperson: ${p.employee || '-'}`,
        });
      }
    });

    data.employees.forEach((e) => {
      const hay = `${e.code} ${e.name} ${e.dept}`.toLowerCase();
      if (hay.includes(q)) {
        const related = data.transactions.filter((t) => (t.employee || '').toLowerCase().includes((e.name || '').toLowerCase().split(' ')[0])).slice(0, 3);
        const relText = related.length ? ` | Related TS: ${related.map((r) => r.docNo).join(', ')}` : '';
        results.push({
          pageId: 'employees',
          title: `Employee • ${e.code} ${e.name}`,
          meta: `Department: ${e.dept || '-'}${relText}`,
        });
      }
    });

    renderGlobalSearchResults(results.slice(0, 60), query);
  };

  run();

  if (!searchMasterPrefetchStarted && (!projectsLoaded || !workOrdersLoaded)) {
    searchMasterPrefetchStarted = true;
    Promise.allSettled([
      projectsLoaded ? Promise.resolve() : loadProjects(),
      workOrdersLoaded ? Promise.resolve() : loadWorkOrders(),
    ]).then(() => {
      run();
    });
  }
}

function initGlobalSearch() {
  const input = document.getElementById('globalSearchInput');
  const panel = document.getElementById('globalSearchResults');
  if (!input || !panel || input.dataset.boundGlobalSearch === '1') return;

  input.addEventListener('input', (e) => {
    const val = e.target.value || '';
    clearTimeout(globalSearchDebounce);
    globalSearchDebounce = setTimeout(() => runGlobalSearch(val), 120);
  });

  input.addEventListener('focus', () => {
    if (input.value.trim()) runGlobalSearch(input.value);
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== input) {
      panel.style.display = 'none';
    }
  });

  input.dataset.boundGlobalSearch = '1';
}

function refreshDashboardKpis() {
  const projectRows = Array.from(document.querySelectorAll('#projectsBody tr')).filter((tr) => tr.querySelectorAll('td').length > 1);
  const workOrderRows = Array.from(document.querySelectorAll('#workOrdersBody tr')).filter((tr) => tr.querySelectorAll('td').length > 1);
  const totalProjects = projectRows.length;
  const totalWorkOrders = workOrderRows.length;
  const inProgressWorkOrders = workOrderRows.filter((tr) => {
    const status = safeText(tr.querySelectorAll('td')[6]?.textContent).toLowerCase();
    return status.includes('in progress');
  }).length;

  const prodOpen = Array.from(document.querySelectorAll('#page-prod-list tbody tr')).filter((tr) => {
    const status = safeText(tr.querySelectorAll('td')[7]?.textContent).toLowerCase();
    return status.includes('draft') || status.includes('submitted') || status.includes('pending');
  }).length;
  const instOpen = Array.from(document.querySelectorAll('#page-inst-list tbody tr')).filter((tr) => {
    const status = safeText(tr.querySelectorAll('td')[6]?.textContent).toLowerCase();
    return status.includes('draft') || status.includes('submitted') || status.includes('pending');
  }).length;
  const openTimesheets = prodOpen + instOpen;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };

  setText('kpiProjectsValue', totalWorkOrders);
  setText('kpiWorkOrdersValue', inProgressWorkOrders);
  setText('kpiTimesheetsValue', totalProjects);
  setText('kpiEmployeesValue', openTimesheets);

  const projectSub = document.getElementById('kpiProjectsSub');
  const woSub = document.getElementById('kpiWorkOrdersSub');
  const tsSub = document.getElementById('kpiTimesheetsSub');
  const empSub = document.getElementById('kpiEmployeesSub');
  if (projectSub) projectSub.textContent = `${totalWorkOrders} records from Work Order Master`;
  if (woSub) woSub.textContent = `${inProgressWorkOrders} currently in progress`;
  if (tsSub) tsSub.textContent = `${totalProjects} records from Project Master`;
  if (empSub) empSub.textContent = `${prodOpen} Production + ${instOpen} Installation`;
}

function setMasterWidth(wrapperId, mode) {
  const wrap = document.getElementById(wrapperId);
  if (!wrap) return;
  const table = wrap.querySelector('.data-table');
  if (!table) return;

  if (mode === 'fit') table.style.minWidth = '1200px';
  if (mode === 'wide') table.style.minWidth = '1700px';
  if (mode === 'xl') table.style.minWidth = '2200px';
  localStorage.setItem(`tableWidth:${wrapperId}`, table.style.minWidth);
}

function sortMasterTable(tableId, spec) {
  if (!spec) return;
  const table = document.getElementById(tableId);
  if (!table) return;
  const body = table.tBodies[0];
  if (!body) return;
  const [idxRaw, dirRaw] = spec.split(':');
  const idx = Number(idxRaw);
  const dir = dirRaw === 'desc' ? -1 : 1;

  const rows = Array.from(body.querySelectorAll('tr'));
  rows.sort((a, b) => {
    const av = (a.cells[idx]?.textContent || '').trim().toLowerCase();
    const bv = (b.cells[idx]?.textContent || '').trim().toLowerCase();
    return av.localeCompare(bv, undefined, { numeric: true }) * dir;
  });

  rows.forEach((r) => body.appendChild(r));
}

function initResizableMasterTables() {
  const handles = document.querySelectorAll('.table-resize-handle');
  handles.forEach((handle) => {
    if (handle.dataset.boundResize === '1') return;
    const wrapId = handle.getAttribute('data-target-wrap');
    const wrap = wrapId ? document.getElementById(wrapId) : null;
    const table = wrap ? wrap.querySelector('.data-table') : null;
    if (!wrap || !table) return;

    const saved = localStorage.getItem(`tableWidth:${wrapId}`);
    if (saved) table.style.minWidth = saved;

    let startX = 0;
    let startWidth = 0;
    const minWidth = 1200;
    const maxWidth = 3200;

    const getClientX = (evt) => {
      if (evt.touches && evt.touches[0]) return evt.touches[0].clientX;
      if (evt.changedTouches && evt.changedTouches[0]) return evt.changedTouches[0].clientX;
      return evt.clientX;
    };

    const onMove = (e) => {
      const dx = getClientX(e) - startX;
      const next = Math.max(minWidth, Math.min(maxWidth, startWidth + dx));
      table.style.minWidth = `${next}px`;
    };

    const onUp = () => {
      localStorage.setItem(`tableWidth:${wrapId}`, table.style.minWidth);
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };

    const onStart = (e) => {
      e.preventDefault();
      startX = getClientX(e);
      startWidth = parseInt(getComputedStyle(table).minWidth, 10) || table.offsetWidth || 1700;
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
    };

    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, { passive: false });
    handle.dataset.boundResize = '1';
  });
}

function initResizableColumns() {
  const tables = document.querySelectorAll('table.data-table, table.line-table');
  tables.forEach((table) => {
    const thead = table.tHead;
    if (!thead || !thead.rows.length) return;
    const headers = Array.from(thead.rows[0].cells);

    headers.forEach((th, idx) => {
      if (th.querySelector('.col-resize-handle')) return;
      th.style.position = 'relative';
      const handle = document.createElement('span');
      handle.className = 'col-resize-handle';
      th.appendChild(handle);

      let startX = 0;
      let startW = 0;
      const minW = 80;
      const maxW = 900;

      const onMove = (e) => {
        const x = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
        const next = Math.max(minW, Math.min(maxW, startW + (x - startX)));
        const px = `${next}px`;
        th.style.width = px;
        th.style.minWidth = px;
        th.style.maxWidth = px;

        const rows = Array.from(table.rows);
        rows.forEach((row) => {
          const cell = row.cells[idx];
          if (!cell) return;
          cell.style.width = px;
          cell.style.minWidth = px;
          cell.style.maxWidth = px;
        });
      };

      const onUp = () => {
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onUp);
      };

      const onDown = (e) => {
        e.preventDefault();
        const x = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
        startX = x;
        startW = th.offsetWidth;
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
      };

      handle.addEventListener('mousedown', onDown);
      handle.addEventListener('touchstart', onDown, { passive: false });
    });
  });
}

function mapWOStatusToBadge(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('released')) return { cls: 'badge-approved', text: 'Released' };
  if (s.includes('in process')) return { cls: 'badge-submitted', text: 'In Progress' };
  if (s.includes('hold') || s.includes('risk')) return { cls: 'badge-pending', text: status || 'At Risk' };
  return { cls: 'badge-draft', text: status || 'Unknown' };
}

function renderWorkOrdersRows(rows) {
  const body = document.getElementById('workOrdersBody');
  if (!body) return;

  if (!rows || rows.length === 0) {
    body.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:20px">No work orders found for selected filters.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((r, i) => {
    const badge = mapWOStatusToBadge(r.netsuiteStatus);
    const dept = r.departmentName || '-';
    const deptCls = dept.toLowerCase().includes('prod') ? 'wip-dept-prod' : dept.toLowerCase().includes('inst') ? 'wip-dept-inst' : 'wip-dept-digit';
    return `
      <tr>
        <td class="wip-td-num">${i + 1}</td>
        <td><span class="wip-link">${r.workOrderNumber || '-'}</span></td>
        <td style="color:#6b7280">${r.projectCode || '-'}</td>
        <td><span class="wip-project-name">${r.projectName || '-'}</span></td>
        <td style="color:#6b7280">${r.customerName || '-'}</td>
        <td style="color:#6b7280">${r.signType || '-'}</td>
        <td><span class="wip-dept-badge ${deptCls}">${dept}</span></td>
        <td><span class="badge ${badge.cls}">${badge.text}</span></td>
      </tr>
    `;
  }).join('');
  const meta = document.getElementById('woMeta');
  if (meta) meta.textContent = `${rows.length} items`;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
const QUICK_LINK_MAP = {
  'Production Timesheets':  { label: 'Production Timesheets',  page: 'prod-list',         icon: '📋' },
  'Installation Timesheets':{ label: 'Installation Timesheets',page: 'inst-list',         icon: '🔧' },
  'Projects Team':          { label: 'Projects Team',          page: 'projects-team',     icon: '👷' },
  'WO Complete':            { label: 'WO Complete',            page: 'wo-complete',       icon: '✅' },
  'Employee Master':        { label: 'Employees',              page: 'employees',         icon: '👤' },
  'Department Master':      { label: 'Departments',            page: 'departments',       icon: '🏢' },
  'Item Master':            { label: 'Items',                  page: 'items',             icon: '📦' },
  'Machinery Master':       { label: 'Machinery',              page: 'machinery',         icon: '⚙️'  },
  'Vehicle Master':         { label: 'Vehicles',               page: 'vehicles',          icon: '🚗'  },
  'Access Equipment':       { label: 'Access Equipment',       page: 'access-equipment',  icon: '🏗️'  },
  'Project Master':         { label: 'Projects',               page: 'projects',          icon: '📁' },
  'Work Orders':            { label: 'Work Orders',            page: 'workorders',        icon: '📝' },
  'Task Type Master':       { label: 'Task Types',             page: 'task-type-master',  icon: '🏷️'  },
  'Reports':                { label: 'Reports',                page: 'reports',           icon: '📊' },
  'Audit Trail':            { label: 'Audit Trail',            page: 'audit',             icon: '🔍' },
  'Document Numbering':     { label: 'Document Numbering',     page: 'doc-numbering',     icon: '🔢' },
  'Shift Setup':            { label: 'Shift Setup',            page: 'shift-setup',       icon: '🕐' },
  'User Management':        { label: 'User Management',        page: 'user-list',         icon: '🔑' },
  'Role Management':        { label: 'Role Management',        page: 'role-list',         icon: '🛡️'  },
  'Login History':          { label: 'Login History',          page: 'login-history',     icon: '📜' },
  'Active Sessions':        { label: 'Active Sessions',        page: 'active-sessions',   icon: '💻' },
};

function _greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

async function loadDashboard() {
  const user = getCurrentUser();

  // Greeting + date
  const name = user?.displayName?.split(' ')[0] || user?.username || 'there';
  const greetEl = document.getElementById('dashGreeting');
  if (greetEl) greetEl.textContent = `${_greetingWord()}, ${name}`;
  const dateEl = document.getElementById('dashDate');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-GB', { weekday:'long', day:'2-digit', month:'long', year:'numeric' });

  // Fetch permissions, stats, and login audit in parallel
  let perms = [], stats = null, audit = null;
  let _dataScope = 'All';
  try {
    let permsResp;
    [permsResp, stats, audit] = await Promise.all([
      fetchJson(`${getApiBaseUrl()}/auth/permissions`).catch(() => ({ permissions: [], dataScope: 'All' })),
      fetchJson(`${getApiBaseUrl()}/auth/dashboard-stats`).catch(() => null),
      fetchJson(`${getApiBaseUrl()}/auth/login-audit`).catch(() => null),
    ]);
    if (Array.isArray(permsResp)) {
      perms = permsResp;
    } else {
      perms      = permsResp.permissions || [];
      _dataScope = permsResp.dataScope   || 'All';
    }
  } catch (_) {}

  window._userDataScope = _dataScope;

  const canRead = (module) => {
    if (!perms.length) return true;
    const p = perms.find(p => p.module === module);
    return p ? (p.canRead === true || p.canRead === 1) : false;
  };

  const set = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val ?? '—'; };

  // ── Recent Timesheets ──────────────────────────────────────────────────────
  const hasTs = canRead('Production Timesheets') || canRead('Installation Timesheets');
  const recentCard = document.getElementById('dashRecentTsCard');
  const recentBody = document.getElementById('dashRecentTsBody');
  if (recentCard && hasTs) {
    recentCard.style.display = '';
    const rows = stats?.recentTimesheets || [];
    recentBody.innerHTML = rows.length
      ? rows.map(r => {
          const st = (r.status || '').toLowerCase();
          const badgeCls = st === 'approved' ? 'badge-approved' : st === 'submitted' ? 'badge-submitted' : st === 'rejected' ? 'badge-rejected' : 'badge-draft';
          const type = (r.tsType || '').toUpperCase();
          const typColor = type === 'INST' ? '#16a34a' : type === 'PROJ' ? '#9333ea' : '#2563eb';
          const typLabel = type === 'INST' ? 'Inst' : type === 'PROJ' ? 'Proj' : 'Prod';
          const dt = r.entryDate ? new Date(r.entryDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) : '—';
          const page = type === 'INST' ? 'inst-list' : type === 'PROJ' ? 'proj-ts' : 'prod-list';
          return `<tr>
            <td><span class="wip-link" style="font-size:12px" onclick="showPage('${page}')">${r.tsDocNo}</span></td>
            <td><span style="font-size:11px;font-weight:600;color:${typColor}">${typLabel}</span></td>
            <td style="color:var(--text3);font-size:11px;white-space:nowrap">${dt}</td>
            <td><span class="badge ${badgeCls}" style="font-size:10px">${r.status}</span></td>
          </tr>`;
        }).join('')
      : `<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:16px;font-size:12px">No timesheets found.</td></tr>`;
  }

  // ── Quick Access links ─────────────────────────────────────────────────────
  const quickCard  = document.getElementById('dashQuickCard');
  const quickLinks = document.getElementById('dashQuickLinks');
  if (quickCard && quickLinks) {
    const links = Object.entries(QUICK_LINK_MAP)
      .filter(([mod]) => canRead(mod))
      .map(([, { label, page, icon }]) =>
        `<button class="btn btn-outline btn-sm" style="justify-content:flex-start;gap:8px;font-size:12px" onclick="showPage('${page}')">
           <span>${icon}</span>${label}
         </button>`
      );
    if (links.length) {
      quickCard.style.display  = '';
      quickLinks.innerHTML     = links.join('');
    }
  }

  // ── Login audit ────────────────────────────────────────────────────────────
  if (audit) {
    const fmtAudit = (val) => {
      if (!val) return '—';
      const d = new Date(val);
      if (isNaN(d)) return '—';
      return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
        + ' ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }).toLowerCase();
    };
    const expEl = document.getElementById('auditPwExpiry');
    if (expEl && audit.passwordExpiry) {
      const daysLeft = Math.ceil((new Date(audit.passwordExpiry) - new Date()) / 86400_000);
      const color    = daysLeft <= 7 ? 'var(--red)' : daysLeft <= 30 ? 'var(--amber)' : 'var(--text1)';
      expEl.textContent = fmtAudit(audit.passwordExpiry);
      expEl.style.color = color;
    } else if (expEl) expEl.textContent = '—';

    const failEl = document.getElementById('auditFailToday');
    if (failEl) {
      failEl.textContent = audit.failuresToday ?? '0';
      failEl.style.color = (audit.failuresToday ?? 0) > 0 ? 'var(--red)' : 'var(--green)';
    }
    const succEl = document.getElementById('auditSuccessToday');
    if (succEl) {
      succEl.textContent = audit.successfulToday ?? '0';
      succEl.style.color = 'var(--green)';
    }
    set('auditPrevLogin',  fmtAudit(audit.previousLogin));
    set('auditPrevMobile', fmtAudit(audit.previousMobileLogin));
    set('auditPwChange',   fmtAudit(audit.lastPasswordChange));
  }
}

async function loadWorkOrders() {
  const body = document.getElementById('workOrdersBody');
  if (!body) return;
  const cacheKey = 'work-orders';
  const cached = readMasterCache(cacheKey);
  if (cached) {
    renderWorkOrdersRows(cached);
    workOrdersLoaded = true;
    refreshDashboardKpis();
  } else {
    body.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:20px">Loading work orders...</td></tr>';
  }

  try {
    const url = `${getApiBaseUrl()}/work-orders?subsidiaryIds=1,3&statuses=In Process,Released`;
    const rows = await fetchJson(url);
    masterWorkOrders = Array.isArray(rows) ? rows : [];
    renderWorkOrdersRows(rows);
    writeMasterCache(cacheKey, rows);
    workOrdersLoaded = true;
    refreshDashboardKpis();
  } catch (err) {
    if (!cached) {
      body.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--red);padding:20px">Unable to load Work Orders API. Check backend on port 3000.</td></tr>';
    }
    console.error('Work Orders API error:', err);
  }
  if (masterWorkOrders.length === 0 && Array.isArray(cached)) {
    masterWorkOrders = cached;
  }
}

function mapProjectStatusToBadge(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('active') || s.includes('track')) return { cls: 'badge-approved', text: status || 'Active' };
  if (s.includes('risk') || s.includes('hold')) return { cls: 'badge-pending', text: status || 'At Risk' };
  if (s.includes('close') || s.includes('stop') || s.includes('delay')) return { cls: 'badge-rejected', text: status || 'Delayed' };
  return { cls: 'badge-active', text: status || 'Active' };
}

function renderProjectsRows(rows) {
  const body = document.getElementById('projectsBody');
  if (!body) return;

  if (!rows || rows.length === 0) {
    body.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px">No projects found for selected filters.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((r, i) => {
    const badge = mapProjectStatusToBadge(r.status);
    return `
      <tr>
        <td class="wip-td-num">${i + 1}</td>
        <td><span class="wip-link">${r.projectCode || '-'}</span></td>
        <td><span class="wip-project-name">${r.projectName || '-'}</span></td>
        <td style="color:#6b7280">${r.salesperson || '-'}</td>
        <td style="color:#6b7280">${r.customerName || '-'}</td>
        <td style="color:#6b7280">${r.businessUnitCode || '-'}</td>
        <td style="color:#374151">${r.projectManager || '-'}</td>
        <td style="color:#6b7280">${r.projectOwner || '-'}</td>
        <td><span class="badge ${badge.cls}">${badge.text}</span></td>
      </tr>
    `;
  }).join('');
}

async function loadProjects() {
  const body = document.getElementById('projectsBody');
  if (!body) return;
  const cacheKey = 'projects';
  const cached = readMasterCache(cacheKey);
  if (cached) {
    renderProjectsRows(cached);
    projectsLoaded = true;
    refreshDashboardKpis();
  } else {
    body.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px">Loading projects...</td></tr>';
  }

  try {
    const url = `${getApiBaseUrl()}/projects?subsidiaryIds=1,3`;
    const rows = await fetchJson(url);
    masterProjects = Array.isArray(rows) ? rows : [];
    renderProjectsRows(rows);
    writeMasterCache(cacheKey, rows);
    projectsLoaded = true;
    refreshDashboardKpis();
  } catch (err) {
    if (!cached) {
      body.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--red);padding:20px">Unable to load Projects API. Check backend on port 3000.</td></tr>';
    }
    console.error('Projects API error:', err);
  }
  if (masterProjects.length === 0 && Array.isArray(cached)) {
    masterProjects = cached;
  }
}

// ── Department status helpers (frontend-only, localStorage) ──
let _masterDepartments = [];

function isDeptActive(code) {
  const r = _masterDepartments.find(d => d.departmentCode === code);
  return r ? (r.isActive !== false && r.isActive !== 0) : true;
}

function updateDeptsMetaStatus() {
  const total  = _masterDepartments.length;
  const active = _masterDepartments.filter(d => d.isActive !== false && d.isActive !== 0).length;
  const meta = document.getElementById('deptsMeta');
  if (meta) meta.textContent = `${total} items · ${active} active`;
}

function renderDepartmentsRows(rows) {
  _masterDepartments = Array.isArray(rows) ? rows : [];
  const body = document.getElementById('departmentsBody');
  if (!body) return;

  if (!rows || rows.length === 0) {
    body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px">No departments found.</td></tr>';
    return;
  }

  const editIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

  body.innerHTML = rows.map((r, i) => {
    const code   = r.departmentCode || '-';
    const active = r.isActive !== false && r.isActive !== 0;
    const deptId = r.departmentId || '';
    return `
    <tr data-dept-code="${code}" data-dept-id="${deptId}">
      <td class="wip-td-num">${i + 1}</td>
      <td><span class="wip-link">${code}</span></td>
      <td style="color:#6b7280">${r.mainDepartment || '-'}</td>
      <td>${active ? '<span class="badge badge-active">Active</span>' : '<span class="badge badge-inactive">Inactive</span>'}</td>
      <td style="text-align:center">
        <button class="del-row-btn" title="Edit" onclick="openDeptEdit(${deptId})">${editIcon}</button>
      </td>
    </tr>`;
  }).join('');

  updateDeptsMetaStatus();
}

function openDeptEdit(departmentId) {
  const r = _masterDepartments.find(d => d.departmentId === departmentId);
  const label = r ? `${r.departmentCode || ''}${r.departmentId ? ` (ID: ${r.departmentId})` : ''}` : String(departmentId);
  document.getElementById('deptEditCode').textContent      = label;
  document.getElementById('deptEditMainDept').value        = (r && r.mainDepartment) ? r.mainDepartment : '';
  document.getElementById('deptEditStatus').value          = (r && (r.isActive === false || r.isActive === 0)) ? '0' : '1';
  document.getElementById('deptEditModal').dataset.deptId  = departmentId;
  document.getElementById('deptEditModal').style.display   = 'flex';
}

async function saveDeptProfile() {
  const departmentId = document.getElementById('deptEditModal').dataset.deptId;
  const mainDept     = document.getElementById('deptEditMainDept').value.trim();
  const isActive     = document.getElementById('deptEditStatus').value === '1';
  const updatedBy    = getCurrentUser()?.displayName || getCurrentUser()?.username || '';

  try {
    const res = await apiFetch(`${getApiBaseUrl()}/departments/${departmentId}/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mainDepartmentOverride: mainDept || null, isActive, updatedBy }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || res.statusText);
    document.getElementById('deptEditModal').style.display = 'none';
    showToast('Department updated.', 'success');
    departmentsLoaded = false;
    prodDepartmentsLoaded = false;
    localStorage.removeItem(getCacheKey('departments_v2'));
    localStorage.removeItem(getCacheKey('prod_departments_v2'));
    await Promise.all([loadDepartments(), loadProdDepartments()]);
  } catch (err) {
    showToast('Save failed: ' + (err?.message || err), 'error');
  }
}

async function loadDepartments() {
  const body = document.getElementById('departmentsBody');
  if (!body) return;
  localStorage.removeItem(getCacheKey('departments')); // bust old filtered cache
  const cacheKey = 'departments_v2';
  const cached = readMasterCache(cacheKey);
  if (cached) {
    renderDepartmentsRows(cached);
    departmentsLoaded = true;
  } else {
    body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:20px">Loading departments...</td></tr>';
  }

  try {
    const url = `${getApiBaseUrl()}/departments`;
    const rows = await fetchJson(url);
    renderDepartmentsRows(rows);
    writeMasterCache(cacheKey, rows);
    departmentsLoaded = true;
  } catch (err) {
    if (!cached) {
      body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--red);padding:20px">Unable to load Departments API. Check backend on port 3000.</td></tr>';
    }
    console.error('Departments API error:', err);
  }
}

async function loadProdDepartments() {
  localStorage.removeItem(getCacheKey('prod_departments'));
  const cacheKey = 'prod_departments_v2';
  const cached = readMasterCache(cacheKey);
  if (cached) {
    masterProdDepartments = cached;
    prodDepartmentsLoaded = true;
  }
  try {
    const url = `${getApiBaseUrl()}/departments`;
    const rows = await fetchJson(url);
    masterProdDepartments = Array.isArray(rows) ? rows : [];
    writeMasterCache('prod_departments_v2', masterProdDepartments);
    prodDepartmentsLoaded = true;
  } catch (err) {
    console.error('Prod departments API error:', err);
  }
  populateProdDepartmentSelect();
}

function populateProdDepartmentSelect() {
  const prodDepts = masterProdDepartments.filter(
    (d) => (d.mainDepartment || '').toLowerCase() === 'production'
      && d.isActive !== false && d.isActive !== 0
  );
  setSrchOptions('prodDepartment', prodDepts.map(d => ({ value: d.departmentCode || '', label: d.departmentCode || '-' })));
  setupSearchSel('prodDepartment', 'prodDepartmentMenu');
}

function populateInstDepartmentSelect() {
  const instDepts = masterProdDepartments.filter(
    (d) => (d.mainDepartment || '').toLowerCase().includes('inst')
      && d.isActive !== false && d.isActive !== 0
  );
  setSrchOptions('instDepartment', instDepts.map(d => ({ value: d.departmentCode || '', label: d.departmentCode || '-' })));
  setupSearchSel('instDepartment', 'instDepartmentMenu');
}

function renderMachineryRows(rows) {
  const body = document.getElementById('machineryBody');
  if (!body) return;

  if (!rows || rows.length === 0) {
    body.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:20px">No machinery found.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((r, i) => `
    <tr>
      <td class="wip-td-num">${i + 1}</td>
      <td><span class="wip-link">${r.machineName || '-'}</span></td>
      <td style="color:#6b7280">${r.departmentCode || '-'}</td>
    </tr>
  `).join('');
  const meta = document.getElementById('machineryMeta');
  if (meta) meta.textContent = `${rows.length} items`;
}

async function loadMachinery() {
  const body = document.getElementById('machineryBody');
  if (!body) return;
  const cacheKey = 'machinery';
  const cached = readMasterCache(cacheKey);
  if (cached) {
    renderMachineryRows(cached);
    machineryLoaded = true;
  } else {
    body.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:20px">Loading machinery...</td></tr>';
  }

  try {
    const url = `${getApiBaseUrl()}/machinery?subsidiaryIds=1`;
    const rows = await fetchJson(url);
    masterMachinery = Array.isArray(rows) ? rows : [];
    renderMachineryRows(rows);
    writeMasterCache(cacheKey, rows);
    machineryLoaded = true;
  } catch (err) {
    if (!cached) {
      body.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--red);padding:20px">Unable to load Machinery API. Check backend on port 3000.</td></tr>';
    }
    console.error('Machinery API error:', err);
  }
  if (masterMachinery.length === 0 && Array.isArray(cached)) {
    masterMachinery = cached;
  }
}

function isSjoItem(r) {
  return (r.itemName || '').includes('-SJO-');
}

function renderItemsRows(rows) {
  const body = document.getElementById('itemsBody');
  if (!body) return;

  const filtered = (rows || []).filter(r => !isSjoItem(r));

  if (filtered.length === 0) {
    body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px">No items found.</td></tr>';
    return;
  }

  body.innerHTML = filtered.map((r, i) => `
    <tr>
      <td class="wip-td-num">${i + 1}</td>
      <td><span class="wip-link">${r.itemcode || '-'}</span></td>
      <td>${r.itemName || '-'}</td>
      <td style="color:#6b7280">${r.description || '-'}</td>
      <td style="color:#6b7280">${r.UOM || '-'}</td>
      <td style="color:#6b7280">${r.subsidiaryCode || '-'}</td>
    </tr>
  `).join('');

  const meta = document.getElementById('itemsMeta');
  if (meta) meta.textContent = `${filtered.length} items`;
}

async function loadItems() {
  const body = document.getElementById('itemsBody');
  const cacheKey = 'items';
  const cached = readMasterCache(cacheKey);
  if (cached) {
    if (body) renderItemsRows(cached);
    masterItems = (Array.isArray(cached) ? cached : []).filter(r => !isSjoItem(r));
    itemsLoaded = true;
  } else {
    if (body) body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:20px">Loading items...</td></tr>';
  }

  try {
    const url = `${getApiBaseUrl()}/items?subsidiaryIds=1,3`;
    const rows = await fetchJson(url);
    masterItems = (Array.isArray(rows) ? rows : []).filter(r => !isSjoItem(r));
    if (body) renderItemsRows(masterItems);
    writeMasterCache(cacheKey, masterItems);
    itemsLoaded = true;
  } catch (err) {
    if (!cached && body) {
      body.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--red);padding:20px">Unable to load Items API. Check backend on port 3000.</td></tr>';
    }
    console.error('Items API error:', err);
  }
  if (masterItems.length === 0 && Array.isArray(cached)) {
    masterItems = cached.filter(r => !isSjoItem(r));
  }
}

function renderEmployeesRows(rows) {
  const body = document.getElementById('empBody');
  if (!body) return;

  if (!rows || rows.length === 0) {
    body.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text3);padding:20px">No employees found.</td></tr>';
    return;
  }

  const viewIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const editIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

  body.innerHTML = rows.map((r, i) => {
    const fullName = [r.firstName, r.lastname].filter(Boolean).join(' ') || '-';
    const initials = [(r.firstName || '')[0], (r.lastname || '')[0]].filter(Boolean).join('').toUpperCase() || '?';
    const location = [r.emiratesOrState, r.city].filter(Boolean).join(', ') || '-';
    const empNo = (r.employeeNo || '').replace(/'/g, "\\'");
    return `
      <tr>
        <td class="wip-td-num">${i + 1}</td>
        <td><span class="wip-link">${r.employeeNo || '-'}</span></td>
        <td><span class="wip-avatar">${initials}</span>${fullName}</td>
        <td style="color:#6b7280">${r.designation || '-'}</td>
        <td>${r.departmentCode || '-'}</td>
        <td style="color:#6b7280">${r.emailId || '-'}</td>
        <td style="color:#6b7280">${r.subsidiaryCode || '-'}</td>
        <td style="color:#6b7280">${location}</td>
        <td style="text-align:center;white-space:nowrap">
          <button class="del-row-btn" title="View" onclick="viewEmployee('${empNo}')" style="margin-right:4px">${viewIcon}</button>
          <button class="del-row-btn" title="Edit" onclick="editEmployeeFromMaster('${empNo}')">${editIcon}</button>
        </td>
      </tr>
    `;
  }).join('');

  const meta = document.getElementById('empListMeta');
  if (meta) meta.textContent = `${rows.length} employees`;
}

async function loadEmployees() {
  const body = document.getElementById('empBody');
  const cacheKey = 'employees';
  const cached = readMasterCache(cacheKey);
  if (cached) {
    if (body) renderEmployeesRows(cached);
    masterEmployees = Array.isArray(cached) ? cached : [];
    employeesLoaded = true;
  } else {
    if (body) body.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:20px">Loading employees...</td></tr>';
  }

  try {
    const url = `${getApiBaseUrl()}/employees?regionIds=1,3`;
    const rows = await fetchJson(url);
    masterEmployees = Array.isArray(rows) ? rows : [];
    if (body) renderEmployeesRows(masterEmployees);
    writeMasterCache(cacheKey, masterEmployees);
    employeesLoaded = true;
  } catch (err) {
    if (!cached && body) {
      body.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--red);padding:20px">Unable to load Employees API. Check backend on port 3000.</td></tr>';
    }
    console.error('Employees API error:', err);
  }
  if (masterEmployees.length === 0 && Array.isArray(cached)) {
    masterEmployees = cached;
  }
}

function renderAccessEquipmentRows(rows) {
  const body = document.getElementById('accessEquipmentBody');
  if (!body) return;

  if (!rows || rows.length === 0) {
    body.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:20px">No access equipment found.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((r, i) => `
    <tr>
      <td class="wip-td-num">${i + 1}</td>
      <td><span class="wip-link">${r.equipmentName || '-'}</span></td>
      <td style="color:#6b7280">${r.departmentCode || '-'}</td>
    </tr>
  `).join('');
  const meta = document.getElementById('accessEqMeta');
  if (meta) meta.textContent = `${rows.length} items`;
}

async function loadAccessEquipment() {
  const body = document.getElementById('accessEquipmentBody');
  if (!body) return;
  const cacheKey = 'access-equipment';
  const cached = readMasterCache(cacheKey);
  if (cached) {
    renderAccessEquipmentRows(cached);
    accessEquipmentLoaded = true;
  } else {
    body.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:20px">Loading access equipment...</td></tr>';
  }

  try {
    const url = `${getApiBaseUrl()}/access-equipment`;
    const rows = await fetchJson(url);
    renderAccessEquipmentRows(rows);
    writeMasterCache(cacheKey, rows);
    accessEquipmentLoaded = true;
  } catch (err) {
    if (!cached) {
      body.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--red);padding:20px">Unable to load Access Equipment API. Check backend on port 3000.</td></tr>';
    }
    console.error('Access Equipment API error:', err);
  }
}

function renderTaskTypesRows(rows) {
  const body = document.getElementById('taskTypesBody');
  if (!body) return;

  if (!rows || rows.length === 0) {
    body.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:20px">No task types found.</td></tr>';
    return;
  }

  body.innerHTML = rows.map((r, i) => `
    <tr>
      <td class="wip-td-num">${i + 1}</td>
      <td><span class="wip-link">${r.reasonVisit || '-'}</span></td>
      <td style="color:#6b7280">${r.moduleName || '-'}</td>
    </tr>
  `).join('');
  const meta = document.getElementById('taskTypesMeta');
  if (meta) meta.textContent = `${rows.length} items`;
}

async function loadTaskTypes() {
  const body = document.getElementById('taskTypesBody');
  if (!body) return;
  const cacheKey = 'task-types';
  const cached = readMasterCache(cacheKey);
  if (cached) {
    renderTaskTypesRows(cached);
    taskTypesLoaded = true;
  } else {
    body.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text3);padding:20px">Loading task types...</td></tr>';
  }

  try {
    const url = `${getApiBaseUrl()}/task-types`;
    const rows = await fetchJson(url);
    masterTaskTypes = Array.isArray(rows) ? rows : [];
    renderTaskTypesRows(rows);
    writeMasterCache(cacheKey, rows);
    taskTypesLoaded = true;
  } catch (err) {
    if (!cached) {
      body.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--red);padding:20px">Unable to load Task Types API. Check backend on port 3000.</td></tr>';
    }
    console.error('Task Types API error:', err);
  }
  if (masterTaskTypes.length === 0 && Array.isArray(cached)) {
    masterTaskTypes = cached;
  }
}

async function loadMasterTaskTypes() {
  if (taskTypesLoaded && masterTaskTypes.length > 0) return;
  const cached = readMasterCache('task-types');
  if (cached && cached.length > 0) { masterTaskTypes = cached; taskTypesLoaded = true; return; }
  try {
    const rows = await fetchJson(`${getApiBaseUrl()}/task-types`);
    masterTaskTypes = Array.isArray(rows) ? rows : [];
    writeMasterCache('task-types', masterTaskTypes);
    taskTypesLoaded = true;
  } catch (err) { console.error('loadMasterTaskTypes error:', err); }
}

// ── Vehicle Master ────────────────────────────────────────────────────────────
const VEHICLES_API = () => `${getApiBaseUrl()}/vehicles`;
let vehiclesLoaded = false;

function renderVehicleRows(rows) {
  const body = document.getElementById('vehiclesBody');
  if (!body) return;
  const editIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const delIcon  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;

  if (!rows || rows.length === 0) {
    body.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:20px">No vehicles found.</td></tr>';
    const meta = document.getElementById('vehiclesMeta');
    if (meta) meta.textContent = '0 vehicles';
    return;
  }

  body.innerHTML = rows.map((r, i) => `
    <tr>
      <td class="wip-td-num">${i + 1}</td>
      <td><span class="wip-link" onclick="editVehicle('${r.vehicleId}')">${r.vehicleId}</span></td>
      <td style="font-weight:500">${r.plateNo}</td>
      <td>${r.vehicleType}</td>
      <td style="color:#6b7280">${[r.make, r.model].filter(Boolean).join(' ') || '—'}</td>
      <td style="color:#6b7280">${r.yearModel || '—'}</td>
      <td><span class="badge ${r.status === 'Active' ? 'badge-active' : 'badge-inactive'}">${r.status}</span></td>
      <td><div class="action-cell">
        <button class="wip-action-btn wip-action-edit"   title="Edit"   onclick="editVehicle('${r.vehicleId}')">${editIcon}</button>
        <button class="wip-action-btn wip-action-delete" title="Delete" onclick="deleteVehicle('${r.vehicleId}')">${delIcon}</button>
      </div></td>
    </tr>
  `).join('');

  const meta = document.getElementById('vehiclesMeta');
  if (meta) meta.textContent = `${rows.length} vehicle${rows.length !== 1 ? 's' : ''}`;
}

async function loadVehicles() {
  const body = document.getElementById('vehiclesBody');
  if (!body) return;
  try {
    const rows = await fetchJson(VEHICLES_API());
    masterVehicles = Array.isArray(rows) ? rows : [];
    masterVehiclesLoaded = true;
    renderVehicleRows(rows);
    vehiclesLoaded = true;
  } catch (err) {
    body.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--red);padding:20px">Unable to load Vehicles. Check backend.</td></tr>';
    console.error('Vehicles API error:', err);
  }
}

async function loadMasterVehicles() {
  if (masterVehiclesLoaded) return;
  try {
    const rows = await fetchJson(VEHICLES_API());
    masterVehicles = Array.isArray(rows) ? rows : [];
    masterVehiclesLoaded = true;
  } catch (err) {
    console.error('Master vehicles fetch error:', err);
  }
}

async function loadMasterAccessEquipment() {
  if (masterAccessEquipmentLoaded) return;
  try {
    const rows = await fetchJson(`${getApiBaseUrl()}/access-equipment`);
    masterAccessEquipment = Array.isArray(rows) ? rows : [];
    masterAccessEquipmentLoaded = true;
  } catch (err) {
    console.error('Master access equipment fetch error:', err);
  }
}

async function createNewVehicle() {
  const { vehicleId } = await fetchJson(`${VEHICLES_API()}/next-id`).catch(() => ({ vehicleId: 'VEH-????' }));
  document.getElementById('vehicleEditId').value     = '';
  document.getElementById('vehicleIdField').value    = vehicleId;
  document.getElementById('vehiclePlateNo').value    = '';
  document.getElementById('vehicleType').value       = 'Pickup';
  document.getElementById('vehicleMake').value       = '';
  document.getElementById('vehicleModel').value      = '';
  document.getElementById('vehicleYear').value       = '';
  document.getElementById('vehicleStatus').value     = 'Active';
  document.getElementById('vehicleRemarks').value    = '';
  document.getElementById('vehicleFormTitle').textContent = 'New Vehicle';
  showPage('vehicle-form');
}

async function editVehicle(vehicleId) {
  try {
    const v = await fetchJson(`${VEHICLES_API()}/${encodeURIComponent(vehicleId)}`);
    document.getElementById('vehicleEditId').value     = v.vehicleId;
    document.getElementById('vehicleIdField').value    = v.vehicleId;
    document.getElementById('vehiclePlateNo').value    = v.plateNo;
    document.getElementById('vehicleType').value       = v.vehicleType;
    document.getElementById('vehicleMake').value       = v.make || '';
    document.getElementById('vehicleModel').value      = v.model || '';
    document.getElementById('vehicleYear').value       = v.yearModel || '';
    document.getElementById('vehicleStatus').value     = v.status;
    document.getElementById('vehicleRemarks').value    = v.remarks || '';
    document.getElementById('vehicleFormTitle').textContent = `Edit Vehicle — ${v.plateNo}`;
    showPage('vehicle-form');
  } catch (e) {
    showToast('Failed to load vehicle: ' + (e?.message || e), 'error');
  }
}

async function saveVehicle() {
  const editId      = document.getElementById('vehicleEditId').value.trim();
  const plateNo     = document.getElementById('vehiclePlateNo').value.trim().toUpperCase();
  const vehicleType = document.getElementById('vehicleType').value;
  const make        = document.getElementById('vehicleMake').value.trim();
  const model       = document.getElementById('vehicleModel').value.trim();
  const yearModel   = document.getElementById('vehicleYear').value.trim();
  const status      = document.getElementById('vehicleStatus').value;
  const remarks     = document.getElementById('vehicleRemarks').value.trim();

  if (!plateNo)     { showToast('Plate No is required.', 'error'); return; }
  if (!vehicleType) { showToast('Vehicle Type is required.', 'error'); return; }

  const payload = { plateNo, vehicleType, make: make||null, model: model||null,
    yearModel: yearModel ? Number(yearModel) : null, status, remarks: remarks||null };

  const url    = editId ? `${VEHICLES_API()}/${encodeURIComponent(editId)}` : VEHICLES_API();
  const method = editId ? 'PATCH' : 'POST';

  try {
    const res = await apiFetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `HTTP ${res.status}`); }
    showToast(editId ? 'Vehicle updated.' : 'Vehicle created.', 'success');
    vehiclesLoaded = false;
    showPage('vehicles');
  } catch (e) {
    showToast('Error: ' + (e?.message || e), 'error');
  }
}

async function deleteVehicle(vehicleId) {
  if (!confirm(`Delete vehicle "${vehicleId}"?`)) return;
  try {
    const res = await apiFetch(`${VEHICLES_API()}/${encodeURIComponent(vehicleId)}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `HTTP ${res.status}`); }
    showToast(`Vehicle "${vehicleId}" deleted.`, 'success');
    await loadVehicles();
  } catch (e) {
    showToast('Error: ' + (e?.message || e), 'error');
  }
}

async function loadShifts() {
  const cacheKey = 'shifts';
  const cached = readMasterCache(cacheKey);
  if (Array.isArray(cached)) masterShifts = cached;

  try {
    const url = `${getApiBaseUrl()}/system-settings/shifts`;
    const rows = await fetchJson(url);
    masterShifts = Array.isArray(rows) ? rows : [];
    writeMasterCache(cacheKey, masterShifts);
  } catch (err) {
    console.error('Shifts API error:', err);
  }
}

// ── Users ─────────────────────────────────────────────────────────────────────
const USERS_API = () => `${getApiBaseUrl()}/users`;
const ROLES_API = () => `${getApiBaseUrl()}/roles`;
let _masterRoles = [];

async function loadUserList() {
  try {
    const [users, roles] = await Promise.all([fetchJson(USERS_API()), fetchJson(ROLES_API())]);
    _masterRoles = Array.isArray(roles) ? roles : [];
    const tbody = document.getElementById('userListBody');
    const meta  = document.getElementById('userListMeta');
    if (!tbody) return;

    const editIcon  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    const deactIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`;
    const delIcon   = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
    const roleMap   = Object.fromEntries(_masterRoles.map(r => [r.roleCode, r.roleName]));

    const fmtDate = iso => {
      if (!iso) return '—';
      try { return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return '—'; }
    };

    tbody.innerHTML = users.map((u, i) => {
      const initials = u.displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
      const roleName = roleMap[u.roleCode] || u.roleCode;
      const isActive = u.status === 'Active';
      const deactBtn = isActive
        ? `<button class="wip-action-btn" title="Deactivate" style="color:#f59e0b" onclick="deactivateUser('${u.userId}','${u.displayName.replace(/'/g,"\\'")}')"> ${deactIcon}</button>`
        : `<button class="wip-action-btn wip-action-delete" title="Delete" onclick="deleteUser('${u.userId}')"> ${delIcon}</button>`;
      return `<tr>
        <td class="wip-td-num">${i + 1}</td>
        <td><span class="wip-link" onclick="editUser('${u.userId}')">${u.userId}</span></td>
        <td style="color:#6b7280">${u.username}</td>
        <td><span class="wip-avatar">${initials}</span>${u.displayName}</td>
        <td><span class="wip-dept-badge">${roleName}</span></td>
        <td style="color:#6b7280">${u.departmentCode || '—'}</td>
        <td style="color:#6b7280;font-size:12px">${fmtDate(u.lastLoginAt)}</td>
        <td><span class="badge ${isActive ? 'badge-active' : 'badge-inactive'}">${u.status}</span></td>
        <td><div class="action-cell">
          <button class="wip-action-btn wip-action-edit" title="Edit" onclick="editUser('${u.userId}')">${editIcon}</button>
          ${deactBtn}
        </div></td>
      </tr>`;
    }).join('');
    if (meta) meta.textContent = `${users.length} user${users.length !== 1 ? 's' : ''}`;
  } catch (e) {
    console.error('Failed to load users', e);
    showToast('Failed to load users', 'error');
  }
}

async function createNewUser() {
  const [roles, { userId }] = await Promise.all([
    _masterRoles.length ? Promise.resolve(_masterRoles) : fetchJson(ROLES_API()).catch(() => []),
    fetchJson(`${USERS_API()}/next-id`).catch(() => ({ userId: 'USR-????' })),
  ]);
  _masterRoles = Array.isArray(roles) ? roles : _masterRoles;
  document.getElementById('userEditId').value     = '';
  document.getElementById('userId').value          = userId;
  document.getElementById('username').value        = '';
  document.getElementById('username').readOnly     = false;
  document.getElementById('displayName').value     = '';
  document.getElementById('userPassword').value    = '';
  document.getElementById('confirmPassword').value = '';
  document.getElementById('userEmail').value       = '';
  document.getElementById('userPhone').value       = '';
  document.getElementById('userStatus').value      = 'Active';
  document.getElementById('passwordHint').style.display     = 'none';
  document.getElementById('btnResetPassword').style.display = 'none';
  document.getElementById('pwStrengthBar').style.display    = 'none';
  document.getElementById('userFormPageTitle').textContent  = 'Create Login User';
  document.getElementById('userFormPageSub').textContent    = 'Fill in details to create a new login user';
  document.getElementById('userRolePermsSummary').style.display = 'none';
  _populateRoleSelect(roles);
  await _populateUserEmployeeSelect(null);
  await _populateUserDeptSelect(null);
  showPage('user-create');
}

async function editUser(userId) {
  try {
    const [u, roles] = await Promise.all([
      fetchJson(`${USERS_API()}/${encodeURIComponent(userId)}`),
      _masterRoles.length ? Promise.resolve(_masterRoles) : fetchJson(ROLES_API()),
    ]);
    _masterRoles = Array.isArray(roles) ? roles : _masterRoles;
    document.getElementById('userEditId').value     = u.userId;
    document.getElementById('userId').value          = u.userId;
    document.getElementById('username').value        = u.username;
    document.getElementById('username').readOnly     = true;
    document.getElementById('displayName').value     = u.displayName;
    document.getElementById('userPassword').value    = '';
    document.getElementById('confirmPassword').value = '';
    document.getElementById('userEmail').value       = u.email || '';
    document.getElementById('userPhone').value       = u.phone || '';
    document.getElementById('userStatus').value      = u.status;
    document.getElementById('passwordHint').style.display     = '';
    document.getElementById('btnResetPassword').style.display = '';
    document.getElementById('pwStrengthBar').style.display    = 'none';
    document.getElementById('userFormPageTitle').textContent  = 'Edit User';
    document.getElementById('userFormPageSub').textContent    = `Editing: ${u.username}`;
    _populateRoleSelect(_masterRoles, u.roleCode);
    await Promise.all([
      _populateUserEmployeeSelect(u.employeeCode),
      _populateUserDeptSelect(u.departmentCode),
      loadUserRolePermsSummary(u.roleCode),
    ]);
    showPage('user-create');
  } catch (e) {
    showToast('Failed to load user: ' + (e?.message || e), 'error');
  }
}

async function _populateUserEmployeeSelect(selectedCode) {
  const sel = document.getElementById('userEmployeeCode');
  if (!sel) return;
  if (masterEmployees.length === 0) {
    try {
      const rows = await fetchJson(`${getApiBaseUrl()}/employees?regionIds=1,3`);
      masterEmployees = Array.isArray(rows) ? rows : [];
    } catch { masterEmployees = []; }
  }
  sel.innerHTML = `<option value="">— Not linked —</option>` +
    masterEmployees.map(e => {
      const code = e.employeeNo || '';
      const name = [e.firstName, e.lastname].filter(Boolean).join(' ');
      return `<option value="${code}" ${code === (selectedCode || '') ? 'selected' : ''}>${code} — ${name}</option>`;
    }).join('');
}

async function _populateUserDeptSelect(selectedCode) {
  const sel = document.getElementById('userDepartmentCode');
  if (!sel) return;
  try {
    const depts = await fetchJson(`${getApiBaseUrl()}/departments`).catch(() => []);
    sel.innerHTML = `<option value="">— Select —</option>` +
      depts.map(d => `<option value="${d.departmentCode}" ${d.departmentCode === (selectedCode || '') ? 'selected' : ''}>${d.departmentCode}</option>`).join('');
  } catch { /* keep default */ }
}

function onUserEmployeeChange(empCode) {
  if (!empCode) return;
  const emp = masterEmployees.find(e => e.employeeNo === empCode);
  if (!emp) return;
  const name = [emp.firstName, emp.lastname].filter(Boolean).join(' ');
  if (name) document.getElementById('displayName').value = name;
  if (emp.emailId) document.getElementById('userEmail').value = emp.emailId;
  if (emp.departmentCode) {
    const deptSel = document.getElementById('userDepartmentCode');
    if (deptSel) deptSel.value = emp.departmentCode;
  }
}

async function loadUserRolePermsSummary(roleCode) {
  const wrap    = document.getElementById('userRolePermsSummary');
  const content = document.getElementById('userRolePermsContent');
  if (!wrap || !content || !roleCode) { if (wrap) wrap.style.display = 'none'; return; }
  try {
    const perms = await fetchJson(`${getApiBaseUrl()}/roles/${encodeURIComponent(roleCode)}/permissions`).catch(() => []);
    if (!perms || !perms.length) { wrap.style.display = 'none'; return; }
    const actionLabels = { canCreate:'C', canRead:'R', canWrite:'W', canDelete:'D', canReport:'Rep' };
    content.innerHTML = perms.map(p => {
      const allowed = Object.entries(actionLabels)
        .filter(([key]) => p[key])
        .map(([, lbl]) => `<span style="background:var(--green,#16a34a);color:#fff;border-radius:3px;padding:1px 5px">${lbl}</span>`)
        .join('');
      const denied = Object.entries(actionLabels)
        .filter(([key]) => !p[key])
        .map(([, lbl]) => `<span style="background:var(--bg3);color:var(--text3);border-radius:3px;padding:1px 5px">${lbl}</span>`)
        .join('');
      return `<div style="padding:4px 8px;background:var(--bg1);border:1px solid var(--border);border-radius:6px;display:flex;align-items:center;gap:6px">
        <span style="font-weight:600;color:var(--text1);min-width:120px;font-size:11px">${p.module}</span>
        ${allowed}${denied}
      </div>`;
    }).join('');
    wrap.style.display = '';
  } catch { wrap.style.display = 'none'; }
}

function _populateRoleSelect(roles, selectedCode) {
  const sel = document.getElementById('userRole');
  if (!sel) return;
  sel.innerHTML = roles.filter(r => r.status === 'Active').map(r =>
    `<option value="${r.roleCode}" ${r.roleCode === selectedCode ? 'selected' : ''}>${r.roleName}</option>`
  ).join('');
}

async function saveUser() {
  const editId         = document.getElementById('userEditId').value.trim();
  const username       = document.getElementById('username').value.trim();
  const displayName    = document.getElementById('displayName').value.trim();
  const password       = document.getElementById('userPassword').value;
  const confirm        = document.getElementById('confirmPassword').value;
  const roleCode       = document.getElementById('userRole').value;
  const email          = document.getElementById('userEmail').value.trim();
  const phone          = document.getElementById('userPhone').value.trim();
  const status         = document.getElementById('userStatus').value;
  const employeeCode   = document.getElementById('userEmployeeCode')?.value || '';
  const departmentCode = document.getElementById('userDepartmentCode')?.value || '';
  const isEdit         = !!editId;

  if (!username)    { showToast('Username is required.', 'error'); return; }
  if (!displayName) { showToast('Display Name is required.', 'error'); return; }
  if (!isEdit && !password) { showToast('Password is required.', 'error'); return; }
  if (password) {
    const pwErr = validatePasswordPolicy(password, username);
    if (pwErr) { showToast(pwErr, 'error'); return; }
  }
  if (password && password !== confirm) { showToast('Passwords do not match.', 'error'); return; }

  const payload = { username, displayName, roleCode, email, phone, status, employeeCode, departmentCode };
  if (password) payload.password = password;

  const url    = isEdit ? `${USERS_API()}/${encodeURIComponent(editId)}` : USERS_API();
  const method = isEdit ? 'PATCH' : 'POST';

  try {
    const res = await apiFetch(url, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    showToast(isEdit ? 'User updated.' : 'User created.', 'success');
    showPage('user-list');
  } catch (e) {
    showToast('Error: ' + (e?.message || e), 'error');
  }
}

async function deactivateUser(userId, displayName) {
  if (!confirm(`Deactivate "${displayName || userId}"?\n\nThe user will be set to Inactive and cannot log in. You can reactivate them by editing the user.`)) return;
  try {
    const res = await apiFetch(`${USERS_API()}/${encodeURIComponent(userId)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Inactive' }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `HTTP ${res.status}`); }
    showToast(`User "${userId}" deactivated.`, 'success');
    await loadUserList();
  } catch (e) {
    showToast('Error: ' + (e?.message || e), 'error');
  }
}

async function deleteUser(userId) {
  if (!confirm(`Permanently delete user "${userId}"?\n\nThis cannot be undone.`)) return;
  try {
    const res = await apiFetch(`${USERS_API()}/${encodeURIComponent(userId)}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `HTTP ${res.status}`); }
    showToast(`User "${userId}" deleted.`, 'success');
    await loadUserList();
  } catch (e) {
    showToast('Error: ' + (e?.message || e), 'error');
  }
}

function exportUsersCSV() {
  const table = document.getElementById('userListTable');
  if (!table) return;
  const headers = ['#','User ID','Username','Display Name','Role','Department','Last Login','Status'];
  const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
    Array.from(tr.querySelectorAll('td')).map(td => {
      const txt = td.innerText.trim().replace(/\n/g, ' ');
      return `"${txt.replace(/"/g, '""')}"`;
    }).join(',')
  );
  const csv = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `users_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Password policy (client-side mirror of backend rules) ────────────────────
function validatePasswordPolicy(password, username) {
  const errors = [];
  if (password.length < 8)                  errors.push('at least 8 characters');
  if (!/[A-Z]/.test(password))              errors.push('one uppercase letter');
  if (!/[a-z]/.test(password))              errors.push('one lowercase letter');
  if (!/[0-9]/.test(password))              errors.push('one number');
  if (!/[^A-Za-z0-9]/.test(password))       errors.push('one special character');
  if (/\s/.test(password))                  errors.push('no spaces allowed');
  if (username && password.toLowerCase().includes(username.toLowerCase()))
                                            errors.push('password must not contain username');
  return errors.length ? `Password must have: ${errors.join(', ')}` : null;
}

function _pwChecks(password) {
  return {
    len:  password.length >= 8,
    up:   /[A-Z]/.test(password),
    lo:   /[a-z]/.test(password),
    num:  /[0-9]/.test(password),
    sp:   /[^A-Za-z0-9]/.test(password),
    nsp:  !/\s/.test(password),
  };
}

// barId: 'pwStrengthBar'|'cpStrengthBar'|'fcpStrengthBar'
// fillId: 'pwStrengthFill'|'cpStrengthFill'|'fcpStrengthFill'
// rulePrefix: 'pwr'|'cpr'|'fcpr'
function _renderPwRules(barId, fillId, rulePrefix, checks) {
  const bar = document.getElementById(barId);
  if (!bar) return;
  bar.style.display = '';
  const set = (suffix, ok) => {
    const el = document.getElementById(`${rulePrefix}-${suffix}`);
    if (!el) return;
    el.textContent = (ok ? '✓ ' : '✗ ') + el.textContent.slice(2);
    el.style.color = ok ? 'var(--green,#16a34a)' : 'var(--text3,#9ca3af)';
  };
  set('len', checks.len);
  set('up',  checks.up);
  set('lo',  checks.lo);
  set('num', checks.num);
  set('sp',  checks.sp);
  set('nsp', checks.nsp);
  const score = Object.values(checks).filter(Boolean).length;
  const fill  = document.getElementById(fillId);
  if (fill) {
    fill.style.width      = `${Math.round(score / 6 * 100)}%`;
    fill.style.background = score <= 2 ? '#ef4444' : score <= 4 ? '#f59e0b' : '#16a34a';
  }
}

function updatePwStrength(val) {
  if (!val) { const b = document.getElementById('pwStrengthBar'); if (b) b.style.display = 'none'; return; }
  _renderPwRules('pwStrengthBar', 'pwStrengthFill', 'pwr', _pwChecks(val));
}

function updateCpStrength(val) {
  if (!val) { const b = document.getElementById('cpStrengthBar'); if (b) b.style.display = 'none'; return; }
  _renderPwRules('cpStrengthBar', 'cpStrengthFill', 'cpr', _pwChecks(val));
}

function updateFcpStrength(val) {
  if (!val) { const b = document.getElementById('fcpStrengthBar'); if (b) b.style.display = 'none'; return; }
  _renderPwRules('fcpStrengthBar', 'fcpStrengthFill', 'fcpr', _pwChecks(val));
}

// ── Admin: Reset Password ────────────────────────────────────────────────────
async function resetUserPassword() {
  const userId = document.getElementById('userEditId').value.trim();
  if (!userId) return;
  if (!confirm(`Reset password for "${userId}"?\n\nA temporary password will be generated that the user must change on next login.`)) return;
  try {
    const res = await apiFetch(`${USERS_API()}/${encodeURIComponent(userId)}/reset-password`, { method: 'POST' });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `HTTP ${res.status}`); }
    const { tempPassword } = await res.json();
    document.getElementById('resetPwValue').textContent = tempPassword;
    const modal = document.getElementById('resetPwModal');
    modal.style.display = 'flex';
  } catch (e) {
    showToast('Reset failed: ' + (e?.message || e), 'error');
  }
}

function copyResetPw() {
  const val = document.getElementById('resetPwValue').textContent;
  navigator.clipboard.writeText(val).then(() => showToast('Copied to clipboard', 'success')).catch(() => {});
}

function closeResetPwModal() {
  document.getElementById('resetPwModal').style.display = 'none';
}

// ── Self-service: Change Password ────────────────────────────────────────────
function openChangePwModal() {
  document.getElementById('cpCurrentPw').value  = '';
  document.getElementById('cpNewPw').value       = '';
  document.getElementById('cpConfirmPw').value  = '';
  document.getElementById('cpError').style.display = 'none';
  const bar = document.getElementById('cpStrengthBar');
  if (bar) bar.style.display = 'none';
  const modal = document.getElementById('changePwModal');
  modal.style.display = 'flex';
  // close profile menu
  const pm = document.getElementById('profileMenu');
  if (pm) pm.style.display = 'none';
}

function closeChangePwModal() {
  document.getElementById('changePwModal').style.display = 'none';
}

async function submitChangePassword() {
  const currentPw = document.getElementById('cpCurrentPw').value;
  const newPw     = document.getElementById('cpNewPw').value;
  const confirmPw = document.getElementById('cpConfirmPw').value;
  const errEl     = document.getElementById('cpError');

  const showErr = (msg) => { errEl.textContent = msg; errEl.style.display = ''; };

  if (!currentPw || !newPw || !confirmPw) { showErr('All fields are required.'); return; }
  const policyErr = validatePasswordPolicy(newPw, getCurrentUser()?.username || '');
  if (policyErr) { showErr(policyErr); return; }
  if (newPw !== confirmPw) { showErr('New passwords do not match.'); return; }

  try {
    const res = await apiFetch(`${getApiBaseUrl()}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); showErr(err.message || `HTTP ${res.status}`); return; }
    closeChangePwModal();
    showToast('Password changed successfully.', 'success');
  } catch (e) {
    showErr(e?.message || 'Failed to change password.');
  }
}

// ── Force change password (after admin reset) ─────────────────────────────────
function openForceChangePwModal() {
  document.getElementById('fcpCurrentPw').value  = '';
  document.getElementById('fcpNewPw').value       = '';
  document.getElementById('fcpConfirmPw').value  = '';
  document.getElementById('fcpError').style.display = 'none';
  const bar = document.getElementById('fcpStrengthBar');
  if (bar) bar.style.display = 'none';
  document.getElementById('forceChangePwModal').style.display = 'flex';
}

async function submitForceChangePassword() {
  const currentPw = document.getElementById('fcpCurrentPw').value;
  const newPw     = document.getElementById('fcpNewPw').value;
  const confirmPw = document.getElementById('fcpConfirmPw').value;
  const errEl     = document.getElementById('fcpError');

  const showErr = (msg) => { errEl.textContent = msg; errEl.style.display = ''; };

  if (!currentPw || !newPw || !confirmPw) { showErr('All fields are required.'); return; }
  const policyErr = validatePasswordPolicy(newPw, getCurrentUser()?.username || '');
  if (policyErr) { showErr(policyErr); return; }
  if (newPw !== confirmPw) { showErr('Passwords do not match.'); return; }

  try {
    const res = await apiFetch(`${getApiBaseUrl()}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); showErr(err.message || `HTTP ${res.status}`); return; }
    document.getElementById('forceChangePwModal').style.display = 'none';
    showToast('Password updated. Welcome!', 'success');
  } catch (e) {
    showErr(e?.message || 'Failed to update password.');
  }
}

// ── Roles ─────────────────────────────────────────────────────────────────────
const PERM_MODULE_GROUPS = [
  { label: 'General',       modules: ['Dashboard'] },
  { label: 'Timesheets',    modules: ['Production Timesheets', 'Installation Timesheets', 'Projects Team', 'WO Complete'] },
  { label: 'Master Data',   modules: ['Employee Master', 'Department Master', 'Item Master', 'Machinery Master', 'Vehicle Master', 'Access Equipment', 'Project Master', 'Work Orders', 'Task Type Master'] },
  { label: 'Reporting',     modules: ['Reports', 'Audit Trail'] },
  { label: 'Settings',      modules: ['Document Numbering', 'Shift Setup'] },
  { label: 'Access Control',modules: ['User Management', 'Role Management', 'Login History', 'Active Sessions'] },
];
const PERM_MODULES = PERM_MODULE_GROUPS.flatMap(g => g.modules);

async function loadRoleList() {
  try {
    const roles = await fetchJson(ROLES_API());
    _masterRoles = Array.isArray(roles) ? roles : [];
    const tbody = document.getElementById('roleListBody');
    const meta  = document.getElementById('roleListMeta');
    if (!tbody) return;

    const editIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    const delIcon  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;

    tbody.innerHTML = roles.map((r, i) => {
      const dsColor = r.dataScope === 'Own' ? 'color:#f59e0b' : 'color:#10b981';
      return `<tr>
        <td class="wip-td-num">${i + 1}</td>
        <td><span class="wip-link" onclick="editRole('${r.roleCode}')">${r.roleCode}</span></td>
        <td>${r.roleName}</td>
        <td><span class="wip-dept-badge">${r.deptScope}</span></td>
        <td style="font-size:12px;font-weight:600;${dsColor}">${r.dataScope || 'All'}</td>
        <td><span class="badge ${r.status === 'Active' ? 'badge-active' : 'badge-inactive'}">${r.status}</span></td>
        <td style="color:#6b7280">${r.userCount ?? 0}</td>
        <td><div class="action-cell">
          <button class="wip-action-btn wip-action-edit" title="Edit" onclick="editRole('${r.roleCode}')">${editIcon}</button>
          <button class="wip-action-btn wip-action-delete" title="Delete" onclick="deleteRole('${r.roleCode}')">${delIcon}</button>
        </div></td>
      </tr>`;
    }).join('');
    if (meta) meta.textContent = `${roles.length} role${roles.length !== 1 ? 's' : ''}`;
  } catch (e) {
    console.error('Failed to load roles', e);
    showToast('Failed to load roles', 'error');
  }
}

async function createNewRole() {
  const { roleCode } = await fetchJson(`${ROLES_API()}/next-code`).catch(() => ({ roleCode: 'ROLE-???' }));
  document.getElementById('roleEditCode').value    = '';
  document.getElementById('roleCode').value        = roleCode;
  document.getElementById('roleName').value        = '';
  document.getElementById('roleScope').value       = 'All';
  document.getElementById('roleDataScope').value   = 'All';
  document.getElementById('roleStatus').value      = 'Active';
  document.getElementById('roleFormPageTitle').textContent = 'New Role';
  document.getElementById('rolePermCard').style.display = 'none';
  showPage('role-create');
}

async function editRole(roleCode) {
  try {
    const [r, perms] = await Promise.all([
      fetchJson(`${ROLES_API()}/${encodeURIComponent(roleCode)}`),
      fetchJson(`${ROLES_API()}/${encodeURIComponent(roleCode)}/permissions`),
    ]);
    document.getElementById('roleEditCode').value    = r.roleCode;
    document.getElementById('roleCode').value        = r.roleCode;
    document.getElementById('roleName').value        = r.roleName;
    document.getElementById('roleScope').value       = r.deptScope;
    document.getElementById('roleDataScope').value   = r.dataScope || 'All';
    document.getElementById('roleStatus').value      = r.status;
    document.getElementById('roleFormPageTitle').textContent = `Edit Role — ${r.roleName}`;
    _renderPermMatrix(perms);
    document.getElementById('rolePermCard').style.display = '';
    showPage('role-create');
  } catch (e) {
    showToast('Failed to load role: ' + (e?.message || e), 'error');
  }
}

function _renderPermMatrix(perms) {
  const byModule = Object.fromEntries((perms || []).map(p => [p.module, p]));
  const tbody = document.getElementById('rolePermBody');
  if (!tbody) return;

  const rows = [];
  for (const group of PERM_MODULE_GROUPS) {
    // group header row
    rows.push(`<tr style="background:var(--bg2)">
      <td colspan="6" style="font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--text3);padding:6px 12px">${group.label}</td>
    </tr>`);
    for (const mod of group.modules) {
      const p = byModule[mod] || {};
      const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
      const cb  = (action) =>
        `<td style="text-align:center;padding:8px">
           <input type="checkbox" data-module="${mod}" data-action="${action}" ${p[`can${cap(action)}`] ? 'checked' : ''}
             style="width:15px;height:15px;cursor:pointer;accent-color:var(--accent)"/>
         </td>`;
      rows.push(`<tr>
        <td style="padding:8px 12px;font-size:13px">${mod}</td>
        ${cb('create')}${cb('read')}${cb('write')}${cb('delete')}${cb('report')}
      </tr>`);
    }
  }
  tbody.innerHTML = rows.join('');
}

function togglePermCol(action, checked) {
  document.querySelectorAll(`[data-action="${action}"]`).forEach(cb => cb.checked = checked);
}

async function saveRoleHeader() {
  const editCode = document.getElementById('roleEditCode').value.trim();
  const roleName = document.getElementById('roleName').value.trim();
  const deptScope= document.getElementById('roleScope').value;
  const dataScope= document.getElementById('roleDataScope').value;
  const status   = document.getElementById('roleStatus').value;
  const isEdit   = !!editCode;

  if (!roleName) { showToast('Role Name is required.', 'error'); return; }

  const url    = isEdit ? `${ROLES_API()}/${encodeURIComponent(editCode)}` : ROLES_API();
  const method = isEdit ? 'PATCH' : 'POST';

  try {
    const res = await apiFetch(url, {
      method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleName, deptScope, dataScope, status }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `HTTP ${res.status}`); }
    const saved = await res.json();
    if (!isEdit) {
      document.getElementById('roleEditCode').value = saved.roleCode;
      document.getElementById('roleCode').value      = saved.roleCode;
      document.getElementById('roleFormPageTitle').textContent = `Edit Role — ${saved.roleName}`;
      _renderPermMatrix([]);
      document.getElementById('rolePermCard').style.display = '';
    }
    showToast(isEdit ? 'Role updated.' : 'Role created. Set permissions below.', 'success');
  } catch (e) {
    showToast('Error: ' + (e?.message || e), 'error');
  }
}

async function saveRolePermissions() {
  const roleCode = document.getElementById('roleEditCode').value.trim();
  if (!roleCode) { showToast('Save the role header first.', 'error'); return; }

  const permissions = PERM_MODULES.map(mod => ({
    module:    mod,
    canCreate: !!document.querySelector(`[data-module="${mod}"][data-action="create"]`)?.checked,
    canRead:   !!document.querySelector(`[data-module="${mod}"][data-action="read"]`)?.checked,
    canWrite:  !!document.querySelector(`[data-module="${mod}"][data-action="write"]`)?.checked,
    canDelete: !!document.querySelector(`[data-module="${mod}"][data-action="delete"]`)?.checked,
    canReport: !!document.querySelector(`[data-module="${mod}"][data-action="report"]`)?.checked,
  }));

  try {
    const res = await apiFetch(`${ROLES_API()}/${encodeURIComponent(roleCode)}/permissions`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `HTTP ${res.status}`); }
    showToast('Permissions saved.', 'success');
  } catch (e) {
    showToast('Error: ' + (e?.message || e), 'error');
  }
}

async function deleteRole(roleCode) {
  if (!confirm(`Delete role "${roleCode}"? Users assigned to this role must be reassigned first.`)) return;
  try {
    const res = await apiFetch(`${ROLES_API()}/${encodeURIComponent(roleCode)}`, { method: 'DELETE' });
    if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || `HTTP ${res.status}`); }
    showToast(`Role "${roleCode}" deleted.`, 'success');
    await loadRoleList();
  } catch (e) {
    showToast('Error: ' + (e?.message || e), 'error');
  }
}

function setMachineFormReadonly(isReadonly) {
  const fields = ['machId', 'machName', 'machDept', 'machStatus'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') {
      el.disabled = isReadonly;
    } else {
      el.readOnly = isReadonly;
    }
  });
  const btn = document.getElementById('machSaveBtn');
  if (btn) btn.style.display = isReadonly ? 'none' : 'inline-flex';
}

function fillMachineForm(m) {
  document.getElementById('machId').value = m.id || '';
  document.getElementById('machName').value = m.name || '';
  document.getElementById('machDept').value = m.dept || 'Production';
  document.getElementById('machStatus').value = m.status || 'Operational';
}

function createNewMachine() {
  document.getElementById('machineryFormMode').style.display = 'none';
  document.getElementById('machineryFormSub').textContent = 'Create new machine';
  fillMachineForm({ id: 'MCH-NEW', name: '', dept: 'Production', status: 'Operational' });
  setMachineFormReadonly(false);
  showPage('machinery-form');
}

function viewMachine(machineId) {
  const m = machineData[machineId];
  if (!m) return;
  document.getElementById('machineryFormMode').style.display = 'flex';
  document.getElementById('machineryFormMode').textContent = `Viewing machine: ${machineId}`;
  document.getElementById('machineryFormSub').textContent = 'View machine details';
  fillMachineForm(m);
  setMachineFormReadonly(true);
  showPage('machinery-form');
}

function editMachine(machineId) {
  const m = machineData[machineId];
  if (!m) return;
  document.getElementById('machineryFormMode').style.display = 'flex';
  document.getElementById('machineryFormMode').textContent = `Editing machine: ${machineId}`;
  document.getElementById('machineryFormSub').textContent = 'Edit machine details';
  fillMachineForm(m);
  setMachineFormReadonly(false);
  showPage('machinery-form');
}

function fillEmployeeForm(e) {
  document.getElementById('empCode').value = e.code || '';
  document.getElementById('empName').value = e.name || '';
  document.getElementById('empDept').value = e.dept || 'Production';
  document.getElementById('empSubDept').value = e.subDept || '';
  document.getElementById('empCategory').value = e.category || '';
  document.getElementById('empStatus').value = e.status || 'Active';
}

function createNewEmployee() {
  document.getElementById('employeeFormMode').style.display = 'none';
  document.getElementById('employeeFormSub').textContent = 'Create new employee';
  fillEmployeeForm({ code: 'EMP-NEW', name: '', dept: 'Production', subDept: '', category: '', status: 'Active' });
  document.getElementById('empImage').value = '';
  showPage('employee-form');
}

function viewEmployee(empNo) {
  const r = masterEmployees.find(e => (e.employeeNo || '') === empNo);
  if (!r) return;
  const fullName = [r.firstName, r.lastname].filter(Boolean).join(' ') || '-';
  const initials = [(r.firstName || '')[0], (r.lastname || '')[0]].filter(Boolean).join('').toUpperCase() || '?';
  document.getElementById('empViewName').textContent      = fullName;
  document.getElementById('empViewNo').textContent        = r.employeeNo || '';
  document.getElementById('empViewAvatar').textContent    = initials;
  document.getElementById('empViewFullName').textContent  = fullName;
  document.getElementById('empViewDesignation').textContent = r.designation || '-';
  document.getElementById('empViewEmpNo').value      = r.employeeNo    || '';
  document.getElementById('empViewDept').value       = r.departmentCode || '';
  document.getElementById('empViewEmail').value      = r.emailId        || '';
  document.getElementById('empViewSubsidiary').value = r.subsidiaryCode || '';
  document.getElementById('empViewEmirates').value   = r.emiratesOrState || '';
  document.getElementById('empViewCity').value       = r.city           || '';
  const editBtn = document.getElementById('empViewEditBtn');
  if (editBtn) editBtn.onclick = () => { document.getElementById('empViewModal').style.display = 'none'; editEmployeeFromMaster(empNo); };
  document.getElementById('empViewModal').style.display = 'flex';
}

function editEmployeeFromMaster(empNo) {
  const r = masterEmployees.find(e => (e.employeeNo || '') === empNo);
  if (!r) return;
  const fullName = [r.firstName, r.lastname].filter(Boolean).join(' ');
  document.getElementById('employeeFormMode').style.display = 'flex';
  document.getElementById('employeeFormMode').textContent = `Editing employee: ${empNo}`;
  document.getElementById('employeeFormSub').textContent = 'Edit employee details';
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  set('empCode', r.employeeNo);
  set('empName', fullName);
  set('empDept', r.departmentCode);
  showPage('employee-form');
}

function editEmployee(empCode) {
  const e = employeeData[empCode];
  if (!e) return;
  document.getElementById('employeeFormMode').style.display = 'flex';
  document.getElementById('employeeFormMode').textContent = `Editing employee: ${empCode}`;
  document.getElementById('employeeFormSub').textContent = 'Edit employee details';
  fillEmployeeForm(e);
  showPage('employee-form');
}

function openTimesheetProjectTypeModal(type) {
  pendingTimesheetType = type;
  document.getElementById('tsProjectRelated').value = 'yes';
  closeModal('timesheetProjectSelectModal');
  openModal('timesheetProjectTypeModal');
}

function goNextTimesheetProjectStep() {
  const related = document.getElementById('tsProjectRelated').value;
  closeModal('timesheetProjectTypeModal');
  if (related === 'no') {
    if (pendingTimesheetType === 'prod') showPage('new-prod');
    else showPage('new-inst');
    return;
  }
  const sel = document.getElementById('tsProjectIdSelect');
  sel.innerHTML = instProjects.map(p => `<option value="${p.id}">${p.id}</option>`).join('');
  openModal('timesheetProjectSelectModal');
}

function openTimesheetAfterProjectSelect() {
  const projectId = document.getElementById('tsProjectIdSelect').value;
  const project = instProjects.find(p => p.id === projectId);
  closeModal('timesheetProjectSelectModal');
  if (pendingTimesheetType === 'prod') {
    const prodSel = document.getElementById('prodProjectId');
    const prodName = document.getElementById('prodProjectName');
    if (prodSel) prodSel.value = projectId;
    if (prodName) prodName.value = project ? project.name : '';
    showPage('new-prod');
  } else {
    const instSel = document.getElementById('instProjectId');
    if (instSel) instSel.value = projectId;
    onInstProjectChange();
    showPage('new-inst');
  }
}

// ── Projects Team Timesheets ───────────────────────────────────────────────────

async function loadMasterProjects() {
  if (projectsLoaded && masterProjects.length > 0) return;
  const cached = readMasterCache('projects');
  if (cached && cached.length > 0) { masterProjects = cached; projectsLoaded = true; return; }
  try {
    const rows = await fetchJson(`${getApiBaseUrl()}/projects?subsidiaryIds=1,3`);
    masterProjects = Array.isArray(rows) ? rows : [];
    writeMasterCache('projects', masterProjects);
    projectsLoaded = true;
  } catch (err) { console.error('loadMasterProjects error:', err); }
}

function getPTProjectOptions() {
  if (masterProjects.length > 0)
    return masterProjects.map(p => `<option value="${p.projectCode || ''}">${p.projectCode || '-'}</option>`).join('');
  return '';
}

function getPTTaskTypeOptions() {
  if (masterTaskTypes.length > 0)
    return masterTaskTypes.map(t => `<option value="${t.reasonVisit || ''}">${t.reasonVisit || '-'}</option>`).join('');
  return '<option value="Site Visit">Site Visit</option><option value="Site Coordination">Site Coordination</option><option value="Site Inspection">Site Inspection</option>';
}

function renderProjTsRows(rows) {
  const body = document.getElementById('projTsBody');
  if (!body) return;
  const editIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const viewIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  if (!rows || rows.length === 0) {
    body.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:20px">No timesheets found.</td></tr>';
    const m = document.getElementById('projTsMeta'); if (m) m.textContent = '0 items';
    return;
  }
  body.innerHTML = rows.map((r, i) => {
    const dur = r.totalDuration ? `${r.totalDuration} min` : '—';
    const emp = r.employeeName || r.employeeCode || r.entered_by_name || '—';
    const taskType = r.shiftCode || '—';
    return `<tr>
      <td class="wip-td-num">${i + 1}</td>
      <td><span class="doc-no" style="cursor:pointer" onclick="viewProjTs('${r.tsDocNo}')">${r.tsDocNo}</span></td>
      <td>${r.entryDate || '—'}</td>
      <td>${emp}</td>
      <td style="color:#6b7280">${r.projectId || '—'}</td>
      <td><span class="wip-project-name">${r.projectName || '—'}</span></td>
      <td style="color:#6b7280">${taskType}</td>
      <td style="color:#6b7280">${dur}</td>
      <td><div class="action-cell">
        <button class="wip-action-btn" title="View" onclick="viewProjTs('${r.tsDocNo}')">${viewIcon}</button>
        <button class="wip-action-btn wip-action-edit" title="Edit" onclick="editProjTs('${r.tsDocNo}')">${editIcon}</button>
      </div></td>
    </tr>`;
  }).join('');
  const m = document.getElementById('projTsMeta');
  if (m) m.textContent = `${rows.length} timesheet${rows.length !== 1 ? 's' : ''} · Updated just now`;
}

async function loadProjTimesheets() {
  const body = document.getElementById('projTsBody');
  if (!body) return;
  try {
    let rows = await fetchJson(`${getApiBaseUrl()}/timesheets?type=PROJ`);
    if (window._userDataScope === 'Own') {
      const me = getCurrentUser()?.displayName || '';
      rows = rows.filter(r => (r.entered_by_name || r.enteredByName || '') === me);
    }
    renderProjTsRows(rows);
    projTsLoaded = true;
  } catch (err) {
    body.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--red);padding:20px">Unable to load timesheets. Check backend.</td></tr>';
    console.error('Proj timesheets error:', err);
  }
}

function toggleProjFilter() {
  const panel = document.getElementById('projFilterPanel');
  const btn   = document.getElementById('projFilterBtn');
  if (!panel) return;
  const open = panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  btn.classList.toggle('wip-filter-btn-active', open);
}

function applyProjFilters() {
  const from  = document.getElementById('projDateFrom')?.value;
  const to    = document.getElementById('projDateTo')?.value;
  const fromD = from ? new Date(from) : null;
  const toD   = to   ? new Date(to)   : null;
  let visible = 0;
  document.querySelectorAll('#projTsBody tr[data-date]').forEach(tr => {
    const d = new Date(tr.dataset.date);
    const ok = (!fromD || d >= fromD) && (!toD || d <= toD);
    tr.style.display = ok ? '' : 'none';
    if (ok) visible++;
  });
  const total = document.querySelectorAll('#projTsBody tr').length;
  const el = document.getElementById('projTsMeta');
  if (el) el.textContent = (from || to) ? `${visible} of ${total} items filtered` : `${total} items`;
}

function clearProjFilters() {
  const el = id => document.getElementById(id);
  if (el('projDateFrom')) el('projDateFrom').value = '';
  if (el('projDateTo'))   el('projDateTo').value   = '';
  applyProjFilters();
}

async function viewProjTs(docNo) {
  const r = await fetchJson(`${getApiBaseUrl()}/timesheets/${encodeURIComponent(docNo)}`).catch(() => null);
  if (!r) { showToast('Record not found.', 'error'); return; }
  const emp = (r.labourLines && r.labourLines[0]) ? (r.labourLines[0].employeeName || r.labourLines[0].employeeCode || '—') : (r.entered_by_name || '—');
  const start = (r.labourLines && r.labourLines[0])?.startTime || '—';
  const end   = (r.labourLines && r.labourLines[0])?.endTime   || '—';
  const dur   = (r.labourLines && r.labourLines[0])?.durationMinutes;
  document.getElementById('projViewDocNo').textContent = docNo;
  document.getElementById('projViewBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;font-size:13px;margin-bottom:12px">
      <div><span style="color:var(--text3)">Date</span><br><strong>${r.entryDate || '—'}</strong></div>
      <div><span style="color:var(--text3)">Employee</span><br><strong>${emp}</strong></div>
      <div><span style="color:var(--text3)">Task Type</span><br><strong>${r.shiftCode || '—'}</strong></div>
      <div><span style="color:var(--text3)">Project</span><br><strong>${r.projectId || '—'}</strong></div>
      <div><span style="color:var(--text3)">Project Name</span><br><strong>${r.projectName || '—'}</strong></div>
      <div><span style="color:var(--text3)">Start</span><br><strong>${start}</strong></div>
      <div><span style="color:var(--text3)">End</span><br><strong>${end}</strong></div>
      <div><span style="color:var(--text3)">Duration</span><br><strong>${dur ? dur + ' min' : '—'}</strong></div>
      <div><span style="color:var(--text3)">Entered By</span><br><strong>${r.entered_by_name || '—'}</strong></div>
    </div>
    ${r.remarks ? `<div style="font-size:13px"><span style="color:var(--text3)">Comments</span><br>${r.remarks}</div>` : ''}
  `;
  document.getElementById('projViewModal').style.display = 'flex';
}

function closeProjViewModal() {
  document.getElementById('projViewModal').style.display = 'none';
}

function openProjectsTeamTimesheetModal(projectId = '') {
  selectedPTProjectId = projectId || '';
  document.getElementById('ptEntryType').value = 'daily';
  openModal('projectsTeamEntryTypeModal');
}

function openProjectsTeamEntry() {
  const t = document.getElementById('ptEntryType').value;
  closeModal('projectsTeamEntryTypeModal');
  if (t === 'weekly') {
    initPTWeeklyPage();
    showPage('projects-team-weekly');
    return;
  }
  _editingProjDocNo = null;
  initPTDailyPage();
  showPage('projects-team-daily');
}

async function initPTDailyPage() {
  if (!projectsLoaded)   await loadMasterProjects();
  if (!taskTypesLoaded)  await loadMasterTaskTypes();
  if (!employeesLoaded)  await loadEmployees();
  await _ensureProjectEmployees();

  const user = document.querySelector('.user-name');
  document.getElementById('ptUser').value = user ? user.textContent.trim() : 'System User';
  document.getElementById('ptDate').value = new Date().toISOString().slice(0, 10);

  _bindPTEmployeeSearch('ptEmployee', 'ptEmployeeMenu');

  const currentUser = getCurrentUser();
  const taggedCode  = currentUser?.employeeCode || '';
  if (taggedCode && !_editingProjDocNo) {
    const empInp = document.getElementById('ptEmployee');
    if (empInp && !empInp.dataset.empCode) {
      const empObj = _projectEmployeeList.find(e => (e.employeeNo || '') === taggedCode) || masterEmployees.find(e => (e.employeeNo || '') === taggedCode);
      if (empObj) {
        empInp.dataset.empCode = taggedCode;
        empInp.value = [empObj.firstName, empObj.lastname].filter(Boolean).join(' ');
      }
    }
  }

  const projInput = document.getElementById('ptProjectId');
  projInput.value = selectedPTProjectId || '';
  if (selectedPTProjectId) _applyPTProjectSelection();
  else { document.getElementById('ptProjectName').value = ''; document.getElementById('ptCustomer').value = ''; }

  if (!projInput.dataset.boundPTSearch) {
    projInput.addEventListener('focus', () => updatePTProjectSuggestions());
    projInput.addEventListener('blur',  () => setTimeout(() => {
      const m = document.getElementById('ptProjectIdMenu'); if (m) m.style.display = 'none';
    }, 120));
    projInput.dataset.boundPTSearch = '1';
  }
  if (!window.__ptProjectMenuDocClickBound) {
    window.__ptProjectMenuDocClickBound = true;
    document.addEventListener('click', e => {
      const menu  = document.getElementById('ptProjectIdMenu');
      const input = document.getElementById('ptProjectId');
      if (!menu || !input) return;
      if (e.target !== input && !menu.contains(e.target)) menu.style.display = 'none';
    });
  }

  const ttSel = document.getElementById('ptTaskType');
  ttSel.innerHTML = '<option value="">Select task type…</option>' + getPTTaskTypeOptions();
  ['ptStartH','ptStartM','ptStartAP','ptEndH','ptEndM','ptEndAP'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('ptDuration').value    = '';
  document.getElementById('ptComments').value    = '';

  document.getElementById('ptDailyTitle').textContent = 'New Daily Timesheet';
  document.getElementById('ptDailySub').textContent   = 'Projects Team daily entry';

  const docNoEl = document.getElementById('ptDocNo');
  docNoEl.textContent = '…';
  fetchJson(`${getApiBaseUrl()}/timesheets/preview-docno?type=PROJ`)
    .then(r => { docNoEl.textContent = r.docNo || ''; })
    .catch(() => { docNoEl.textContent = ''; });
}

function updatePTProjectSuggestions() {
  const input = document.getElementById('ptProjectId');
  const menu  = document.getElementById('ptProjectIdMenu');
  if (!input || !menu) return;
  const cleaned = sanitizeProjectIdInput(input.value);
  if (cleaned !== input.value) input.value = cleaned;
  const q = cleaned.toLowerCase();
  const source = masterProjects.length > 0 ? masterProjects : (readMasterCache('projects') || []);
  const filtered = source
    .filter(p => !isProjectClosed(p))
    .map(p => p.projectCode || '')
    .filter(Boolean)
    .filter(id => !q || id.toLowerCase().includes(q))
    .slice(0, 100);
  if (filtered.length === 0) { menu.style.display = 'none'; menu.innerHTML = ''; return; }
  menu.innerHTML = filtered.map(id => `<div class="project-id-option" data-project-id="${id}">${id}</div>`).join('');
  menu.style.display = 'block';
  menu.querySelectorAll('.project-id-option').forEach(el => {
    el.addEventListener('mousedown', evt => {
      evt.preventDefault();
      input.value = el.getAttribute('data-project-id') || '';
      menu.style.display = 'none';
      _applyPTProjectSelection();
    });
  });
}

function _applyPTProjectSelection() {
  const pid = sanitizeProjectIdInput(document.getElementById('ptProjectId')?.value || '');
  const p   = masterProjects.find(x => (x.projectCode || '') === pid);
  document.getElementById('ptProjectName').value = p ? (p.projectName || '') : '';
  document.getElementById('ptCustomer').value    = p ? (p.customerName || '') : '';
}

function onPTProjectChange() {
  updatePTProjectSuggestions();
  _applyPTProjectSelection();
}

function _getPT12HourTime(prefix) {
  const h  = parseInt(document.getElementById(prefix + 'H')?.value  || '0', 10);
  const m  = parseInt(document.getElementById(prefix + 'M')?.value  || '0', 10);
  const ap = document.getElementById(prefix + 'AP')?.value || '';
  if (!h || !ap) return null;
  let hour24 = h % 12;
  if (ap === 'PM') hour24 += 12;
  return `${String(hour24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function _setPT12HourTime(prefix, hhmm) {
  if (!hhmm) return;
  const [hStr, mStr] = hhmm.split(':');
  const h24 = parseInt(hStr, 10);
  const m   = parseInt(mStr, 10);
  const ap  = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  const mRounded = [0, 15, 30, 45].reduce((prev, cur) => Math.abs(cur - m) < Math.abs(prev - m) ? cur : prev, 0);
  const hEl  = document.getElementById(prefix + 'H');
  const mEl  = document.getElementById(prefix + 'M');
  const apEl = document.getElementById(prefix + 'AP');
  if (hEl)  hEl.value  = String(h12);
  if (mEl)  mEl.value  = String(mRounded).padStart(2, '0');
  if (apEl) apEl.value = ap;
}

function calcPTDuration() {
  const s = _getPT12HourTime('ptStart');
  const e = _getPT12HourTime('ptEnd');
  if (!s || !e) return;
  const [sh, sm] = s.split(':').map(Number);
  const [eh, em] = e.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 1440;
  document.getElementById('ptDuration').value = String(mins);
}

async function savePTDailyTimesheet() {
  const empInp   = document.getElementById('ptEmployee');
  const employee = empInp?.dataset.empCode || empInp?.value || '';
  const projectId = document.getElementById('ptProjectId').value;
  const date      = document.getElementById('ptDate').value;
  const taskType  = document.getElementById('ptTaskType').value;
  const start     = _getPT12HourTime('ptStart');
  const end       = _getPT12HourTime('ptEnd');
  const duration  = document.getElementById('ptDuration').value;
  const comments  = document.getElementById('ptComments').value.trim();
  const entryPerson = document.getElementById('ptUser').value;
  const projectName = document.getElementById('ptProjectName').value;

  if (!employee)  { showToast('Please select an employee.', 'error'); return; }
  if (!projectId) { showToast('Please select a project.', 'error');   return; }
  if (!date)      { showToast('Please select a date.', 'error');       return; }
  if (!taskType)  { showToast('Please select a task type.', 'error');  return; }

  const payload = {
    tsType:      'PROJ',
    date,
    projectId,
    projectName,
    shift:       taskType,
    entryPerson,
    remarks:     comments,
    labourRows:  [{ employee, startTime: start || null, endTime: end || null, duration: duration || '0' }],
  };

  try {
    const isEdit = !!_editingProjDocNo;
    const opts = { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
    const url  = isEdit ? `${getApiBaseUrl()}/timesheets/${encodeURIComponent(_editingProjDocNo)}` : `${getApiBaseUrl()}/timesheets`;
    const res  = await apiFetch(url, opts);
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || res.statusText); }
    showToast(isEdit ? 'Timesheet updated.' : 'Timesheet saved.', 'success');
    projTsLoaded = false;
    showPage('projects-team');
  } catch (err) {
    showToast('Save failed: ' + (err?.message || err), 'error');
  }
}

async function editProjTs(docNo) {
  const r = await fetchJson(`${getApiBaseUrl()}/timesheets/${encodeURIComponent(docNo)}`).catch(() => null);
  if (!r) { showToast('Record not found.', 'error'); return; }
  await initPTDailyPage();
  _editingProjDocNo = docNo;
  showPage('projects-team-daily');
  document.getElementById('ptDailyTitle').textContent = 'Edit Timesheet';
  document.getElementById('ptDailySub').textContent   = docNo;
  document.getElementById('ptDocNo').textContent      = docNo;
  document.getElementById('ptDate').value             = r.entryDate || '';
  document.getElementById('ptProjectId').value        = r.projectId || '';
  onPTProjectChange();
  document.getElementById('ptTaskType').value         = r.shiftCode  || '';
  document.getElementById('ptComments').value         = r.remarks    || '';
  if (r.labourLines && r.labourLines[0]) {
    const l = r.labourLines[0];
    const ptEmpInp = document.getElementById('ptEmployee');
    if (ptEmpInp) {
      ptEmpInp.dataset.empCode = l.employeeCode || '';
      ptEmpInp.value = l.employeeName || l.employeeCode || '';
    }
    _setPT12HourTime('ptStart', l.startTime);
    _setPT12HourTime('ptEnd',   l.endTime);
    document.getElementById('ptDuration').value = l.durationMinutes ? String(l.durationMinutes) : '';
  }
}

// ── Weekly form ────────────────────────────────────────────────────────────────

function _dateOffsetStr(baseStr, offset) {
  const dt = new Date(baseStr + 'T00:00:00');
  dt.setDate(dt.getDate() + offset);
  return dt.toISOString().slice(0, 10);
}

function _formatDayHeader(baseStr, offset) {
  if (!baseStr) return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][offset] || `Day ${offset + 1}`;
  const dt = new Date(baseStr + 'T00:00:00');
  dt.setDate(dt.getDate() + offset);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return `${days[dt.getDay()]} ${dt.getDate()}/${dt.getMonth() + 1}`;
}

function onPTWeeklyStartChange() {
  const s = document.getElementById('ptWeeklyStart').value;
  if (!s) return;
  const dt = new Date(s + 'T00:00:00');
  dt.setDate(dt.getDate() + 6);
  document.getElementById('ptWeeklyEnd').value = dt.toISOString().slice(0, 10);
  for (let i = 0; i < 7; i++) {
    const th = document.getElementById(`ptwDay${i + 1}`);
    if (th) th.textContent = _formatDayHeader(s, i);
  }
}

function _parse12HourTimePart(part) {
  // Accepts: "8am", "8:30am", "8AM", "8:30 PM", "14:00" (24h fallback)
  const clean = part.replace(/\s/g, '').toLowerCase();
  const m = clean.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2] || '0', 10);
  const meridiem = m[3];
  if (meridiem) {
    if (meridiem === 'pm' && h !== 12) h += 12;
    if (meridiem === 'am' && h === 12) h = 0;
  }
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function _parsePTTimeRange(str) {
  if (!str) return null;
  const clean = str.replace('–', '-').replace(/\s*-\s*/, '-');
  const sep = clean.indexOf('-', 1);
  if (sep === -1) return null;
  const startRaw = clean.slice(0, sep).trim();
  const endRaw   = clean.slice(sep + 1).trim();
  const start = _parse12HourTimePart(startRaw);
  const end   = _parse12HourTimePart(endRaw);
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let dur = (eh * 60 + em) - (sh * 60 + sm);
  if (dur < 0) dur += 1440;
  return { start, end, duration: String(dur) };
}

function _formatTimeAs12(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ap  = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

function normalizePTWeeklyTime(input) {
  const parsed = _parsePTTimeRange(input.value.trim());
  if (parsed) input.value = `${_formatTimeAs12(parsed.start)} - ${_formatTimeAs12(parsed.end)}`;
}

function normalizeTimeInput(input) {
  const parsed = _parse12HourTimePart(input.value.trim());
  if (parsed) input.value = _formatTimeAs12(parsed);
}

function _readTimeValue(el) {
  const v = el?.value?.trim() || '';
  return _parse12HourTimePart(v) || v;
}

function _bindPTWeeklyRowSearch(tr) {
  const input = tr.querySelector('input.ptw-proj');
  const menu  = tr.querySelector('.ptw-proj-menu');
  if (!input || !menu) return;
  input.addEventListener('input', () => _showPTWeeklyProjMenu(input, menu));
  input.addEventListener('focus', () => _showPTWeeklyProjMenu(input, menu));
  input.addEventListener('blur',  () => setTimeout(() => { menu.style.display = 'none'; }, 120));
}

function _showPTWeeklyProjMenu(input, menu) {
  const cleaned = sanitizeProjectIdInput(input.value);
  if (cleaned !== input.value) input.value = cleaned;
  const q = cleaned.toLowerCase();
  const source = masterProjects.length > 0 ? masterProjects : (readMasterCache('projects') || []);
  const filtered = source
    .filter(p => !isProjectClosed(p))
    .map(p => p.projectCode || '')
    .filter(Boolean)
    .filter(id => !q || id.toLowerCase().includes(q))
    .slice(0, 100);
  if (filtered.length === 0) { menu.style.display = 'none'; menu.innerHTML = ''; return; }
  menu.innerHTML = filtered.map(id => `<div class="project-id-option" data-project-id="${id}">${id}</div>`).join('');
  // position fixed so the menu escapes the overflow-x:auto table wrapper
  const rect = input.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top      = `${rect.bottom + 4}px`;
  menu.style.left     = `${rect.left}px`;
  menu.style.width    = `${Math.max(rect.width, 160)}px`;
  menu.style.right    = 'auto';
  menu.style.display  = 'block';
  menu.querySelectorAll('.project-id-option').forEach(el => {
    el.addEventListener('mousedown', evt => {
      evt.preventDefault();
      input.value = el.getAttribute('data-project-id') || '';
      menu.style.display = 'none';
    });
  });
}

function addPTWeeklyRow() {
  const tb = document.getElementById('ptWeeklyBody');
  if (!tb) return;
  const ttOpts  = getPTTaskTypeOptions();
  const dayCell = `<td><input class="line-input ptw-time" placeholder="8am-5pm" style="min-width:110px" onblur="normalizePTWeeklyTime(this)"/></td>`;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td style="position:relative">
      <input class="line-input ptw-proj" placeholder="Type project ID…" autocomplete="off" style="min-width:130px"/>
      <div class="project-id-menu ptw-proj-menu" style="display:none;min-width:160px"></div>
    </td>
    <td><select class="line-input"><option value="">— Task —</option>${ttOpts}</select></td>
    ${dayCell}${dayCell}${dayCell}${dayCell}${dayCell}${dayCell}${dayCell}
    <td><input class="line-input" placeholder="Comment"/></td>
    <td><button class="del-row-btn" onclick="this.closest('tr').remove()" title="Remove"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>
  `;
  tb.appendChild(tr);
  _bindPTWeeklyRowSearch(tr);
}

async function initPTWeeklyPage() {
  if (!projectsLoaded)  await loadMasterProjects();
  if (!taskTypesLoaded) await loadMasterTaskTypes();
  if (!employeesLoaded) await loadEmployees();
  await _ensureProjectEmployees();

  const user = document.querySelector('.user-name');
  document.getElementById('ptWeeklyUser').value = user ? user.textContent.trim() : 'System User';

  _bindPTEmployeeSearch('ptWeeklyEmployee', 'ptWeeklyEmployeeMenu');

  const currentUser = getCurrentUser();
  const taggedCode  = currentUser?.employeeCode || '';
  if (taggedCode) {
    const empInp = document.getElementById('ptWeeklyEmployee');
    if (empInp && !empInp.dataset.empCode) {
      const empObj = _projectEmployeeList.find(e => (e.employeeNo || '') === taggedCode) || masterEmployees.find(e => (e.employeeNo || '') === taggedCode);
      if (empObj) {
        empInp.dataset.empCode = taggedCode;
        empInp.value = [empObj.firstName, empObj.lastname].filter(Boolean).join(' ');
      }
    }
  }

  const today  = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  document.getElementById('ptWeeklyStart').value = monday.toISOString().slice(0, 10);
  onPTWeeklyStartChange();

  const body = document.getElementById('ptWeeklyBody');
  if (body) { body.innerHTML = ''; addPTWeeklyRow(); }
}

async function savePTWeeklyTimesheet() {
  const ptWkEmpInp = document.getElementById('ptWeeklyEmployee');
  const employee   = ptWkEmpInp?.dataset.empCode || ptWkEmpInp?.value || '';
  const enteredBy = document.getElementById('ptWeeklyUser').value;
  const weekStart = document.getElementById('ptWeeklyStart').value;
  if (!employee)  { showToast('Please select an employee.', 'error'); return; }
  if (!weekStart) { showToast('Please select a week start date.', 'error'); return; }

  const rows = Array.from(document.querySelectorAll('#ptWeeklyBody tr'));
  const records = [];

  for (const tr of rows) {
    const cells = tr.querySelectorAll('td');
    if (cells.length < 11) continue;
    const projectId = sanitizeProjectIdInput(cells[0].querySelector('input.ptw-proj')?.value || '');
    const taskType  = cells[1].querySelector('select')?.value;
    const comment   = cells[9].querySelector('input')?.value.trim() || '';
    const projObj   = masterProjects.find(p => (p.projectCode || '') === projectId);
    const projectName = projObj?.projectName || '';
    if (!projectId) continue;

    for (let d = 0; d < 7; d++) {
      const timeStr = cells[2 + d].querySelector('input')?.value.trim();
      const parsed  = _parsePTTimeRange(timeStr);
      if (!parsed) continue;
      records.push({
        tsType:     'PROJ',
        date:       _dateOffsetStr(weekStart, d),
        projectId,
        projectName,
        shift:      taskType || '',
        entryPerson: enteredBy,
        remarks:    comment,
        labourRows: [{ employee, startTime: parsed.start, endTime: parsed.end, duration: parsed.duration }],
      });
    }
  }

  if (records.length === 0) { showToast('No valid day entries found. Enter times as 8am-5pm or 8:30AM-4:30PM.', 'error'); return; }

  try {
    const res  = await apiFetch(`${getApiBaseUrl()}/timesheets/batch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ records }) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || res.statusText); }
    const data = await res.json();
    showToast(`${data.results?.length || records.length} timesheets saved.`, 'success');
    projTsLoaded = false;
    showPage('projects-team');
  } catch (err) {
    showToast('Save failed: ' + (err?.message || err), 'error');
  }
}

let activeDateRangeInput = null;
function openDateRangePicker(targetInput) {
  activeDateRangeInput = targetInput;
  const current = targetInput.value || '';
  const parts = current.split(' to ');
  document.getElementById('rangeFromDate').value = parts[0] || '';
  document.getElementById('rangeToDate').value = parts[1] || '';
  openModal('dateRangeModal');
}

function applyDateRange() {
  if (!activeDateRangeInput) return;
  const from = document.getElementById('rangeFromDate').value;
  const to = document.getElementById('rangeToDate').value;
  if (from && to) {
    activeDateRangeInput.value = `${from} to ${to}`;
  } else if (from) {
    activeDateRangeInput.value = from;
  } else {
    activeDateRangeInput.value = '';
  }
  closeModal('dateRangeModal');
}

function updateInstProjectSuggestions() {
  const input = document.getElementById('instProjectId');
  const menu  = document.getElementById('instProjectIdMenu');
  if (!input) return;
  const cleaned = sanitizeProjectIdInput(input.value);
  if (cleaned !== input.value) input.value = cleaned;
  const q = cleaned.toLowerCase();
  const projectSource = masterProjects.length > 0 ? masterProjects : (readMasterCache('projects') || []);
  const closedCodes = new Set(projectSource.filter(isProjectClosed).map(p => (p.projectCode || '').toLowerCase()));
  const allIds = getAllProdProjectIds();
  const filtered = allIds.filter(id => !closedCodes.has(id.toLowerCase()) && (!q || id.toLowerCase().includes(q))).slice(0, 200);
  if (!menu) return;
  if (filtered.length === 0) { menu.style.display = 'none'; menu.innerHTML = ''; return; }
  menu.innerHTML = filtered.map(id => `<div class="project-id-option" data-project-id="${id}">${id}</div>`).join('');
  menu.style.display = 'block';
  menu.querySelectorAll('.project-id-option').forEach(el => {
    el.addEventListener('mousedown', evt => {
      evt.preventDefault();
      input.value = el.getAttribute('data-project-id') || '';
      menu.style.display = 'none';
      onInstProjectChange();
    });
  });
}

async function onInstProjectChange() {
  updateInstProjectSuggestions();
  const inputEl   = document.getElementById('instProjectId');
  const projectId = inputEl ? sanitizeProjectIdInput(inputEl.value) : '';
  if (inputEl && inputEl.value !== projectId) inputEl.value = projectId;
  const project   = masterProjects.find(p => p.projectCode === projectId) || instProjects.find(p => p.id === projectId);
  const nameEl    = document.getElementById('instProjectName');
  if (nameEl) nameEl.value = project?.projectName || project?.name || '';
  if (!document.getElementById('instWorkOrder')) return;
  await _ensureCompletedWoNos();
  const masterList   = masterWorkOrders.filter(w =>
    (w.projectCode || '') === projectId &&
    (w.departmentName || '').toLowerCase().includes('inst') &&
    !_completedWoNos.has((w.workOrderNumber || '').trim())
  );
  const fallbackList = instWorkOrders.filter(w =>
    w.projectId === projectId && !_completedWoNos.has((w.wo || '').trim())
  );
  const woOpts = masterList.length > 0
    ? masterList.map(w => ({ value: w.workOrderNumber || '', label: w.workOrderNumber || '-' }))
    : fallbackList.map(w => ({ value: w.wo, label: w.wo }));
  setSrchOptions('instWorkOrder', woOpts);
  setupSearchSel('instWorkOrder', 'instWorkOrderMenu', onInstWOChange);
  if (!document.getElementById('instWorkOrder').value && woOpts.length === 1)
    document.getElementById('instWorkOrder').value = woOpts[0].value;
  onInstWOChange();
}

function onInstWOChange() {
  const wo  = document.getElementById('instWorkOrder')?.value || '';
  const row = masterWorkOrders.find(w => (w.workOrderNumber || '') === wo)
           || instWorkOrders.find(w => w.wo === wo);
  const deptEl = document.getElementById('instDepartment');
  if (!deptEl) return;
  const code = row?.departmentCode || '';
  if (code) deptEl.value = code;
  const blk = document.getElementById('instWocBlock');
  const btn = document.getElementById('instSaveBtn');
  if (wo && _completedWoNosLoaded && _completedWoNos.has(wo.trim())) {
    if (blk) { blk.textContent = `⛔ Work order ${wo} has already been marked complete. Timesheet entry is not allowed.`; blk.style.display = 'block'; }
    if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
  } else {
    if (blk) blk.style.display = 'none';
    if (btn) { btn.disabled = false; btn.style.opacity = ''; }
  }
}

function calcInstDuration(input) {
  const tr = input.closest('tr');
  const s  = _parse12HourTimePart(tr.querySelector('.inst-start')?.value || '');
  const e  = _parse12HourTimePart(tr.querySelector('.inst-end')?.value   || '');
  if (!s || !e) return;
  const [sh, sm] = s.split(':').map(Number);
  const [eh, em] = e.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 1440;
  const dur = tr.querySelector('.inst-dur');
  if (dur) dur.value = String(mins);
}

function addInstLabourRow() {
  const tb = document.getElementById('instLabourBody');
  if (!tb) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><div class="srch-wrap" style="min-width:170px"><input class="line-input ts-emp-inp" placeholder="Search employee…" autocomplete="off" style="width:100%"/><div class="srch-menu ts-emp-menu" style="display:none;min-width:220px"></div></div></td>
    <td><input type="text" class="line-input inst-start" placeholder="8:00 AM" oninput="calcInstDuration(this)" onblur="normalizeTimeInput(this);calcInstDuration(this)"/></td>
    <td><input type="text" class="line-input inst-end"   placeholder="5:00 PM" oninput="calcInstDuration(this)" onblur="normalizeTimeInput(this);calcInstDuration(this)"/></td>
    <td><input class="line-input inst-dur" value="" readonly/></td>
    <td><button class="del-row-btn" onclick="this.closest('tr').remove();updateInstTabBadges()" title="Remove"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>
  `;
  tb.appendChild(tr);
  _bindEmpSearchRow(tr, _getInstEmployees, _ensureInstEmployees);
  updateInstTabBadges();
}

function _applyItemSelection(tr, code, descClass, uomClass) {
  const masterItem = masterItems.find(it => (it.itemcode || it.itemName || '') === code);
  const info = masterItem
    ? { desc: masterItem.description || masterItem.itemName || '', uom: masterItem.UOM || '' }
    : (itemLookup[code] || { desc: '', uom: '' });
  if (tr.querySelector(descClass)) tr.querySelector(descClass).value = info.desc;
  if (tr.querySelector(uomClass))  tr.querySelector(uomClass).value  = info.uom;
}

function _bindItemSearchRow(tr, descClass, uomClass) {
  const inp  = tr.querySelector('.ts-item-inp');
  const menu = tr.querySelector('.ts-item-menu');
  if (!inp || !menu) return;

  function positionMenu() {
    const rect = inp.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.top   = (rect.bottom + 2) + 'px';
    menu.style.left  = rect.left + 'px';
    menu.style.width = Math.max(rect.width, 260) + 'px';
    menu.style.zIndex = '9999';
  }

  function renderItem() {
    const q = (inp.value || '').toLowerCase();
    const source = masterItems.length > 0 ? masterItems : Object.entries(itemLookup).map(([code, d]) => ({ itemcode: code, itemName: d.desc }));
    const opts = source
      .filter(it => !isSjoItem(it))
      .map(it => ({ value: it.itemcode || it.itemName || '', label: it.itemcode ? `${it.itemcode} – ${it.itemName || ''}` : (it.itemName || '') }))
      .filter(o => o.value && (!q || o.label.toLowerCase().includes(q)));
    if (!opts.length) { menu.style.display = 'none'; return; }
    menu.innerHTML = opts.slice(0, 150).map(o =>
      `<div class="srch-opt" data-val="${o.value.replace(/"/g,'&quot;')}" data-label="${o.label.replace(/"/g,'&quot;')}">${o.label}</div>`
    ).join('');
    positionMenu();
    menu.style.display = 'block';
    menu.querySelectorAll('.srch-opt').forEach(el => {
      el.addEventListener('mousedown', ev => {
        ev.preventDefault();
        inp.dataset.itemCode = el.dataset.val;
        inp.value = el.dataset.label;
        menu.style.display = 'none';
        _applyItemSelection(tr, el.dataset.val, descClass, uomClass);
      });
    });
  }

  inp.addEventListener('focus', renderItem);
  inp.addEventListener('input', renderItem);
  inp.addEventListener('blur',  () => setTimeout(() => { menu.style.display = 'none'; }, 160));
}

function onInstItemChange(sel) {
  const code = sel.value;
  const tr = sel.closest('tr');
  _applyItemSelection(tr, code, '.inst-item-desc', '.inst-item-uom');
}

function addInstMaterialRow() {
  const tb = document.getElementById('instMaterialBody');
  if (!tb) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><div class="srch-wrap" style="min-width:180px"><input class="line-input ts-item-inp" placeholder="Search item…" autocomplete="off" style="width:100%"/><div class="srch-menu ts-item-menu" style="display:none;min-width:260px"></div></div></td>
    <td><input class="line-input inst-item-desc" value="" readonly/></td>
    <td><input class="line-input inst-item-uom"  value="" readonly/></td>
    <td><input type="number" class="line-input" value="" min="0"/></td>
    <td><button class="del-row-btn" onclick="this.closest('tr').remove();updateInstTabBadges()" title="Remove"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>
  `;
  tb.appendChild(tr);
  _bindItemSearchRow(tr, '.inst-item-desc', '.inst-item-uom');
  updateInstTabBadges();
}

function getInstVehicleOptions() {
  const active = masterVehicles.filter(v => (v.status || '').toLowerCase() === 'active');
  if (active.length > 0) {
    return active.map(v => {
      const label = v.plateNo + (v.vehicleType ? ` — ${v.vehicleType}` : '') + (v.make || v.model ? ` (${[v.make, v.model].filter(Boolean).join(' ')})` : '');
      return `<option value="${v.plateNo}">${label}</option>`;
    }).join('');
  }
  return '';
}

function getInstAccessOptions() {
  const source = masterAccessEquipment.length > 0 ? masterAccessEquipment : (readMasterCache('access-equipment') || []);
  if (source.length > 0) return source.map(a => `<option value="${a.equipmentName || ''}">${a.equipmentName || ''}</option>`).join('');
  return `<option value="Scissor Lift">Scissor Lift</option><option value="Boom Lift">Boom Lift</option><option value="Mobile Scaffold">Mobile Scaffold</option>`;
}

function addInstVehicleRow() {
  const tb = document.getElementById('instVehicleBody');
  if (!tb) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><select class="line-input"><option value="">— Select Vehicle —</option>${getInstVehicleOptions()}</select></td>
    <td><input type="number" class="line-input" value="" min="0" step="1"/></td>
    <td><button class="del-row-btn" onclick="this.closest('tr').remove();updateInstTabBadges()" title="Remove"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>
  `;
  tb.appendChild(tr);
  updateInstTabBadges();
}

function addInstAccessRow() {
  const tb = document.getElementById('instAccessBody');
  if (!tb) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><select class="line-input"><option value="">— Select Equipment —</option>${getInstAccessOptions()}</select></td>
    <td><input type="number" class="line-input" value="" min="0" step="0.5"/></td>
    <td><button class="del-row-btn" onclick="this.closest('tr').remove();updateInstTabBadges()" title="Remove"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>
  `;
  tb.appendChild(tr);
  updateInstTabBadges();
}

function updateInstTabBadges() {
  const counts = {
    labour:   document.querySelectorAll('#instLabourBody tr').length,
    material: document.querySelectorAll('#instMaterialBody tr').length,
    vehicle:  document.querySelectorAll('#instVehicleBody tr').length,
    access:   document.querySelectorAll('#instAccessBody tr').length,
  };
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('instBadgeLabour',   counts.labour);
  set('instBadgeMaterial', counts.material);
  set('instBadgeVehicle',  counts.vehicle);
  set('instBadgeAccess',   counts.access);
  set('instSumLabour',     counts.labour);
  set('instSumMaterial',   counts.material);
  set('instSumVehicle',    counts.vehicle);
  set('instSumAccess',     counts.access);
  const total = counts.labour + counts.material + counts.vehicle + counts.access;
  const mobBadge = document.getElementById('instMobBadge');
  if (mobBadge) mobBadge.textContent = total;
}

function openInstEntryModal() {
  document.getElementById('instEntryModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  switchMobTsTab('inst', 'details');
}

function closeInstEntryModal() {
  document.getElementById('instEntryModal').style.display = 'none';
  document.body.style.overflow = '';
  window._editingInstDocNo = null;
  const blk = document.getElementById('instWocBlock'); if (blk) blk.style.display = 'none';
  const btn = document.getElementById('instSaveBtn'); if (btn) { btn.disabled = false; btn.style.opacity = ''; }
}

async function initNewInstPage() {
  const isEditing = !!window._editingInstDocNo;

  if (!prodDepartmentsLoaded) await loadProdDepartments();
  populateInstDepartmentSelect();
  if (!masterVehiclesLoaded) await loadMasterVehicles();
  if (!masterAccessEquipmentLoaded) await loadMasterAccessEquipment();
  await _ensureInstEmployees();

  const entry = document.getElementById('instEntryPerson');
  const loginName = document.querySelector('.user-name');
  if (entry) entry.value = loginName ? loginName.textContent.trim() : 'System User';

  const dateEl = document.getElementById('instDate');
  if (dateEl) {
    const now = new Date();
    const minDate = new Date(now); minDate.setDate(now.getDate() - 30);
    const toIso = d => d.toISOString().slice(0, 10);
    dateEl.min = toIso(minDate);
    dateEl.max = toIso(now);
    if (!isEditing) dateEl.value = toIso(now);
  }

  const instShiftOpts = masterShifts.filter(s => (s.status || '').toLowerCase() === 'active').map(s => ({ value: s.shiftCode, label: `${s.shiftCode} — ${s.shiftName || ''}` }));
  if (!instShiftOpts.length) instShiftOpts.push({ value: 'SHIFT-A', label: 'SHIFT-A — Morning Shift' }, { value: 'SHIFT-B', label: 'SHIFT-B — Evening Shift' }, { value: 'SHIFT-C', label: 'SHIFT-C — Night Shift' });
  setSrchOptions('instShift', instShiftOpts);
  setupSearchSel('instShift', 'instShiftMenu');

  if (!isEditing) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) { if (el.tagName === 'SPAN') el.textContent = v; else el.value = v; } };
    const instDocNoEl = document.getElementById('instDocNo');
    if (instDocNoEl) {
      instDocNoEl.textContent = '…';
      fetchJson(`${getApiBaseUrl()}/timesheets/preview-docno?type=INST`)
        .then(r => { instDocNoEl.textContent = r.docNo || ''; })
        .catch(() => { instDocNoEl.textContent = ''; });
    }
    set('instProjectId', '');
    set('instProjectName', '');
    set('instDepartment', '');
    document.getElementById('instEntryModalTitle').textContent = 'New Installation Timesheet';
    document.getElementById('instEntryModalSub').textContent   = 'Fill in the details below and save';
    const woInput = document.getElementById('instWorkOrder');
    if (woInput) { woInput.value = ''; setSrchOptions('instWorkOrder', []); }
    ['instLabourBody','instMaterialBody','instVehicleBody','instAccessBody'].forEach(id => {
      const el = document.getElementById(id); if (el) el.innerHTML = '';
    });
    addInstLabourRow();
  }

  const instInput = document.getElementById('instProjectId');
  if (instInput && !instInput.dataset.boundProjectSearch) {
    instInput.addEventListener('focus', () => updateInstProjectSuggestions());
    instInput.addEventListener('blur',  () => setTimeout(() => {
      const m = document.getElementById('instProjectIdMenu'); if (m) m.style.display = 'none';
    }, 120));
    instInput.dataset.boundProjectSearch = '1';
  }

  if (!window.__instProjectMenuDocClickBound) {
    window.__instProjectMenuDocClickBound = true;
    document.addEventListener('click', e => {
      const menu  = document.getElementById('instProjectIdMenu');
      const input = document.getElementById('instProjectId');
      if (!menu || !input) return;
      if (e.target !== input && !menu.contains(e.target)) menu.style.display = 'none';
    });
  }

  updateInstTabBadges();
}


// ── Production form helpers ──
function calcProdDur(input) {
  const tr = input.closest('tr');
  const s = _parse12HourTimePart(tr.querySelector('.prod-start')?.value || '');
  const e = _parse12HourTimePart(tr.querySelector('.prod-end')?.value   || '');
  if (!s || !e) return;
  const [sh, sm] = s.split(':').map(Number);
  const [eh, em] = e.split(':').map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 1440;
  const dur = tr.querySelector('.prod-dur');
  if (dur) dur.value = String(mins);
}

function getProdEmployeeOptions() {
  if (masterEmployees.length > 0) {
    return masterEmployees.map(e => {
      const fullName = [e.firstName, e.lastname].filter(Boolean).join(' ');
      const val = e.employeeNo || fullName;
      const label = e.employeeNo ? `${e.employeeNo} - ${fullName}` : fullName;
      return `<option value="${val}">${label}</option>`;
    }).join('');
  }
  return Object.values(employeeData).map(e => `<option value="${e.code}">${e.code} - ${e.name}</option>`).join('');
}

function addProdLabourRow() {
  const tb = document.getElementById('prodLabourBody');
  if (!tb) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><div class="srch-wrap" style="min-width:170px"><input class="line-input ts-emp-inp" placeholder="Search employee…" autocomplete="off" style="width:100%"/><div class="srch-menu ts-emp-menu" style="display:none;min-width:220px"></div></div></td>
    <td><input type="text" class="line-input prod-start" placeholder="8:00 AM" oninput="calcProdDur(this)" onblur="normalizeTimeInput(this);calcProdDur(this)"/></td>
    <td><input type="text" class="line-input prod-end"   placeholder="5:00 PM" oninput="calcProdDur(this)" onblur="normalizeTimeInput(this);calcProdDur(this)"/></td>
    <td><input class="line-input prod-dur" value="" readonly/></td>
    <td><button class="del-row-btn" onclick="this.closest('tr').remove();updateProdTabBadges()" title="Remove"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>
  `;
  tb.appendChild(tr);
  _bindEmpSearchRow(tr, _getProdInstEmployees, _ensureProdInstEmployees);
  updateProdTabBadges();
}

function getProdItemOptions() {
  const source = masterItems.length > 0
    ? masterItems
        .filter(it => !isSjoItem(it))
        .map(it => {
          const val = it.itemcode || it.itemName || '';
          const label = it.itemcode ? `${it.itemcode} – ${it.itemName || ''}` : (it.itemName || '');
          return `<option value="${val}">${label}</option>`;
        }).join('')
    : Object.entries(itemLookup).map(([code, d]) => `<option value="${code}">${code} – ${d.desc}</option>`).join('');
  return source || `<option value="">No items loaded</option>`;
}

function onProdItemChange(sel) {
  const code = sel.value;
  const tr = sel.closest('tr');
  _applyItemSelection(tr, code, '.prod-desc', '.prod-uom');
}

function addProdMaterialRow() {
  const matTb = document.getElementById('prodMaterialBody');
  if (!matTb) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><div class="srch-wrap" style="min-width:180px"><input class="line-input ts-item-inp" placeholder="Search item…" autocomplete="off" style="width:100%"/><div class="srch-menu ts-item-menu" style="display:none;min-width:260px"></div></div></td>
    <td><input class="line-input prod-desc" value="" readonly/></td>
    <td><input class="line-input prod-uom" value="" readonly/></td>
    <td><input type="number" class="line-input" value="" min="0"/></td>
    <td><button class="del-row-btn" onclick="this.closest('tr').remove();updateProdTabBadges()" title="Remove"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>
  `;
  matTb.appendChild(tr);
  _bindItemSearchRow(tr, '.prod-desc', '.prod-uom');
  updateProdTabBadges();
}

function addProdMachineryRow() {
  const machTb = document.getElementById('prodMachineryBody');
  if (!machTb) return;
  const tr = document.createElement('tr');
  const machineOptions = getProdMachineryOptions();
  tr.innerHTML = `
    <td><select class="line-input"><option value="">— Select Machine —</option>${machineOptions}</select></td>
    <td><input type="number" class="line-input" value="" step="1" min="0"/></td>
    <td><button class="del-row-btn" onclick="this.closest('tr').remove();updateProdTabBadges()" title="Remove"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>
  `;
  machTb.appendChild(tr);
  updateProdTabBadges();
}

function getProdProjectOptions() {
  if (masterProjects.length > 0) {
    return masterProjects.map((p) => `<option value="${p.projectCode}">${p.projectCode}</option>`).join('');
  }
  return instProjects.map((p) => `<option value="${p.id}">${p.id}</option>`).join('');
}

function isProjectClosed(p) {
  // Check every field that might carry a status value
  const statusRaw = p.status || p.netsuiteStatus || p.projectStatus || p.statusLabel || '';
  const s = statusRaw.toLowerCase().trim();
  return s === 'closed' || s === 'close'
    || s === 'completed' || s === 'complete'
    || s === 'cancelled' || s === 'canceled'
    || s === 'stopped'   || s === 'inactive'
    || s.includes('clos') || s.includes('cancel') || s.includes('complet');
}

function getAllProdProjectIds() {
  // Use masterProjects if populated; fall back to cache, then to static instProjects
  const source = masterProjects.length > 0
    ? masterProjects
    : (readMasterCache('projects') || []);

  if (source.length > 0) {
    return source
      .filter((p) => !isProjectClosed(p))
      .map((p) => (p.projectCode || '').toString())
      .filter(Boolean);
  }
  return instProjects.map((p) => (p.id || '').toString()).filter(Boolean);
}

function sanitizeProjectIdInput(raw) {
  return (raw || '').replace(/[^A-Za-z0-9_ -]/g, '');
}

function updateProdProjectSuggestions() {
  const input = document.getElementById('prodProjectId');
  const menu = document.getElementById('prodProjectIdMenu');
  if (!input) return;

  const cleaned = sanitizeProjectIdInput(input.value);
  if (cleaned !== input.value) input.value = cleaned;

  const q = cleaned.toLowerCase();

  // Build a set of closed project codes as a second-pass safety net
  const projectSource = masterProjects.length > 0 ? masterProjects : (readMasterCache('projects') || []);

  // DEBUG: log first 5 projects to reveal actual status field names
  console.log('[DEBUG] projectSource.length:', projectSource.length);
  if (projectSource.length > 0) {
    console.log('[DEBUG] sample projects (first 5):',
      projectSource.slice(0, 5).map(p => ({
        projectCode: p.projectCode,
        status: p.status,
        netsuiteStatus: p.netsuiteStatus,
        projectStatus: p.projectStatus,
        statusLabel: p.statusLabel,
        allKeys: Object.keys(p)
      }))
    );
    const closedSamples = projectSource.filter(isProjectClosed);
    console.log('[DEBUG] projects identified as closed:', closedSamples.length);
  }

  const closedCodes = new Set(
    projectSource.filter(isProjectClosed).map(p => (p.projectCode || '').toLowerCase())
  );

  const allIds = getAllProdProjectIds();
  const filtered = allIds
    .filter((id) => !closedCodes.has(id.toLowerCase()))
    .filter((id) => !q || id.toLowerCase().includes(q));

  const top = filtered.slice(0, 200);

  if (!menu) return;
  if (top.length === 0) {
    menu.style.display = 'none';
    menu.innerHTML = '';
    return;
  }

  menu.innerHTML = top.map((id) => `<div class="project-id-option" data-project-id="${id}">${id}</div>`).join('');
  menu.style.display = 'block';

  menu.querySelectorAll('.project-id-option').forEach((el) => {
    el.addEventListener('mousedown', (evt) => {
      evt.preventDefault();
      input.value = el.getAttribute('data-project-id') || '';
      menu.style.display = 'none';
      onProdProjectChange();
    });
  });
}

function getProdTaskTypeOptions() {
  if (masterTaskTypes.length > 0) {
    return masterTaskTypes.map((t) => `<option value="${t.reasonVisit || ''}">${t.reasonVisit || '-'}</option>`).join('');
  }
  return '<option value="">-</option>';
}

function getActiveShiftOptions() {
  const active = masterShifts.filter(s => (s.status || '').toLowerCase() === 'active');
  if (active.length > 0) {
    return active.map(s => `<option value="${s.shiftCode}">${s.shiftCode} — ${s.shiftName || ''}</option>`).join('');
  }
  return '<option value="SHIFT-A">SHIFT-A — Morning Shift</option><option value="SHIFT-B">SHIFT-B — Evening Shift</option><option value="SHIFT-C">SHIFT-C — Night Shift</option>';
}

function getProdShiftOptions() {
  return getActiveShiftOptions();
}

function getProdMachineryOptions() {
  if (masterMachinery.length > 0) {
    return masterMachinery.map((m, idx) => `<option value="${m.machineName || `MACH-${idx + 1}`}">${m.machineName || '-'}</option>`).join('');
  }
  return Object.values(machineData).map((m) => `<option value="${m.id}">${m.id} - ${m.name}</option>`).join('');
}

async function onProdProjectChange() {
  updateProdProjectSuggestions();
  const inputEl = document.getElementById('prodProjectId');
  const projectId = inputEl ? sanitizeProjectIdInput(inputEl.value) : '';
  if (inputEl && inputEl.value !== projectId) inputEl.value = projectId;
  const project = masterProjects.find((p) => p.projectCode === projectId) || instProjects.find((p) => p.id === projectId);
  const projectNameEl = document.getElementById('prodProjectName');
  if (projectNameEl) projectNameEl.value = project?.projectName || project?.name || '';

  if (!document.getElementById('prodWorkOrder')) return;
  await _ensureCompletedWoNos();
  const masterList = masterWorkOrders.filter((w) =>
    (w.projectCode || '') === projectId &&
    (w.departmentName || '').toLowerCase().includes('prod') &&
    !_completedWoNos.has((w.workOrderNumber || '').trim())
  );
  const fallbackList = instWorkOrders.filter((w) =>
    w.projectId === projectId && !_completedWoNos.has((w.wo || '').trim())
  );
  const woOpts = masterList.length > 0
    ? masterList.map(w => ({ value: w.workOrderNumber || '', label: w.workOrderNumber || '-' }))
    : fallbackList.map(w => ({ value: w.wo, label: w.wo }));
  setSrchOptions('prodWorkOrder', woOpts);
  setupSearchSel('prodWorkOrder', 'prodWorkOrderMenu', onProdWorkOrderChange);
  if (!document.getElementById('prodWorkOrder').value && woOpts.length === 1)
    document.getElementById('prodWorkOrder').value = woOpts[0].value;
  onProdWorkOrderChange();
}

function onProdWorkOrderChange() {
  const wo = document.getElementById('prodWorkOrder')?.value || '';
  const row = masterWorkOrders.find((w) => (w.workOrderNumber || '') === wo);
  const deptEl = document.getElementById('prodDepartment');
  if (!deptEl) return;
  if (row?.departmentCode) {
    deptEl.value = row.departmentCode;
  } else if (row?.departmentName) {
    const match = masterProdDepartments.find(
      (d) => (d.mainDepartment || '').toLowerCase() === row.departmentName.toLowerCase()
    );
    if (match) deptEl.value = match.departmentCode || '';
  }
  const blk = document.getElementById('prodWocBlock');
  const btn = document.getElementById('prodSaveBtn');
  if (wo && _completedWoNosLoaded && _completedWoNos.has(wo.trim())) {
    if (blk) { blk.textContent = `⛔ Work order ${wo} has already been marked complete. Timesheet entry is not allowed.`; blk.style.display = 'block'; }
    if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
  } else {
    if (blk) blk.style.display = 'none';
    if (btn) { btn.disabled = false; btn.style.opacity = ''; }
  }
}

async function getProdRecordByDocNo(docNo) {
  try {
    return await fetchJson(`${getApiBaseUrl()}/timesheets/${encodeURIComponent(docNo)}`);
  } catch (err) {
    console.error('Failed to load timesheet', err);
    return null;
  }
}

async function viewProdTimesheet(docNo) {
  const r = await getProdRecordByDocNo(docNo);
  if (!r) { showToast('Record not found.', 'error'); return; }

  const labourLines    = r.labourLines    || r.labourRows    || [];
  const materialLines  = r.materialLines  || r.materialRows  || [];
  const equipmentLines = r.equipmentLines || r.machineryRows || [];

  const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); } catch { return d||'-'; } };

  const infoCard = (label, val, wide) =>
    `<div style="background:#f8fafc;border:1px solid #e9eef5;border-radius:8px;padding:10px 14px;${wide?'grid-column:span 2':''}">
       <div style="font-size:10px;font-weight:600;letter-spacing:.06em;color:#94a3b8;text-transform:uppercase;margin-bottom:3px">${label}</div>
       <div style="font-size:13px;font-weight:500;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${val||'—'}</div>
     </div>`;

  const sectionHead = (icon, title, count, color) =>
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
       <div style="width:28px;height:28px;border-radius:7px;background:${color}1a;display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon}</div>
       <span style="font-size:13px;font-weight:600;color:#1e293b">${title}</span>
       <span style="margin-left:4px;background:${color}22;color:${color};font-size:11px;font-weight:600;padding:1px 8px;border-radius:20px">${count}</span>
     </div>`;

  const emptyState = (msg) =>
    `<div style="text-align:center;padding:18px 0;color:#94a3b8;font-size:13px">${msg}</div>`;

  const th = (label, right) =>
    `<th style="padding:8px 12px;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#64748b;background:#f1f5f9;text-align:${right?'right':'left'};white-space:nowrap">${label}</th>`;
  const td = (val, right, mono) =>
    `<td style="padding:9px 12px;font-size:13px;color:#334155;text-align:${right?'right':'left'};${mono?'font-family:monospace;letter-spacing:.02em':''}">${val||'—'}</td>`;
  const tableWrap = (thead, rows) =>
    `<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
       <table style="width:100%;border-collapse:collapse">
         <thead><tr>${thead}</tr></thead>
         <tbody>${rows}</tbody>
       </table>
     </div>`;

  // Labour
  let labourHtml;
  if (labourLines.length) {
    const rows = labourLines.map((l, i) => {
      let dur = l.durationMinutes != null ? String(l.durationMinutes) : '—';
      if (l.startTime && l.endTime) {
        const [sh,sm] = l.startTime.split(':').map(Number);
        const [eh,em] = l.endTime.split(':').map(Number);
        let m = (eh*60+em)-(sh*60+sm); if(m<0)m+=1440; dur=String(m);
      }
      const bg = i%2===0 ? '' : 'background:#f8fafc';
      return `<tr style="${bg}">${td(l.employeeName||l.employeeCode)}${td(l.startTime,false,true)}${td(l.endTime,false,true)}${td(dur?dur+' min':'—',true)}</tr>`;
    }).join('');
    labourHtml = tableWrap(
      th('Employee Name') + th('Start Time') + th('End Time') + th('Duration (min)', true),
      rows
    );
  } else {
    labourHtml = emptyState('No labour entries recorded.');
  }

  // Material
  let materialHtml;
  if (materialLines.length) {
    const rows = materialLines.map((m, i) => {
      const bg = i%2===0 ? '' : 'background:#f8fafc';
      return `<tr style="${bg}">${td(m.itemCode,false,true)}${td(m.itemName)}${td(m.uom,true)}${td(m.qty,true)}</tr>`;
    }).join('');
    materialHtml = tableWrap(
      th('Item Code') + th('Description') + th('UOM', true) + th('Qty', true),
      rows
    );
  } else {
    materialHtml = emptyState('No material entries recorded.');
  }

  // Machinery
  let machineryHtml;
  if (equipmentLines.length) {
    const rows = equipmentLines.map((m, i) => {
      const bg = i%2===0 ? '' : 'background:#f8fafc';
      return `<tr style="${bg}">${td(m.equipmentName)}${td(m.hoursUsed?(m.hoursUsed+' min'):'—',true)}</tr>`;
    }).join('');
    machineryHtml = tableWrap(
      th('Machine') + th('Duration (min)', true),
      rows
    );
  } else {
    machineryHtml = emptyState('No machinery entries recorded.');
  }

  const section = (head, body) =>
    `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px">${head}${body}</div>`;

  const rawProjName = r.projectName || '';
  const colonIdx = rawProjName.indexOf(':');
  const customerName = colonIdx !== -1 ? rawProjName.slice(0, colonIdx).trim() : '—';
  const projectNameOnly = colonIdx !== -1 ? rawProjName.slice(colonIdx + 1).trim() : (rawProjName || '—');

  const _statusColors = { Approved:'#16a34a', Submitted:'#2563eb', Rejected:'#dc2626', Draft:'#64748b' };
  const _statusBadge = (s) => {
    const c = _statusColors[s] || '#64748b';
    return `<span style="display:inline-block;background:${c}18;color:${c};font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;letter-spacing:.04em;border:1px solid ${c}33">${s||'—'}</span>`;
  };
  const _approverInfo = () => {
    if (r.status === 'Approved')  return `${r.approvedBy||'—'}${r.approvedAt ? ' · '+fmtDate(r.approvedAt) : ''}`;
    if (r.status === 'Rejected')  return `${r.approvedBy||'—'}${r.rejectionReason ? ' — Reason: '+r.rejectionReason : ''}`;
    return null;
  };

  document.getElementById('prodViewDocNo').textContent = docNo;
  document.getElementById('prodViewBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      ${infoCard('Project ID',   r.projectId   || '—')}
      ${infoCard('Date',         fmtDate(r.entryDate))}
      ${infoCard('Customer',     customerName,  true)}
      ${infoCard('Project Name', projectNameOnly)}
      ${infoCard('Work Order',   r.workOrderNo || '—')}
      ${infoCard('Department',   r.department_code || '—')}
      ${infoCard('Shift',        r.shiftCode   || '—')}
      ${infoCard('Entry Person', r.entered_by_name || '—')}
      ${infoCard('Status',       _statusBadge(r.status))}
      ${_approverInfo() != null ? infoCard(r.status === 'Rejected' ? 'Rejected By' : 'Approved By', _approverInfo()) : ''}
    </div>

    ${section(
      sectionHead('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
        'Labour Time', labourLines.length, '#2563eb'),
      labourHtml
    )}
    ${section(
      sectionHead('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
        'Consumed Material', materialLines.length, '#0891b2'),
      materialHtml
    )}
    ${section(
      sectionHead('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>',
        'Machinery', equipmentLines.length, '#7c3aed'),
      machineryHtml
    )}
  `;
  document.getElementById('prodViewModal').style.display = 'flex';
}

function closeProdViewModal() {
  document.getElementById('prodViewModal').style.display = 'none';
}

async function editProdTimesheet(docNo) {
  const r = await getProdRecordByDocNo(docNo);
  if (!r) { showToast('Record not found.', 'error'); return; }
  const _editUser = getCurrentUser();
  if (r.status === 'Approved' && _editUser?.roleCode !== 'ROLE-001') {
    showToast('Approved timesheets cannot be edited. Contact an administrator.', 'error');
    return;
  }
  window._editingProdDocNo = docNo;

  await initNewProdPage();
  openProdEntryModal();

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SPAN') el.textContent = val || '';
    else el.value = val || '';
  };
  set('prodDocNo',      r.tsDocNo         || '');
  set('prodProjectId',  r.projectId       || '');
  set('prodProjectName',r.projectName     || '');
  set('prodDate',       r.entryDate       || '');
  set('prodEntryPerson',r.entered_by_name || '');

  const projectId = r.projectId || '';
  if (projectId) onProdProjectChange();

  setTimeout(() => {
    set('prodWorkOrder',  r.workOrderNo     || '');
    set('prodDepartment', r.department_code || '');
    set('prodShift',      r.shiftCode       || '');

    const labourLines = r.labourLines || r.labourRows || [];
    const labourBody = document.getElementById('prodLabourBody');
    if (labourBody && labourLines.length) {
      labourBody.innerHTML = '';
      labourLines.forEach((l) => {
        addProdLabourRow();
        const tr = labourBody.lastElementChild;
        const empInp = tr.querySelector('.ts-emp-inp');
        if (empInp) {
          empInp.dataset.empCode = l.employeeCode || '';
          empInp.value = l.employeeName || l.employeeCode || '';
        }
        const inputs = tr.querySelectorAll('input');
        if (inputs[0]) inputs[0].value = l.startTime ? _formatTimeAs12(l.startTime) : '';
        if (inputs[1]) inputs[1].value = l.endTime   ? _formatTimeAs12(l.endTime)   : '';
        if (inputs[2]) {
          let dur = l.durationMinutes != null ? String(l.durationMinutes) : '';
          if (l.startTime && l.endTime) {
            const [sh, sm] = l.startTime.split(':').map(Number);
            const [eh, em] = l.endTime.split(':').map(Number);
            let m = (eh * 60 + em) - (sh * 60 + sm);
            if (m < 0) m += 1440;
            dur = String(m);
          }
          inputs[2].value = dur;
        }
      });
    }

    const materialLines = r.materialLines || r.materialRows || [];
    const materialBody = document.getElementById('prodMaterialBody');
    if (materialBody && materialLines.length) {
      materialBody.innerHTML = '';
      materialLines.forEach((m) => {
        addProdMaterialRow();
        const tr = materialBody.lastElementChild;
        const itemInp = tr.querySelector('.ts-item-inp');
        if (itemInp) {
          itemInp.dataset.itemCode = m.itemCode || '';
          const it = masterItems.find(i => (i.itemcode || i.itemName || '') === m.itemCode);
          itemInp.value = it ? (it.itemcode ? `${it.itemcode} – ${it.itemName || ''}` : it.itemName || '') : (m.itemCode || '');
        }
        const inputs = tr.querySelectorAll('input');
        if (inputs[0]) inputs[0].value = m.itemName || '';
        if (inputs[1]) inputs[1].value = m.uom      || '';
        if (inputs[2]) inputs[2].value = m.qty      || '';
      });
    }

    const equipmentLines = r.equipmentLines || r.machineryRows || [];
    const machineryBody = document.getElementById('prodMachineryBody');
    if (machineryBody && equipmentLines.length) {
      machineryBody.innerHTML = '';
      equipmentLines.forEach((m) => {
        addProdMachineryRow();
        const tr = machineryBody.lastElementChild;
        const sel = tr.querySelector('select');
        if (sel) sel.value = m.equipmentName || '';
        const input = tr.querySelector('input[type="number"]');
        if (input) input.value = m.hoursUsed || '';
      });
    }
    updateProdTabBadges();
  }, 100);
}

/* Generic WIP table search */
function filterWipTable(inputId, tableId, metaId) {
  const q = (document.getElementById(inputId)?.value || '').toLowerCase();
  let visible = 0;
  const rows = document.querySelectorAll(`#${tableId} tbody tr`);
  rows.forEach((tr) => {
    const match = !q || tr.textContent.toLowerCase().includes(q);
    tr.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  if (metaId) {
    const el = document.getElementById(metaId);
    if (el) el.textContent = q ? `${visible} of ${rows.length} items` : `${rows.length} items · Updated just now`;
  }
}

/* Generic WIP table sort — tracks state per-header via dataset */
function sortWipCol(th, tableId, colIdx) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const body = table.tBodies[0];
  const dir = th.dataset.sortDir === 'asc' ? -1 : 1;
  th.dataset.sortDir = dir === 1 ? 'asc' : 'desc';
  table.querySelectorAll('.wip-sort-icon').forEach((el) => el.textContent = '↕');
  const icon = th.querySelector('.wip-sort-icon');
  if (icon) icon.textContent = dir === 1 ? '↑' : '↓';
  const rows = Array.from(body.querySelectorAll('tr'));
  rows.sort((a, b) => {
    const av = (a.cells[colIdx]?.textContent || '').trim().toLowerCase();
    const bv = (b.cells[colIdx]?.textContent || '').trim().toLowerCase();
    return av.localeCompare(bv, undefined, { numeric: true }) * dir;
  });
  rows.forEach((r) => body.appendChild(r));
  /* renumber # col */
  rows.forEach((r, i) => { const n = r.querySelector('.wip-td-num'); if (n) n.textContent = i + 1; });
}

let _wipSortCol = -1;
let _wipSortDir = 1;
function sortWipTable(colIdx) {
  const tbody = document.getElementById('prodListBody');
  if (!tbody) return;
  if (_wipSortCol === colIdx) { _wipSortDir *= -1; } else { _wipSortCol = colIdx; _wipSortDir = 1; }
  const rows = Array.from(tbody.querySelectorAll('tr:not([style*="display:none"])'));
  rows.sort((a, b) => {
    const av = (a.cells[colIdx]?.textContent || '').trim().toLowerCase();
    const bv = (b.cells[colIdx]?.textContent || '').trim().toLowerCase();
    return av.localeCompare(bv, undefined, { numeric: true }) * _wipSortDir;
  });
  rows.forEach((r) => tbody.appendChild(r));
  renumberProdList();
  document.querySelectorAll('#prodListTable .wip-sort-icon').forEach((el, i) => {
    el.textContent = (i + 1) === colIdx ? (_wipSortDir === 1 ? '↑' : '↓') : '↕';
  });
}

function toggleProdFilter() {
  const panel = document.getElementById('prodFilterPanel');
  const btn   = document.getElementById('prodFilterBtn');
  if (!panel) return;
  const open = panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  btn.classList.toggle('wip-filter-btn-active', open);
  if (open) populateProdDeptFilter();
}

function populateProdDeptFilter() {
  const sel = document.getElementById('prodListDeptFilter');
  if (!sel) return;
  const current = sel.value;
  const depts = new Set();
  document.querySelectorAll('#prodListBody tr').forEach((tr) => {
    const d = tr.cells[6]?.textContent?.trim();
    if (d) depts.add(d);
  });
  sel.innerHTML = '<option value="">All Departments</option>' +
    Array.from(depts).sort().map((d) => `<option value="${d}"${d === current ? ' selected' : ''}>${d}</option>`).join('');
}

function applyProdFilters() {
  const from   = document.getElementById('prodListDateFrom')?.value;
  const to     = document.getElementById('prodListDateTo')?.value;
  const dept   = (document.getElementById('prodListDeptFilter')?.value || '').toLowerCase();
  const status = document.getElementById('prodListStatusFilter')?.value || '';
  const parseDate = (str) => {
    if (!str) return null;
    const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
    const parts = str.trim().split(' ');
    if (parts.length === 3) return new Date(+parts[2], months[parts[1]], +parts[0]);
    return new Date(str);
  };
  const fromD = from ? new Date(from) : null;
  const toD   = to ? new Date(to) : null;
  let visible = 0;
  document.querySelectorAll('#prodListBody tr').forEach((tr) => {
    const rowDate   = parseDate(tr.cells[7]?.textContent?.trim());
    const rowDept   = (tr.cells[6]?.textContent?.trim() || '').toLowerCase();
    const rowStatus = tr.dataset.status || '';
    const dateOk   = (!fromD || rowDate >= fromD) && (!toD || rowDate <= toD);
    const deptOk   = !dept || rowDept.includes(dept);
    const statusOk = !status || rowStatus === status;
    tr.style.display = (dateOk && deptOk && statusOk) ? '' : 'none';
    if (dateOk && deptOk && statusOk) visible++;
  });
  const total = document.querySelectorAll('#prodListBody tr').length;
  const el = document.getElementById('prodListMeta');
  if (el) el.textContent = (fromD || toD || dept || status) ? `${visible} of ${total} items filtered` : `${total} Items · Updated just now`;
  const active = [from, to, dept, status].filter(Boolean).length;
  const badge = document.getElementById('prodFilterBadge');
  if (badge) { badge.textContent = active; badge.style.display = active ? 'inline-flex' : 'none'; }
}

function clearProdFilters() {
  const el = (id) => document.getElementById(id);
  if (el('prodListDateFrom'))    el('prodListDateFrom').value = '';
  if (el('prodListDateTo'))      el('prodListDateTo').value = '';
  if (el('prodListDeptFilter'))  el('prodListDeptFilter').value = '';
  if (el('prodListStatusFilter'))el('prodListStatusFilter').value = '';
  applyProdFilters();
}

function toggleInstFilter() {
  const panel = document.getElementById('instFilterPanel');
  const btn   = document.getElementById('instFilterBtn');
  if (!panel) return;
  const open = panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  btn.classList.toggle('wip-filter-btn-active', open);
}

function applyInstFilters() {
  const from   = document.getElementById('instDateFrom')?.value;
  const to     = document.getElementById('instDateTo')?.value;
  const status = document.getElementById('instListStatusFilter')?.value || '';
  const parseDate = (str) => {
    if (!str) return null;
    const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
    const parts = str.trim().split(' ');
    if (parts.length === 3) return new Date(+parts[2], months[parts[1]], +parts[0]);
    return new Date(str);
  };
  const fromD = from ? new Date(from) : null;
  const toD   = to ? new Date(to) : null;
  let visible = 0;
  document.querySelectorAll('#instListTable tbody tr').forEach((tr) => {
    const rowDate   = parseDate(tr.cells[2]?.textContent?.trim());
    const rowStatus = tr.dataset.status || '';
    const dateOk   = (!fromD || rowDate >= fromD) && (!toD || rowDate <= toD);
    const statusOk = !status || rowStatus === status;
    tr.style.display = (dateOk && statusOk) ? '' : 'none';
    if (dateOk && statusOk) visible++;
  });
  const total = document.querySelectorAll('#instListTable tbody tr').length;
  const el = document.getElementById('instListMeta');
  if (el) el.textContent = (fromD || toD || status) ? `${visible} of ${total} items filtered` : `${total} items · Updated just now`;
  const active = [from, to, status].filter(Boolean).length;
  const badge = document.getElementById('instFilterBadge');
  if (badge) { badge.textContent = active; badge.style.display = active ? 'inline-flex' : 'none'; }
}

function clearInstFilters() {
  const el = (id) => document.getElementById(id);
  if (el('instDateFrom'))         el('instDateFrom').value = '';
  if (el('instDateTo'))           el('instDateTo').value = '';
  if (el('instListStatusFilter')) el('instListStatusFilter').value = '';
  applyInstFilters();
}

let instListLoaded = false;

async function loadInstTimesheets() {
  const tbody = document.getElementById('instListBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--text3);padding:20px">Loading timesheets...</td></tr>';
  try {
    let rows = await fetchJson(`${getApiBaseUrl()}/timesheets?type=INST`);
    if (window._userDataScope === 'Own') {
      const me = getCurrentUser()?.displayName || '';
      rows = rows.filter(r => (r.entered_by_name || r.enteredByName || '') === me);
    }
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--text3);padding:20px">No timesheets found.</td></tr>';
      instListLoaded = true;
      return;
    }
    const fmt      = iso => { try { return new Date(iso).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); } catch { return iso||'-'; } };
    const initials = name => (name||'').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    tbody.innerHTML = rows.map((r, i) => {
      const dn      = r.tsDocNo;
      const ep      = r.entered_by_name || r.enteredByName || '';
      const rawPN   = r.projectName || '';
      const ci      = rawPN.indexOf(':');
      const cust    = ci !== -1 ? rawPN.slice(0, ci).trim() : '-';
      const projN   = ci !== -1 ? rawPN.slice(ci + 1).trim() : (rawPN || r.projectId || '-');
      const st = (r.status || 'Draft');
      const stCls = st === 'Approved' ? 'badge-approved' : st === 'Submitted' ? 'badge-submitted' : st === 'Rejected' ? 'badge-rejected' : 'badge-draft';
      const submitBtn = (st === 'Draft' || st === 'Rejected') ? '<button class="wip-action-btn" title="Submit for Approval" onclick="submitTimesheet(\'' + dn + '\',\'INST\')" style="color:#7c3aed"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 2 11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>' : '';
      return `
        <tr data-doc-no="${dn}" data-status="${st}">
          <td class="wip-td-num">${i + 1}</td>
          <td><span class="wip-link" onclick="viewInstTimesheet('${dn}')">${dn}</span></td>
          <td style="color:#374151">${fmt(r.entryDate)}</td>
          <td style="color:#374151">${r.workOrderNo || '-'}</td>
          <td style="color:#6b7280">${r.projectId || '-'}</td>
          <td style="color:#6b7280">${cust}</td>
          <td><span class="wip-project-name" title="${rawPN}">${projN}</span></td>
          <td><span class="wip-dept-badge wip-dept-inst">${r.department_code || '-'}</span></td>
          <td style="color:#6b7280">${r.shiftCode || '-'}</td>
          <td><span class="wip-avatar">${initials(ep)}</span><span style="color:#111827">${ep}</span></td>
          <td><span class="badge ${stCls}" style="font-size:10px">${st}</span>${st === 'Rejected' && r.rejectionReason ? `<div style="font-size:10px;color:var(--red);margin-top:2px" title="${r.rejectionReason}">⚠ ${r.rejectionReason.slice(0,30)}${r.rejectionReason.length>30?'…':''}</div>` : ''}</td>
          <td><div class="action-cell">
            ${submitBtn}
            <button class="wip-action-btn" data-tip="View" onclick="viewInstTimesheet('${dn}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
            <button class="wip-action-btn wip-action-edit" data-tip="Edit" onclick="editInstTimesheet('${dn}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          </div></td>
        </tr>`;
    }).join('');
    instListLoaded = true;
    const meta = document.getElementById('instListMeta');
    if (meta) meta.textContent = `${rows.length} items · Updated just now`;
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--red);padding:20px">Unable to load timesheets. Check backend on port 3000.</td></tr>';
  }
}

async function saveInstTimesheet() {
  const get = id => {
    const el = document.getElementById(id);
    return el ? (el.value !== undefined && el.tagName !== 'SPAN' ? el.value : el.textContent).trim() : '';
  };
  const docNo       = get('instDocNo');
  const projectId   = get('instProjectId');
  const projectName = get('instProjectName');
  const workOrder   = get('instWorkOrder');
  const department  = get('instDepartment');
  const date        = get('instDate');
  const entryPerson = get('instEntryPerson');
  const shift       = get('instShift');

  if (!projectId)  { showToast('Please select a Project ID.',  'error'); return; }
  if (!workOrder)  { showToast('Please select a Work Order.',  'error'); return; }
  if (!department) { showToast('Please select a Department.',  'error'); return; }
  if (!date)       { showToast('Please select a Date.',        'error'); return; }
  if (!shift)      { showToast('Please select a Shift.',       'error'); return; }

  await _ensureCompletedWoNos();
  if (_completedWoNos.has(workOrder.trim())) {
    const blk = document.getElementById('instWocBlock');
    const btn = document.getElementById('instSaveBtn');
    if (blk) { blk.textContent = `⛔ Work order ${workOrder} has already been marked complete. Timesheet entry is not allowed.`; blk.style.display = 'block'; }
    if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
    console.error('[WOC block] Inst save blocked for WO:', workOrder);
    return;
  }

  const labourRows = Array.from(document.querySelectorAll('#instLabourBody tr')).map(tr => {
    const empInp  = tr.querySelector('.ts-emp-inp');
    const empCode = empInp?.dataset.empCode || empInp?.value || '';
    const displayVal = empInp?.value || '';
    const empName = empInp?.dataset.empCode ? displayVal : (() => {
      const obj = masterEmployees.find(e => (e.employeeNo || '') === empCode);
      return obj ? [obj.firstName, obj.lastname].filter(Boolean).join(' ') : '';
    })();
    return {
      employee:     empCode,
      employeeName: empName,
      startTime:    _readTimeValue(tr.querySelector('.inst-start')),
      endTime:      _readTimeValue(tr.querySelector('.inst-end')),
      duration:     tr.querySelector('.inst-dur')?.value || '',
    };
  });

  const materialRows = Array.from(document.querySelectorAll('#instMaterialBody tr')).map(tr => ({
    itemCode:    tr.querySelector('.ts-item-inp')?.dataset.itemCode || tr.querySelector('.ts-item-inp')?.value || '',
    description: tr.querySelector('.inst-item-desc')?.value || '',
    uom:         tr.querySelector('.inst-item-uom')?.value  || '',
    qty:         tr.querySelectorAll('input')[2]?.value     || '',
  }));

  const vehicleRows = Array.from(document.querySelectorAll('#instVehicleBody tr')).map(tr => ({
    vehicle: tr.querySelector('select')?.value || '',
    km:      tr.querySelector('input[type="number"]')?.value || '',
  }));

  const accessRows = Array.from(document.querySelectorAll('#instAccessBody tr')).map(tr => ({
    equipment: tr.querySelector('select')?.value || '',
    hours:     tr.querySelector('input[type="number"]')?.value || '',
  }));

  const isEdit  = !!window._editingInstDocNo;
  const payload = { projectId, projectName, workOrder, department, date, entryPerson, shift, labourRows, materialRows, vehicleRows, accessRows, tsType: 'INST' };

  try {
    let result;
    const fetchWithError = async (url, opts) => {
      const res = await apiFetch(url, opts);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.message || res.statusText);
      }
      return res.json();
    };

    if (isEdit) {
      result = await fetchWithError(`${getApiBaseUrl()}/timesheets/${encodeURIComponent(docNo)}`, {
        method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload),
      });
    } else {
      result = await fetchWithError(`${getApiBaseUrl()}/timesheets`, {
        method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload),
      });
    }

    const savedDocNo = result.docNo || docNo;
    window._editingInstDocNo = null;

    const fmt      = iso => { try { return new Date(iso).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); } catch { return iso; } };
    const initials = name => (name||'').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const rawPN    = projectName || '';
    const ci       = rawPN.indexOf(':');
    const cust     = ci !== -1 ? rawPN.slice(0, ci).trim() : '-';
    const projN    = ci !== -1 ? rawPN.slice(ci + 1).trim() : (rawPN || projectId || '-');

    const tbody = document.getElementById('instListBody');
    if (tbody) {
      const existingRow = tbody.querySelector(`tr[data-doc-no="${savedDocNo}"]`);
      if (existingRow) {
        existingRow.cells[2].textContent = fmt(date + 'T00:00:00');
        existingRow.cells[3].textContent = workOrder;
        existingRow.cells[4].textContent = projectId;
        existingRow.cells[5].textContent = cust;
        existingRow.cells[6].textContent = projN;
        existingRow.cells[7].textContent = department;
        existingRow.cells[8].textContent = shift;
        existingRow.cells[9].innerHTML   = `<span class="wip-avatar">${initials(entryPerson)}</span> ${entryPerson}`;
      } else {
        const tr = document.createElement('tr');
        tr.dataset.docNo = savedDocNo;
        tr.innerHTML = `
          <td class="wip-td-num">${tbody.children.length + 1}</td>
          <td><span class="wip-link" onclick="viewInstTimesheet('${savedDocNo}')">${savedDocNo}</span></td>
          <td style="color:#374151">${fmt(date + 'T00:00:00')}</td>
          <td style="color:#374151">${workOrder}</td>
          <td style="color:#6b7280">${projectId}</td>
          <td style="color:#6b7280">${cust}</td>
          <td><span class="wip-project-name" title="${rawPN}">${projN}</span></td>
          <td><span class="wip-dept-badge wip-dept-inst">${department}</span></td>
          <td style="color:#6b7280">${shift}</td>
          <td><span class="wip-avatar">${initials(entryPerson)}</span><span style="color:#111827">${entryPerson}</span></td>
          <td><div class="action-cell">
            <button class="wip-action-btn" data-tip="View" onclick="viewInstTimesheet('${savedDocNo}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
            <button class="wip-action-btn wip-action-edit" data-tip="Edit" onclick="editInstTimesheet('${savedDocNo}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          </div></td>`;
        tbody.insertBefore(tr, tbody.firstChild);
        document.querySelectorAll('#instListBody tr').forEach((tr2, i) => {
          const c = tr2.querySelector('.wip-td-num'); if (c) c.textContent = i + 1;
        });
      }
      const meta = document.getElementById('instListMeta');
      if (meta) meta.textContent = `${document.querySelectorAll('#instListBody tr').length} items · Updated just now`;
    }

    showToast(`${savedDocNo} ${isEdit ? 'updated' : 'submitted'}.`);
    closeInstEntryModal();
    showPage('inst-list');
  } catch (err) {
    console.error('Save inst timesheet error:', err);
    const msg = err?.message || 'Failed to save timesheet. Check backend connection.';
    if (msg.toLowerCase().includes('marked complete')) {
      const blk = document.getElementById('instWocBlock');
      const btn = document.getElementById('instSaveBtn');
      if (blk) { blk.textContent = `⛔ ${msg}`; blk.style.display = 'block'; }
      if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
    } else {
      showToast(msg, 'error');
    }
  }
}

async function viewInstTimesheet(docNo) {
  const r = await fetchJson(`${getApiBaseUrl()}/timesheets/${encodeURIComponent(docNo)}`).catch(() => null);
  if (!r) { showToast('Record not found.', 'error'); return; }

  const labourLines   = r.labourLines   || [];
  const materialLines = r.materialLines || [];
  const vehicleLines  = r.vehicleLines  || [];
  const accessLines   = r.accessLines   || [];

  const fmtDate = d => { try { return new Date(d).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); } catch { return d||'-'; } };

  const rawPN  = r.projectName || '';
  const ci     = rawPN.indexOf(':');
  const custN  = ci !== -1 ? rawPN.slice(0, ci).trim() : '—';
  const projN  = ci !== -1 ? rawPN.slice(ci + 1).trim() : (rawPN || '—');

  const infoCard = (label, val, wide) =>
    `<div style="background:#f8fafc;border:1px solid #e9eef5;border-radius:8px;padding:10px 14px;${wide?'grid-column:span 2':''}">
       <div style="font-size:10px;font-weight:600;letter-spacing:.06em;color:#94a3b8;text-transform:uppercase;margin-bottom:3px">${label}</div>
       <div style="font-size:13px;font-weight:500;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${val||'—'}</div>
     </div>`;

  const sectionHead = (icon, title, count, color) =>
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
       <div style="width:28px;height:28px;border-radius:7px;background:${color}1a;display:flex;align-items:center;justify-content:center;flex-shrink:0">${icon}</div>
       <span style="font-size:13px;font-weight:600;color:#1e293b">${title}</span>
       <span style="margin-left:4px;background:${color}22;color:${color};font-size:11px;font-weight:600;padding:1px 8px;border-radius:20px">${count}</span>
     </div>`;

  const emptyState = msg => `<div style="text-align:center;padding:18px 0;color:#94a3b8;font-size:13px">${msg}</div>`;
  const th = (label, right) => `<th style="padding:8px 12px;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#64748b;background:#f1f5f9;text-align:${right?'right':'left'};white-space:nowrap">${label}</th>`;
  const td = (val, right, mono) => `<td style="padding:9px 12px;font-size:13px;color:#334155;text-align:${right?'right':'left'};${mono?'font-family:monospace;letter-spacing:.02em':''}">${val||'—'}</td>`;
  const tableWrap = (thead, rows) =>
    `<div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
       <table style="width:100%;border-collapse:collapse"><thead><tr>${thead}</tr></thead><tbody>${rows}</tbody></table>
     </div>`;
  const section = (head, body) =>
    `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:14px">${head}${body}</div>`;

  const labourHtml = labourLines.length ? tableWrap(
    th('Employee Name') + th('Start') + th('End') + th('Duration (min)', true),
    labourLines.map((l, i) => {
      let dur = l.durationMinutes != null ? String(l.durationMinutes) : '—';
      if (l.startTime && l.endTime) {
        const [sh,sm] = l.startTime.split(':').map(Number), [eh,em] = l.endTime.split(':').map(Number);
        let m = (eh*60+em)-(sh*60+sm); if(m<0)m+=1440; dur=String(m);
      }
      return `<tr style="${i%2?'background:#f8fafc':''}">${td(l.employeeName||l.employeeCode)}${td(l.startTime,false,true)}${td(l.endTime,false,true)}${td(dur?dur+' min':'—',true)}</tr>`;
    }).join('')
  ) : emptyState('No labour entries recorded.');

  const materialHtml = materialLines.length ? tableWrap(
    th('Item Code') + th('Description') + th('UOM', true) + th('Qty', true),
    materialLines.map((m, i) => `<tr style="${i%2?'background:#f8fafc':''}">${td(m.itemCode,false,true)}${td(m.itemName)}${td(m.uom,true)}${td(m.qty,true)}</tr>`).join('')
  ) : emptyState('No material entries recorded.');

  const vehicleHtml = vehicleLines.length ? tableWrap(
    th('Vehicle') + th('KM', true),
    vehicleLines.map((v, i) => `<tr style="${i%2?'background:#f8fafc':''}">${td(v.equipmentName||'')}${td(v.hoursUsed!=null?v.hoursUsed+' km':'—',true)}</tr>`).join('')
  ) : emptyState('No vehicle entries recorded.');

  const accessHtml = accessLines.length ? tableWrap(
    th('Equipment') + th('Hours', true),
    accessLines.map((a, i) => `<tr style="${i%2?'background:#f8fafc':''}">${td(a.equipmentName||'')}${td(a.hoursUsed!=null?a.hoursUsed+' hrs':'—',true)}</tr>`).join('')
  ) : emptyState('No access equipment recorded.');

  const _statusColors = { Approved:'#16a34a', Submitted:'#2563eb', Rejected:'#dc2626', Draft:'#64748b' };
  const _statusBadge = (s) => {
    const c = _statusColors[s] || '#64748b';
    return `<span style="display:inline-block;background:${c}18;color:${c};font-size:11px;font-weight:700;padding:2px 10px;border-radius:20px;letter-spacing:.04em;border:1px solid ${c}33">${s||'—'}</span>`;
  };
  const _approverInfo = () => {
    if (r.status === 'Approved')  return `${r.approvedBy||'—'}${r.approvedAt ? ' · '+fmtDate(r.approvedAt) : ''}`;
    if (r.status === 'Rejected')  return `${r.approvedBy||'—'}${r.rejectionReason ? ' — Reason: '+r.rejectionReason : ''}`;
    return null;
  };

  document.getElementById('instViewDocNo').textContent = docNo;
  document.getElementById('instViewBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
      ${infoCard('Project ID',   r.projectId   || '—')}
      ${infoCard('Date',         fmtDate(r.entryDate))}
      ${infoCard('Customer',     custN, true)}
      ${infoCard('Project Name', projN)}
      ${infoCard('Work Order',   r.workOrderNo || '—')}
      ${infoCard('Department',   r.department_code || '—')}
      ${infoCard('Shift',        r.shiftCode   || '—')}
      ${infoCard('Entry Person', r.entered_by_name || '—')}
      ${infoCard('Status',       _statusBadge(r.status))}
      ${_approverInfo() != null ? infoCard(r.status === 'Rejected' ? 'Rejected By' : 'Approved By', _approverInfo()) : ''}
    </div>
    ${section(sectionHead('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>','Labour Time',labourLines.length,'#2563eb'), labourHtml)}
    ${section(sectionHead('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0891b2" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>','Consumed Material',materialLines.length,'#0891b2'), materialHtml)}
    ${section(sectionHead('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>','Vehicle',vehicleLines.length,'#d97706'), vehicleHtml)}
    ${section(sectionHead('<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>','Access Equipment',accessLines.length,'#7c3aed'), accessHtml)}
  `;
  document.getElementById('instViewModal').style.display = 'flex';
}

function closeInstViewModal() {
  document.getElementById('instViewModal').style.display = 'none';
}

async function editInstTimesheet(docNo) {
  const r = await fetchJson(`${getApiBaseUrl()}/timesheets/${encodeURIComponent(docNo)}`).catch(() => null);
  if (!r) { showToast('Record not found.', 'error'); return; }
  const _editUser = getCurrentUser();
  if (r.status === 'Approved' && _editUser?.roleCode !== 'ROLE-001') {
    showToast('Approved timesheets cannot be edited. Contact an administrator.', 'error');
    return;
  }
  window._editingInstDocNo = docNo;

  await initNewInstPage();
  openInstEntryModal();

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SPAN') el.textContent = val || '';
    else el.value = val || '';
  };

  document.getElementById('instEntryModalTitle').textContent = `Edit Timesheet`;
  document.getElementById('instEntryModalSub').textContent   = docNo;
  set('instDocNo',       r.tsDocNo         || '');
  set('instProjectId',   r.projectId       || '');
  set('instProjectName', r.projectName     || '');
  set('instDate',        r.entryDate       || '');
  set('instEntryPerson', r.entered_by_name || '');

  if (r.projectId) onInstProjectChange();

  setTimeout(() => {
    set('instWorkOrder',  r.workOrderNo     || '');
    set('instDepartment', r.department_code || '');
    set('instShift',      r.shiftCode       || '');

    const labourLines = r.labourLines || [];
    const labourBody  = document.getElementById('instLabourBody');
    if (labourBody && labourLines.length) {
      labourBody.innerHTML = '';
      labourLines.forEach(l => {
        addInstLabourRow();
        const tr = labourBody.lastElementChild;
        const empInp = tr.querySelector('.ts-emp-inp');
        if (empInp) {
          empInp.dataset.empCode = l.employeeCode || '';
          empInp.value = l.employeeName || l.employeeCode || '';
        }
        const inputs = tr.querySelectorAll('input');
        if (inputs[0]) inputs[0].value = l.startTime ? _formatTimeAs12(l.startTime) : '';
        if (inputs[1]) inputs[1].value = l.endTime   ? _formatTimeAs12(l.endTime)   : '';
        if (inputs[2]) {
          let dur = l.durationMinutes != null ? String(l.durationMinutes) : '';
          if (l.startTime && l.endTime) {
            const [sh,sm] = l.startTime.split(':').map(Number), [eh,em] = l.endTime.split(':').map(Number);
            let m = (eh*60+em)-(sh*60+sm); if(m<0)m+=1440; dur=String(m);
          }
          inputs[2].value = dur;
        }
      });
    }

    const materialLines = r.materialLines || [];
    const materialBody  = document.getElementById('instMaterialBody');
    if (materialBody && materialLines.length) {
      materialBody.innerHTML = '';
      materialLines.forEach(m => {
        addInstMaterialRow();
        const tr  = materialBody.lastElementChild;
        const itemInp = tr.querySelector('.ts-item-inp');
        if (itemInp) {
          itemInp.dataset.itemCode = m.itemCode || '';
          const it = masterItems.find(i => (i.itemcode || i.itemName || '') === m.itemCode);
          itemInp.value = it ? (it.itemcode ? `${it.itemcode} – ${it.itemName || ''}` : it.itemName || '') : (m.itemCode || '');
        }
        const inputs = tr.querySelectorAll('input');
        if (inputs[0]) inputs[0].value = m.itemName || '';
        if (inputs[1]) inputs[1].value = m.uom      || '';
        if (inputs[2]) inputs[2].value = m.qty      || '';
      });
    }

    const vehicleLines   = r.vehicleLines  || [];
    const accessLinesArr = r.accessLines   || [];

    const vehicleBody = document.getElementById('instVehicleBody');
    if (vehicleBody && vehicleLines.length) {
      vehicleBody.innerHTML = '';
      vehicleLines.forEach(v => {
        addInstVehicleRow();
        const tr  = vehicleBody.lastElementChild;
        const sel = tr.querySelector('select');
        if (sel) sel.value = v.equipmentName || '';
        const input = tr.querySelector('input[type="number"]');
        if (input) input.value = v.hoursUsed || '';
      });
    }

    const accessBody = document.getElementById('instAccessBody');
    if (accessBody && accessLinesArr.length) {
      accessBody.innerHTML = '';
      accessLinesArr.forEach(a => {
        addInstAccessRow();
        const tr  = accessBody.lastElementChild;
        const sel = tr.querySelector('select');
        if (sel) sel.value = a.equipmentName || '';
        const input = tr.querySelector('input[type="number"]');
        if (input) input.value = a.hoursUsed || '';
      });
    }

    updateInstTabBadges();
  }, 100);
}

document.addEventListener('click', (e) => {
  const wrap = document.getElementById('prodFilterWrap');
  if (wrap && !wrap.contains(e.target)) {
    const panel = document.getElementById('prodFilterPanel');
    if (panel) panel.style.display = 'none';
    document.getElementById('prodFilterBtn')?.classList.remove('wip-filter-btn-active');
  }
  const instWrap = document.getElementById('instFilterWrap');
  if (instWrap && !instWrap.contains(e.target)) {
    const instPanel = document.getElementById('instFilterPanel');
    if (instPanel) instPanel.style.display = 'none';
    document.getElementById('instFilterBtn')?.classList.remove('wip-filter-btn-active');
  }
});

function renumberProdList() {
  document.querySelectorAll('#prodListBody tr').forEach((tr, i) => {
    const numCell = tr.querySelector('.wip-td-num');
    if (numCell) numCell.textContent = i + 1;
  });
}

function updateProdListMeta() {
  const count = document.querySelectorAll('#prodListBody tr:not([style*="display:none"])').length;
  const el = document.getElementById('prodListMeta');
  if (el) el.textContent = `${count} item${count !== 1 ? 's' : ''} · Updated just now`;
}

function filterProdList(q) {
  const lower = q.toLowerCase();
  let visible = 0;
  document.querySelectorAll('#prodListBody tr').forEach((tr) => {
    const text = tr.textContent.toLowerCase();
    const show = !lower || text.includes(lower);
    tr.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  const el = document.getElementById('prodListMeta');
  if (el) {
    const total = document.querySelectorAll('#prodListBody tr').length;
    el.textContent = lower ? `${visible} of ${total} items` : `${total} item${total !== 1 ? 's' : ''} · Updated just now`;
  }
}

function showToast(msg, type = 'success') {
  const el = document.getElementById('appToast');
  if (!el) return;
  el.textContent = msg;
  el.style.background = type === 'error' ? '#e53935' : '#2e7d32';
  el.style.display = 'block';
  el.style.opacity = '1';
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => { el.style.opacity = '0'; setTimeout(() => { el.style.display = 'none'; }, 300); }, 3000);
}

async function saveProdTimesheet() {
  const get = (id) => {
    const el = document.getElementById(id);
    return el ? (el.value !== undefined && el.tagName !== 'SPAN' ? el.value : el.textContent).trim() : '';
  };

  const docNo      = get('prodDocNo');
  const projectId  = get('prodProjectId');
  const projectName= get('prodProjectName');
  const workOrder  = get('prodWorkOrder');
  const department = get('prodDepartment');
  const date       = get('prodDate');
  const entryPerson= get('prodEntryPerson');
  const shift      = get('prodShift');

  if (!projectId)  { showToast('Please select a Project ID.', 'error'); return; }
  if (!workOrder)  { showToast('Please select a Work Order.', 'error'); return; }
  if (!department) { showToast('Please select a Department.', 'error'); return; }
  if (!date)       { showToast('Please select a Date.', 'error'); return; }
  if (!shift)      { showToast('Please select a Shift.', 'error'); return; }

  await _ensureCompletedWoNos();
  if (_completedWoNos.has(workOrder.trim())) {
    const blk = document.getElementById('prodWocBlock');
    const btn = document.getElementById('prodSaveBtn');
    if (blk) { blk.textContent = `⛔ Work order ${workOrder} has already been marked complete. Timesheet entry is not allowed.`; blk.style.display = 'block'; }
    if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
    console.error('[WOC block] Prod save blocked for WO:', workOrder);
    return;
  }

  const labourRows = Array.from(document.querySelectorAll('#prodLabourBody tr')).map((tr) => {
    const empInp  = tr.querySelector('.ts-emp-inp');
    const empCode = empInp?.dataset.empCode || empInp?.value || '';
    const displayVal = empInp?.value || '';
    const empName = empInp?.dataset.empCode ? displayVal : (() => {
      const obj = masterEmployees.find(e => (e.employeeNo || '') === empCode);
      return obj ? [obj.firstName, obj.lastname].filter(Boolean).join(' ') : '';
    })();
    return {
      employee: empCode,
      employeeName: empName,
      startTime: _readTimeValue(tr.querySelector('.prod-start')),
      endTime:   _readTimeValue(tr.querySelector('.prod-end')),
      duration: tr.querySelector('.prod-dur')?.value || '',
    };
  });

  const materialRows = Array.from(document.querySelectorAll('#prodMaterialBody tr')).map((tr) => ({
    itemCode: tr.querySelector('.ts-item-inp')?.dataset.itemCode || tr.querySelector('.ts-item-inp')?.value || '',
    description: tr.querySelector('.prod-desc')?.value || '',
    uom: tr.querySelector('.prod-uom')?.value || '',
    qty: tr.querySelectorAll('input')[2]?.value || '',
  }));

  const machineryRows = Array.from(document.querySelectorAll('#prodMachineryBody tr')).map((tr) => ({
    machine: tr.querySelector('select')?.value || '',
    hours: tr.querySelector('input[type="number"]')?.value || '',
  }));

  const isEdit = !!window._editingProdDocNo;
  const payload = { projectId, projectName, workOrder, department, date, entryPerson, shift, labourRows, materialRows, machineryRows, tsType: 'PROD' };

  try {
    let result;
    const fetchWithError = async (url, opts) => {
      const res = await apiFetch(url, opts);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.detail || body.message || res.statusText;
        console.error('[Timesheet API error]', msg, body);
        throw new Error(msg);
      }
      return res.json();
    };

    if (isEdit) {
      result = await fetchWithError(`${getApiBaseUrl()}/timesheets/${encodeURIComponent(docNo)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
    } else {
      result = await fetchWithError(`${getApiBaseUrl()}/timesheets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
    }

    const savedDocNo = result.docNo || docNo;
    window._editingProdDocNo = null;

    const fmt = (iso) => { try { const d = new Date(iso); return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); } catch { return iso; } };
    const initials = (name) => (name || '').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
    const tbody = document.getElementById('prodListBody');
    if (tbody) {
      const existingRow = tbody.querySelector(`tr[data-doc-no="${savedDocNo}"]`);
      const saveRawPN = projectName || '';
      const saveCi = saveRawPN.indexOf(':');
      const saveCustomer = saveCi !== -1 ? saveRawPN.slice(0, saveCi).trim() : '-';
      const saveProjName = saveCi !== -1 ? saveRawPN.slice(saveCi + 1).trim() : (saveRawPN || projectId || '-');
      if (existingRow) {
        existingRow.cells[2].textContent = projectId;
        existingRow.cells[3].textContent = saveCustomer;
        existingRow.cells[4].textContent = saveProjName;
        existingRow.cells[5].textContent = workOrder;
        existingRow.cells[7].textContent = fmt(date + 'T00:00:00');
        existingRow.cells[8].textContent = shift;
        existingRow.cells[9].innerHTML = `<span class="wip-avatar">${initials(entryPerson)}</span> ${entryPerson}`;
      } else {
        const tr = document.createElement('tr');
        tr.dataset.docNo = savedDocNo;
        tr.innerHTML = `
          <td class="wip-td-num">${tbody.children.length + 1}</td>
          <td><span class="wip-link" onclick="viewProdTimesheet('${savedDocNo}')">${savedDocNo}</span></td>
          <td style="color:#6b7280">${projectId}</td>
          <td style="color:#6b7280">${saveCustomer}</td>
          <td><span class="wip-project-name" title="${saveRawPN}">${saveProjName}</span></td>
          <td style="color:#374151">${workOrder}</td>
          <td><span class="wip-dept-badge wip-dept-prod">${department}</span></td>
          <td style="color:#374151">${fmt(date + 'T00:00:00')}</td>
          <td style="color:#6b7280">${shift}</td>
          <td><span class="wip-avatar">${initials(entryPerson)}</span><span style="color:#111827">${entryPerson}</span></td>
          <td><div class="action-cell">
            <button class="wip-action-btn" data-tip="View" onclick="viewProdTimesheet('${savedDocNo}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
            <button class="wip-action-btn wip-action-edit" data-tip="Edit" onclick="editProdTimesheet('${savedDocNo}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          </div></td>
        `;
        tbody.insertBefore(tr, tbody.firstChild);
        renumberProdList();
      }
      updateProdListMeta();
    }

    showToast(`${savedDocNo} ${isEdit ? 'updated' : 'submitted'}.`);
    closeProdEntryModal();
    showPage('prod-list');
  } catch (err) {
    console.error('Save timesheet error:', err);
    const msg = err?.message || 'Failed to save timesheet. Check backend connection.';
    if (msg.toLowerCase().includes('marked complete')) {
      const blk = document.getElementById('prodWocBlock');
      const btn = document.getElementById('prodSaveBtn');
      if (blk) { blk.textContent = `⛔ ${msg}`; blk.style.display = 'block'; }
      if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
    } else {
      showToast(msg, 'error');
    }
  }
}

let prodListLoaded = false;

async function loadProdTimesheets() {
  const tbody = document.getElementById('prodListBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:20px">Loading timesheets...</td></tr>';
  try {
    let rows = await fetchJson(`${getApiBaseUrl()}/timesheets?type=PROD`);
    if (window._userDataScope === 'Own') {
      const me = getCurrentUser()?.displayName || '';
      rows = rows.filter(r => (r.entered_by_name || r.enteredByName || '') === me);
    }
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:20px">No timesheets found.</td></tr>';
      return;
    }
    const fmt = (iso) => { try { const d = new Date(iso); return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }); } catch { return iso || '-'; } };
    const initials = (name) => (name || '').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
    tbody.innerHTML = rows.map((r, i) => {
      const dn = r.tsDocNo;
      const ep = r.entered_by_name || r.enteredByName || '';
      const rawPN = r.projectName || '';
      const ci = rawPN.indexOf(':');
      const listCustomer = ci !== -1 ? rawPN.slice(0, ci).trim() : '-';
      const listProjName = ci !== -1 ? rawPN.slice(ci + 1).trim() : (rawPN || r.projectId || '-');
      const st = (r.status || 'Draft');
      const stCls = st === 'Approved' ? 'badge-approved' : st === 'Submitted' ? 'badge-submitted' : st === 'Rejected' ? 'badge-rejected' : 'badge-draft';
      const submitBtn = (st === 'Draft' || st === 'Rejected') ? '<button class="wip-action-btn" title="Submit for Approval" onclick="submitTimesheet(\'' + dn + '\',\'PROD\')" style="color:#7c3aed"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 2 11 13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>' : '';
      return `
        <tr data-doc-no="${dn}" data-status="${st}">
          <td class="wip-td-num">${i + 1}</td>
          <td><span class="wip-link" onclick="viewProdTimesheet('${dn}')">${dn}</span></td>
          <td style="color:#6b7280">${r.projectId || '-'}</td>
          <td style="color:#6b7280">${listCustomer}</td>
          <td><span class="wip-project-name" title="${rawPN}">${listProjName}</span></td>
          <td style="color:#374151">${r.workOrderNo || '-'}</td>
          <td><span class="wip-dept-badge wip-dept-prod">${r.department_code || '-'}</span></td>
          <td style="color:#374151">${fmt(r.entryDate)}</td>
          <td style="color:#6b7280">${r.shiftCode || '-'}</td>
          <td><span class="wip-avatar">${initials(ep)}</span><span style="color:#111827">${ep}</span></td>
          <td><span class="badge ${stCls}" style="font-size:10px">${st}</span>${st === 'Rejected' && r.rejectionReason ? `<div style="font-size:10px;color:var(--red);margin-top:2px" title="${r.rejectionReason}">⚠ ${r.rejectionReason.slice(0,30)}${r.rejectionReason.length>30?'…':''}</div>` : ''}</td>
          <td><div class="action-cell">
            ${submitBtn}
            <button class="wip-action-btn" data-tip="View" onclick="viewProdTimesheet('${dn}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
            <button class="wip-action-btn wip-action-edit" data-tip="Edit" onclick="editProdTimesheet('${dn}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          </div></td>
        </tr>`;
    }).join('');
    prodListLoaded = true;
    updateProdListMeta();
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--red);padding:20px">Unable to load timesheets. Check backend on port 3000.</td></tr>';
    console.error('Load prod timesheets error:', err);
  }
}

// ── Production Timesheet Entry Modal ──────────────────
function switchMobTsTab(prefix, tab) {
  const tsModal = document.getElementById(prefix + 'EntryModal')?.querySelector('.ts-modal');
  if (!tsModal) return;
  tsModal.dataset.mobTab = tab;
  const detailsBtn = document.getElementById(prefix + 'MobTabDetails');
  const entriesBtn = document.getElementById(prefix + 'MobTabEntries');
  if (detailsBtn) detailsBtn.classList.toggle('ts-mob-tab-active', tab === 'details');
  if (entriesBtn) entriesBtn.classList.toggle('ts-mob-tab-active', tab === 'entries');
}

function openProdEntryModal() {
  const modal = document.getElementById('prodEntryModal');
  if (modal) modal.style.display = 'flex';
  switchMobTsTab('prod', 'details');
  updateProdTabBadges();
}

function closeProdEntryModal() {
  const modal = document.getElementById('prodEntryModal');
  if (modal) modal.style.display = 'none';
  window._editingProdDocNo = null;
  const blk = document.getElementById('prodWocBlock'); if (blk) blk.style.display = 'none';
  const btn = document.getElementById('prodSaveBtn'); if (btn) { btn.disabled = false; btn.style.opacity = ''; }
  const anyActive = document.querySelector('.page.active');
  if (!anyActive) showPage('prod-list');
}

function switchProdTab(name) {
  ['Labour','Material','Machinery'].forEach(t => {
    const pane = document.getElementById('prodPane' + t);
    const btn  = document.getElementById('prodTabBtn' + t);
    if (pane) pane.style.display = t === name ? 'flex' : 'none';
    if (btn)  btn.classList.toggle('ts-tab-active', t === name);
  });
}

function updateProdTabBadges() {
  const counts = {
    Labour:   document.querySelectorAll('#prodLabourBody tr').length,
    Material: document.querySelectorAll('#prodMaterialBody tr').length,
    Machinery:document.querySelectorAll('#prodMachineryBody tr').length,
  };
  Object.keys(counts).forEach(k => {
    const n     = counts[k];
    const badge = document.getElementById('prodBadge' + k);
    const sum   = document.getElementById('prodSum' + k);
    if (badge) {
      badge.textContent = n;
      badge.style.background = n > 0 ? '#dbeafe' : '#e5e7eb';
      badge.style.color      = n > 0 ? '#2563eb' : '#6b7280';
    }
    if (sum) sum.textContent = n;
  });
  const total = counts.Labour + counts.Material + counts.Machinery;
  const mobBadge = document.getElementById('prodMobBadge');
  if (mobBadge) mobBadge.textContent = total;
}

async function initNewProdPage() {
  const titleEl = document.getElementById('prodEntryModalTitle');
  const subEl   = document.getElementById('prodEntryModalSub');
  if (titleEl) titleEl.textContent = window._editingProdDocNo ? 'Edit Production Timesheet' : 'New Production Timesheet';
  if (subEl)   subEl.textContent   = window._editingProdDocNo ? `Editing ${window._editingProdDocNo}` : 'Fill in the details below and save';

  await Promise.allSettled([
    projectsLoaded ? Promise.resolve() : loadProjects(),
    workOrdersLoaded ? Promise.resolve() : loadWorkOrders(),
    machineryLoaded ? Promise.resolve() : loadMachinery(),
    taskTypesLoaded ? Promise.resolve() : loadTaskTypes(),
    itemsLoaded ? Promise.resolve() : loadItems(),
    employeesLoaded ? Promise.resolve() : loadEmployees(),
    loadShifts(),
    prodDepartmentsLoaded ? Promise.resolve() : loadProdDepartments(),
    _ensureProdInstEmployees(),
  ]);

  const entry = document.getElementById('prodEntryPerson');
  const loginName = document.querySelector('.user-name');
  if (entry) entry.value = loginName ? loginName.textContent.trim() : 'System User';

  const docNoEl = document.getElementById('prodDocNo');
  if (docNoEl && !window._editingProdDocNo) {
    docNoEl.textContent = '…';
    fetchJson(`${getApiBaseUrl()}/timesheets/preview-docno?type=PROD`)
      .then(r => { docNoEl.textContent = r.docNo || ''; })
      .catch(() => { docNoEl.textContent = ''; });
  }

  const isEditing = !!window._editingProdDocNo;

  const dateEl = document.getElementById('prodDate');
  if (dateEl) {
    const now = new Date();
    const toIso = (dt) => {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    const minDate = new Date(now);
    minDate.setDate(now.getDate() - 30);
    dateEl.min = toIso(minDate);
    dateEl.max = toIso(now);
    if (!isEditing) dateEl.value = toIso(now);
  }

  const projectInput = document.getElementById('prodProjectId');
  if (projectInput) {
    if (!isEditing) projectInput.value = '';
    if (!projectInput.dataset.boundProjectSearch) {
      projectInput.addEventListener('input', () => {
        updateProdProjectSuggestions();
        onProdProjectChange();
      });
      projectInput.addEventListener('focus', () => {
        updateProdProjectSuggestions();
      });
      projectInput.addEventListener('blur', () => {
        setTimeout(() => {
          const menu = document.getElementById('prodProjectIdMenu');
          if (menu) menu.style.display = 'none';
        }, 120);
      });
      projectInput.dataset.boundProjectSearch = '1';
    }
  }

  if (!window.__prodProjectMenuDocClickBound) {
    window.__prodProjectMenuDocClickBound = true;
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('prodProjectIdMenu');
      const input = document.getElementById('prodProjectId');
      if (!menu || !input) return;
      if (e.target !== input && !menu.contains(e.target)) {
        menu.style.display = 'none';
      }
    });
  }

  const shiftOpts = masterShifts.filter(s => (s.status || '').toLowerCase() === 'active').map(s => ({ value: s.shiftCode, label: `${s.shiftCode} — ${s.shiftName || ''}` }));
  if (!shiftOpts.length) shiftOpts.push({ value: 'SHIFT-A', label: 'SHIFT-A — Morning Shift' }, { value: 'SHIFT-B', label: 'SHIFT-B — Evening Shift' }, { value: 'SHIFT-C', label: 'SHIFT-C — Night Shift' });
  setSrchOptions('prodShift', shiftOpts);
  setupSearchSel('prodShift', 'prodShiftMenu');

  const taskTypeSel = document.getElementById('prodTaskType');
  if (taskTypeSel) taskTypeSel.innerHTML = getProdTaskTypeOptions();

  const labourBody = document.getElementById('prodLabourBody');
  if (labourBody) labourBody.innerHTML = '';

  const materialBody = document.getElementById('prodMaterialBody');
  if (materialBody) materialBody.innerHTML = '';

  const machineryBody = document.getElementById('prodMachineryBody');
  if (machineryBody) machineryBody.innerHTML = '';

  if (!isEditing) {
    const projNameEl = document.getElementById('prodProjectName');
    if (projNameEl) projNameEl.value = '';
    const woInput = document.getElementById('prodWorkOrder');
    if (woInput) { woInput.value = ''; setSrchOptions('prodWorkOrder', []); }
  }

  populateProdDepartmentSelect();
  // Don't auto-open the project dropdown on form init — only on user click/focus
}

function startRegionalClock() {
  const el = document.getElementById('topbarDateTime');
  if (!el) return;
  if (window.__topbarClockStarted) return;
  window.__topbarClockStarted = true;

  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const tick = () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const zone = tz ? ` (${tz})` : '';
      el.textContent = `${formatter.format(new Date())}${zone}`;
    } catch (_err) {
      el.textContent = new Date().toLocaleString();
    }
  };

  tick();
  setInterval(tick, 1000);
}

function bootstrapLegacyUi() {
  initUserTheme();
  const quick = document.getElementById('quickThemeSelect');
  if (quick) quick.value = document.body.getAttribute('data-theme') || 'industrial';

  // Session validation — show login overlay or continue
  initSession();

  const activePage = document.querySelector('.page.active');
  if (!activePage) showPage('dashboard');
  initResizableMasterTables();
  initResizableColumns();
  if (activePage && activePage.id === 'page-workorders') {
    loadWorkOrders();
  }
  if (activePage && activePage.id === 'page-projects') {
    loadProjects();
  }
  if (activePage && activePage.id === 'page-departments') {
    loadDepartments();
  }
  if (activePage && activePage.id === 'page-machinery') {
    loadMachinery();
  }
  if (activePage && activePage.id === 'page-access-equipment') {
    loadAccessEquipment();
  }
  if (activePage && activePage.id === 'page-task-type-master') {
    loadTaskTypes();
  }
  startRegionalClock();
  initGlobalSearch();
  refreshDashboardKpis();
  if (!window.__profileDocClickBound) {
    window.__profileDocClickBound = true;
    document.addEventListener('click', (e) => {
      const menu = document.getElementById('profileMenu');
      const right = document.querySelector('.topbar-right');
      if (!menu || !right) return;
      if (!right.contains(e.target)) hideProfileMenu();
    });
  }
}

// ── Shift Setup ──────────────────────────────────────────────────────────────
const SHIFTS_API = () => `${getApiBaseUrl()}/system-settings/shifts`;

async function loadShiftSetupPage() {
  try {
    const rows = await fetchJson(SHIFTS_API());
    masterShifts = Array.isArray(rows) ? rows : [];
    renderShiftsTable(masterShifts);
  } catch (e) {
    console.error('Failed to load shifts', e);
    showToast('Failed to load shifts', 'error');
  }
}

function renderShiftsTable(rows) {
  const tbody = document.getElementById('shiftsTableBody');
  const meta  = document.getElementById('shiftsMeta');
  if (!tbody) return;

  const editIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const delIcon  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;

  tbody.innerHTML = rows.map((s, i) => `
    <tr>
      <td class="wip-td-num">${i + 1}</td>
      <td><span class="wip-link" onclick="editShift('${s.shiftCode}')">${s.shiftCode}</span></td>
      <td>${s.shiftName}</td>
      <td style="color:#6b7280">${s.startTime}</td>
      <td style="color:#6b7280">${s.endTime}</td>
      <td style="color:#6b7280">${s.graceMinutes} min</td>
      <td><span class="badge ${s.status === 'Active' ? 'badge-active' : 'badge-inactive'}">${s.status}</span></td>
      <td><div class="action-cell">
        <button class="wip-action-btn wip-action-edit" title="Edit" onclick="editShift('${s.shiftCode}')">${editIcon}</button>
        <button class="wip-action-btn wip-action-delete" title="Delete" onclick="deleteShift('${s.shiftCode}')">${delIcon}</button>
      </div></td>
    </tr>`).join('');

  if (meta) meta.textContent = `${rows.length} shift${rows.length !== 1 ? 's' : ''}`;
}

function editShift(shiftCode) {
  const s = masterShifts.find(x => x.shiftCode === shiftCode);
  if (!s) return;
  document.getElementById('shiftEditCode').value  = s.shiftCode;
  document.getElementById('shiftCode').value       = s.shiftCode;
  document.getElementById('shiftCode').readOnly    = true;
  document.getElementById('shiftName').value       = s.shiftName;
  document.getElementById('shiftStartTime').value  = s.startTime;
  document.getElementById('shiftEndTime').value    = s.endTime;
  document.getElementById('shiftGrace').value      = s.graceMinutes;
  document.getElementById('shiftStatus').value     = s.status;
  document.getElementById('shiftFormTitle').textContent = 'Edit Shift';
  document.getElementById('shiftSaveBtn').textContent   = 'Save Changes';
  document.getElementById('shiftCancelBtn').style.display = '';
  document.getElementById('shiftCode').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function resetShiftForm() {
  document.getElementById('shiftEditCode').value   = '';
  document.getElementById('shiftCode').value        = '';
  document.getElementById('shiftCode').readOnly     = false;
  document.getElementById('shiftName').value        = '';
  document.getElementById('shiftStartTime').value   = '06:00';
  document.getElementById('shiftEndTime').value     = '14:00';
  document.getElementById('shiftGrace').value       = '10';
  document.getElementById('shiftStatus').value      = 'Active';
  document.getElementById('shiftFormTitle').textContent = 'Add Shift';
  document.getElementById('shiftSaveBtn').textContent   = '+ Add Shift';
  document.getElementById('shiftCancelBtn').style.display = 'none';
}

async function saveShift() {
  const editCode    = document.getElementById('shiftEditCode').value.trim();
  const shiftCode   = document.getElementById('shiftCode').value.trim().toUpperCase();
  const shiftName   = document.getElementById('shiftName').value.trim();
  const startTime   = document.getElementById('shiftStartTime').value;
  const endTime     = document.getElementById('shiftEndTime').value;
  const graceMinutes= parseInt(document.getElementById('shiftGrace').value || '0', 10);
  const status      = document.getElementById('shiftStatus').value;

  if (!shiftCode)  { showToast('Shift Code is required.', 'error'); return; }
  if (!shiftName)  { showToast('Shift Name is required.', 'error'); return; }
  if (!startTime)  { showToast('Start Time is required.', 'error'); return; }
  if (!endTime)    { showToast('End Time is required.',   'error'); return; }

  const payload = { shiftCode, shiftName, startTime, endTime, graceMinutes, status };
  const isEdit  = !!editCode;
  const url     = isEdit ? `${SHIFTS_API()}/${encodeURIComponent(editCode)}` : SHIFTS_API();
  const method  = isEdit ? 'PATCH' : 'POST';

  try {
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    showToast(isEdit ? 'Shift updated.' : 'Shift added.', 'success');
    resetShiftForm();
    await loadShiftSetupPage();
  } catch (e) {
    showToast('Error: ' + (e?.message || e), 'error');
  }
}

async function deleteShift(shiftCode) {
  if (!confirm(`Delete shift "${shiftCode}"? This cannot be undone.`)) return;
  try {
    const res = await apiFetch(`${SHIFTS_API()}/${encodeURIComponent(shiftCode)}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    showToast(`Shift "${shiftCode}" deleted.`, 'success');
    await loadShiftSetupPage();
  } catch (e) {
    showToast('Error: ' + (e?.message || e), 'error');
  }
}

// ── Document Numbering Settings ──────────────────────────────────────────────
const _dnCurrentSeq = { PROD: 0, INST: 0, DAILY: 0, WEEKLY: 0 };

async function loadDocNumberingSettings() {
  try {
    const rows = await fetchJson(`${getApiBaseUrl()}/timesheets/doc-numbering`);
    const byType = {};
    rows.forEach(r => { byType[r.docType] = r; });

    const digits = byType['PROD']?.sequenceDigits ?? byType['INST']?.sequenceDigits ?? 4;

    ['PROD', 'INST', 'WOC', 'PROJ'].forEach(t => {
      _dnCurrentSeq[t] = byType[t]?.currentNo ?? 0;
    });

    const stripTrailingDash = s => (s || '').replace(/-+$/, '');
    const el = id => document.getElementById(id);
    if (el('dnProdPrefix'))     el('dnProdPrefix').value     = stripTrailingDash(byType['PROD']?.prefix || 'TS-PROD-');
    if (el('dnInstPrefix'))     el('dnInstPrefix').value     = stripTrailingDash(byType['INST']?.prefix || 'TS-INST-');
    if (el('dnWocPrefix'))      el('dnWocPrefix').value      = stripTrailingDash(byType['WOC']?.prefix  || 'WOC-');
    if (el('dnProjPrefix'))     el('dnProjPrefix').value     = stripTrailingDash(byType['PROJ']?.prefix || 'TS-PROJ-');
    if (el('dnSequenceDigits')) el('dnSequenceDigits').value = String(digits);

    updateDocNumberingPreview();
  } catch (e) {
    console.error('Failed to load doc numbering settings', e);
  }
}

function updateDocNumberingPreview() {
  const year   = new Date().getFullYear();
  const digits = parseInt(document.getElementById('dnSequenceDigits')?.value || '4', 10);
  const el     = id => document.getElementById(id);

  const makeNext = (prefixInput, currentNo) => {
    const raw    = (prefixInput?.value || '').trim();
    const prefix = raw ? raw + '-' : '';
    const next   = String(currentNo + 1).padStart(digits, '0');
    return `${prefix}${year}-${next}`;
  };

  if (el('dnPreviewProd')) el('dnPreviewProd').textContent = makeNext(el('dnProdPrefix'), _dnCurrentSeq['PROD']);
  if (el('dnPreviewInst')) el('dnPreviewInst').textContent = makeNext(el('dnInstPrefix'), _dnCurrentSeq['INST']);
  if (el('dnPreviewWoc'))  el('dnPreviewWoc').textContent  = makeNext(el('dnWocPrefix'),  _dnCurrentSeq['WOC']);
  if (el('dnPreviewProj')) el('dnPreviewProj').textContent = makeNext(el('dnProjPrefix'), _dnCurrentSeq['PROJ']);
}

async function saveDocNumberingSettings() {
  const digits = parseInt(document.getElementById('dnSequenceDigits')?.value || '4', 10);
  const val    = id => (document.getElementById(id)?.value || '').trim();

  const makePrefix = raw => raw ? raw.replace(/-+$/, '') + '-' : '';

  const rows = [
    { docType: 'PROD', prefix: makePrefix(val('dnProdPrefix')), sequenceDigits: digits },
    { docType: 'INST', prefix: makePrefix(val('dnInstPrefix')), sequenceDigits: digits },
    { docType: 'WOC',  prefix: makePrefix(val('dnWocPrefix')),  sequenceDigits: digits },
    { docType: 'PROJ', prefix: makePrefix(val('dnProjPrefix')), sequenceDigits: digits },
  ];

  try {
    const res = await apiFetch(`${getApiBaseUrl()}/timesheets/doc-numbering`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    showToast('Document numbering settings saved.', 'success');
  } catch (e) {
    showToast('Failed to save settings: ' + (e?.message || e), 'error');
  }
}

// ── Auth / Login ──────────────────────────────────────────────────────────────
function _setLoginError(msg) {
  const wrap = document.getElementById('loginError');
  const text = document.getElementById('loginErrorText');
  if (!wrap) return;
  if (msg) { wrap.style.display = 'block'; if (text) text.textContent = msg; }
  else      { wrap.style.display = 'none'; }
}

function showForgotPasswordInfo() {
  const msg = document.getElementById('loginLockMsg');
  if (!msg) return;
  msg.style.display = 'block';
  msg.style.color = '#64748b';
  msg.innerHTML = '&#128274; Contact your system administrator to reset your password.';
}

function toggleLoginPw() {
  const inp  = document.getElementById('loginPassword');
  const icon = document.getElementById('pwEyeIcon');
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  if (icon) icon.innerHTML = show
    ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
}

function showLoginOverlay(msg) {
  const overlay = document.getElementById('loginOverlay');
  if (!overlay) return;
  overlay.style.display = 'flex';
  document.querySelector('.layout-root')?.style.setProperty('display', 'none');
  _setLoginError(msg || '');
  setTimeout(() => document.getElementById('loginUsername')?.focus(), 50);
  ['loginUsername','loginPassword'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => _setLoginError(''), { once: true });
  });
}

function hideLoginOverlay() {
  const overlay = document.getElementById('loginOverlay');
  if (overlay) overlay.style.display = 'none';
  const layout = document.querySelector('.layout-root');
  if (layout) layout.style.removeProperty('display');
}

async function initSession() {
  const token = getSessionToken();
  if (!token) { showLoginOverlay(); return; }
  try {
    const user = await fetchJson(`${getApiBaseUrl()}/auth/me`);
    applySessionUser(user);
    resetInactivityTimer();
    document.addEventListener('click',     resetInactivityTimer, { passive: true });
    document.addEventListener('keydown',   resetInactivityTimer, { passive: true });
    hideLoginOverlay();
    loadDashboard();
    refreshPendingCount();
    initNewProdPage();
    initNewInstPage();
  } catch {
    showLoginOverlay();
  }
}

function applySessionUser(user) {
  if (!user) return;
  const nameEl   = document.querySelector('.user-name');
  const roleEl   = document.querySelector('.user-role');
  const avatarEl = document.getElementById('topbarAvatar');
  if (nameEl)   nameEl.textContent   = user.displayName || user.username;
  if (roleEl)   roleEl.textContent   = user.roleCode    || '';
  if (avatarEl) avatarEl.textContent = (user.displayName || user.username || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

async function submitLogin() {
  const btn      = document.getElementById('loginBtn');
  const username = document.getElementById('loginUsername')?.value.trim();
  const password = document.getElementById('loginPassword')?.value;

  if (!username || !password) {
    _setLoginError('Please enter your username and password.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in…';
  _setLoginError('');

  try {
    // Best-effort geo lookup from browser (sees the real public IP, not the server's LAN IP)
    let city = '', country = '';
    try {
      const geo = await Promise.race([
        fetch('https://ip-api.com/json/?fields=city,country,status').then(r => r.json()),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
      ]);
      if (geo?.status === 'success') { city = geo.city || ''; country = geo.country || ''; }
    } catch { /* geo is best-effort */ }

    const res  = await window.fetch(`${getApiBaseUrl()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, city, country }),
    });
    const data = await res.json();
    if (!res.ok) {
      _setLoginError(data.message || 'Login failed.');
      return;
    }
    saveSession(data.token, data.user);
    applySessionUser(data.user);
    resetInactivityTimer();
    document.addEventListener('click',   resetInactivityTimer, { passive: true });
    document.addEventListener('keydown', resetInactivityTimer, { passive: true });
    document.getElementById('loginPassword').value = '';
    hideLoginOverlay();
    loadDashboard();
    refreshPendingCount();
    initNewProdPage();
    initNewInstPage();
    if (data.mustChangePassword) {
      openForceChangePwModal();
    }
  } catch (e) {
    _setLoginError('Cannot reach server. Check connection.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

// ── Audit Trail ───────────────────────────────────────────────────────────────
async function loadAuditTrail() {
  const tbody = document.getElementById('auditBody');
  const meta  = document.getElementById('auditMeta');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:30px">Loading…</td></tr>`;

  const params = new URLSearchParams();
  const docType  = document.getElementById('auditFilterDocType')?.value;
  const action   = document.getElementById('auditFilterAction')?.value;
  const dateFrom = document.getElementById('auditFilterDateFrom')?.value;
  const dateTo   = document.getElementById('auditFilterDateTo')?.value;
  const search   = document.getElementById('auditSearch')?.value.trim();
  if (docType)  params.set('docType',  docType);
  if (action)   params.set('action',   action);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo)   params.set('dateTo',   dateTo);
  if (search)   params.set('search',   search);
  params.set('limit', '200');

  try {
    const { rows, total } = await fetchJson(`${getApiBaseUrl()}/audit?${params}`);
    if (meta) meta.textContent = `${rows.length} of ${total} entries`;
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:30px">No audit entries found.</td></tr>`;
      return;
    }
    const actionColors = { CREATE:'#16a34a', UPDATE:'#2563eb', DELETE:'#dc2626', 'RESET-PWD':'#f59e0b', PERMISSIONS:'#9333ea' };
    const fmt = iso => {
      if (!iso) return '—';
      try {
        const d = new Date(iso);
        return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
          + ' ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
      } catch { return iso; }
    };
    tbody.innerHTML = rows.map((r, i) => {
      const color = actionColors[r.action] || '#6b7280';
      return `<tr>
        <td class="wip-td-num">${i + 1}</td>
        <td style="font-family:var(--font-mono);font-size:11px;color:#6b7280;white-space:nowrap">${fmt(r.loggedAt)}</td>
        <td><span class="wip-dept-badge" style="font-size:11px">${r.docType}</span></td>
        <td style="font-weight:500;color:var(--text1);font-size:12px">${r.docRef}</td>
        <td><span style="font-size:11px;font-weight:600;color:${color};background:${color}18;padding:2px 8px;border-radius:4px">${r.action}</span></td>
        <td style="color:#374151;font-size:12px">${r.performedByName || r.performedBy || '—'}</td>
        <td style="color:#6b7280;font-size:12px">${r.details || '—'}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--red);padding:30px">Failed to load audit log.</td></tr>`;
    console.error('Audit trail error:', err);
  }
}

function clearAuditFilters() {
  ['auditFilterDocType','auditFilterAction','auditFilterDateFrom','auditFilterDateTo','auditSearch']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  loadAuditTrail();
}

function exportAuditCSV() {
  const table = document.getElementById('auditTable');
  if (!table) return;
  const headers = ['#','Timestamp','Type','Reference','Action','Performed By','Details'];
  const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr =>
    Array.from(tr.querySelectorAll('td')).map(td => `"${td.innerText.trim().replace(/"/g,'""')}"`).join(',')
  );
  const csv = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `audit_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Reports ───────────────────────────────────────────────────────────────────
function _currentMonthRange() {
  const now   = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);
  return { first, today };
}

let _reportDeptLoaded = false;

async function _initReportDeptFilter() {
  if (_reportDeptLoaded) return;
  try {
    const depts = await fetchJson(`${getApiBaseUrl()}/departments`);
    const sel = document.getElementById('rptDept');
    if (!sel) return;
    (depts || []).forEach(d => {
      const o = document.createElement('option');
      o.value = d.departmentCode || d.departmentId || d.code || '';
      o.textContent = d.departmentName || d.name || o.value;
      sel.appendChild(o);
    });
    _reportDeptLoaded = true;
  } catch { /* departments optional */ }
}

async function loadReport() {
  const dateFrom = document.getElementById('rptDateFrom')?.value || '';
  const dateTo   = document.getElementById('rptDateTo')?.value   || '';
  const type     = document.getElementById('rptType')?.value     || '';
  const status   = document.getElementById('rptStatus')?.value   || '';
  const dept     = document.getElementById('rptDept')?.value     || '';

  const params = new URLSearchParams();
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo)   params.set('dateTo',   dateTo);
  if (type)     params.set('type',     type);
  if (status)   params.set('status',   status);
  if (dept)     params.set('department', dept);

  const body = document.getElementById('rptBody');
  if (body) body.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--text3);padding:30px">Loading…</td></tr>';

  try {
    const rows = await fetchJson(`${getApiBaseUrl()}/timesheets?${params.toString()}`);
    _renderReport(rows || []);
  } catch (e) {
    if (body) body.innerHTML = `<tr><td colspan="12" style="text-align:center;color:#e74c3c;padding:30px">${e.message || 'Failed to load'}</td></tr>`;
  }
}

function _renderReport(rows) {
  const body = document.getElementById('rptBody');
  if (!body) return;

  const summaryBar = document.getElementById('rptSummaryBar');

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--text3);padding:40px">No records found for the selected filters</td></tr>';
    if (summaryBar) summaryBar.style.display = 'none';
    return;
  }

  const totalMins     = rows.reduce((s, r) => s + (Number(r.totalDuration) || 0), 0);
  const totalLabour   = rows.reduce((s, r) => s + (Number(r.labourCount)   || 0), 0);
  const totalMaterial = rows.reduce((s, r) => s + (Number(r.materialCount) || 0), 0);
  const totalEquip    = rows.reduce((s, r) => s + (Number(r.equipmentCount)|| 0), 0);

  const fmtMins = m => {
    const h  = Math.floor(m / 60);
    const mn = m % 60;
    return `${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}`;
  };

  if (summaryBar) {
    summaryBar.style.display = 'flex';
    document.getElementById('rptTotalCount').textContent    = rows.length;
    document.getElementById('rptTotalHours').textContent = fmtMins(totalMins);
    document.getElementById('rptTotalLabour').textContent   = totalLabour;
    document.getElementById('rptTotalMaterial').textContent = totalMaterial;
    document.getElementById('rptTotalEquip').textContent    = totalEquip;
  }

  const statusBadge = s => {
    const cls = { Draft:'badge-draft', Submitted:'badge-submitted', Approved:'badge-approved', Rejected:'badge-rejected' }[s] || '';
    return `<span class="badge ${cls}">${s || '—'}</span>`;
  };
  const typeBadge = t => {
    const cls = { PROD:'badge-approved', INST:'badge-submitted', PROJ:'badge-draft' }[t] || '';
    return `<span class="badge ${cls}">${t || '—'}</span>`;
  };

  body.innerHTML = rows.map(r => {
    const hrs = fmtMins(Number(r.totalDuration) || 0);
    const wo  = r.workOrderNo || r.projectName || r.projectId || '—';
    return `<tr>
      <td><span class="wip-link" style="font-size:12px">${r.tsDocNo || '—'}</span></td>
      <td>${typeBadge(r.tsType)}</td>
      <td style="white-space:nowrap">${r.entryDate || '—'}</td>
      <td>${r.department_code || '—'}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${wo}">${wo}</td>
      <td>${r.entered_by_name || '—'}</td>
      <td>${r.shiftCode || '—'}</td>
      <td style="text-align:center">${r.labourCount ?? 0}</td>
      <td style="text-align:right;white-space:nowrap">${hrs}</td>
      <td style="text-align:center">${r.materialCount ?? 0}</td>
      <td style="text-align:center">${r.equipmentCount ?? 0}</td>
      <td>${statusBadge(r.status)}</td>
    </tr>`;
  }).join('');
}

function clearReportFilters() {
  ['rptDateFrom','rptDateTo','rptType','rptStatus','rptDept'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const body = document.getElementById('rptBody');
  if (body) body.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--text3);padding:40px">Select filters and click Run Report</td></tr>';
  const summaryBar = document.getElementById('rptSummaryBar');
  if (summaryBar) summaryBar.style.display = 'none';
}

function exportReportCSV() {
  const body = document.getElementById('rptBody');
  if (!body) return;
  const dataRows = body.querySelectorAll('tr');
  if (!dataRows.length || (dataRows.length === 1 && dataRows[0].querySelector('td[colspan]'))) {
    alert('No data to export. Run the report first.');
    return;
  }
  const headers = ['Doc No','Type','Date','Department','Work Order / Project','Entered By','Shift','Labour Lines','Duration','Material Lines','Equipment Lines','Status'];
  const rows = Array.from(dataRows).map(tr =>
    Array.from(tr.querySelectorAll('td')).map(td => `"${td.innerText.trim().replace(/"/g,'""')}"`).join(',')
  ).filter(r => r);
  const dateFrom = document.getElementById('rptDateFrom')?.value || '';
  const dateTo   = document.getElementById('rptDateTo')?.value   || '';
  const label    = dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : new Date().toISOString().slice(0,10);
  const csv  = [headers.map(h => `"${h}"`).join(','), ...rows].join('\n');
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `timesheet_report_${label}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Timesheet Detail Report ───────────────────────────────────────────────────
function openDetailReport(type) {
  window._detailReportPresetType = type || '';
  _detailReportAllRows = [];
  // Reset date range so it re-applies on next open
  const df = document.getElementById('drptDateFrom');
  const dt = document.getElementById('drptDateTo');
  if (df) df.value = '';
  if (dt) dt.value = '';
  showPage('report-detail');
}

let _detailReportDeptLoaded = false;
let _detailReportAllRows   = [];

async function _initDetailReportDeptFilter() {
  if (_detailReportDeptLoaded) return;
  try {
    const depts = await fetchJson(`${getApiBaseUrl()}/departments`);
    const sel = document.getElementById('drptDept');
    if (!sel) return;
    (depts || []).forEach(d => {
      const o = document.createElement('option');
      o.value = d.departmentCode || d.departmentId || d.code || '';
      o.textContent = d.departmentName || d.name || o.value;
      sel.appendChild(o);
    });
    _detailReportDeptLoaded = true;
  } catch { /* optional */ }
}

async function loadDetailReport() {
  const dateFrom = document.getElementById('drptDateFrom')?.value || '';
  const dateTo   = document.getElementById('drptDateTo')?.value   || '';
  const type     = document.getElementById('drptType')?.value     || '';
  const status   = document.getElementById('drptStatus')?.value   || '';
  const dept     = document.getElementById('drptDept')?.value     || '';

  const params = new URLSearchParams();
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo)   params.set('dateTo',   dateTo);
  if (type)     params.set('type',     type);
  if (status)   params.set('status',   status);
  if (dept)     params.set('department', dept);

  const body = document.getElementById('drptBody');
  if (body) body.innerHTML = '<tr><td colspan="13" style="text-align:center;color:var(--text3);padding:30px">Loading…</td></tr>';

  try {
    const rows = await fetchJson(`${getApiBaseUrl()}/timesheets/report-detail?${params.toString()}`);
    _detailReportAllRows = rows || [];
    _applyDetailLineFilter();
  } catch (e) {
    _detailReportAllRows = [];
    if (body) body.innerHTML = `<tr><td colspan="13" style="text-align:center;color:#e74c3c;padding:30px">${e.message || 'Failed to load'}</td></tr>`;
  }
}

function _applyDetailLineFilter() {
  const isProj   = window._detailReportPresetType === 'PROJ';
  const lineType = document.getElementById('drptLineType')?.value || '';
  const empSearch = (document.getElementById('drptEmployee')?.value || '').toLowerCase().trim();
  let rows = _detailReportAllRows;
  if (lineType)   rows = rows.filter(r => r.lineType === lineType);
  if (isProj && empSearch) rows = rows.filter(r =>
    (r.employeeName || '').toLowerCase().includes(empSearch) ||
    (r.employeeCode || '').toLowerCase().includes(empSearch)
  );
  _renderDetailReport(rows);
}

function _renderDetailReport(rows) {
  const body = document.getElementById('drptBody');
  if (!body) return;

  const summaryBar = document.getElementById('drptSummaryBar');

  if (!rows.length) {
    body.innerHTML = '<tr><td colspan="13" style="text-align:center;color:var(--text3);padding:40px">No records found for the selected filters</td></tr>';
    if (summaryBar) summaryBar.style.display = 'none';
    return;
  }

  const fmtMins = m => {
    if (window._detailReportPresetType === 'PROJ') {
      const h = Math.floor(m / 60), mn = m % 60;
      return `${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}`;
    }
    return String(Number(m) || 0);
  };

  const labourRows   = rows.filter(r => r.lineType === 'LABOUR');
  const materialRows = rows.filter(r => r.lineType === 'MATERIAL');
  const equipRows    = rows.filter(r => !['LABOUR','MATERIAL'].includes(r.lineType));
  const totalMins    = labourRows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
  const uniqueTS     = new Set(rows.map(r => r.tsDocNo)).size;

  if (summaryBar) {
    summaryBar.style.display = 'flex';
    document.getElementById('drptTotalTS').textContent       = uniqueTS;
    document.getElementById('drptTotalLabour').textContent   = labourRows.length;
    document.getElementById('drptTotalDuration').textContent = fmtMins(totalMins);
    document.getElementById('drptTotalMaterial').textContent = materialRows.length;
    document.getElementById('drptTotalEquip').textContent    = equipRows.length;
  }

  const statusBadge = s => {
    const cls = { Draft:'badge-draft', Submitted:'badge-submitted', Approved:'badge-approved', Rejected:'badge-rejected' }[s] || '';
    return `<span class="badge ${cls}">${s || '—'}</span>`;
  };
  const typeBadge = t => {
    const cls = { PROD:'badge-approved', INST:'badge-submitted', PROJ:'badge-draft' }[t] || '';
    return `<span class="badge ${cls}">${t || '—'}</span>`;
  };
  const lineTypeBadge = lt => {
    const map = { LABOUR:'badge-submitted', MATERIAL:'badge-approved', MACHINERY:'badge-draft', VEHICLE:'badge-rejected', ACCESS:'badge-draft' };
    return `<span class="badge ${map[lt]||''}">${lt || '—'}</span>`;
  };

  const isProj = window._detailReportPresetType === 'PROJ';

  let prevDocNo = null;
  body.innerHTML = rows.map(r => {
    const isLabour   = r.lineType === 'LABOUR';
    const isMaterial = r.lineType === 'MATERIAL';
    const nameField  = isLabour   ? (r.employeeName || r.employeeCode || '—')
                     : isMaterial ? (r.itemName     || '—')
                     :              (r.equipmentName|| r.itemName || '—');
    const codeField  = isLabour   ? (r.employeeCode || r.designation || '—')
                     : isMaterial ? (r.itemCode     || '—')
                     :              '—';
    const qtyDisplay = isLabour   ? fmtMins(Number(r.qty) || 0)
                     : isMaterial ? (r.qty != null ? Number(r.qty).toFixed(2) : '—')
                     :              (r.qty != null ? r.qty : '—');
    const uom        = isMaterial ? (r.uom || '—') : (isLabour ? 'min' : 'hrs');
    const wo         = isProj ? (r.projectId || r.projectName || '—') : (r.workOrderNo || r.projectName || '—');

    const isNewDoc = r.tsDocNo !== prevDocNo;
    prevDocNo = r.tsDocNo;

    const deptCell = isProj ? '' : `<td>${r.department_code || '—'}</td>`;
    const hdrCells = isNewDoc
      ? `<td><span class="wip-link" style="font-size:12px">${r.tsDocNo}</span></td>
         <td>${typeBadge(r.tsType)}</td>
         <td style="white-space:nowrap">${r.entryDate || '—'}</td>
         ${deptCell}
         <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${wo}">${wo}</td>
         <td>${r.entered_by_name || '—'}</td>`
      : `<td></td><td></td><td></td>${isProj ? '' : '<td></td>'}<td></td><td></td>`;

    const lineTypeCell = isProj ? '' : `<td>${lineTypeBadge(r.lineType)}</td>`;

    return `<tr>
      ${hdrCells}
      ${lineTypeCell}
      <td>${nameField}</td>
      <td style="color:var(--text3)">${codeField}</td>
      <td style="white-space:nowrap;color:var(--text3)">${r.startTime || '—'}</td>
      <td style="white-space:nowrap;color:var(--text3)">${r.endTime   || '—'}</td>
      <td style="text-align:right;white-space:nowrap">${qtyDisplay}</td>
      ${isProj ? '' : `<td style="color:var(--text3)">${uom}</td>`}
    </tr>`;
  }).join('');
}

function clearDetailReportFilters() {
  ['drptDateFrom','drptDateTo','drptStatus','drptDept','drptLineType','drptEmployee'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const preset = window._detailReportPresetType || '';
  const typeEl = document.getElementById('drptType');
  if (typeEl) typeEl.value = preset;
  _detailReportAllRows = [];
  const body = document.getElementById('drptBody');
  if (body) body.innerHTML = '<tr><td colspan="13" style="text-align:center;color:var(--text3);padding:40px">Select filters and click Run Report</td></tr>';
  const summaryBar = document.getElementById('drptSummaryBar');
  if (summaryBar) summaryBar.style.display = 'none';
}

function exportDetailReportCSV() {
  const body = document.getElementById('drptBody');
  if (!body || !_detailReportAllRows.length) {
    alert('No data to export. Run the report first.');
    return;
  }
  const fmtMins = m => {
    if (window._detailReportPresetType === 'PROJ') {
      const h = Math.floor(m / 60), mn = m % 60;
      return `${String(h).padStart(2,'0')}:${String(mn).padStart(2,'0')}`;
    }
    return String(Number(m) || 0);
  };
  const isProj = window._detailReportPresetType === 'PROJ';
  const headers = isProj
    ? ['Doc No','Type','Date','Project ID','Entered By','Employee','Code / Designation','Start','End','Duration']
    : ['Doc No','Type','Date','Department','Work Order / Project','Entered By','Line Type','Name / Item / Equipment','Code / Designation','Start','End','Duration / Qty','UOM'];
  const rows = _detailReportAllRows.map(r => {
    const isLabour   = r.lineType === 'LABOUR';
    const isMaterial = r.lineType === 'MATERIAL';
    const name    = isLabour ? (r.employeeName||r.employeeCode||'') : isMaterial ? (r.itemName||'') : (r.equipmentName||r.itemName||'');
    const code    = isLabour ? (r.employeeCode||r.designation||'') : isMaterial ? (r.itemCode||'') : '';
    const qty     = isLabour ? fmtMins(Number(r.qty)||0) : (r.qty != null ? r.qty : '');
    const uom     = isMaterial ? (r.uom||'') : isLabour ? 'min' : 'hrs';
    const wo      = isProj ? (r.projectId || r.projectName || '') : (r.workOrderNo || r.projectName || '');
    const csvCols = isProj
      ? [r.tsDocNo, r.tsType, r.entryDate, wo, r.entered_by_name, name, code, r.startTime||'', r.endTime||'', qty]
      : [r.tsDocNo, r.tsType, r.entryDate, r.department_code, wo, r.entered_by_name, r.lineType, name, code, r.startTime||'', r.endTime||'', qty, uom];
    return csvCols.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',');
  });
  const dateFrom = document.getElementById('drptDateFrom')?.value || '';
  const dateTo   = document.getElementById('drptDateTo')?.value   || '';
  const label    = dateFrom && dateTo ? `${dateFrom}_to_${dateTo}` : new Date().toISOString().slice(0,10);
  const csv  = [headers.map(h=>`"${h}"`).join(','), ...rows].join('\n');
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const typeSlug = (window._detailReportPresetType || '').toLowerCase();
  a.download = `timesheet_detail${typeSlug ? '_' + typeSlug : ''}_${label}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Login History ─────────────────────────────────────────────────────────────
async function loadLoginHistory() {
  try {
    const filter  = document.getElementById('loginHistoryFilter')?.value || 'all';
    const days    = document.getElementById('loginHistoryDays')?.value    || '30';
    const qs      = days !== '0' ? `?days=${days}` : '';
    const curUser = getCurrentUser();
    const url     = filter === 'mine' && curUser
      ? `${getApiBaseUrl()}/auth/login-history/${encodeURIComponent(curUser.userId)}${qs}`
      : `${getApiBaseUrl()}/auth/login-history${qs}`;

    const [rows, sessions] = await Promise.all([
      fetchJson(url),
      fetchJson(`${getApiBaseUrl()}/auth/sessions`),
    ]);

    _renderLoginHistory(rows, days);
    _renderActiveSessions(sessions);
  } catch (e) {
    console.error('Failed to load login history', e);
  }
}

function _renderLoginHistory(rows, days) {
  const tbody = document.getElementById('loginHistBody');
  const meta  = document.getElementById('loginHistoryMeta');
  if (!tbody) return;

  tbody.innerHTML = rows.map((r, i) => {
    const ua      = _parseUA(r.userAgent || '');
    const locStr  = [r.city, r.country].filter(Boolean).join(', ') || '—';
    const success = r.success === true || r.success === 1;
    return `<tr>
      <td class="wip-td-num">${i + 1}</td>
      <td>${r.username}</td>
      <td style="color:#6b7280;white-space:nowrap">${_fmtDateTime(r.attemptAt)}</td>
      <td><span class="badge ${success ? 'badge-active' : 'badge-inactive'}">${success ? 'Success' : 'Failed'}</span></td>
      <td style="color:#6b7280;font-family:monospace;font-size:11px">${r.ipAddress || '—'}</td>
      <td style="color:#6b7280">${locStr}</td>
      <td style="color:#6b7280;font-size:11px">${ua}</td>
      <td style="color:#ef4444;font-size:11px">${r.failReason || ''}</td>
    </tr>`;
  }).join('');
  const period = !days || days === '0' ? 'all time' : `last ${days} day${days === '1' ? '' : 's'}`;
  if (meta) meta.textContent = `${rows.length} record${rows.length !== 1 ? 's' : ''} — ${period}`;
}

function _renderActiveSessions(sessions) {
  const tbody = document.getElementById('activeSessionsBody');
  if (!tbody) return;
  const curToken = getSessionToken();
  const killIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  tbody.innerHTML = sessions.map((s, i) => {
    const isCurrent = s.sessionToken === curToken;
    return `<tr ${isCurrent ? 'style="background:var(--bg3)"' : ''}>
      <td class="wip-td-num">${i + 1}</td>
      <td>${s.displayName} <span style="color:var(--text3);font-size:11px">(${s.username})</span>${isCurrent ? ' <span class="badge badge-active" style="font-size:10px">current</span>' : ''}</td>
      <td style="color:#6b7280;white-space:nowrap">${_fmtDateTime(s.createdAt)}</td>
      <td style="color:#6b7280;white-space:nowrap">${_fmtDateTime(s.lastActiveAt)}</td>
      <td style="color:#6b7280;white-space:nowrap">${_fmtDateTime(s.expiresAt)}</td>
      <td style="color:#6b7280;font-family:monospace;font-size:11px">${s.ipAddress || '—'}</td>
      <td><div class="action-cell">${isCurrent ? '' :
        `<button class="wip-action-btn wip-action-delete" title="Force logout" onclick="forceLogoutSession('${s.sessionToken}')">${killIcon}</button>`
      }</div></td>
    </tr>`;
  }).join('');
}

async function forceLogoutSession(token) {
  if (!confirm('Force logout this session?')) return;
  try {
    const res = await apiFetch(`${getApiBaseUrl()}/auth/sessions/${encodeURIComponent(token)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error();
    showToast('Session terminated.', 'success');
    loadLoginHistory();
  } catch { showToast('Failed to terminate session.', 'error'); }
}

function _fmtDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return val;
  return d.toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}

function _parseUA(ua) {
  if (!ua) return '—';
  let browser = 'Unknown';
  if (ua.includes('Edg/'))       browser = 'Edge';
  else if (ua.includes('Chrome'))browser = 'Chrome';
  else if (ua.includes('Firefox'))browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  let os = '';
  if (ua.includes('Windows'))     os = 'Windows';
  else if (ua.includes('Mac'))    os = 'macOS';
  else if (ua.includes('Linux'))  os = 'Linux';
  else if (ua.includes('Android'))os = 'Android';
  else if (ua.includes('iPhone')) os = 'iOS';
  return os ? `${browser} / ${os}` : browser;
}

// ── WO Complete ──────────────────────────────────────────────────────────────

async function _ensureWorkOrdersMaster() {
  if (masterWorkOrders.length > 0) return;
  try {
    const rows = await fetchJson(`${getApiBaseUrl()}/work-orders?subsidiaryIds=1,3&statuses=In Process,Released`);
    masterWorkOrders = Array.isArray(rows) ? rows : [];
  } catch (err) {
    console.error('WO master silent fetch error:', err);
  }
}

/* Work order numbers that already have a WO Complete record.
   Refreshed on demand and cleared when a new WOC is saved. */
let _completedWoNos = new Set();
let _completedWoNosLoaded = false;

async function _ensureCompletedWoNos() {
  if (_completedWoNosLoaded) return;
  try {
    const rows = await fetchJson(`${getApiBaseUrl()}/wo-complete`);
    _completedWoNos = new Set(
      (Array.isArray(rows) ? rows : [])
        .map(r => (r.workOrderNumber || '').trim())
        .filter(Boolean)
    );
    _completedWoNosLoaded = true;
  } catch (err) {
    console.error('Completed WO fetch error:', err);
  }
}

async function loadWoComplete() {
  const body = document.getElementById('wocBody');
  if (!body) return;
  try {
    body.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:20px">Loading…</td></tr>';
    let rows = await fetchJson(`${getApiBaseUrl()}/wo-complete`);
    if (!Array.isArray(rows)) rows = [];
    if (window._userDataScope === 'Own') {
      const me = getCurrentUser()?.displayName || '';
      rows = rows.filter(r => (r.enteredBy || '') === me);
    }
    renderWocRows(rows);
    woCompleteLoaded = true;
  } catch (err) {
    body.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--red);padding:20px">Unable to load records. Check backend.</td></tr>';
    console.error('WO Complete load error:', err);
  }
}

function _wocCustomerName(projectName) {
  if (!projectName) return '';
  const idx = projectName.indexOf(':');
  return idx !== -1 ? projectName.slice(idx + 1).trim() : projectName;
}

let _wocStagedFiles = [];
let _wocEditId = null;
let _wocViewMode = false;
let _wocSavedAttachments = [];

function renderWocRows(rows) {
  const body = document.getElementById('wocBody');
  if (!body) return;
  const meta = document.getElementById('woCompleteMeta');
  if (!rows || rows.length === 0) {
    body.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:20px">No records found.</td></tr>';
    if (meta) meta.textContent = '0 records';
    return;
  }
  const viewIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const editIcon = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  const delIcon  = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
  body.innerHTML = rows.map((r, i) => {
    const badge = _wocStatusBadge(r.status);
    return `<tr>
      <td class="wip-td-num">${i + 1}</td>
      <td><span class="doc-no">${r.docNo}</span></td>
      <td>${r.completedDate || '—'}</td>
      <td style="color:#6b7280">${r.projectId || '—'}</td>
      <td><span class="wip-project-name">${r.projectName || '—'}</span></td>
      <td style="color:#6b7280">${r.department || '—'}</td>
      <td><span class="wip-link">${r.workOrderNumber || '—'}</span></td>
      <td><span class="badge ${badge}">${r.status || '—'}</span></td>
      <td style="color:#6b7280">${r.enteredBy || '—'}</td>
      <td><div class="action-cell">
        <button class="wip-action-btn" title="View" onclick="viewWocRecord(${r.id})">${viewIcon}</button>
        <button class="wip-action-btn wip-action-edit" title="Edit" onclick="editWocRecord(${r.id})">${editIcon}</button>
        <button class="wip-action-btn wip-action-delete" title="Delete" onclick="deleteWocRecord(${r.id},'${r.docNo}')">${delIcon}</button>
      </div></td>
    </tr>`;
  }).join('');
  if (meta) meta.textContent = `${rows.length} record${rows.length !== 1 ? 's' : ''} · Updated just now`;
}

function _wocStatusBadge(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('wo completed'))         return 'badge-approved';
  if (s.includes('data entry completed')) return 'badge-submitted';
  return 'badge-draft';
}

async function openWocCreateModal() {
  if (!prodDepartmentsLoaded) await loadProdDepartments();
  if (!projectsLoaded)        await loadMasterProjects();
  await _ensureWorkOrdersMaster();
  await _ensureCompletedWoNos();

  _wocEditId = null;
  _wocViewMode = false;
  _wocStagedFiles = [];
  _wocSavedAttachments = [];
  _setWocModalMode('create');

  document.getElementById('wocProjectId').value    = '';
  document.getElementById('wocCustomerName').value = '';
  document.getElementById('wocStatus').value       = '';
  document.getElementById('wocRemarks').value      = '';
  document.getElementById('wocWorkOrder').innerHTML = '<option value="">Select project first…</option>';
  document.getElementById('wocDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('wocRelatedPanel').style.display = 'none';
  document.getElementById('wocFileList').innerHTML = '';
  document.getElementById('wocTsBody').innerHTML = '<tr><td colspan="5" class="woc-ts-empty">Select a work order to view entries.</td></tr>';
  const tsMeta = document.getElementById('wocTsMeta'); if (tsMeta) tsMeta.textContent = '';
  switchWocTab(1);

  const user = document.querySelector('.user-name');
  document.getElementById('wocEnteredBy').value = user ? user.textContent.trim() : 'System User';

  const deptSel = document.getElementById('wocDepartment');
  const mainDepts = [...new Set(masterProdDepartments.map(d => d.mainDepartment).filter(Boolean))];
  deptSel.innerHTML = '<option value="">Select department…</option>' +
    mainDepts.map(d => `<option value="${d}">${d}</option>`).join('');

  try {
    const { docNo } = await fetchJson(`${getApiBaseUrl()}/wo-complete/preview-doc-no`);
    document.getElementById('wocDocNo').textContent = docNo;
  } catch (e) {
    document.getElementById('wocDocNo').textContent = 'WOC-…';
  }

  document.getElementById('wocModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeWocModal() {
  document.getElementById('wocModal').style.display = 'none';
  document.body.style.overflow = '';
  _wocEditId = null;
  _wocViewMode = false;
  _wocSavedAttachments = [];
}

function _setWocModalMode(mode) {
  // mode: 'create' | 'edit' | 'view'
  const title  = document.getElementById('wocModalTitle');
  const saveBtn = document.getElementById('wocSaveBtn');
  const fields  = ['wocDate','wocStatus','wocEnteredBy','wocProjectId','wocCustomerName','wocDepartment','wocWorkOrder','wocRemarks'];
  const isView  = mode === 'view';

  if (title) title.textContent = mode === 'create' ? 'Mark WO Complete' : mode === 'edit' ? 'Edit WO Complete' : 'View WO Complete';
  if (saveBtn) {
    saveBtn.style.display = isView ? 'none' : '';
    saveBtn.textContent   = mode === 'edit' ? '✏️ Save Changes' : '✅ Mark Complete';
  }

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') el.disabled = isView;
    else el.readOnly = isView;
  });

  const dropzone  = document.getElementById('wocDropzone');
  const fileInput = document.getElementById('wocFileInput');
  if (dropzone)  dropzone.style.display  = isView ? 'none' : '';
  if (fileInput) fileInput.disabled = isView;
}

function _renderWocSavedFiles() {
  const list = document.getElementById('wocSavedFileList');
  if (!list) return;
  if (!_wocSavedAttachments.length) { list.style.display = 'none'; return; }
  const icon = f => (f.mimeType || '').includes('pdf') ? '📄' : (f.mimeType || '').includes('image') ? '🖼️' : (f.mimeType || '').includes('word') || (f.fileName || '').endsWith('.docx') ? '📝' : '📎';
  const fmt  = b => !b ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(0)} KB` : `${(b/1048576).toFixed(1)} MB`;
  const viewOnly = _wocViewMode;
  list.innerHTML = _wocSavedAttachments.map(f => `
    <div class="woc-file-item">
      <span style="font-size:16px">${icon(f)}</span>
      <span class="woc-file-item-name">${f.fileName}</span>
      <span class="woc-file-item-size">${fmt(f.fileSize)}</span>
      ${viewOnly ? '' : `<button class="woc-file-item-del" onclick="_wocDeleteSavedFile(${f.id})" title="Remove">✕</button>`}
    </div>`).join('');
  list.style.display = '';
}

async function _wocDeleteSavedFile(attachId) {
  try {
    const res = await apiFetch(`${getApiBaseUrl()}/wo-complete/attachments/${attachId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(res.statusText);
    _wocSavedAttachments = _wocSavedAttachments.filter(f => f.id !== attachId);
    _renderWocSavedFiles();
  } catch (err) {
    showToast('Delete failed: ' + (err?.message || err), 'error');
  }
}

async function _openWocRecord(id, viewOnly) {
  if (!prodDepartmentsLoaded) await loadProdDepartments();
  if (!projectsLoaded)        await loadMasterProjects();
  await _ensureWorkOrdersMaster();

  let rec;
  try {
    rec = await fetchJson(`${getApiBaseUrl()}/wo-complete/${id}`);
  } catch (err) {
    showToast('Failed to load record.', 'error');
    return;
  }

  _wocEditId   = viewOnly ? null : id;
  _wocViewMode = viewOnly;
  _wocStagedFiles = [];
  _wocSavedAttachments = [];

  _setWocModalMode(viewOnly ? 'view' : 'edit');

  // Fill fields
  document.getElementById('wocDocNo').textContent      = rec.docNo || '';
  document.getElementById('wocDate').value             = (rec.completedDate || '').slice(0, 10);
  document.getElementById('wocEnteredBy').value        = rec.enteredBy || '';
  document.getElementById('wocRemarks').value          = rec.remarks  || '';
  document.getElementById('wocCustomerName').value     = rec.projectName || '';
  document.getElementById('wocProjectId').value        = rec.projectId   || '';
  document.getElementById('wocStatus').value           = rec.status || '';

  // Populate department dropdown then set value
  const deptSel   = document.getElementById('wocDepartment');
  const mainDepts = [...new Set(masterProdDepartments.map(d => d.mainDepartment).filter(Boolean))];
  deptSel.innerHTML = '<option value="">Select department…</option>' +
    mainDepts.map(d => `<option value="${d}">${d}</option>`).join('');
  deptSel.value = rec.department || '';

  // Populate WO dropdown filtered by project + department, keeping the record's own WO visible
  await _ensureCompletedWoNos();
  _populateWocWorkOrders(rec.projectId || '', rec.department || '', rec.workOrderNumber || '');

  // Show related panel and load timesheets for the WO
  if (rec.workOrderNumber) {
    document.getElementById('wocRelatedPanel').style.display = '';
    switchWocTab(1);
    await _loadWocTimesheets(rec.workOrderNumber);
  } else {
    document.getElementById('wocRelatedPanel').style.display = 'none';
  }

  // Load existing attachments
  document.getElementById('wocFileList').innerHTML = '';
  try {
    _wocSavedAttachments = await fetchJson(`${getApiBaseUrl()}/wo-complete/${id}/attachments`);
  } catch (_) { _wocSavedAttachments = []; }
  _renderWocSavedFiles();

  document.getElementById('wocModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

async function viewWocRecord(id) {
  await _openWocRecord(id, true);
}

async function editWocRecord(id) {
  await _openWocRecord(id, false);
}

function switchWocTab(n) {
  document.getElementById('wocTabContent1').style.display = n === 1 ? '' : 'none';
  document.getElementById('wocTabContent2').style.display = n === 2 ? '' : 'none';
  document.getElementById('wocTab1').classList.toggle('active', n === 1);
  document.getElementById('wocTab2').classList.toggle('active', n === 2);
}

function onWocProjectInput() {
  const input = document.getElementById('wocProjectId');
  const menu  = document.getElementById('wocProjectMenu');
  const q = sanitizeProjectIdInput(input.value).toLowerCase();
  const filtered = masterProjects
    .filter(p => !isProjectClosed(p))
    .map(p => p.projectCode || '')
    .filter(Boolean)
    .filter(id => !q || id.toLowerCase().includes(q))
    .slice(0, 60);
  if (filtered.length === 0) { menu.style.display = 'none'; return; }
  menu.innerHTML = filtered.map(id => `<div class="project-id-option" data-id="${id}">${id}</div>`).join('');
  const rect = input.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top   = `${rect.bottom + 4}px`;
  menu.style.left  = `${rect.left}px`;
  menu.style.width = `${Math.max(rect.width, 180)}px`;
  menu.style.right = 'auto';
  menu.style.display = 'block';
  menu.querySelectorAll('.project-id-option').forEach(el => {
    el.addEventListener('mousedown', evt => {
      evt.preventDefault();
      input.value = el.getAttribute('data-id') || '';
      menu.style.display = 'none';
      _onWocProjectSelect(input.value);
    });
  });
}

function _populateWocWorkOrders(projectId, mainDept, keepWo) {
  const woSel = document.getElementById('wocWorkOrder');
  if (!projectId || !mainDept) {
    woSel.innerHTML = `<option value="">${!projectId ? 'Select project first…' : 'Select department first…'}</option>`;
    return;
  }
  const deptLower = mainDept.toLowerCase();
  const wos = masterWorkOrders.filter(w => {
    if ((w.projectCode || '') !== projectId) return false;
    const wDept = (w.departmentName || '').toLowerCase();
    if (!wDept.includes(deptLower) && !deptLower.includes(wDept)) return false;
    // exclude WOs already completed, but keep the one being edited
    const woNo = (w.workOrderNumber || '').trim();
    if (_completedWoNosLoaded && _completedWoNos.has(woNo) && woNo !== (keepWo || '').trim()) return false;
    return true;
  });
  if (wos.length === 0) {
    woSel.innerHTML = '<option value="">No available work orders for this department</option>';
  } else {
    woSel.innerHTML = '<option value="">Select work order…</option>' +
      wos.map(w => `<option value="${w.workOrderNumber}" data-status="${w.netsuiteStatus || ''}" data-source="${w.sourceType || ''}">${w.workOrderNumber} — ${w.netsuiteStatus || ''}</option>`).join('');
  }
  if (keepWo) woSel.value = keepWo;
}

function _onWocProjectSelect(projectId) {
  const proj = masterProjects.find(p => (p.projectCode || '') === projectId);
  document.getElementById('wocCustomerName').value = proj?.projectName || '';
  document.getElementById('wocRelatedPanel').style.display = 'none';
  const mainDept = document.getElementById('wocDepartment').value;
  _populateWocWorkOrders(projectId, mainDept);
}

async function onWocDepartmentChange() {
  await _ensureCompletedWoNos();
  const projectId = document.getElementById('wocProjectId').value.trim();
  const mainDept  = document.getElementById('wocDepartment').value;
  _populateWocWorkOrders(projectId, mainDept);
  // reset WO selection and hide panel
  document.getElementById('wocWorkOrder').value = '';
  document.getElementById('wocRelatedPanel').style.display = 'none';
  document.getElementById('wocTsBody').innerHTML = '<tr><td colspan="5" class="woc-ts-empty">Select a work order to view entries.</td></tr>';
  const tsMeta = document.getElementById('wocTsMeta'); if (tsMeta) tsMeta.textContent = '';
}

async function onWocWorkOrderChange() {
  const woSel = document.getElementById('wocWorkOrder');
  const wo    = woSel.value;
  const panel = document.getElementById('wocRelatedPanel');
  if (!wo) { panel.style.display = 'none'; return; }
  panel.style.display = '';
  switchWocTab(1);
  await _loadWocTimesheets(wo);
}

async function _loadWocTimesheets(workOrderNo) {
  const tsBody = document.getElementById('wocTsBody');
  const tsMeta = document.getElementById('wocTsMeta');
  if (!tsBody) return;
  tsBody.innerHTML = '<tr><td colspan="5" class="woc-ts-empty">Loading…</td></tr>';
  if (tsMeta) tsMeta.textContent = '';

  try {
    const allRows = await fetchJson(`${getApiBaseUrl()}/timesheets?workOrderNo=${encodeURIComponent(workOrderNo)}`);
    const mainDept = document.getElementById('wocDepartment').value;
    const deptCodes = mainDept
      ? masterProdDepartments.filter(d => (d.mainDepartment || '') === mainDept).map(d => d.departmentCode || '')
      : [];
    const rows = deptCodes.length > 0
      ? allRows.filter(r => deptCodes.includes(r.department_code || ''))
      : allRows;

    if (!rows.length) {
      tsBody.innerHTML = '<tr><td colspan="5" class="woc-ts-empty">No timesheet entries found for this work order.</td></tr>';
      if (tsMeta) tsMeta.textContent = '0 entries';
      return;
    }
    tsBody.innerHTML = rows.map((r, i) => `<tr>
        <td>${i + 1}</td>
        <td><span style="font-family:var(--font-mono);font-size:11px">${r.tsDocNo}</span></td>
        <td>${r.entryDate || '—'}</td>
        <td style="color:#6b7280">${r.department_code || r.department || '—'}</td>
        <td>${r.entered_by_name || r.employeeName || r.employeeCode || '—'}</td>
      </tr>`).join('');
    if (tsMeta) tsMeta.textContent = `${rows.length} entr${rows.length !== 1 ? 'ies' : 'y'}`;
  } catch (err) {
    tsBody.innerHTML = '<tr><td colspan="5" class="woc-ts-empty" style="color:var(--red)">Failed to load timesheets.</td></tr>';
    console.error('WOC timesheets fetch error:', err);
  }
}

function wocHandleFileSelect(evt) {
  Array.from(evt.target.files).forEach(_wocAddFile);
  evt.target.value = '';
}

function wocHandleDrop(evt) {
  evt.preventDefault();
  document.getElementById('wocDropzone').classList.remove('woc-dropzone-hover');
  Array.from(evt.dataTransfer.files).forEach(_wocAddFile);
}

function _wocAddFile(file) {
  if (file.size > 5 * 1024 * 1024) { showToast(`${file.name} exceeds 5 MB limit.`, 'error'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    const base64 = e.target.result.split(',')[1];
    _wocStagedFiles.push({ name: file.name, type: file.type, size: file.size, data: base64 });
    _renderWocFileList();
  };
  reader.readAsDataURL(file);
}

function _renderWocFileList() {
  const list = document.getElementById('wocFileList');
  if (!list) return;
  const icon = f => f.type.includes('pdf') ? '📄' : f.type.includes('image') ? '🖼️' : f.type.includes('word') || f.name.endsWith('.docx') ? '📝' : '📎';
  const fmt  = b => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(0)} KB` : `${(b/1048576).toFixed(1)} MB`;
  list.innerHTML = _wocStagedFiles.map((f, i) => `
    <div class="woc-file-item">
      <span style="font-size:16px">${icon(f)}</span>
      <span class="woc-file-item-name">${f.name}</span>
      <span class="woc-file-item-size">${fmt(f.size)}</span>
      <button class="woc-file-item-del" onclick="_wocRemoveFile(${i})" title="Remove">✕</button>
    </div>`).join('');
}

function _wocRemoveFile(idx) {
  _wocStagedFiles.splice(idx, 1);
  _renderWocFileList();
}

async function saveWocComplete() {
  const projectId       = document.getElementById('wocProjectId').value.trim();
  const department      = document.getElementById('wocDepartment').value;
  const woSel           = document.getElementById('wocWorkOrder');
  const workOrderNumber = woSel.value;
  const opt             = woSel.options[woSel.selectedIndex];
  const workOrderStatus = opt ? (opt.getAttribute('data-status') || '') : '';
  const sourceType      = opt ? (opt.getAttribute('data-source') || '') : '';
  const status          = document.getElementById('wocStatus').value;
  const completedDate   = document.getElementById('wocDate').value;

  if (!projectId)       { showToast('Please select a project.', 'error');    return; }
  if (!department)      { showToast('Please select a department.', 'error'); return; }
  if (!workOrderNumber) { showToast('Please select a work order.', 'error'); return; }
  if (!status)          { showToast('Please select a status.', 'error');     return; }
  if (!completedDate)   { showToast('Please select a date.', 'error');       return; }

  const proj = masterProjects.find(p => (p.projectCode || '') === projectId);
  const payload = {
    projectId,
    projectName:     proj?.projectName || '',
    customerName:    document.getElementById('wocCustomerName').value,
    department,
    workOrderNumber,
    workOrderStatus,
    sourceType,
    status,
    completedDate,
    enteredBy: document.getElementById('wocEnteredBy').value,
    remarks:   document.getElementById('wocRemarks').value.trim(),
  };

  const isEdit = _wocEditId !== null;
  const url    = isEdit ? `${getApiBaseUrl()}/wo-complete/${_wocEditId}` : `${getApiBaseUrl()}/wo-complete`;

  try {
    const res = await apiFetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || res.statusText); }
    const recordId = isEdit ? _wocEditId : (await res.json()).id;
    // upload any newly staged files
    for (const f of _wocStagedFiles) {
      await apiFetch(`${getApiBaseUrl()}/wo-complete/${recordId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: f.name, mimeType: f.type, fileData: f.data, fileSize: f.size }),
      }).catch(err => console.error('File upload error:', err));
    }
    showToast(isEdit ? 'Record updated.' : 'Work order marked complete.', 'success');
    closeWocModal();
    woCompleteLoaded = false;
    _completedWoNosLoaded = false; // force refresh so timesheet WO dropdowns reflect new completion
    loadWoComplete();
  } catch (err) {
    showToast('Save failed: ' + (err?.message || err), 'error');
  }
}

async function deleteWocRecord(id, docNo) {
  if (!confirm(`Delete record ${docNo}?`)) return;
  try {
    const res = await apiFetch(`${getApiBaseUrl()}/wo-complete/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(res.statusText);
    showToast('Record deleted.', 'success');
    woCompleteLoaded = false;
    _completedWoNosLoaded = false; // WO is no longer completed — allow timesheet entry again
    loadWoComplete();
  } catch (err) {
    showToast('Delete failed: ' + (err?.message || err), 'error');
  }
}

// ══════════════════════════════════════════════════════
// APPROVAL FLOW
// ══════════════════════════════════════════════════════

async function submitTimesheet(docNo, type) {
  if (!confirm(`Submit ${docNo} for approval?`)) return;
  try {
    const res = await apiFetch(`${getApiBaseUrl()}/timesheets/${docNo}/submit`, { method: 'POST' });
    if (!res.ok) { const b = await res.json().catch(()=>({})); throw new Error(b.message || res.statusText); }
    showToast(`${docNo} submitted for approval.`, 'success');
    if (type === 'PROD') { prodListLoaded = false; loadProdTimesheets(); }
    if (type === 'INST') { instListLoaded = false; loadInstTimesheets(); }
    refreshPendingCount();
  } catch (err) {
    showToast('Submit failed: ' + (err?.message || err), 'error');
  }
}

let _approveDocNo = null;
let _rejectDocNo  = null;

function openApproveModal(docNo) {
  _approveDocNo = docNo;
  const lbl = document.getElementById('approveDocNoLabel');
  if (lbl) lbl.textContent = docNo;
  const rem = document.getElementById('approveRemark');
  if (rem) rem.value = '';
  const m = document.getElementById('approveModal');
  if (m) m.style.display = 'flex';
}
function closeApproveModal() {
  const m = document.getElementById('approveModal');
  if (m) m.style.display = 'none';
  _approveDocNo = null;
}

async function confirmApprove() {
  if (!_approveDocNo) return;
  const docNo = _approveDocNo;
  closeApproveModal();
  try {
    const res = await apiFetch(`${getApiBaseUrl()}/timesheets/${docNo}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approverName: getCurrentUser()?.displayName || '' }),
    });
    if (!res.ok) { const b = await res.json().catch(()=>({})); throw new Error(b.message || res.statusText); }
    showToast(`${docNo} approved.`, 'success');
    prodListLoaded = false; instListLoaded = false;
    loadPendingApprovals();
    refreshPendingCount();
  } catch (err) {
    showToast('Approve failed: ' + (err?.message || err), 'error');
  }
}

function openRejectModal(docNo) {
  _rejectDocNo = docNo;
  const lbl = document.getElementById('rejectDocNoLabel');
  if (lbl) lbl.textContent = docNo;
  const rea = document.getElementById('rejectReason');
  if (rea) rea.value = '';
  const m = document.getElementById('rejectModal');
  if (m) m.style.display = 'flex';
}
function closeRejectModal() {
  const m = document.getElementById('rejectModal');
  if (m) m.style.display = 'none';
  _rejectDocNo = null;
}

async function confirmReject() {
  if (!_rejectDocNo) return;
  const docNo = _rejectDocNo;
  const reason = (document.getElementById('rejectReason')?.value || '').trim();
  if (!reason) { showToast('Please enter a rejection reason.', 'error'); return; }
  closeRejectModal();
  try {
    const res = await apiFetch(`${getApiBaseUrl()}/timesheets/${docNo}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) { const b = await res.json().catch(()=>({})); throw new Error(b.message || res.statusText); }
    showToast(`${docNo} rejected.`, 'success');
    prodListLoaded = false; instListLoaded = false;
    loadPendingApprovals();
    refreshPendingCount();
  } catch (err) {
    showToast('Reject failed: ' + (err?.message || err), 'error');
  }
}

function _timePending(submittedAt) {
  if (!submittedAt) return '—';
  const ms = Date.now() - new Date(submittedAt).getTime();
  const days = Math.floor(ms / 86400000);
  const hrs  = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `<span style="color:var(--red);font-weight:600">${days}d ${hrs}h</span>`;
  if (hrs > 0)  return `<span style="color:var(--accent)">${hrs}h ${mins}m</span>`;
  return `${mins}m`;
}

async function loadPendingApprovals() {
  const tbody = document.getElementById('pendingApprovalsBody');
  const meta  = document.getElementById('pendingApprovalsMeta');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:20px">Loading…</td></tr>';
  try {
    const rows = await fetchJson(`${getApiBaseUrl()}/timesheets/pending-approvals`);
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--text3);padding:20px">No pending approvals.</td></tr>';
      if (meta) meta.textContent = '0 items';
      refreshPendingCount(0);
      return;
    }
    const fmt = iso => { try { return new Date(iso).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}); } catch { return iso||'-'; } };
    const fmtDt = iso => {
      if (!iso) return '—';
      try { const d = new Date(iso); if (isNaN(d)) return '—'; return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) + ' ' + d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}); } catch { return '—'; }
    };
    tbody.innerHTML = rows.map((r, i) => {
      const typeLabel = r.tsType === 'INST' ? 'Installation' : 'Production';
      const dn = r.tsDocNo;
      const submittedTs = r.submittedAt || r.createdAt; // fall back to createdAt for pre-migration rows
      return `<tr>
        <td class="wip-td-num">${i+1}</td>
        <td><span class="wip-link" onclick="${r.tsType==='INST'?`viewInstTimesheet('${dn}')`:`viewProdTimesheet('${dn}')`}">${dn}</span></td>
        <td><span class="badge ${r.tsType==='INST'?'badge-submitted':'badge-draft'}" style="font-size:10px">${typeLabel}</span></td>
        <td>${fmt(r.entryDate)}</td>
        <td>${r.department_code||'—'}</td>
        <td>${r.workOrderNo||'—'}</td>
        <td>${r.entered_by_name||'—'}</td>
        <td>${r.totalDuration||0} min</td>
        <td style="font-size:12px;white-space:nowrap">${fmtDt(submittedTs)}${!r.submittedAt ? ' <span style="font-size:10px;opacity:0.5">(est)</span>' : ''}</td>
        <td style="white-space:nowrap">${_timePending(submittedTs)}</td>
        <td><div class="action-cell" style="gap:4px">
          <button class="btn btn-outline btn-sm" style="height:24px;padding:0 8px;font-size:11px" onclick="reviewTimesheetAsApprover('${dn}','${r.tsType}')">Edit</button>
          <button class="btn btn-primary btn-sm" style="height:24px;padding:0 8px;font-size:11px" onclick="openApproveModal('${dn}')">Approve</button>
          <button class="btn btn-outline btn-sm" style="height:24px;padding:0 8px;font-size:11px;color:var(--red);border-color:var(--red)" onclick="openRejectModal('${dn}')">Reject</button>
        </div></td>
      </tr>`;
    }).join('');
    if (meta) meta.textContent = `${rows.length} pending approval${rows.length!==1?'s':''}`;
    refreshPendingCount(rows.length);
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--red);padding:20px">Unable to load. Check backend.</td></tr>';
  }
}

function reviewTimesheetAsApprover(docNo, type) {
  if (type === 'INST') {
    editInstTimesheet(docNo);
  } else {
    editProdTimesheet(docNo);
  }
}

async function refreshPendingCount(count) {
  const badge = document.getElementById('pendingApprovalsCount');
  if (!badge) return;
  if (count === undefined) {
    try {
      const rows = await fetchJson(`${getApiBaseUrl()}/timesheets/pending-approvals`);
      count = rows?.length ?? 0;
    } catch { count = 0; }
  }
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

// ══════════════════════════════════════════════════════
// APPROVAL SETTINGS
// ══════════════════════════════════════════════════════

let _approvalSettingsRows = [];

async function loadApprovalSettings() {
  const tbody = document.getElementById('approvalSettingsBody');
  if (!tbody) return;
  try {
    _approvalSettingsRows = await fetchJson(`${getApiBaseUrl()}/approval-settings`);
    renderApprovalSettings();
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--red)">Unable to load settings.</td></tr>';
  }
}

function renderApprovalSettings() {
  const tbody = document.getElementById('approvalSettingsBody');
  if (!tbody) return;
  if (!_approvalSettingsRows.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text3);padding:20px">No rows. Click "+ Add Row" to begin.</td></tr>';
    return;
  }
  tbody.innerHTML = _approvalSettingsRows.map((r, i) => `
    <tr>
      <td><input class="form-control" style="width:100%" value="${r.department||''}" oninput="_approvalSettingsRows[${i}].department=this.value" placeholder="e.g. Production"/></td>
      <td>
        <input class="form-control" style="width:100%" value="${r.approverNames||''}" oninput="_approvalSettingsRows[${i}].approverNames=this.value" placeholder="John Smith, Jane Doe"/>
        <div style="font-size:11px;color:var(--text3);margin-top:3px">Any one of these can approve</div>
      </td>
      <td><input class="form-control" style="width:100%" value="${r.approverEmails||''}" oninput="_approvalSettingsRows[${i}].approverEmails=this.value" placeholder="john@co.com, jane@co.com"/></td>
      <td style="text-align:center"><button class="btn btn-ghost btn-sm btn-icon" style="color:var(--red)" onclick="_approvalSettingsRows.splice(${i},1);renderApprovalSettings()">✕</button></td>
    </tr>`).join('');
}

function addApprovalSettingsRow() {
  _approvalSettingsRows.push({ department: '', approverNames: '', approverEmails: '' });
  renderApprovalSettings();
}

async function saveApprovalSettings() {
  const rows = _approvalSettingsRows.filter(r => r.department?.trim());
  try {
    const res = await apiFetch(`${getApiBaseUrl()}/approval-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) throw new Error(res.statusText);
    showToast('Approval settings saved.', 'success');
    loadApprovalSettings();
  } catch (err) {
    showToast('Save failed: ' + (err?.message || err), 'error');
  }
}

// ══════════════════════════════════════════════════════
// EMAIL SETTINGS
// ══════════════════════════════════════════════════════

// ── Tab switching ──
function showEmailTab(tab) {
  ['config', 'notifications', 'templates', 'logs'].forEach(t => {
    const panel = document.getElementById('emailTab-' + t);
    const btn   = document.getElementById('emailTabBtn-' + t);
    if (panel) panel.style.display = (t === tab) ? 'block' : 'none';
    if (btn) {
      btn.style.borderBottomColor = (t === tab) ? 'var(--primary,#2563eb)' : 'transparent';
      btn.style.color             = (t === tab) ? 'var(--primary,#2563eb)' : '';
      btn.style.fontWeight        = (t === tab) ? '600' : '';
    }
  });
  if (tab === 'notifications') loadNotificationRules();
  if (tab === 'logs') loadEmailLogs();
  if (tab === 'templates') {
    const sel = document.getElementById('templateKey');
    if (sel) loadEmailTemplate(sel.value);
  }
}

// ── Config tab ──
function onEmailProviderChange() {
  const isGraph = document.getElementById('emailProviderGraph')?.checked;
  const smtpEl  = document.getElementById('smtpFields');
  const graphEl = document.getElementById('graphFields');
  const hintEl  = document.getElementById('fromEmailHint');
  if (smtpEl)  smtpEl.style.display  = isGraph ? 'none' : 'flex';
  if (graphEl) graphEl.style.display  = isGraph ? 'flex' : 'none';
  if (hintEl)  hintEl.textContent = isGraph ? 'Must be a mailbox in your Microsoft 365 tenant with Mail.Send permission.' : '';
  // Highlight selected provider card
  ['providerSmtpLabel','providerGraphLabel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.borderColor = '';
  });
  const active = isGraph ? 'providerGraphLabel' : 'providerSmtpLabel';
  const activeEl = document.getElementById(active);
  if (activeEl) activeEl.style.borderColor = '#2563eb';
}

async function loadEmailSettings() {
  try {
    const cfg = await fetchJson(`${getApiBaseUrl()}/email-settings`);
    const v = (id, val) => { const el = document.getElementById(id); if (el) { if (el.type === 'checkbox') el.checked = !!val; else el.value = val ?? ''; } };
    v('emailEnabled',      cfg.enabled);
    v('emailHost',         cfg.smtpHost);
    v('emailPort',         cfg.smtpPort || 587);
    v('emailUser',         cfg.smtpUser);
    v('emailPass',         cfg.smtpPass);
    v('emailFrom',         cfg.fromEmail);
    v('emailFromName',     cfg.fromName);
    v('graphTenantId',     cfg.graphTenantId);
    v('graphClientId',     cfg.graphClientId);
    v('graphClientSecret', cfg.graphClientSecret);
    // Set provider radio
    const provider = cfg.provider || 'smtp';
    const radioEl = document.getElementById(provider === 'graph' ? 'emailProviderGraph' : 'emailProviderSmtp');
    if (radioEl) radioEl.checked = true;
    onEmailProviderChange();
    showEmailTab('config');
  } catch (err) {
    showToast('Unable to load email settings.', 'error');
  }
}

async function saveActiveEmailTab() {
  const activeBtn = ['config', 'notifications', 'templates', 'logs'].find(t => {
    const panel = document.getElementById('emailTab-' + t);
    return panel && panel.style.display !== 'none';
  });
  if (activeBtn === 'config')        return saveEmailSettings();
  if (activeBtn === 'notifications') return saveNotificationRules();
  if (activeBtn === 'templates')     return saveEmailTemplate();
  // logs tab has no save action
}

async function saveEmailSettings() {
  const g = id => { const el = document.getElementById(id); return el ? (el.type === 'checkbox' ? el.checked : el.value) : ''; };
  const provider = document.getElementById('emailProviderGraph')?.checked ? 'graph' : 'smtp';
  const body = {
    provider,
    smtpHost:         g('emailHost'),
    smtpPort:         Number(g('emailPort')) || 587,
    smtpUser:         g('emailUser'),
    smtpPass:         g('emailPass'),
    fromEmail:        g('emailFrom'),
    fromName:         g('emailFromName'),
    enabled:          g('emailEnabled'),
    graphTenantId:    g('graphTenantId'),
    graphClientId:    g('graphClientId'),
    graphClientSecret:g('graphClientSecret'),
  };
  try {
    const res = await apiFetch(`${getApiBaseUrl()}/email-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(res.statusText);
    showToast('Email settings saved.', 'success');
  } catch (err) {
    showToast('Save failed: ' + (err?.message || err), 'error');
  }
}

async function testEmailConnection() {
  const resultEl = document.getElementById('emailTestResult');
  if (resultEl) { resultEl.style.display = 'block'; resultEl.style.background = '#f3f4f6'; resultEl.style.color = ''; resultEl.textContent = 'Testing connection…'; }
  try {
    const res = await apiFetch(`${getApiBaseUrl()}/email-settings/test`, { method: 'POST' });
    const data = await res.json();
    if (resultEl) {
      resultEl.style.background = data.ok ? '#d1fae5' : '#fee2e2';
      resultEl.style.color      = data.ok ? '#065f46' : '#991b1b';
      resultEl.textContent      = data.message || (data.ok ? 'Connection successful.' : 'Connection failed.');
    }
  } catch (err) {
    if (resultEl) { resultEl.style.background = '#fee2e2'; resultEl.style.color = '#991b1b'; resultEl.textContent = 'Test failed: ' + err?.message; }
  }
}

async function sendTestEmail() {
  const to = (document.getElementById('testEmailAddr')?.value || '').trim();
  if (!to) { showToast('Enter a recipient email address.', 'error'); return; }
  const resultEl = document.getElementById('emailTestResult');
  if (resultEl) { resultEl.style.display = 'block'; resultEl.style.background = '#f3f4f6'; resultEl.style.color = ''; resultEl.textContent = 'Sending test email…'; }
  try {
    const res = await apiFetch(`${getApiBaseUrl()}/email-settings/test-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to }),
    });
    const data = await res.json();
    if (resultEl) {
      resultEl.style.background = data.ok ? '#d1fae5' : '#fee2e2';
      resultEl.style.color      = data.ok ? '#065f46' : '#991b1b';
      resultEl.textContent      = data.message || (data.ok ? 'Test email sent.' : 'Send failed.');
    }
  } catch (err) {
    if (resultEl) { resultEl.style.background = '#fee2e2'; resultEl.style.color = '#991b1b'; resultEl.textContent = 'Send failed: ' + err?.message; }
  }
}

// ── Notifications tab ──
const _defaultNotificationRules = [
  { module: 'PROD', event: 'SUBMIT',   enabled: true,  sendToApprover: true,  sendToSubmitter: false, ccEmails: '' },
  { module: 'PROD', event: 'APPROVE',  enabled: true,  sendToApprover: false, sendToSubmitter: true,  ccEmails: '' },
  { module: 'PROD', event: 'REJECT',   enabled: true,  sendToApprover: false, sendToSubmitter: true,  ccEmails: '' },
  { module: 'INST', event: 'SUBMIT',   enabled: true,  sendToApprover: true,  sendToSubmitter: false, ccEmails: '' },
  { module: 'INST', event: 'APPROVE',  enabled: true,  sendToApprover: false, sendToSubmitter: true,  ccEmails: '' },
  { module: 'INST', event: 'REJECT',   enabled: true,  sendToApprover: false, sendToSubmitter: true,  ccEmails: '' },
  { module: 'WO',   event: 'COMPLETE', enabled: true,  sendToApprover: false, sendToSubmitter: false, ccEmails: '' },
];

async function loadNotificationRules() {
  try {
    const rules = await fetchJson(`${getApiBaseUrl()}/email-notification-rules`);
    renderNotificationRules(rules && rules.length ? rules : _defaultNotificationRules);
  } catch (err) {
    showToast('Unable to load notification rules.', 'error');
    renderNotificationRules(_defaultNotificationRules);
  }
}

function renderNotificationRules(rules) {
  const moduleLabels = { PROD: 'Production Timesheet', INST: 'Installation Timesheet', WO: 'WO Complete' };
  const eventLabels  = { SUBMIT: 'Submitted', APPROVE: 'Approved', REJECT: 'Rejected', COMPLETE: 'Completed' };
  const tbody = document.getElementById('notificationRulesBody');
  if (!tbody) return;
  tbody.innerHTML = rules.map(r => `
    <tr>
      <td>${moduleLabels[r.module] || r.module}</td>
      <td>${eventLabels[r.event] || r.event}</td>
      <td style="text-align:center"><input type="checkbox" data-module="${r.module}" data-event="${r.event}" data-field="enabled" ${r.enabled ? 'checked' : ''}/></td>
      <td style="text-align:center"><input type="checkbox" data-module="${r.module}" data-event="${r.event}" data-field="sendToApprover" ${r.sendToApprover ? 'checked' : ''}/></td>
      <td style="text-align:center"><input type="checkbox" data-module="${r.module}" data-event="${r.event}" data-field="sendToSubmitter" ${r.sendToSubmitter ? 'checked' : ''}/></td>
      <td><input type="text" class="form-control" data-module="${r.module}" data-event="${r.event}" data-field="ccEmails" value="${r.ccEmails || ''}" placeholder="email1@co.com, email2@co.com" style="width:200px;font-size:12px"/></td>
    </tr>`).join('');
}

async function saveNotificationRules() {
  const tbody = document.getElementById('notificationRulesBody');
  if (!tbody) return;
  const rules = [];
  tbody.querySelectorAll('tr').forEach(row => {
    const checkboxes = row.querySelectorAll('input[type="checkbox"]');
    const texts      = row.querySelectorAll('input[type="text"]');
    if (!checkboxes.length) return;
    const mod   = checkboxes[0].dataset.module;
    const event = checkboxes[0].dataset.event;
    rules.push({
      module:          mod,
      event:           event,
      enabled:         checkboxes[0].checked,
      sendToApprover:  checkboxes[1]?.checked ?? false,
      sendToSubmitter: checkboxes[2]?.checked ?? false,
      ccEmails:        texts[0]?.value?.trim() || '',
    });
  });
  try {
    const res = await apiFetch(`${getApiBaseUrl()}/email-notification-rules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules }),
    });
    if (!res.ok) throw new Error(res.statusText);
    showToast('Notification rules saved.', 'success');
  } catch (err) {
    showToast('Save failed: ' + (err?.message || err), 'error');
  }
}

// ── Templates tab ──
async function loadEmailTemplate(key) {
  if (!key) return;
  try {
    const tpl = await fetchJson(`${getApiBaseUrl()}/email-templates/${encodeURIComponent(key)}`);
    const subjEl = document.getElementById('templateSubject');
    const bodyEl = document.getElementById('templateBody');
    if (subjEl) subjEl.value = tpl.subject || '';
    if (bodyEl) bodyEl.value = tpl.bodyHtml || '';
  } catch (err) {
    showToast('Unable to load template.', 'error');
  }
}

async function saveEmailTemplate() {
  const key     = document.getElementById('templateKey')?.value;
  const subject = document.getElementById('templateSubject')?.value?.trim() || '';
  const bodyHtml = document.getElementById('templateBody')?.value || '';
  if (!key) return;
  try {
    const res = await apiFetch(`${getApiBaseUrl()}/email-templates/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, bodyHtml }),
    });
    if (!res.ok) throw new Error(res.statusText);
    showToast('Template saved.', 'success');
  } catch (err) {
    showToast('Save failed: ' + (err?.message || err), 'error');
  }
}

async function resetEmailTemplate() {
  const key = document.getElementById('templateKey')?.value;
  if (!key) return;
  try {
    const res = await apiFetch(`${getApiBaseUrl()}/email-templates/${encodeURIComponent(key)}/reset`, { method: 'POST' });
    const tpl = await res.json();
    const subjEl = document.getElementById('templateSubject');
    const bodyEl = document.getElementById('templateBody');
    if (subjEl) subjEl.value = tpl.subject || '';
    if (bodyEl) bodyEl.value = tpl.bodyHtml || '';
    showToast('Template reset to default.', 'success');
  } catch (err) {
    showToast('Reset failed: ' + (err?.message || err), 'error');
  }
}

// ── Email Send Log ──
async function loadEmailLogs() {
  const tbody = document.getElementById('emailLogsBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:20px">Loading…</td></tr>';
  try {
    const rows = await fetchJson(`${getApiBaseUrl()}/email-logs?limit=200`);
    if (!rows || rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:20px">No log entries yet. Send a notification to see results here.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(r => {
      const statusColor = r.status === 'sent' ? '#16a34a' : r.status === 'failed' ? '#dc2626' : '#d97706';
      const statusBg    = r.status === 'sent' ? '#f0fdf4' : r.status === 'failed' ? '#fef2f2' : '#fffbeb';
      const dt = r.sentAt ? new Date(r.sentAt).toLocaleString() : '—';
      return `<tr>
        <td style="white-space:nowrap;font-size:12px">${dt}</td>
        <td>${r.module || '—'}</td>
        <td>${r.event || '—'}</td>
        <td style="word-break:break-all;font-size:12px">${r.recipient || '—'}</td>
        <td style="font-size:12px">${r.subject || '—'}</td>
        <td><span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${statusBg};color:${statusColor}">${r.status}</span></td>
        <td style="font-size:11px;color:var(--text2)">${r.errorMsg || ''}</td>
      </tr>`;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#dc2626;padding:20px">Failed to load logs: ${err?.message || err}</td></tr>`;
  }
}

async function clearEmailLogs() {
  if (!confirm('Clear all email send logs?')) return;
  try {
    await apiFetch(`${getApiBaseUrl()}/email-logs`, { method: 'DELETE' });
    showToast('Logs cleared.', 'success');
    loadEmailLogs();
  } catch (err) {
    showToast('Clear failed: ' + (err?.message || err), 'error');
  }
}

// ── Bootstrapping fallback ──
// Ensures one page is always visible even if classes were edited accidentally.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapLegacyUi);
} else {
  bootstrapLegacyUi();
}
