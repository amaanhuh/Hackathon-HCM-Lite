/**
 * HCM Lite — Monthly Payslip Generation & Calculations
 * Strict Beginner Track formulas:
 * - Per-day salary = monthly salary ÷ working days in the month
 * - Attendance deduction = per-day salary × (absent days + 0.5 × half days)
 * - Net salary = monthly salary − deduction
 */

function initPayslipPage() {
  const session = requireAuth(['admin', 'employee']);
  if (!session) return;
  renderNavigation('payslip');

  const isAdmin = session.role === 'admin';
  const urlParams = new URLSearchParams(window.location.search);
  let requestedEmpId = urlParams.get('empId');

  // Strict role security: Employees cannot view other employees' payslips!
  if (!isAdmin) {
    requestedEmpId = session.userId;
  }

  // Populate Employee Selector for Admin
  const empSelectorWrap = document.getElementById('adminEmpSelectorWrap');
  const empSelect = document.getElementById('payslipEmployeeSelect');
  const monthSelect = document.getElementById('payslipMonthSelect');

  if (isAdmin && empSelectorWrap && empSelect) {
    empSelectorWrap.style.display = 'block';
    const users = getUsers().filter(u => u.role === 'employee');
    empSelect.innerHTML = users.map(u => `<option value="${u.id}">${escapeHtml(u.name)} (${u.id} - ${u.department})</option>`).join('');

    if (requestedEmpId && users.some(u => u.id === requestedEmpId)) {
      empSelect.value = requestedEmpId;
    } else if (users.length > 0) {
      requestedEmpId = users[0].id;
      empSelect.value = requestedEmpId;
    }

    empSelect.addEventListener('change', () => {
      calculateAndRenderPayslip(empSelect.value, monthSelect.value);
    });
  } else if (empSelectorWrap) {
    empSelectorWrap.style.display = 'none';
  }

  // Populate Month Selector (current month + past 3 months)
  populateMonthSelector(monthSelect);
  monthSelect.addEventListener('change', () => {
    const targetEmpId = isAdmin ? (empSelect ? empSelect.value : requestedEmpId) : session.userId;
    calculateAndRenderPayslip(targetEmpId, monthSelect.value);
  });

  const finalTargetEmpId = isAdmin ? (empSelect ? empSelect.value : requestedEmpId) : session.userId;
  calculateAndRenderPayslip(finalTargetEmpId, monthSelect.value);

  // Save as PDF button (Direct file download)
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  if (downloadPdfBtn) {
    downloadPdfBtn.addEventListener('click', () => {
      exportPayslipToPDF();
    });
  }

  // Print button
  const printBtn = document.getElementById('printPayslipBtn');
  if (printBtn) {
    printBtn.addEventListener('click', () => {
      triggerPayslipPrint();
    });
  }
}

