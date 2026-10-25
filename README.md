# HCM Lite — Enterprise Human Capital Management
### Saylani Hackathon 2026 | Beginner Track Web Application

HCM Lite is a modern, quiet enterprise Human Capital Management web application designed for basic employee administration, attendance tracking, leave management, and monthly payroll slips.

Built strictly in accordance with the **Saylani Hackathon 2026 Beginner Track** guidelines, HCM Lite utilizes pure web standards without bloated frameworks or external backends.

---

## 1. Technologies & Architecture

- **Markup & Layout**: Semantic HTML5 with accessible landmarks and forms.
- **Styling**: CSS3 Design System adhering to the *Quiet Enterprise* visual aesthetic (Inter typography, forest-green accents `--brand: #245C4F`, warm neutral background `--page-bg: #F6F6F2`, dark mode support, and dedicated print stylesheet).
- **Behavior**: Pure Vanilla JavaScript (ES2022) with modular separation of concerns.
- **Storage Layer**: Browser `localStorage` adhering to the required schema:
  - `hcm_company`: Organization profile, office start time, grace minutes, leave quota, work week.
  - `hcm_users`: Admin and Employee accounts, credentials, departments, designations, monthly salaries.
  - `hcm_attendance`: Daily check-in/check-out logs, calculated durations, statuses (`present`, `late`, `half-day`).
  - `hcm_leaves`: Time-off applications, calendar working days, reasons, approval states (`pending`, `approved`, `rejected`), admin comments.
  - `hcm_session`: Current authenticated user session (stores safe user ID and role, never raw passwords).
  - `hcm_announcements`: Corporate announcements broadcasted by administrators.
- **Visualization**: Chart.js via CDN for real-time attendance distribution.
- **No Heavy Frameworks**: No React, Next.js, Vue, Angular, TypeScript, Tailwind, or backend database servers.

### File Tree

```text
hcm-lite/
├── index.html         # First-run organization setup wizard & multi-role sign in
├── admin.html         # Administrator command center, live metrics & approvals
├── employees.html     # Employee directory, credential provisioning, and CRUD
├── leaves.html        # Company leave requests, approvals, and employee quota audit
├── settings.html      # Office hours, grace period, quota, working days, and demo tools
├── employee.html      # Employee self-service dashboard, attendance clock, leave apply
├── payslip.html       # Official monthly salary slip generator with print/PDF layout
├── css/
│   └── style.css      # Enterprise design system tokens, responsive layout & print rules
├── js/
│   ├── storage.js     # Unified localStorage CRUD, date math, toasts, and helpers
│   ├── auth.js        # Authentication guards, role-based protection, navigation shell
│   ├── employees.js   # Employee CRUD, inline field validations, and directory search
│   ├── attendance.js  # Check-in, late threshold, 5-hour half-day logic, CSV export
│   ├── leave.js       # Working days calculator, quota validation, overlapping checks
│   ├── helper.js      # Grounded Smart Assistant (keyword matching against live data)
│   ├── dashboard.js   # Live metric computations, Chart.js updates, announcements
│   ├── settings.js    # Persistent configuration and database seeding/reset
│   └── payslip.js     # Standardized salary formulas and print rendering
└── README.md
```

---

## 2. Core Business Rules Implemented

### Attendance Engine
1. **Late Status**: Calculated dynamically using Admin's configured office start time (e.g., 09:00) + grace minutes (e.g., 15 mins). Arrivals after 09:15 are automatically stamped as `Late Arrival`.
2. **One Check-in per Day**: Employees can check in once per calendar day. Duplicate attempts are prevented with inline feedback.
3. **Check-out Prerequisite**: Check-out is permitted only after an active check-in on that day.
4. **Half Day Rule**: If total duration between check-out and check-in is under 5 hours (300 minutes), the shift is marked as `Half Day`.
5. **Absence Computation**: On configured company working days, an employee with no attendance record and no approved leave is counted as unexcused absent in payroll calculations.

### Leave Management Engine
1. **Working Days Math**: Given start and end dates, the engine iterates day-by-day and counts only configured working days (e.g., skips Saturday and Sunday).
2. **Overlapping Prevention**: Blocks new requests that overlap with existing pending or approved requests for that employee.
3. **Quota Protection**: Checks employee's remaining quota before allowing submission or admin approval (unless unpaid leave).
4. **Approval Workflow**: Admin reviews requests, can enter an optional comment, and records decisions. Balance deductions are only computed from approved requests.

