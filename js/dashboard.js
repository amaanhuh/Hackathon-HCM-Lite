/**
 * HCM Lite — Admin Dashboard & Live Analytics
 */

let attendanceChartInstance = null;
let activeApprovalId = null;
let activeApprovalAction = null;

function initAdminDashboard() {
  const session = requireAuth(['admin']);
  if (!session) return;
  renderNavigation('admin');

  renderMetrics();
  renderAttendanceOverview();
  renderAttendanceChart();
  renderPendingLeaves();
  renderAnnouncements();
  setupDashboardListeners();

  // Initialize Smart Helper
  new SmartHelper('adminHelperMount', session);
}

function renderMetrics() {
  const users = getUsers().filter(u => u.role === 'employee');
  const attendance = getAttendance();
  const leaves = getLeaves();
  const todayStr = getTodayDateString();

  const totalEmployees = users.length;

  const todayAttendance = attendance.filter(a => a.date === todayStr);
  const presentCount = todayAttendance.length;
  const lateCount = todayAttendance.filter(a => a.status === 'late').length;

  const onLeaveCount = leaves.filter(l => {
    return l.status === 'approved' && l.startDate <= todayStr && l.endDate >= todayStr;
  }).length;

  const pendingLeavesCount = leaves.filter(l => l.status === 'pending').length;

  // Set DOM
  const totalEl = document.getElementById('metricTotalEmployees');
  if (totalEl) totalEl.textContent = totalEmployees;

  const presentEl = document.getElementById('metricPresentToday');
  if (presentEl) presentEl.textContent = presentCount;

  const onLeaveEl = document.getElementById('metricOnLeaveToday');
  if (onLeaveEl) onLeaveEl.textContent = onLeaveCount;

  const lateEl = document.getElementById('metricLateToday');
  if (lateEl) lateEl.textContent = lateCount;

  const pendingEl = document.getElementById('metricPendingLeaves');
  if (pendingEl) pendingEl.textContent = pendingLeavesCount;
}

function renderAttendanceOverview() {
  const tbody = document.getElementById('todayAttendanceTableBody');
  const emptyBox = document.getElementById('todayAttendanceEmpty');
  const table = document.getElementById('todayAttendanceTable');

  const users = getUsers().filter(u => u.role === 'employee');
  const attendance = getAttendance();
  const todayStr = getTodayDateString();
  const todayRecords = attendance.filter(a => a.date === todayStr);

  if (users.length === 0) {
    if (table) table.style.display = 'none';
    if (emptyBox) {
      emptyBox.style.display = 'block';
      emptyBox.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">No employees registered yet</div>
          <div class="empty-desc">Add employees in the employee directory to begin tracking attendance.</div>
          <a href="employees.html" class="btn btn-primary btn-sm" style="margin-top: 12px;">+ Add Employee</a>
        </div>
      `;
    }
    return;
  }

  if (todayRecords.length === 0) {
    if (table) table.style.display = 'none';
    if (emptyBox) {
      emptyBox.style.display = 'block';
      emptyBox.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">No check-ins recorded today</div>
          <div class="empty-desc">Attendance will appear here as employees check in for ${formatDate(todayStr)}.</div>
        </div>
      `;
    }
    return;
  }

  if (table) table.style.display = 'table';
  if (emptyBox) emptyBox.style.display = 'none';

  if (!tbody) return;

  tbody.innerHTML = todayRecords.map(rec => {
    const emp = users.find(u => u.id === rec.employeeId) || { name: 'Unknown', department: '-', email: '' };
    const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    let statusHtml = '';
    if (rec.status === 'present') {
      statusHtml = `<span class="status-indicator status-present"><span class="status-dot"></span>Present (On-time)</span>`;
    } else if (rec.status === 'late') {
      statusHtml = `<span class="status-indicator status-late"><span class="status-dot"></span>Late Arrival</span>`;
    } else if (rec.status === 'half-day') {
      statusHtml = `<span class="status-indicator status-half-day"><span class="status-dot"></span>Half Day (&lt;5h)</span>`;
    } else {
      statusHtml = `<span class="status-indicator">${rec.status}</span>`;
    }

    if (rec.photoUrl) {
      statusHtml += ` <button type="button" class="photo-badge" onclick="showAttendancePhoto('${rec.id}')" title="View laptop webcam snapshot"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>Photo</button>`;
    }

    const durationText = rec.checkOutTime ? formatDuration(rec.durationMinutes) : '<span style="color: var(--text-muted);">Ongoing shift</span>';

    return `
      <tr>
        <td>
          <div class="identity-cell">
            <div class="avatar">${initials}</div>
            <div>
              <div class="identity-name">${escapeHtml(emp.name)}</div>
              <div class="identity-sub">${escapeHtml(emp.department)}</div>
            </div>
          </div>
        </td>
        <td><code>${rec.checkInTime || '-'}</code></td>
        <td><code>${rec.checkOutTime || '-'}</code></td>
        <td>${durationText}</td>
        <td>${statusHtml}</td>
      </tr>
    `;
  }).join('');
}

