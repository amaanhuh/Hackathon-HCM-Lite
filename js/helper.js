/**
 * HCM Lite — Grounded Smart Helper
 * Answers queries using keyword-intent matching strictly against actual localStorage records.
 * Enforces role-based data isolation (Employees cannot query other employees' private data).
 */

class SmartHelper {
  constructor(mountElementId, currentUser) {
    this.container = document.getElementById(mountElementId);
    this.user = currentUser;
    this.messages = [];
    this.init();
  }

  init() {
    if (!this.container) return;

    const isAdmin = this.user.role === 'admin';
    const suggestions = isAdmin ? [
      "How many employees do we have?",
      "Who is on leave today?",
      "Who was late today?",
      "How many pending leave requests?"
    ] : [
      "How many leaves do I have left?",
      "Was I late today?",
      "How many hours did I work this week?",
      "What is my salary?"
    ];

    this.container.innerHTML = `
      <div class="helper-container">
        <div class="helper-messages" id="helperMessages"></div>
        <div class="helper-suggestions">
          ${suggestions.map(s => `<button type="button" class="suggestion-chip" data-query="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}
        </div>
        <form class="helper-input-row" id="helperForm">
          <input type="text" id="helperInput" class="form-control" placeholder="Ask a question about ${isAdmin ? 'company' : 'your'} records..." autocomplete="off">
          <button type="submit" class="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            <span>Ask</span>
          </button>
        </form>
      </div>
    `;

    this.messagesBox = this.container.querySelector('#helperMessages');
    this.input = this.container.querySelector('#helperInput');
    this.form = this.container.querySelector('#helperForm');

    // Initial greeting
    const greeting = isAdmin
      ? `Hello ${this.user.name.split(' ')[0]}. I can answer questions regarding employee counts, today's attendance, and pending leave requests from live system records.`
      : `Hello ${this.user.name.split(' ')[0]}. I can look up your remaining leave balance, today's check-in status, and weekly working hours from your records.`;

    this.addMessage('bot', greeting);

    // Form submit
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.input.value.trim();
      if (!text) return;
      this.input.value = '';
      this.handleUserQuery(text);
    });

    // Chip clicks
    this.container.querySelectorAll('.suggestion-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const query = btn.getAttribute('data-query');
        this.handleUserQuery(query);
      });
    });
  }

  addMessage(sender, text) {
    this.messages.push({ sender, text });
    const msgEl = document.createElement('div');
    msgEl.className = `helper-msg helper-msg-${sender}`;
    msgEl.innerHTML = text.replace(/\n/g, '<br>');
    this.messagesBox.appendChild(msgEl);
    this.messagesBox.scrollTop = this.messagesBox.scrollHeight;
  }

  handleUserQuery(queryText) {
    this.addMessage('user', escapeHtml(queryText));

    const answer = this.processIntent(queryText.toLowerCase().trim());
    this.addMessage('bot', answer);
  }

  processIntent(q) {
    const isAdmin = this.user.role === 'admin';
    const users = getUsers();
    const attendance = getAttendance();
    const leaves = getLeaves();
    const company = getCompany() || { name: 'HCM Lite', officeStartTime: '09:00', graceMinutes: 15, yearlyLeaveQuota: 20 };
    const todayStr = getTodayDateString();

    // ----------------- ADMIN INTENTS -----------------
    if (isAdmin) {
      // 1. "How many employees do we have?"
      if (q.includes('how many employee') || q.includes('total employee') || q.includes('employee count') || q.includes('number of employee')) {
        const employees = users.filter(u => u.role === 'employee');
        if (employees.length === 0) {
          return "There are currently 0 employees registered in the company.";
        }
        const departments = [...new Set(employees.map(e => e.department).filter(Boolean))];
        return `We currently have ${employees.length} employee(s) registered in the company across ${departments.length || 1} department(s).`;
      }

      // 2. "Who is on leave today?"
      if (q.includes('on leave today') || q.includes('who is on leave') || q.includes('leaves today') || q.includes('absent on leave')) {
        const todayLeaves = leaves.filter(l => {
          return l.status === 'approved' && l.startDate <= todayStr && l.endDate >= todayStr;
        });

        if (todayLeaves.length === 0) {
          return "No employees are on approved leave today (" + formatDate(todayStr) + ").";
        }

        const details = todayLeaves.map(l => {
          const emp = users.find(u => u.id === l.employeeId);
          const name = emp ? emp.name : l.employeeId;
          return `• <strong>${escapeHtml(name)}</strong> (${l.leaveType.toUpperCase()} leave: ${formatDate(l.startDate)} to ${formatDate(l.endDate)})`;
        }).join('\n');

        return `There are ${todayLeaves.length} employee(s) on approved leave today:\n${details}`;
      }

      // 3. "Who was late today?"
      if (q.includes('who was late') || q.includes('late today') || q.includes('who is late')) {
        const lateRecords = attendance.filter(a => a.date === todayStr && a.status === 'late');
        if (lateRecords.length === 0) {
          return "No employees arrived late today. Everyone checked in before " + company.officeStartTime + " (+ " + company.graceMinutes + "m grace).";
        }

        const details = lateRecords.map(a => {
          const emp = users.find(u => u.id === a.employeeId);
          const name = emp ? emp.name : a.employeeId;
          return `• <strong>${escapeHtml(name)}</strong> checked in at ${a.checkInTime}`;
        }).join('\n');

        return `There are ${lateRecords.length} employee(s) marked late today:\n${details}`;
      }

      // 4. "Who is present today?"
      if (q.includes('who is present') || q.includes('present today') || q.includes('attendance today') || q.includes('checked in today')) {
        const presentRecords = attendance.filter(a => a.date === todayStr);
        if (presentRecords.length === 0) {
          return "No employees have checked in yet today (" + formatDate(todayStr) + ").";
        }

        const details = presentRecords.map(a => {
          const emp = users.find(u => u.id === a.employeeId);
          const name = emp ? emp.name : a.employeeId;
          return `• <strong>${escapeHtml(name)}</strong>: in at ${a.checkInTime} (${a.status.toUpperCase()})`;
        }).join('\n');

        return `${presentRecords.length} employee(s) have checked in today:\n${details}`;
      }

      // 5. "How many pending leave requests?"
      if (q.includes('pending leave') || q.includes('pending request') || q.includes('leave approval') || q.includes('requests waiting')) {
        const pending = leaves.filter(l => l.status === 'pending');
        if (pending.length === 0) {
          return "There are no pending leave requests awaiting approval.";
        }

        const details = pending.map(l => {
          const emp = users.find(u => u.id === l.employeeId);
          const name = emp ? emp.name : l.employeeId;
          return `• <strong>${escapeHtml(name)}</strong>: ${l.daysCount} day(s) for ${l.leaveType} (${formatDate(l.startDate)} - ${formatDate(l.endDate)})`;
        }).join('\n');

        return `There are ${pending.length} pending leave request(s) awaiting your review:\n${details}`;
      }

      // 6. Office hours or grace policy
      if (q.includes('office hour') || q.includes('start time') || q.includes('grace period') || q.includes('timing')) {
        return `Office start time is configured at <strong>${company.officeStartTime}</strong> with a <strong>${company.graceMinutes}-minute</strong> grace period. Working days are Monday through Friday.`;
      }
    }

    // ----------------- EMPLOYEE INTENTS -----------------
    if (!isAdmin) {
      const myId = this.user.userId;

      // 1. "How many leaves do I have left?"
      if (q.includes('how many leave') || q.includes('leave balance') || q.includes('leaves left') || q.includes('remaining leave')) {
        const stats = getEmployeeLeaveStats(myId);
        return `You have <strong>${stats.remaining}</strong> days of annual leave remaining out of your <strong>${stats.quota}</strong> days quota for this year (used: ${stats.usedDays} days).`;
      }

      // 2. "Was I late today?"
      if (q.includes('was i late') || q.includes('am i late') || q.includes('my status today') || q.includes('late today')) {
        const record = attendance.find(a => a.employeeId === myId && a.date === todayStr);
        if (!record) {
          return "You have not checked in yet today (" + formatDate(todayStr) + ").";
        }
        if (record.status === 'late') {
          return `Yes, you were marked <strong>Late</strong> today. You checked in at <strong>${record.checkInTime}</strong> (office start is ${company.officeStartTime} + ${company.graceMinutes}m grace).`;
        }
        return `No, you were on time! You checked in at <strong>${record.checkInTime}</strong>. Status: <strong>${record.status.toUpperCase()}</strong>.`;
      }

      // 3. "How many hours did I work this week?"
      if (q.includes('hours') && (q.includes('this week') || q.includes('work') || q.includes('worked'))) {
        // Calculate start of current week (Monday)
        const now = new Date();
        const day = now.getDay();
        const diffToMonday = (day === 0 ? -6 : 1) - day;
        const monday = new Date(now);
        monday.setDate(now.getDate() + diffToMonday);
        monday.setHours(0, 0, 0, 0);

        const myRecordsThisWeek = attendance.filter(a => {
          if (a.employeeId !== myId) return false;
          const recDate = new Date(a.date + 'T00:00:00');
          return recDate >= monday && recDate <= now;
        });

        let totalMinutes = 0;
        let checkedInWithoutCheckout = false;

        myRecordsThisWeek.forEach(r => {
          if (r.durationMinutes) {
            totalMinutes += r.durationMinutes;
          } else if (r.date === todayStr && r.checkInTime && !r.checkOutTime) {
            checkedInWithoutCheckout = true;
          }
        });

        const formatted = formatDuration(totalMinutes);
        let resp = `You have completed <strong>${formatted}</strong> of logged work this week across ${myRecordsThisWeek.length} working day(s).`;
        if (checkedInWithoutCheckout) {
          resp += ` (Note: Today's ongoing shift is not yet checked out).`;
        }
        return resp;
      }

      // 4. "What is my salary?"
      if (q.includes('my salary') || q.includes('monthly pay') || q.includes('compensation') || q.includes('earnings')) {
        const fullUser = getUserById(myId);
        if (fullUser && fullUser.salary) {
          return `Your configured base salary is <strong>${formatCurrency(fullUser.salary)}</strong> per month. You can view your detailed monthly payslip via the "My Payslip" page.`;
        }
        return "Salary information is not available on your account profile.";
      }

      // 5. "Did I check in today?"
      if (q.includes('did i check in') || q.includes('check in status') || q.includes('my check in')) {
        const record = attendance.find(a => a.employeeId === myId && a.date === todayStr);
        if (!record) {
          return "You have not checked in yet today. Use the check-in button on your dashboard.";
        }
        return `Yes, you checked in at <strong>${record.checkInTime}</strong> today. ` + (record.checkOutTime ? `You checked out at <strong>${record.checkOutTime}</strong>.` : `You have not checked out yet.`);
      }
    }

    // Common Fallback
    if (isAdmin) {
      return "I can answer questions regarding live company records. Try asking:\n• <em>How many employees do we have?</em>\n• <em>Who is on leave today?</em>\n• <em>Who was late today?</em>\n• <em>How many pending leave requests?</em>";
    } else {
      return "I can answer questions regarding your personal employment records. Try asking:\n• <em>How many leaves do I have left?</em>\n• <em>Was I late today?</em>\n• <em>How many hours did I work this week?</em>\n• <em>What is my salary?</em>";
    }
  }
}