### Monthly Payslip Formulas
Adheres strictly to the Beginner Track payroll specification:
- **Calendar Working Days**: Total configured work days in the target month (e.g., 22 days).
- **Per-day Salary**: `Monthly Base Salary ÷ Working Days in Month`
- **Attendance Deduction**: `Per-day Salary × (Absent Days + 0.5 × Half Days)`
- **Net Disbursed Salary**: `Monthly Base Salary − Attendance Deduction`
- **Security Scoping**: Employees can view only their own salary slip.

### Grounded Smart Assistant (`js/helper.js`)
An in-app natural language assistant operating via keyword-intent matching on live `localStorage` data:
- **Admin Inquiries**:
  - *"How many employees do we have?"* &rarr; Counts registered employees across departments.
  - *"Who is on leave today?"* &rarr; Cross-references approved leave date spans covering today.
  - *"Who was late today?"* &rarr; Fetches today's check-in timestamps exceeding start + grace.
  - *"How many pending leave requests?"* &rarr; Audits applications awaiting review.
- **Employee Inquiries**:
  - *"How many leaves do I have left?"* &rarr; Audits quota minus approved days this year.
  - *"Was I late today?"* &rarr; Checks personal check-in against company grace cutoff.
  - *"How many hours did I work this week?"* &rarr; Sums completed shift durations from Monday to Sunday.
  - *"What is my salary?"* &rarr; Retrieves personal monthly contractual compensation.
- Strict data isolation: Employees cannot query other employees' records.

---

## 3. How to Run Locally

Because HCM Lite is built as pure static web files, you can run it using any static file server:

### Option A: Using Vite (Current Environment)
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### Option B: Using Python
```bash
python3 -m http.server 3000
```

### Option C: Using Node `npx serve`
```bash
npx serve . -p 3000
```

---

## 4. 5-Minute Hackathon Demonstration Sequence

1. **Minute 1: Setup & Admin Initialization**
   - Open a fresh browser state on `index.html`.
   - The **First-Run Organization Setup** wizard automatically appears.
   - Enter Company Name (`Saylani Tech Ventures`), Start Time (`09:00`), Grace (`15` mins), Leave Quota (`20` days).
   - Enter Admin details (`Sarah Connor`, `admin@hcm.local`, password `admin`).
   - Click **Complete Setup & Launch Dashboard**.

2. **Minute 2: Employee Provisioning**
   - Navigate to **Employees** (`employees.html`).
   - Click **+ Add Employee**.
   - Create employee: Name (`Bilal Ahmed`), Email (`bilal@company.com`), Department (`Engineering`), Salary (`$8,500`), Password (`password`).
   - Verify account is created with auto-assigned ID `EMP_101`.

3. **Minute 3: Attendance & Leave Workflow**
   - Click **Sign Out** from the bottom sidebar.
   - Sign in as employee: `bilal@company.com` / `password`.
   - On the Employee Portal, click **Check In Now** (or test the Camera Check-in).
   - Review live check-in timestamp and status.
   - Click **Apply for Leave**. Select dates, reason, and observe the live working-days calculation excluding weekends. Click **Submit Application**.
   - Sign out and sign back in as Admin (`admin@hcm.local`).
   - Go to **Leaves & Approvals** (`leaves.html`) and approve Bilal's request with a note.

4. **Minute 4: Real-time Dashboard & Grounded Smart Helper**
   - Return to Admin Dashboard (`admin.html`).
   - Observe live metric counters and Chart.js attendance doughnut chart reflect real records.
   - In the Smart Assistant chat box, ask:
     - *"How many employees do we have?"*
     - *"Who was late today?"*
     - *"Who is on leave today?"*
   - Sign in as employee Bilal and ask:
     - *"How many leaves do I have left?"*
     - *"How many hours did I work this week?"*

5. **Minute 5: Monthly Payslip & Print/PDF**
   - Click **Monthly Payslips** (`payslip.html`).
   - Review the detailed earnings statement, per-day salary rate, attendance deductions, and net salary.
   - Click **Save as PDF** to generate and download the actual formatted PDF file to disk.
   - Click **Print Slip** for clean browser print dialog.

---

## 5. Storage Security Qualification & Limitations

- **Browser-Only Storage Model**: `localStorage` is scoped to the user's browser origin. Data is persisted between page reloads, but can be viewed or edited by anyone with access to Developer Tools.
- This application does not transmit data over an external network or use a database server. Never use real personal or sensitive financial records in this demonstration project.