function renderAttendanceChart() {
  const chartCanvas = document.getElementById('attendanceBreakdownChart');
  if (!chartCanvas) return;

  const users = getUsers().filter(u => u.role === 'employee');
  const attendance = getAttendance();
  const leaves = getLeaves();
  const todayStr = getTodayDateString();

  const totalEmployees = users.length;
  const todayRecords = attendance.filter(a => a.date === todayStr);

  const presentCount = todayRecords.filter(a => a.status === 'present').length;
  const lateCount = todayRecords.filter(a => a.status === 'late').length;
  const halfDayCount = todayRecords.filter(a => a.status === 'half-day').length;

  const onLeaveCount = leaves.filter(l => {
    return l.status === 'approved' && l.startDate <= todayStr && l.endDate >= todayStr;
  }).length;

  const notCheckedIn = Math.max(0, totalEmployees - (todayRecords.length + onLeaveCount));

  if (typeof Chart === 'undefined') {
    return;
  }

  if (attendanceChartInstance) {
    attendanceChartInstance.destroy();
  }

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#ECEFEA' : '#202824';

  attendanceChartInstance = new Chart(chartCanvas, {
    type: 'doughnut',
    data: {
      labels: ['Present (On-time)', 'Late Arrival', 'Half Day', 'On Approved Leave', 'Not Checked In'],
      datasets: [{
        data: totalEmployees === 0 ? [1] : [presentCount, lateCount, halfDayCount, onLeaveCount, notCheckedIn],
        backgroundColor: totalEmployees === 0 ? ['#E2E5DF'] : ['#287A53', '#A66A18', '#C07020', '#3E6B9A', '#D5DAD3'],
        borderWidth: 2,
        borderColor: isDark ? '#1B201D' : '#FFFFFF'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            font: { size: 11, family: "'Inter', sans-serif" },
            color: textColor
          }
        },
        tooltip: {
          enabled: totalEmployees > 0
        }
      },
      cutout: '68%'
    }
  });
}

