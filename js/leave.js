/**
 * HCM Lite — Leave Management Engine
 * Handles quota calculation, working-days exclusion, overlapping checks, and approvals.
 */

// Submit a new leave request
function submitLeaveRequest(employeeId, { leaveType, startDate, endDate, reason }) {
  if (!leaveType || !startDate || !endDate || !reason) {
    return { success: false, message: 'All fields are required.' };
  }

  const company = getCompany() || { yearlyLeaveQuota: 20, workingDays: [1,2,3,4,5] };
  const leaves = getLeaves();

  // Validate start date <= end date
  if (startDate > endDate) {
    return { success: false, message: 'End date cannot be earlier than start date.' };
  }

  // Calculate working days
  const workingDays = calculateWorkingDays(startDate, endDate, company.workingDays);
  if (workingDays === 0) {
    return { success: false, message: 'Selected date range contains 0 working days based on company schedule.' };
  }

  // Prevent overlapping requests for the same employee (pending or approved)
  const hasOverlap = leaves.some(l => {
    if (l.employeeId !== employeeId) return false;
    if (l.status === 'rejected') return false; // Rejected leaves do not conflict

    // Date range overlap check: max(start1, start2) <= min(end1, end2)
    return (startDate <= l.endDate && endDate >= l.startDate);
  });

  if (hasOverlap) {
    return { success: false, message: 'You already have an active (pending or approved) leave request during this date range.' };
  }

  // Check quota if not unpaid leave
  if (leaveType !== 'unpaid') {
    const stats = getEmployeeLeaveStats(employeeId);
    if (workingDays > stats.remaining) {
      return {
        success: false,
        message: `Insufficient leave quota. You requested ${workingDays} working days, but only have ${stats.remaining} days remaining.`
      };
    }
  }

  const newRequest = {
    id: generateId('leave'),
    employeeId: employeeId,
    leaveType: leaveType,
    startDate: startDate,
    endDate: endDate,
    daysCount: workingDays,
    reason: reason.trim(),
    status: 'pending',
    adminComment: '',
    createdAt: new Date().toISOString()
  };

  leaves.unshift(newRequest);
  saveLeaves(leaves);

  return {
    success: true,
    message: `Leave request for ${workingDays} working day(s) submitted successfully.`,
    request: newRequest
  };
}

// Approve a leave request (Admin only)
function approveLeaveRequest(requestId, adminComment = '') {
  const leaves = getLeaves();
  const index = leaves.findIndex(l => l.id === requestId);
  if (index === -1) {
    return { success: false, message: 'Leave request not found.' };
  }

  const req = leaves[index];
  if (req.status !== 'pending') {
    return { success: false, message: `Request is already ${req.status}.` };
  }

  // Double check remaining quota at time of approval
  if (req.leaveType !== 'unpaid') {
    const stats = getEmployeeLeaveStats(req.employeeId);
    if (req.daysCount > stats.remaining) {
      return {
        success: false,
        message: `Cannot approve: Employee only has ${stats.remaining} days remaining (request requires ${req.daysCount} days).`
      };
    }
  }

  req.status = 'approved';
  req.adminComment = (adminComment || '').trim();
  req.decidedAt = new Date().toISOString();

  leaves[index] = req;
  saveLeaves(leaves);

  return { success: true, message: 'Leave request approved successfully.', request: req };
}

// Reject a leave request (Admin only)
function rejectLeaveRequest(requestId, adminComment = '') {
  const leaves = getLeaves();
  const index = leaves.findIndex(l => l.id === requestId);
  if (index === -1) {
    return { success: false, message: 'Leave request not found.' };
  }

  const req = leaves[index];
  if (req.status !== 'pending') {
    return { success: false, message: `Request is already ${req.status}.` };
  }

  req.status = 'rejected';
  req.adminComment = (adminComment || 'Rejected by administrator').trim();
  req.decidedAt = new Date().toISOString();

  leaves[index] = req;
  saveLeaves(leaves);

  return { success: true, message: 'Leave request rejected.', request: req };
}

