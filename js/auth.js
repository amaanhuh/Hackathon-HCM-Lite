/**
 * HCM Lite — Authentication, Session Guard & Shared Shell Navigation
 */

// Guard page access based on session and roles
function requireAuth(allowedRoles = ['admin', 'employee']) {
  const session = getSession();

  if (!session || !session.userId) {
    // If not on index.html, redirect
    if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
      window.location.href = 'index.html';
    }
    return null;
  }

  // Check role authorization
  if (!allowedRoles.includes(session.role)) {
    if (session.role === 'employee') {
      window.location.href = 'employee.html';
    } else {
      window.location.href = 'admin.html';
    }
    return null;
  }

  return session;
}

// Perform login
function login(email, password) {
  if (!email || !password) {
    return { success: false, message: 'Email and password are required.' };
  }

  const user = getUserByEmail(email);
  if (!user) {
    return { success: false, message: 'Invalid credentials. User not found.' };
  }

  if (user.password !== password) {
    return { success: false, message: 'Invalid email or password.' };
  }

  // Save clean session
  saveSession({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department || ''
  });

  return { success: true, user };
}

// Perform logout
function logout() {
  clearSession();
  window.location.href = 'index.html';
}

// Render dynamic application sidebar and topbar
function renderNavigation(activePage) {
  const session = getSession();
  if (!session) return;

  const company = getCompany() || { name: 'HCM Lite' };
  const isAdmin = session.role === 'admin';

  // Sidebar container
  const sidebarMount = document.getElementById('sidebarMount');
  if (sidebarMount) {
    const initials = session.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    let navLinksHtml = '';

    if (isAdmin) {
      navLinksHtml = `
        <div class="nav-section-title">Operations</div>
        <a href="admin.html" class="nav-item ${activePage === 'admin' ? 'active' : ''}">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
          <span>Dashboard</span>
        </a>
        <a href="employees.html" class="nav-item ${activePage === 'employees' ? 'active' : ''}">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span>Employees</span>
        </a>
        <a href="leaves.html" class="nav-item ${activePage === 'leaves' ? 'active' : ''}">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
          <span>Leaves & Approvals</span>
        </a>
        <a href="payslip.html" class="nav-item ${activePage === 'payslip' ? 'active' : ''}">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
          <span>Monthly Payslips</span>
        </a>
        <div class="nav-section-title">System</div>
        <a href="settings.html" class="nav-item ${activePage === 'settings' ? 'active' : ''}">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
          <span>Company Settings</span>
        </a>
      `;
    } else {
      navLinksHtml = `
        <div class="nav-section-title">Employee Portal</div>
        <a href="employee.html" class="nav-item ${activePage === 'employee' ? 'active' : ''}">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
          <span>My Attendance & Leaves</span>
        </a>
        <a href="payslip.html" class="nav-item ${activePage === 'payslip' ? 'active' : ''}">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
          <span>My Payslip</span>
        </a>
      `;
    }

    sidebarMount.className = 'sidebar';
    sidebarMount.innerHTML = `
      <div class="sidebar-header">
        <a href="${isAdmin ? 'admin.html' : 'employee.html'}" class="brand-logo">
          <div class="brand-badge">H</div>
          <span class="brand-text">HCM <span>Lite</span></span>
        </a>
      </div>
      <div class="sidebar-nav">
        ${navLinksHtml}
      </div>
      <div class="sidebar-footer">
        <div class="user-profile-widget">
          <div class="avatar">${initials}</div>
          <div class="user-meta">
            <div class="user-meta-name">${escapeHtml(session.name)}</div>
            <div class="user-meta-role">${escapeHtml(session.role)} · ${escapeHtml(session.department || company.name)}</div>
          </div>
        </div>
        <div class="sidebar-actions">
          <button id="themeToggleBtn" class="btn-icon" title="Toggle dark/light mode">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
          </button>
          <button id="logoutBtn" class="btn btn-secondary btn-sm" style="flex: 1; margin-left: 8px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    `;
  }

  // Topbar container
  const topbarMount = document.getElementById('topbarMount');
  if (topbarMount) {
    topbarMount.className = 'topbar';
    topbarMount.innerHTML = `
      <div class="topbar-left">
        <button id="menuToggleBtn" class="menu-toggle" aria-label="Toggle navigation menu">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
        </button>
        <div class="breadcrumb">
          <span>${escapeHtml(company.name)}</span>
          <span class="breadcrumb-sep">/</span>
          <span class="breadcrumb-active" id="topbarBreadcrumb">${pageTitleMap[activePage] || 'Portal'}</span>
        </div>
      </div>
      <div class="topbar-right">
        <div class="live-clock" id="liveClockDisplay">
          <span class="clock-dot"></span>
          <span id="clockText">--:--:--</span>
        </div>
      </div>
    `;
  }

  // Wire event handlers
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);

  const themeToggleBtn = document.getElementById('themeToggleBtn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      toggleTheme();
    });
  }

  const menuToggleBtn = document.getElementById('menuToggleBtn');
  if (menuToggleBtn && sidebarMount) {
    menuToggleBtn.addEventListener('click', () => {
      sidebarMount.classList.toggle('mobile-open');
    });
  }

  // Start live clock
  updateClock();
  setInterval(updateClock, 1000);

  // Initialize instant zero-lag page navigation
  setupInstantNavigation();
}

