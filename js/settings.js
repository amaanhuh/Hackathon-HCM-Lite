/**
 * HCM Lite — Settings Module
 */

function initSettingsPage() {
  const session = requireAuth(['admin']);
  if (!session) return;
  renderNavigation('settings');

  loadSettings();
  setupSettingsListeners();
}

function loadSettings() {
  const company = getCompany() || {
    name: 'HCM Lite Demo Corp',
    officeStartTime: '09:00',
    graceMinutes: 15,
    yearlyLeaveQuota: 20,
    workingDays: [1, 2, 3, 4, 5]
  };

  document.getElementById('companyName').value = company.name || '';
  document.getElementById('officeStartTime').value = company.officeStartTime || '09:00';
  document.getElementById('graceMinutes').value = company.graceMinutes || 15;
  document.getElementById('yearlyLeaveQuota').value = company.yearlyLeaveQuota || 20;

  const workingDays = company.workingDays || [1, 2, 3, 4, 5];
  for (let i = 0; i <= 6; i++) {
    const chk = document.getElementById(`day_${i}`);
    if (chk) {
      chk.checked = workingDays.includes(i);
    }
  }
}

function setupSettingsListeners() {
  const form = document.getElementById('companySettingsForm');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = document.getElementById('companyName').value.trim();
      const officeStartTime = document.getElementById('officeStartTime').value;
      const graceMinutes = parseInt(document.getElementById('graceMinutes').value, 10);
      const yearlyLeaveQuota = parseInt(document.getElementById('yearlyLeaveQuota').value, 10);

      // Collect working days
      const workingDays = [];
      for (let i = 0; i <= 6; i++) {
        const chk = document.getElementById(`day_${i}`);
        if (chk && chk.checked) {
          workingDays.push(i);
        }
      }

      if (!name) {
        showToast('Company name is required.', 'error');
        return;
      }

      if (!officeStartTime) {
        showToast('Office start time is required.', 'error');
        return;
      }

      if (isNaN(graceMinutes) || graceMinutes < 0) {
        showToast('Grace period must be 0 or more minutes.', 'error');
        return;
      }

      if (isNaN(yearlyLeaveQuota) || yearlyLeaveQuota < 1) {
        showToast('Yearly leave quota must be at least 1 day.', 'error');
        return;
      }

      if (workingDays.length === 0) {
        showToast('Please select at least one working day.', 'error');
        return;
      }

      const updatedCompany = {
        name,
        officeStartTime,
        graceMinutes,
        yearlyLeaveQuota,
        workingDays
      };

      saveCompany(updatedCompany);
      showToast('Company settings saved persistently.', 'success');

      // Update breadcrumb and header if needed
      const breadcrumb = document.getElementById('topbarBreadcrumb');
      if (breadcrumb) {
        renderNavigation('settings');
      }
    });
  }

  // Clear / Reset all data
  const resetBtn = document.getElementById('resetAllDataBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const confirmation = prompt('DANGER: Type "RESET" in all caps to permanently erase all localStorage data and return to First-Run Setup:');
      if (confirmation === 'RESET') {
        resetAllData();
        alert('All HCM Lite data has been cleared. Redirecting to first-run setup.');
        window.location.href = 'index.html';
      } else if (confirmation !== null) {
        showToast('Reset cancelled: Confirmation text did not match.', 'info');
      }
    });
  }
}
