/**
 * HCM Lite — Employee Management Module
 */

let currentEmployeesList = [];
let deleteTargetId = null;

function initEmployeesPage() {
  const session = requireAuth(['admin']);
  if (!session) return;
  renderNavigation('employees');

  loadEmployees();
  setupEventListeners();
}

function loadEmployees() {
  const users = getUsers();
  currentEmployeesList = users.filter(u => u.role === 'employee');
  populateDepartmentFilter();
  renderEmployeesTable();
}

function populateDepartmentFilter() {
  const deptSelect = document.getElementById('deptFilter');
  if (!deptSelect) return;

  const currentVal = deptSelect.value;
  const depts = [...new Set(currentEmployeesList.map(e => e.department).filter(Boolean))].sort();

  deptSelect.innerHTML = `<option value="">All Departments</option>` +
    depts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');

  if (currentVal) deptSelect.value = currentVal;
}

function renderEmployeesTable() {
  const searchInput = document.getElementById('employeeSearch');
  const deptSelect = document.getElementById('deptFilter');
  const tbody = document.getElementById('employeesTableBody');
  const countBadge = document.getElementById('employeeCountBadge');
  const emptyState = document.getElementById('employeesEmptyState');
  const tableContainer = document.getElementById('employeesTableContainer');

  const query = (searchInput ? searchInput.value : '').toLowerCase().trim();
  const selectedDept = deptSelect ? deptSelect.value : '';

  let filtered = currentEmployeesList.filter(emp => {
    const matchQuery = !query ||
      emp.name.toLowerCase().includes(query) ||
      emp.email.toLowerCase().includes(query) ||
      emp.id.toLowerCase().includes(query);
    const matchDept = !selectedDept || emp.department === selectedDept;
    return matchQuery && matchDept;
  });

  if (countBadge) {
    countBadge.textContent = `${filtered.length} of ${currentEmployeesList.length} Employees`;
  }

  if (filtered.length === 0) {
    if (tableContainer) tableContainer.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (tableContainer) tableContainer.style.display = 'block';
  if (emptyState) emptyState.style.display = 'none';

  if (!tbody) return;

  tbody.innerHTML = filtered.map(emp => {
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
        <td><code>${escapeHtml(emp.id)}</code></td>
        <td>${escapeHtml(emp.designation || 'Staff')}</td>
        <td>${escapeHtml(emp.department || '-')}</td>
        <td class="numeric font-medium">${formatCurrency(emp.salary)}</td>
        <td>${formatDate(emp.joiningDate)}</td>
        <td>
          <div style="display: flex; gap: 6px; justify-content: flex-end;">
            <a href="payslip.html?empId=${encodeURIComponent(emp.id)}" class="btn btn-secondary btn-sm" title="View Payslip">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" x2="8" y2="13"/><line x1="16" x2="8" y1="17" x2="8" y2="17"/></svg>
              <span>Payslip</span>
            </a>
            <button class="btn btn-secondary btn-sm" onclick="openEditEmployeeModal('${emp.id}')" title="Edit Employee">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
              <span>Edit</span>
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="openDeleteEmployeeModal('${emp.id}')" title="Delete Employee">
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function setupEventListeners() {
  const searchInput = document.getElementById('employeeSearch');
  if (searchInput) searchInput.addEventListener('input', renderEmployeesTable);

  const deptSelect = document.getElementById('deptFilter');
  if (deptSelect) deptSelect.addEventListener('change', renderEmployeesTable);

  // Add Employee Form
  const addForm = document.getElementById('addEmployeeForm');
  if (addForm) {
    addForm.addEventListener('submit', handleAddEmployeeSubmit);
  }

  // Edit Employee Form
  const editForm = document.getElementById('editEmployeeForm');
  if (editForm) {
    editForm.addEventListener('submit', handleEditEmployeeSubmit);
  }

  // Delete Confirm Button
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
  }
}

// Modal controls
function openAddEmployeeModal() {
  const form = document.getElementById('addEmployeeForm');
  if (form) form.reset();
  clearFormErrors('addEmployeeForm');
  const modal = document.getElementById('addEmployeeModal');
  if (modal) modal.classList.add('open');
}

function closeAddEmployeeModal() {
  const modal = document.getElementById('addEmployeeModal');
  if (modal) modal.classList.remove('open');
}

function handleAddEmployeeSubmit(e) {
  e.preventDefault();
  clearFormErrors('addEmployeeForm');

  const name = document.getElementById('addEmpName').value.trim();
  const email = document.getElementById('addEmpEmail').value.trim();
  const department = document.getElementById('addEmpDept').value.trim();
  const designation = document.getElementById('addEmpDesignation').value.trim();
  const salary = parseFloat(document.getElementById('addEmpSalary').value);
  const phone = document.getElementById('addEmpPhone').value.trim();
  const joiningDate = document.getElementById('addEmpJoiningDate').value || getTodayDateString();
  const password = document.getElementById('addEmpPassword').value.trim() || 'password';

  let hasError = false;

  if (!name) {
    showFieldError('addEmpNameError', 'Full name is required.');
    hasError = true;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showFieldError('addEmpEmailError', 'Please enter a valid email address.');
    hasError = true;
  } else if (getUserByEmail(email)) {
    showFieldError('addEmpEmailError', 'This email address is already registered to another user.');
    hasError = true;
  }

  if (!department) {
    showFieldError('addEmpDeptError', 'Department is required.');
    hasError = true;
  }

  if (isNaN(salary) || salary <= 0) {
    showFieldError('addEmpSalaryError', 'Monthly salary must be greater than zero.');
    hasError = true;
  }

  if (hasError) return;

  const users = getUsers();
  const newId = `EMP_${String(users.filter(u => u.role === 'employee').length + 101).padStart(3, '0')}`;

  const newEmployee = {
    id: newId,
    name: name,
    email: email,
    password: password,
    role: 'employee',
    department: department,
    designation: designation || 'Staff',
    salary: salary,
    phone: phone,
    joiningDate: joiningDate
  };

  users.push(newEmployee);
  saveUsers(users);

  closeAddEmployeeModal();
  loadEmployees();
  showToast(`Employee ${name} added successfully with ID ${newId}.`, 'success');
}

// Edit Employee
function openEditEmployeeModal(empId) {
  const emp = getUserById(empId);
  if (!emp) return;

  document.getElementById('editEmpId').value = emp.id;
  document.getElementById('editEmpName').value = emp.name;
  document.getElementById('editEmpEmail').value = emp.email;
  document.getElementById('editEmpDept').value = emp.department || '';
  document.getElementById('editEmpDesignation').value = emp.designation || '';
  document.getElementById('editEmpSalary').value = emp.salary || '';
  document.getElementById('editEmpPhone').value = emp.phone || '';
  document.getElementById('editEmpJoiningDate').value = emp.joiningDate || '';

  clearFormErrors('editEmployeeForm');
  const modal = document.getElementById('editEmployeeModal');
  if (modal) modal.classList.add('open');
}

function closeEditEmployeeModal() {
  const modal = document.getElementById('editEmployeeModal');
  if (modal) modal.classList.remove('open');
}

function handleEditEmployeeSubmit(e) {
  e.preventDefault();
  clearFormErrors('editEmployeeForm');

  const empId = document.getElementById('editEmpId').value;
  const name = document.getElementById('editEmpName').value.trim();
  const email = document.getElementById('editEmpEmail').value.trim();
  const department = document.getElementById('editEmpDept').value.trim();
  const designation = document.getElementById('editEmpDesignation').value.trim();
  const salary = parseFloat(document.getElementById('editEmpSalary').value);
  const phone = document.getElementById('editEmpPhone').value.trim();
  const joiningDate = document.getElementById('editEmpJoiningDate').value;

  let hasError = false;

  if (!name) {
    showFieldError('editEmpNameError', 'Full name is required.');
    hasError = true;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    showFieldError('editEmpEmailError', 'Please enter a valid email address.');
    hasError = true;
  } else {
    const existing = getUserByEmail(email);
    if (existing && existing.id !== empId) {
      showFieldError('editEmpEmailError', 'This email is already in use by another user.');
      hasError = true;
    }
  }

  if (!department) {
    showFieldError('editEmpDeptError', 'Department is required.');
    hasError = true;
  }

  if (isNaN(salary) || salary <= 0) {
    showFieldError('editEmpSalaryError', 'Salary must be greater than zero.');
    hasError = true;
  }

  if (hasError) return;

  const users = getUsers();
  const index = users.findIndex(u => u.id === empId);
  if (index === -1) return;

  users[index].name = name;
  users[index].email = email;
  users[index].department = department;
  users[index].designation = designation;
  users[index].salary = salary;
  users[index].phone = phone;
  users[index].joiningDate = joiningDate;

  saveUsers(users);

  closeEditEmployeeModal();
  loadEmployees();
  showToast(`Employee ${name} updated successfully.`, 'success');
}

// Delete Employee
function openDeleteEmployeeModal(empId) {
  const emp = getUserById(empId);
  if (!emp) return;

  deleteTargetId = empId;
  const targetName = document.getElementById('deleteTargetName');
  if (targetName) targetName.textContent = `${emp.name} (${emp.id})`;

  const modal = document.getElementById('deleteEmployeeModal');
  if (modal) modal.classList.add('open');
}

function closeDeleteEmployeeModal() {
  deleteTargetId = null;
  const modal = document.getElementById('deleteEmployeeModal');
  if (modal) modal.classList.remove('open');
}

function handleConfirmDelete() {
  if (!deleteTargetId) return;

  const users = getUsers();
  const emp = users.find(u => u.id === deleteTargetId);
  const remainingUsers = users.filter(u => u.id !== deleteTargetId);
  saveUsers(remainingUsers);

  // Handle related records consistently: cascade delete or cleanup
  const attendance = getAttendance().filter(a => a.employeeId !== deleteTargetId);
  saveAttendance(attendance);

  const leaves = getLeaves().filter(l => l.employeeId !== deleteTargetId);
  saveLeaves(leaves);

  closeDeleteEmployeeModal();
  loadEmployees();
  showToast(`Employee ${emp ? emp.name : deleteTargetId} and associated records deleted.`, 'info');
}

function showFieldError(errorId, message) {
  const el = document.getElementById(errorId);
  if (el) {
    el.textContent = message;
    el.classList.add('show');
  }
}

function clearFormErrors(formId) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.querySelectorAll('.field-error').forEach(el => {
    el.textContent = '';
    el.classList.remove('show');
  });
}