const pageTitleMap = {
  admin: 'Admin Overview',
  employees: 'Employee Directory',
  leaves: 'Leave Management',
  settings: 'Company Configuration',
  employee: 'My Dashboard',
  payslip: 'Monthly Salary Slip'
};

function updateClock() {
  const clockText = document.getElementById('clockText');
  if (!clockText) return;
  const now = new Date();
  clockText.textContent = now.toLocaleTimeString('en-US', { hour12: false });
}

// ----------------- Instant Client-Side Navigation Engine -----------------
const pageContentCache = {};
let instantNavInitialized = false;

async function preloadPage(url) {
  const cleanUrl = url.split('?')[0];
  if (pageContentCache[cleanUrl]) return pageContentCache[cleanUrl];
  try {
    const res = await fetch(cleanUrl);
    if (res.ok) {
      const html = await res.text();
      pageContentCache[cleanUrl] = html;
      return html;
    }
  } catch (_) {}
  return null;
}

function startBackgroundPreload() {
  const session = getSession();
  if (!session) return;
  const pages = session.role === 'admin'
    ? ['admin.html', 'employees.html', 'leaves.html', 'settings.html', 'payslip.html']
    : ['employee.html', 'payslip.html'];

  setTimeout(() => {
    pages.forEach(p => preloadPage(p));
  }, 100);
}

async function navigateTo(targetUrl) {
  let cleanTarget = targetUrl.split('?')[0];
  if (!cleanTarget.includes('.') && cleanTarget !== '') {
    cleanTarget += '.html';
  }
  if (cleanTarget === 'index.html' || window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
    window.location.href = targetUrl;
    return;
  }

  try {
    let html = pageContentCache[cleanTarget];
    if (!html) {
      const res = await fetch(cleanTarget);
      if (!res.ok) throw new Error('Fetch failed');
      html = await res.text();
      pageContentCache[cleanTarget] = html;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const newContent = doc.querySelector('.content-area');
    const curContent = document.querySelector('.content-area');

    if (!newContent || !curContent) {
      window.location.href = targetUrl;
      return;
    }

    // Swap main content area instantly
    curContent.innerHTML = newContent.innerHTML;

    // Sync any modals from target document
    doc.querySelectorAll('.modal-backdrop').forEach(modal => {
      const existing = document.getElementById(modal.id);
      if (existing) {
        existing.innerHTML = modal.innerHTML;
      } else {
        document.body.appendChild(modal.cloneNode(true));
      }
    });

    // Update document title and URL
    document.title = doc.title || document.title;
    window.history.pushState({}, doc.title, targetUrl);

    const pageId = cleanTarget.replace('.html', '');
    renderNavigation(pageId);

    // Call page-specific initializer
    if (pageId === 'admin' && typeof initAdminDashboard === 'function') {
      initAdminDashboard();
    } else if (pageId === 'employees' && typeof initEmployeesPage === 'function') {
      initEmployeesPage();
    } else if (pageId === 'leaves' && typeof initLeavesPage === 'function') {
      initLeavesPage();
    } else if (pageId === 'settings' && typeof initSettingsPage === 'function') {
      initSettingsPage();
    } else if (pageId === 'employee' && typeof initEmployeeDashboard === 'function') {
      initEmployeeDashboard();
    } else if (pageId === 'payslip' && typeof initPayslipPage === 'function') {
      initPayslipPage();
    }

    window.scrollTo({ top: 0, behavior: 'instant' });

    const sidebar = document.getElementById('sidebarMount');
    if (sidebar) sidebar.classList.remove('mobile-open');

  } catch (err) {
    console.warn('Instant navigation fallback:', err);
    window.location.href = targetUrl;
  }
}

function setupInstantNavigation() {
  if (instantNavInitialized) return;
  instantNavInitialized = true;

  document.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || link.target === '_blank') return;

    if (href.endsWith('.html') || href.includes('.html?')) {
      e.preventDefault();
      navigateTo(href);
    }
  });

  window.addEventListener('popstate', () => {
    let currentFile = window.location.pathname.split('/').pop() || 'index.html';
    if (!currentFile.includes('.')) currentFile += '.html';
    const fullTarget = currentFile + window.location.search;
    navigateTo(fullTarget);
  });

  startBackgroundPreload();
}
