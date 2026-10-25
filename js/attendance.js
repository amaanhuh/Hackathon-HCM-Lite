/**
 * HCM Lite — Attendance Logic, Check-in/Check-out Engine & CSV Exporter
 */

// Check if current time is considered late
function isTimeLate(timeString, officeStartTime = '09:00', graceMinutes = 15) {
  const [inH, inM] = timeString.split(':').map(Number);
  const [startH, startM] = officeStartTime.split(':').map(Number);

  const checkInMinutes = inH * 60 + inM;
  const cutoffMinutes = startH * 60 + startM + Number(graceMinutes);

  return checkInMinutes > cutoffMinutes;
}

// Calculate duration in minutes between HH:MM:SS and HH:MM:SS
function calculateDurationMinutes(checkInTimeStr, checkOutTimeStr) {
  if (!checkInTimeStr || !checkOutTimeStr) return null;
  const [h1, m1, s1 = 0] = checkInTimeStr.split(':').map(Number);
  const [h2, m2, s2 = 0] = checkOutTimeStr.split(':').map(Number);

  const t1 = h1 * 3600 + m1 * 60 + s1;
  const t2 = h2 * 3600 + m2 * 60 + s2;

  const diffSec = t2 - t1;
  if (diffSec < 0) return 0;
  return Math.round(diffSec / 60);
}

// Perform Check-in
function recordCheckIn(employeeId, method = 'standard', photoUrl = null) {
  const company = getCompany() || { officeStartTime: '09:00', graceMinutes: 15, workingDays: [1,2,3,4,5] };
  const todayStr = getTodayDateString();
  const records = getAttendance();

  // Check if employee already checked in today
  const existing = records.find(r => r.employeeId === employeeId && r.date === todayStr);
  if (existing) {
    return { success: false, message: 'You have already checked in today (' + existing.checkInTime + ').' };
  }

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS

  const isLate = isTimeLate(timeStr, company.officeStartTime, company.graceMinutes);
  const status = isLate ? 'late' : 'present';

  const newRecord = {
    id: generateId('att'),
    employeeId: employeeId,
    date: todayStr,
    checkInTime: timeStr,
    checkOutTime: null,
    durationMinutes: null,
    status: status,
    method: method,
    photoUrl: photoUrl
  };

  records.push(newRecord);
  saveAttendance(records);

  return {
    success: true,
    message: isLate
      ? `Checked in at ${timeStr}. Marked Late (arrived after ${company.officeStartTime} + ${company.graceMinutes}m grace).`
      : `Checked in at ${timeStr} successfully (On-Time).`,
    record: newRecord
  };
}

// Global modal viewer for attendance verification photo
function showAttendancePhoto(recordId) {
  const records = getAttendance();
  const rec = records.find(r => r.id === recordId);
  if (!rec || !rec.photoUrl) {
    showToast('No camera snapshot attached to this record.', 'info');
    return;
  }

  let modal = document.getElementById('photoViewerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'photoViewerModal';
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <div class="modal-title">Verification Snapshot</div>
          <button class="modal-close" onclick="document.getElementById('photoViewerModal').classList.remove('open')">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body" style="text-align: center; background-color: #0b0e0c;">
          <img id="photoViewerImg" class="photo-thumb-modal-img" src="" alt="Verification Snapshot">
          <div id="photoViewerMeta" style="color: #ECEFEA; font-size: 12px; margin-top: 10px;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  const img = document.getElementById('photoViewerImg');
  const meta = document.getElementById('photoViewerMeta');
  img.src = rec.photoUrl;
  meta.textContent = `Captured via Laptop Webcam on ${formatDate(rec.date)} at ${rec.checkInTime} (${rec.status.toUpperCase()})`;
  modal.classList.add('open');
}

// Perform Check-out
function recordCheckOut(employeeId) {
  const todayStr = getTodayDateString();
  const records = getAttendance();

  const recordIndex = records.findIndex(r => r.employeeId === employeeId && r.date === todayStr);
  if (recordIndex === -1) {
    return { success: false, message: 'No check-in record found for today. You must check in first.' };
  }

  const record = records[recordIndex];
  if (record.checkOutTime) {
    return { success: false, message: `You have already checked out today at ${record.checkOutTime}.` };
  }

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  const durationMinutes = calculateDurationMinutes(record.checkInTime, timeStr);

  // Status rule: if total working duration is under 5 hours (300 minutes), mark as half-day!
  let finalStatus = record.status;
  if (durationMinutes < 300) {
    finalStatus = 'half-day';
  }

  record.checkOutTime = timeStr;
  record.durationMinutes = durationMinutes;
  record.status = finalStatus;

  records[recordIndex] = record;
  saveAttendance(records);

  const durationFormatted = formatDuration(durationMinutes);
  const isHalfDay = finalStatus === 'half-day';

  return {
    success: true,
    message: isHalfDay
      ? `Checked out at ${timeStr}. Duration: ${durationFormatted} (Under 5h logged: marked as Half Day).`
      : `Checked out at ${timeStr}. Duration: ${durationFormatted}.`,
    record: record
  };
}

// Export attendance records as CSV (Bonus feature)
function exportAttendanceCSV() {
  const records = getAttendance();
  const users = getUsers();
  const userMap = {};
  users.forEach(u => { userMap[u.id] = u; });

  if (records.length === 0) {
    showToast('No attendance records available to export.', 'info');
    return;
  }

  const headers = ['Record ID', 'Employee ID', 'Employee Name', 'Department', 'Date', 'Check-In', 'Check-Out', 'Duration (Minutes)', 'Status', 'Method'];
  const rows = records.map(r => {
    const user = userMap[r.employeeId] || {};
    return [
      `"${r.id}"`,
      `"${r.employeeId}"`,
      `"${user.name || 'Unknown'}"`,
      `"${user.department || 'N/A'}"`,
      `"${r.date}"`,
      `"${r.checkInTime || '-'}"`,
      `"${r.checkOutTime || '-'}"`,
      r.durationMinutes !== null ? r.durationMinutes : '-',
      `"${r.status}"`,
      `"${r.method || 'standard'}"`
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `hcm_attendance_export_${getTodayDateString()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Attendance records exported successfully.', 'success');
}