function exportPayslipToPDF() {
  const element = document.querySelector('.payslip-wrapper');
  if (!element) {
    showToast('No payslip currently rendered to export.', 'error');
    return;
  }

  const empSelect = document.getElementById('payslipEmployeeSelect');
  const monthSelect = document.getElementById('payslipMonthSelect');
  const session = getSession();
  const isAdmin = session && session.role === 'admin';
  const targetEmpId = isAdmin ? (empSelect ? empSelect.value : '') : (session ? session.userId : '');
  const emp = getUserById(targetEmpId);
  const cleanName = (emp ? emp.name : 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
  const period = monthSelect ? monthSelect.value : 'statement';
  const fileName = `Payslip_${cleanName}_${period}.pdf`;

  if (typeof html2pdf !== 'undefined') {
    showToast('Generating official PDF...', 'info');
    const opt = {
      margin:       [8, 8, 8, 8],
      filename:     fileName,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save().then(() => {
      showToast('Payslip PDF downloaded successfully.', 'success');
    }).catch(err => {
      console.warn('html2pdf export failed, falling back:', err);
      triggerPayslipPrint();
    });
  } else {
    triggerPayslipPrint();
  }
}

function triggerPayslipPrint() {
  try {
    window.print();
  } catch (err) {
    console.warn('window.print() prevented by sandbox:', err);
    showToast('Browser print blocked by sandbox. Use "Save as PDF" button.', 'info');
  }
}

function populateMonthSelector(selectEl) {
  if (!selectEl) return;
  const now = new Date();
  selectEl.innerHTML = '';

  for (let i = 0; i < 4; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    selectEl.appendChild(opt);
  }
}

function calculateAndRenderPayslip(employeeId, yearMonthStr) {
  const container = document.getElementById('payslipRenderArea');
  if (!container) return;

  if (!employeeId) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">No employee selected</div>
        <div class="empty-desc">Please choose an employee from the dropdown above to generate their monthly payslip.</div>
      </div>
    `;
    return;
  }

  const employee = getUserById(employeeId);
  const company = getCompany() || { name: 'HCM Lite Demo Corp', workingDays: [1,2,3,4,5] };

  if (!employee) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-title">Employee not found</div>
        <div class="empty-desc">The requested employee ID does not exist in local records.</div>
      </div>
    `;
    return;
  }

  const [year, month] = yearMonthStr.split('-').map(Number);
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // 1. Calculate working days in this month according to company schedule
  const totalDaysInMonth = new Date(year, month, 0).getDate();
  const workingDaysConfig = company.workingDays || [1, 2, 3, 4, 5];
  let totalWorkingDays = 0;

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    if (workingDaysConfig.includes(d.getDay())) {
      totalWorkingDays++;
    }
  }

  // Fallback to avoid division by zero
  if (totalWorkingDays === 0) totalWorkingDays = 22;

  // 2. Fetch employee attendance in this month
  const attendance = getAttendance().filter(a => {
    return a.employeeId === employeeId && a.date && a.date.startsWith(yearMonthStr);
  });

  const leaves = getLeaves().filter(l => {
    return l.employeeId === employeeId &&
           l.status === 'approved' &&
           ((l.startDate && l.startDate.startsWith(yearMonthStr)) || (l.endDate && l.endDate.startsWith(yearMonthStr)));
  });

  // Count present, late, half-day
  let presentDays = 0;
  let halfDays = 0;

  attendance.forEach(a => {
    if (a.status === 'present' || a.status === 'late') {
      presentDays++;
    } else if (a.status === 'half-day') {
      halfDays++;
    }
  });

  // Calculate approved paid leave days in this month
  let approvedLeaveDays = 0;
  leaves.forEach(l => {
    if (l.leaveType !== 'unpaid') {
      approvedLeaveDays += Number(l.daysCount) || 0;
    }
  });

  // Absent days = Working Days in Month - Present Days - Half Days - Approved Paid Leave Days
  // (Cannot be negative)
  const accountedDays = presentDays + halfDays + approvedLeaveDays;
  const absentDays = Math.max(0, totalWorkingDays - accountedDays);

  // 3. Formula calculations:
  // Per-day salary: monthly salary ÷ working days in the month
  const monthlySalary = Number(employee.salary) || 0;
  const perDaySalary = monthlySalary / totalWorkingDays;

  // Attendance deduction: per-day salary × (absent days + 0.5 × half days)
  const deduction = perDaySalary * (absentDays + (0.5 * halfDays));

  // Net salary: monthly salary − deduction
  const netSalary = Math.max(0, monthlySalary - deduction);

  // Render HTML
  container.innerHTML = `
    <div class="payslip-wrapper">
      <div class="payslip-header">
        <div>
          <div class="payslip-company-title">${escapeHtml(company.name)}</div>
          <div style="font-size: 13px; color: var(--text-secondary); margin-top: 2px;">Official Monthly Earnings Statement</div>
        </div>
        <div style="text-align: right;">
          <div class="payslip-period-pill">${monthName}</div>
          <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 4px;">Ref: PAY-${employee.id}-${yearMonthStr.replace('-', '')}</div>
        </div>
      </div>

      <div class="payslip-section-title">Employee Details</div>
      <div class="payslip-info-grid">
        <div>
          <div class="payslip-info-row">
            <span class="payslip-info-label">Employee Name:</span>
            <span class="payslip-info-val">${escapeHtml(employee.name)}</span>
          </div>
          <div class="payslip-info-row" style="margin-top: 6px;">
            <span class="payslip-info-label">Employee ID:</span>
            <span class="payslip-info-val">${escapeHtml(employee.id)}</span>
          </div>
          <div class="payslip-info-row" style="margin-top: 6px;">
            <span class="payslip-info-label">Designation:</span>
            <span class="payslip-info-val">${escapeHtml(employee.designation || 'Staff')}</span>
          </div>
        </div>
        <div>
          <div class="payslip-info-row">
            <span class="payslip-info-label">Department:</span>
            <span class="payslip-info-val">${escapeHtml(employee.department || 'N/A')}</span>
          </div>
          <div class="payslip-info-row" style="margin-top: 6px;">
            <span class="payslip-info-label">Work Email:</span>
            <span class="payslip-info-val">${escapeHtml(employee.email)}</span>
          </div>
          <div class="payslip-info-row" style="margin-top: 6px;">
            <span class="payslip-info-label">Joining Date:</span>
            <span class="payslip-info-val">${formatDate(employee.joiningDate)}</span>
          </div>
        </div>
      </div>

      <div class="payslip-section-title">Attendance & Calendar Summary</div>
      <table class="payslip-table">
        <thead>
          <tr>
            <th>Calendar Working Days</th>
            <th>Days Present</th>
            <th>Half Days (&lt;5h)</th>
            <th>Approved Paid Leaves</th>
            <th>Calculated Unexcused Absences</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: 600;">${totalWorkingDays} days</td>
            <td style="color: var(--success); font-weight: 600;">${presentDays}</td>
            <td style="color: var(--warning); font-weight: 600;">${halfDays}</td>
            <td style="color: var(--info); font-weight: 600;">${approvedLeaveDays}</td>
            <td style="color: var(--danger); font-weight: 600;">${absentDays}</td>
          </tr>
        </tbody>
      </table>

      <div class="payslip-section-title">Earnings & Deductions Computation</div>
      <table class="payslip-table">
        <thead>
          <tr>
            <th>Line Item / Description</th>
            <th>Computation Basis</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Basic Monthly Salary</strong></td>
            <td>Contractual monthly pay</td>
            <td style="text-align: right; font-weight: 600;">${formatCurrency(monthlySalary)}</td>
          </tr>
          <tr>
            <td>Standard Per-Day Rate</td>
            <td>${formatCurrency(monthlySalary)} ÷ ${totalWorkingDays} working days</td>
            <td style="text-align: right;">${formatCurrency(perDaySalary)} / day</td>
          </tr>
          <tr>
            <td style="color: var(--danger);">
              <strong>Attendance Penalty & Absence Deductions</strong>
            </td>
            <td style="color: var(--danger);">
              ${formatCurrency(perDaySalary)} × (${absentDays} absent + 0.5 × ${halfDays} half-day)
            </td>
            <td style="text-align: right; color: var(--danger); font-weight: 600;">
              - ${formatCurrency(deduction)}
            </td>
          </tr>
          <tr class="payslip-total-row">
            <td style="padding: 14px 12px; font-size: 15px;">NET DISBURSED SALARY</td>
            <td style="padding: 14px 12px; font-size: 12px; font-weight: normal;">Monthly Salary − Deductions</td>
            <td style="padding: 14px 12px; text-align: right; font-size: 17px; font-weight: 700;">
              ${formatCurrency(netSalary)}
            </td>
          </tr>
        </tbody>
      </table>

      <div class="payslip-footer-note">
        This is a computer-generated salary slip created via HCM Lite. Saylani Hackathon 2026.
      </div>
    </div>
  `;
}
