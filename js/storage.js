/**
 * HCM Lite — Storage Layer & Shared Utilities
 * Strict adherence to Beginner Track localStorage schema:
 * - hcm_company
 * - hcm_users
 * - hcm_attendance
 * - hcm_leaves
 * - hcm_session
 * - hcm_announcements
 */

const STORAGE_KEYS = {
  COMPANY: 'hcm_company',
  USERS: 'hcm_users',
  ATTENDANCE: 'hcm_attendance',
  LEAVES: 'hcm_leaves',
  SESSION: 'hcm_session',
  ANNOUNCEMENTS: 'hcm_announcements',
  THEME: 'hcm_theme'
};

// Safe JSON parse with fallback
function safeParse(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error parsing localStorage key "${key}":`, err);
    return fallback;
  }
}

// Safe JSON stringify
function safeSave(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error(`Error saving to localStorage key "${key}":`, err);
    showToast('Storage error: browser storage might be full.', 'error');
    return false;
  }
}

// Unique ID Generator
function generateId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
}

// ----------------- Data Accessors -----------------

// Company
function getCompany() {
  return safeParse(STORAGE_KEYS.COMPANY, null);
}

function saveCompany(companyData) {
  return safeSave(STORAGE_KEYS.COMPANY, companyData);
}

// Users (Admin and Employees)
function getUsers() {
  return safeParse(STORAGE_KEYS.USERS, []);
}

function saveUsers(users) {
  return safeSave(STORAGE_KEYS.USERS, users);
}

function getUserById(userId) {
  const users = getUsers();
  return users.find(u => u.id === userId) || null;
}

function getUserByEmail(email) {
  if (!email) return null;
  const users = getUsers();
  const cleanEmail = email.trim().toLowerCase();
  return users.find(u => u.email.toLowerCase() === cleanEmail) || null;
}

// Attendance
function getAttendance() {
  return safeParse(STORAGE_KEYS.ATTENDANCE, []);
}

function saveAttendance(records) {
  return safeSave(STORAGE_KEYS.ATTENDANCE, records);
}

// Leave Requests
function getLeaves() {
  return safeParse(STORAGE_KEYS.LEAVES, []);
}

function saveLeaves(requests) {
  return safeSave(STORAGE_KEYS.LEAVES, requests);
}

// Session
function getSession() {
  return safeParse(STORAGE_KEYS.SESSION, null);
}

function saveSession(sessionData) {
  // Never save raw password into session
  const cleanSession = {
    userId: sessionData.userId,
    name: sessionData.name,
    email: sessionData.email,
    role: sessionData.role,
    department: sessionData.department || ''
  };
  return safeSave(STORAGE_KEYS.SESSION, cleanSession);
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
}

// Announcements
function getAnnouncements() {
  return safeParse(STORAGE_KEYS.ANNOUNCEMENTS, []);
}

function saveAnnouncements(announcements) {
  return safeSave(STORAGE_KEYS.ANNOUNCEMENTS, announcements);
}

// ----------------- Business Calculations & Helpers -----------------

// Format Currency
function formatCurrency(amount) {
  const num = Number(amount) || 0;
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Format Date YYYY-MM-DD to readable (e.g. Oct 24, 2026)
function formatDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Get ISO string for today in local date format YYYY-MM-DD
function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format minutes to "Xh Ym"
function formatDuration(minutes) {
  if (minutes === null || minutes === undefined || isNaN(minutes)) return '-';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
}

// Calculate working days count between start and end date inclusive based on company config
function calculateWorkingDays(startDateStr, endDateStr, workingDaysArray = [1, 2, 3, 4, 5]) {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');
  if (start > end) return 0;

  let count = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
    if (workingDaysArray.includes(dayOfWeek)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

// Calculate remaining leaves for an employee for the current year
function getEmployeeLeaveStats(employeeId) {
  const company = getCompany() || { yearlyLeaveQuota: 20 };
  const leaves = getLeaves();
  const currentYear = new Date().getFullYear().toString();

  // Filter approved leaves for this employee in the current year
  const approvedLeaves = leaves.filter(l => {
    return l.employeeId === employeeId &&
           l.status === 'approved' &&
           (l.startDate && l.startDate.startsWith(currentYear));
  });

  const usedDays = approvedLeaves.reduce((sum, l) => sum + (Number(l.daysCount) || 0), 0);
  const quota = Number(company.yearlyLeaveQuota) || 20;
  const remaining = Math.max(0, quota - usedDays);

  return {
    quota,
    usedDays,
    remaining
  };
}

// ----------------- UI Feedback & Toast System -----------------

function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }, 3500);
}

// Escape HTML for safe rendering
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ----------------- Theme Management (Bonus) -----------------

function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_KEYS.THEME, next);
  return next;
}

// ----------------- Demo Seeder & Reset Data -----------------

function resetAllData() {
  localStorage.removeItem(STORAGE_KEYS.COMPANY);
  localStorage.removeItem(STORAGE_KEYS.USERS);
  localStorage.removeItem(STORAGE_KEYS.ATTENDANCE);
  localStorage.removeItem(STORAGE_KEYS.LEAVES);
  localStorage.removeItem(STORAGE_KEYS.SESSION);
  localStorage.removeItem(STORAGE_KEYS.ANNOUNCEMENTS);
}

// Seed sample data for testing/demo minute evaluation (accessible via settings or login)
function seedSampleDemoData() {
  const company = {
    name: 'Saylani Tech Ventures',
    officeStartTime: '09:00',
    graceMinutes: 15,
    yearlyLeaveQuota: 20,
    workingDays: [1, 2, 3, 4, 5] // Mon-Fri
  };
  saveCompany(company);

  const users = [
    {
      id: 'USR_ADMIN_01',
      name: 'Sarah Connor',
      email: 'admin@hcm.local',
      password: 'admin',
      role: 'admin',
      department: 'Human Resources',
      designation: 'VP of People',
      salary: 12000,
      phone: '+1 555-0100',
      joiningDate: '2024-01-15'
    },
    {
      id: 'EMP_101',
      name: 'Bilal Ahmed',
      email: 'bilal@hcm.local',
      password: 'password',
      role: 'employee',
      department: 'Engineering',
      designation: 'Senior Frontend Engineer',
      salary: 8500,
      phone: '+1 555-0121',
      joiningDate: '2024-03-01'
    },
    {
      id: 'EMP_102',
      name: 'Ayesha Khan',
      email: 'ayesha@hcm.local',
      password: 'password',
      role: 'employee',
      department: 'Marketing',
      designation: 'Brand Strategist',
      salary: 6800,
      phone: '+1 555-0134',
      joiningDate: '2024-05-10'
    },
    {
      id: 'EMP_103',
      name: 'Hamza Farooq',
      email: 'hamza@hcm.local',
      password: 'password',
      role: 'employee',
      department: 'Engineering',
      designation: 'DevOps Specialist',
      salary: 9200,
      phone: '+1 555-0155',
      joiningDate: '2024-02-15'
    },
    {
      id: 'EMP_104',
      name: 'Zainab Tariq',
      email: 'zainab@hcm.local',
      password: 'password',
      role: 'employee',
      department: 'Operations',
      designation: 'HR Coordinator',
      salary: 5400,
      phone: '+1 555-0188',
      joiningDate: '2024-08-01'
    }
  ];
  saveUsers(users);

  const todayStr = getTodayDateString();

  // Create attendance records
  const attendance = [
    {
      id: 'att_1',
      employeeId: 'EMP_101',
      date: todayStr,
      checkInTime: '08:52:10',
      checkOutTime: null,
      durationMinutes: null,
      status: 'present',
      method: 'standard'
    },
    {
      id: 'att_2',
      employeeId: 'EMP_102',
      date: todayStr,
      checkInTime: '09:28:44', // Late (> 09:15)
      checkOutTime: null,
      durationMinutes: null,
      status: 'late',
      method: 'standard'
    },
    {
      id: 'att_3',
      employeeId: 'EMP_104',
      date: todayStr,
      checkInTime: '09:05:00',
      checkOutTime: '13:30:00', // 4.5 hours (< 5 hours = half-day)
      durationMinutes: 265,
      status: 'half-day',
      method: 'standard'
    }
  ];
  saveAttendance(attendance);

  // Create leaves
  const leaves = [
    {
      id: 'leave_1',
      employeeId: 'EMP_103',
      leaveType: 'annual',
      startDate: todayStr,
      endDate: todayStr,
      daysCount: 1,
      reason: 'Family event and personal appointment',
      status: 'approved',
      adminComment: 'Approved. Enjoy the day off.',
      createdAt: '2026-10-24T08:00:00Z'
    },
    {
      id: 'leave_2',
      employeeId: 'EMP_101',
      leaveType: 'sick',
      startDate: '2026-10-28',
      endDate: '2026-10-29',
      daysCount: 2,
      reason: 'Doctor scheduled medical checkup and recovery',
      status: 'pending',
      adminComment: '',
      createdAt: '2026-10-24T09:30:00Z'
    }
  ];
  saveLeaves(leaves);

  const announcements = [
    {
      id: 'ann_1',
      title: 'Saylani Hackathon 2026 Presentation',
      message: 'All teams please ensure Q3 sprint deliverables and attendance submissions are wrapped by Friday 5 PM.',
      authorName: 'Sarah Connor (Admin)',
      createdAt: todayStr
    },
    {
      id: 'ann_2',
      title: 'Office Schedule & Grace Period Reminder',
      message: 'Office hours commence at 09:00 AM with a 15-minute grace period. Check in using the web portal on arrival.',
      authorName: 'Sarah Connor (Admin)',
      createdAt: todayStr
    }
  ];
  saveAnnouncements(announcements);

  return true;
}

// Auto init theme on load
initTheme();