function renderPendingLeaves() {
  const tbody = document.getElementById('pendingLeavesTableBody');
  const emptyBox = document.getElementById('pendingLeavesEmpty');
  const table = document.getElementById('pendingLeavesTable');

  const leaves = getLeaves();
  const users = getUsers();
  const pending = leaves.filter(l => l.status === 'pending');

  if (pending.length === 0) {
    if (table) table.style.display = 'none';
    if (emptyBox) {
      emptyBox.style.display = 'block';
      emptyBox.innerHTML = `
        <div class="empty-state">
          <div class="empty-title">All caught up</div>
          <div class="empty-desc">No leave requests currently pending administrator approval.</div>
        </div>
      `;
    }
    return;
  }

  if (table) table.style.display = 'table';
  if (emptyBox) emptyBox.style.display = 'none';

  if (!tbody) return;

  tbody.innerHTML = pending.map(req => {
    const emp = users.find(u => u.id === req.employeeId) || { name: 'Unknown', department: '-' };
    return `
      <tr>
        <td>
          <div class="identity-name">${escapeHtml(emp.name)}</div>
          <div class="identity-sub">${escapeHtml(emp.department)}</div>
        </td>
        <td><span style="font-weight: 500; text-transform: capitalize;">${escapeHtml(req.leaveType)}</span></td>
        <td>${formatDate(req.startDate)} to ${formatDate(req.endDate)} (${req.daysCount} d)</td>
        <td><span style="color: var(--text-secondary);">${escapeHtml(req.reason)}</span></td>
        <td>
          <div style="display: flex; gap: 6px; justify-content: flex-end;">
            <button class="btn btn-primary btn-sm" onclick="openApprovalModal('${req.id}', 'approve')">Approve</button>
            <button class="btn btn-outline-danger btn-sm" onclick="openApprovalModal('${req.id}', 'reject')">Reject</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderAnnouncements() {
  const container = document.getElementById('announcementsList');
  if (!container) return;

  const list = getAnnouncements();
  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 20px;">
        <div class="empty-desc">No announcements posted yet. Click "+ New Announcement" to post an update for all employees.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(item => `
    <div style="padding: 14px 16px; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
      <div>
        <div style="font-weight: 600; font-size: 13.5px; color: var(--text-primary); margin-bottom: 4px;">${escapeHtml(item.title)}</div>
        <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.45;">${escapeHtml(item.message)}</div>
        <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 6px;">Posted by ${escapeHtml(item.authorName)} · ${formatDate(item.createdAt)}</div>
      </div>
      <button class="btn-icon" onclick="deleteAnnouncement('${item.id}')" title="Delete announcement" style="flex-shrink: 0;">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/></svg>
      </button>
    </div>
  `).join('');
}

function setupDashboardListeners() {
  // Export CSV button
  const exportBtn = document.getElementById('exportCsvBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportAttendanceCSV);
  }

  // New Announcement Modal & Form
  const newAnnBtn = document.getElementById('newAnnouncementBtn');
  if (newAnnBtn) {
    newAnnBtn.addEventListener('click', () => {
      document.getElementById('announcementForm').reset();
      document.getElementById('announcementModal').classList.add('open');
    });
  }

  const annForm = document.getElementById('announcementForm');
  if (annForm) {
    annForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('annTitle').value.trim();
      const message = document.getElementById('annMessage').value.trim();
      if (!title || !message) {
        showToast('Please provide both title and announcement message.', 'error');
        return;
      }

      const session = getSession();
      const announcements = getAnnouncements();
      announcements.unshift({
        id: generateId('ann'),
        title: title,
        message: message,
        authorName: session.name + ' (Admin)',
        createdAt: getTodayDateString()
      });
      saveAnnouncements(announcements);

      document.getElementById('announcementModal').classList.remove('open');
      renderAnnouncements();
      showToast('Announcement published successfully.', 'success');
    });
  }

  // Leave Approval Action Modal
  const confirmActionBtn = document.getElementById('confirmApprovalActionBtn');
  if (confirmActionBtn) {
    confirmActionBtn.addEventListener('click', () => {
      if (!activeApprovalId || !activeApprovalAction) return;
      const comment = document.getElementById('approvalCommentInput').value;

      let result;
      if (activeApprovalAction === 'approve') {
        result = approveLeaveRequest(activeApprovalId, comment);
      } else {
        result = rejectLeaveRequest(activeApprovalId, comment);
      }

      if (result.success) {
        showToast(result.message, activeApprovalAction === 'approve' ? 'success' : 'info');
        closeApprovalModal();
        renderMetrics();
        renderPendingLeaves();
        renderAttendanceChart();
      } else {
        showToast(result.message, 'error');
      }
    });
  }
}

function openApprovalModal(requestId, action) {
  activeApprovalId = requestId;
  activeApprovalAction = action;

  const leaves = getLeaves();
  const req = leaves.find(l => l.id === requestId);
  const users = getUsers();
  const emp = req ? users.find(u => u.id === req.employeeId) : null;

  const modalTitle = document.getElementById('approvalModalTitle');
  const modalDesc = document.getElementById('approvalModalDesc');
  const commentInput = document.getElementById('approvalCommentInput');
  const actionBtn = document.getElementById('confirmApprovalActionBtn');

  if (modalTitle) modalTitle.textContent = action === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request';
  if (modalDesc && req && emp) {
    modalDesc.innerHTML = `Confirm ${action} for <strong>${escapeHtml(emp.name)}</strong> (${req.daysCount} working days, ${req.leaveType} leave from ${formatDate(req.startDate)} to ${formatDate(req.endDate)}).`;
  }
  if (commentInput) commentInput.value = action === 'approve' ? 'Approved by administration.' : 'Cannot be approved due to project requirements.';
  if (actionBtn) {
    actionBtn.className = action === 'approve' ? 'btn btn-primary' : 'btn btn-danger';
    actionBtn.textContent = action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection';
  }

  const modal = document.getElementById('approvalModal');
  if (modal) modal.classList.add('open');
}

function closeApprovalModal() {
  activeApprovalId = null;
  activeApprovalAction = null;
  const modal = document.getElementById('approvalModal');
  if (modal) modal.classList.remove('open');
}

function deleteAnnouncement(annId) {
  const list = getAnnouncements().filter(a => a.id !== annId);
  saveAnnouncements(list);
  renderAnnouncements();
  showToast('Announcement removed.', 'info');
}