// ----------------- Leave Page UI Management -----------------
let activeLeaveId = null;
let activeAction = null;

function initLeavesPage() {
  const session = requireAuth(['admin']);
  if (!session) return;
  renderNavigation('leaves');

  renderLeaves();
  renderBalances();

  const search = document.getElementById('leaveSearch');
  if (search) {
    search.oninput = renderLeaves;
  }

  const statusFilter = document.getElementById('leaveStatusFilter');
  if (statusFilter) {
    statusFilter.onchange = renderLeaves;
  }

  const typeFilter = document.getElementById('leaveTypeFilter');
  if (typeFilter) {
    typeFilter.onchange = renderLeaves;
  }

  const confirmBtn = document.getElementById('confirmReviewBtn');
  if (confirmBtn) {
    confirmBtn.onclick = handleConfirmReview;
  }
}

function renderLeaves() {
  const searchEl = document.getElementById('leaveSearch');
  const statusFilterEl = document.getElementById('leaveStatusFilter');
  const typeFilterEl = document.getElementById('leaveTypeFilter');

  const search = (searchEl ? searchEl.value : '').toLowerCase().trim();
  const statusFilter = statusFilterEl ? statusFilterEl.value : '';
  const typeFilter = typeFilterEl ? typeFilterEl.value : '';

  const leaves = getLeaves();
  const users = getUsers();
  const tbody = document.getElementById('leavesTableBody');
  const emptyState = document.getElementById('leavesEmptyState');
  const tableContainer = document.getElementById('leavesTableContainer');
  const countBadge = document.getElementById('leaveCountBadge');

  const filtered = leaves.filter(l => {
    const emp = users.find(u => u.id === l.employeeId) || { name: '', department: '' };
    const matchSearch = !search ||
      emp.name.toLowerCase().includes(search) ||
      (l.reason && l.reason.toLowerCase().includes(search));
    const matchStatus = !statusFilter || l.status === statusFilter;
    const matchType = !typeFilter || l.leaveType === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  if (countBadge) {
    countBadge.textContent = `${filtered.length} of ${leaves.length} Requests`;
  }

  if (filtered.length === 0) {
    if (tableContainer) tableContainer.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (tableContainer) tableContainer.style.display = 'block';
  if (emptyState) emptyState.style.display = 'none';

  if (!tbody) return;

  tbody.innerHTML = filtered.map(req => {
    const emp = users.find(u => u.id === req.employeeId) || { name: 'Unknown', department: '-' };
    const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    let statusClass = `status-${req.status}`;
    let statusLabel = req.status.charAt(0).toUpperCase() + req.status.slice(1);
    const isPending = req.status === 'pending';

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
        <td><span style="font-weight: 500; text-transform: capitalize;">${escapeHtml(req.leaveType)}</span></td>
        <td>${formatDate(req.startDate)} to ${formatDate(req.endDate)}</td>
        <td style="font-weight: 600;">${req.daysCount} working days</td>
        <td><span style="color: var(--text-secondary);">${escapeHtml(req.reason)}</span></td>
        <td>
          <span class="status-indicator ${statusClass}">
            <span class="status-dot"></span>
            <span>${statusLabel}</span>
          </span>
        </td>
        <td><small style="color: var(--text-muted);">${escapeHtml(req.adminComment || '-')}</small></td>
        <td>
          <div style="display: flex; gap: 6px; justify-content: flex-end;">
            ${isPending ? `
              <button type="button" class="btn btn-primary btn-sm" onclick="openReviewModal('${req.id}', 'approve')">Approve</button>
              <button type="button" class="btn btn-outline-danger btn-sm" onclick="openReviewModal('${req.id}', 'reject')">Reject</button>
            ` : `
              <span style="font-size: 11.5px; color: var(--text-muted);">Decided</span>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderBalances() {
  const tbody = document.getElementById('balancesTableBody');
  if (!tbody) return;

  const users = getUsers().filter(u => u.role === 'employee');
  const company = getCompany() || { yearlyLeaveQuota: 20 };

  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No employees registered in the company.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(emp => {
    const stats = getEmployeeLeaveStats(emp.id);
    const initials = emp.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    return `
      <tr>
        <td>
          <div class="identity-cell">
            <div class="avatar">${initials}</div>
            <div>
              <div class="identity-name">${escapeHtml(emp.name)}</div>
              <div class="identity-sub">${escapeHtml(emp.email)}</div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(emp.department || '-')}</td>
        <td class="numeric">${stats.quota} days</td>
        <td class="numeric font-medium" style="color: var(--warning);">${stats.usedDays} days</td>
        <td class="numeric font-medium" style="color: var(--success); font-weight: 700;">${stats.remaining} days</td>
      </tr>
    `;
  }).join('');
}

function openReviewModal(requestId, action) {
  activeLeaveId = requestId;
  activeAction = action;

  const leaves = getLeaves();
  const req = leaves.find(l => l.id === requestId);
  const users = getUsers();
  const emp = req ? users.find(u => u.id === req.employeeId) : null;

  const titleEl = document.getElementById('reviewModalTitle');
  const detailsEl = document.getElementById('reviewModalDetails');
  const commentEl = document.getElementById('reviewComment');
  const btn = document.getElementById('confirmReviewBtn');

  if (titleEl) titleEl.textContent = action === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request';
  if (detailsEl && req) {
    detailsEl.innerHTML = `
      Employee: <strong>${escapeHtml(emp ? emp.name : 'Unknown')}</strong><br>
      Dates: <strong>${formatDate(req.startDate)}</strong> to <strong>${formatDate(req.endDate)}</strong> (${req.daysCount} working days)<br>
      Type: <strong>${req.leaveType.toUpperCase()}</strong> &middot; Reason: <em>"${escapeHtml(req.reason)}"</em>
    `;
  }

  if (commentEl) commentEl.value = action === 'approve' ? 'Approved by administration.' : 'Declined due to operational priorities.';

  if (btn) {
    btn.className = action === 'approve' ? 'btn btn-primary' : 'btn btn-danger';
    btn.textContent = action === 'approve' ? 'Approve Request' : 'Reject Request';
  }

  const modal = document.getElementById('leaveReviewModal');
  if (modal) modal.classList.add('open');
}

function closeLeaveReviewModal() {
  activeLeaveId = null;
  activeAction = null;
  const modal = document.getElementById('leaveReviewModal');
  if (modal) modal.classList.remove('open');
}

function handleConfirmReview() {
  if (!activeLeaveId || !activeAction) return;

  const commentEl = document.getElementById('reviewComment');
  const comment = commentEl ? commentEl.value : '';
  let res;
  if (activeAction === 'approve') {
    res = approveLeaveRequest(activeLeaveId, comment);
  } else {
    res = rejectLeaveRequest(activeLeaveId, comment);
  }

  if (res.success) {
    showToast(res.message, activeAction === 'approve' ? 'success' : 'info');
    closeLeaveReviewModal();
    renderLeaves();
    renderBalances();
  } else {
    showToast(res.message, 'error');
  }
}

// Window bindings for instant router & onclick handlers
window.initLeavesPage = initLeavesPage;
window.renderLeaves = renderLeaves;
window.renderBalances = renderBalances;
window.openReviewModal = openReviewModal;
window.closeLeaveReviewModal = closeLeaveReviewModal;
window.handleConfirmReview = handleConfirmReview;
window.submitLeaveRequest = submitLeaveRequest;
window.approveLeaveRequest = approveLeaveRequest;
window.rejectLeaveRequest = rejectLeaveRequest;

