# 20. Administrator User Manual

## Document Control

| Field | Value |
|---|---|
| Document Title | ChrisPa Admin Console — Administrator & Staff User Manual |
| Audience | ChrisPa staff — Owner, Store Manager, Fulfillment, HR Manager, Support Agent |
| Version | 1.0 |
| Date | 14 August 2026 |
| Status | Reflects the admin console as actually built — see [`00-documentation-index.md`](./00-documentation-index.md) |
| Related | [`docs/SRS.md`](./SRS.md), [`19-storefront-user-manual.md`](./19-storefront-user-manual.md) |

## Who This Manual Is For

The admin console has five staff roles, and what you see depends on which one you are:

| Role | Sees |
|---|---|
| **Owner** | Everything — every section below, no restrictions |
| **Store Manager** | Admin/Backend (all of it except Users & Settings and Activity Log) + My HR |
| **Fulfillment** | Admin/Backend (same as Store Manager, minus Support Tickets too) + My HR |
| **HR Manager** | Human Resources + My HR only — no Admin/Backend, no Financial & Accounting |
| **Support Agent** | Support Tickets only, + My HR |

Everyone with a linked employee record — regardless of role — gets **My HR**, the self-service section for
your own attendance, leave, shifts, performance, payslips, and salary advances.

A quick-reference table of what's fully built versus still follow-up work is at the end of this manual
([Feature Availability at a Glance](#feature-availability-at-a-glance)).

## 1. Getting Started

### Logging in

Go to the admin console's login screen with your email/phone and password (plus a 2FA code, if your account
has it enabled — same as the storefront, and biometric login is available here too). **The console's default
page redirects straight to the login screen if you're not signed in** — you can't land on the dashboard or
any other page without logging in first.

![The ChrisPa Admin login screen — email/phone + password, and Log In with Biometric](./screenshots/admin-login.png)

### Your first login (temporary password)

If HR or the Owner just created your login, you were given a **one-time temporary password**. On first login
you'll be forced straight to **Set a New Password** before you can do anything else:

1. Enter the **Temporary Password** you were given.
2. Choose a **New Password** (at least 8 characters) and confirm it.
3. Click **Set Password & Continue**.

You're then taken straight to the dashboard, fully signed in with your own password.

### Finding your way around

The sidebar is grouped into up to four collapsible sections (only the ones your role can see appear at all):
**Admin / Backend**, **Human Resources**, **My HR**, and **Financial & Accounting**. Your session
automatically signs you out after 5 minutes of inactivity.

![The admin Dashboard — sidebar navigation and top-line KPI tiles](./screenshots/admin-dashboard.png)

## 2. Product Manager

*Owner, Store Manager.*

![The Product Manager list, filterable by product line, with Edit/Delete per row](./screenshots/admin-products.png)

The product list (**Admin → Product Manager**) is searchable and filterable by product line. Click **+ Add
Product**, or **Edit** an existing one, to open the product form:

- **Name**, **SKU**, **Product Line** (required)
- **Scent/Flavor Notes**, **Uses** (comma-separated — rendered live as wellness-tag chips as you type),
  **Directions**, **Health Benefits**
- **Price (UGX)**, **Stock Qty**
- **Vendor** — leave as "ChrisPa (no vendor)" for ChrisPa's own products, or assign a marketplace vendor
- **Cost (UGX)** — used for cost-of-goods-sold accounting, not shown to customers
- **SEO** — slug (auto-fills from the name if left blank), title, meta description
- **Status** — Draft, Active, or Archived

![The Edit Product form — required fields, wellness-tag chips, pricing, SEO, and photo thumbnails](./screenshots/admin-product-edit.png)

![The Add Product form (+ Add Product), blank](./screenshots/admin-product-new.png)

**Photos**: click **+ Attach / Upload Photo** to pick one or more image files (JPEG/PNG/WEBP/GIF) — each
uploads immediately and appears as a thumbnail; click the ✕ on any thumbnail to remove it before saving.

**Only Active products appear on the storefront.** New products default to Draft on purpose (review before
publish) — the form reminds you inline whenever Status isn't Active.

**Deleting**: click **Delete**. If the product has real order history, ChrisPa automatically archives it
instead of deleting it — order history is never allowed to break.

## 3. Order Management

*Owner, Store Manager, Fulfillment.*

![Order Management — status tabs with live counts and the order table](./screenshots/admin-orders.png)

The order list (**Admin → Order Management**) has a tab per status (with live counts) and a search box for
order number or customer name. Open any order to see its full detail and a **Move to** row of status chips —
click the next status to transition it. Valid next steps only:

![An order's detail page — status pipeline chips and order/customer info](./screenshots/admin-order-detail.png)

`PENDING → PROCESSING → SHIPPED → DELIVERED → REFUND_REQUESTED → REFUNDED` (or back to `DELIVERED` to reject
a refund request); `CANCELLED` is reachable from `PENDING`/`PROCESSING`. Cancelling or refunding an order
automatically restocks inventory and reverses any loyalty points it earned.

Click **View / Print Receipt** on any order for a printable copy with ChrisPa's logo, full company details,
and every line item — it's the same document the customer sees (same "Receipt" heading, same dual-currency
UGX/USD figures, same layout), not a separate admin-only version. Once the customer has confirmed their own
receipt (see the storefront manual), your copy shows the same "Received in Good Condition" stamp they see; if
they haven't yet, it says so plainly instead.

![An order's printable receipt, from the admin side](./screenshots/admin-order-invoice.png)

**Finding confirmed receipts at a glance**: you don't have to open every order to check — the order list has
a **Receipt** column ("✓ Confirmed," "Awaiting confirmation," or a dash), and a **"✓ Receipt Confirmed"**
filter chip next to the status tabs shows only the orders whose customers have confirmed. Opening an order
also shows the same confirmation status right next to its status badge.

*Editing items/address/pricing, internal notes, split shipment, packing slips, and shipping labels aren't
built yet.*

## 4. Inventory

*All Admin/Backend roles — read-only.*

![The Inventory page — per-SKU/warehouse stock table with Low/OK status chips](./screenshots/admin-inventory.png)

**Admin → Inventory** shows Total Records, Low Stock Alerts, and Warehouse count at a glance, then every
inventory record (SKU, warehouse, batch/lot, quantity on hand, reorder point) with a red **Low** or green
**OK** status chip. This is a live view — there's nothing to edit here yet (no purchase orders, transfers, or
cycle counts).

## 5. Customers (CRM)

*All Admin/Backend roles — read-only.*

![The Customers (CRM) page — customer list with loyalty tier and order count](./screenshots/admin-customers.png)

**Admin → Customers** lists every customer with their loyalty tier and order count, plus totals for your
whole customer base and how many are Gold/Wholesale-tier. There's no per-customer detail drill-down or
notes/tags yet — for a specific customer's activity, check the Activity Log (Owner only) or their orders.

## 6. Marketing & Promos

*Coupons/bundles/subscriber list are read-only for all Admin/Backend roles. Sending a newsletter is
Owner/Store Manager only.*

![Marketing & Promos — coupons, bundles, newsletter subscribers, and the Compose Newsletter form with Past Campaigns](./screenshots/admin-marketing.png)

**Admin → Marketing & Promos** shows your active coupon codes, wellness-kit bundles, a **Newsletter
Subscribers** card — every email address currently signed up through the storefront footer's newsletter box,
newest first, with a running count in the card header — and a **Compose Newsletter** form. Creating/editing
coupons and bundles isn't built yet.

**Compose Newsletter**: type a subject and a message, then send — it goes out immediately, there's no
draft/scheduling step. Every active subscriber is emailed, and any subscriber whose email matches a real
ChrisPa account also gets an in-app notification (their Account → Notifications inbox) with the same content
— both the email and the in-app notification include a "Follow ChrisPa" block linking to whatever social
accounts are active under CMS → Social Media Accounts, so customers reviewing the update can follow/connect
right from it. The button reports back how many subscribers were emailed and how many got the in-app
notification, and every send is logged below as a **Past Campaigns** entry (subject, date, recipient counts)
and in the Activity Log. There's no unsubscribe-link-in-email flow, per-recipient delivery receipts, or
audience segmentation yet — every active subscriber gets every campaign.

## 7. CMS / Site Builder

*All Admin/Backend roles can view; Owner and Store Manager can also manage Pages, Banners, and Social Media
Accounts.*

![CMS / Site Builder — Published Pages, Active Banners, and Social Media Accounts panels](./screenshots/admin-cms.png)

**Admin → CMS** has three editable panels — Blog Posts is the one area of this page still a read-only status
view (a drag-and-drop homepage builder and a cross-page publish workflow aren't built yet either). Nothing
in the three panels below needs a separate "publish" step — the storefront always shows whatever's currently
Active/Published.

**Published Pages** — real standalone pages, live at `/pages/[slug]` the moment they're saved Published.

- **+ Add Page** — a Title (the slug auto-generates from it, or type your own), page content, and a
  Draft/Published status.
- Click the **Draft**/**Published** chip on any row to flip it directly.
- **Edit** to change anything; **Delete** removes it (the storefront URL then 404s).

**Active Banners** — the lowest-Order Active banner becomes the storefront homepage's hero image (previously
a static placeholder). Not a multi-slide carousel — one banner shows at a time.

- **+ Add Banner** — **Upload Image** (a real upload, same as product photos — JPEG/PNG/WEBP/GIF, 5MB max),
  an optional Link URL, and a display Order.
- Click **Active**/**Hidden** to pull a banner without deleting it; **Edit** to replace the image or change
  its link/order; **Remove** to delete it.

**Social Media Accounts** drives both the storefront footer's "Follow ChrisPa" links and the Account →
Connected & Social page — one list, two places it shows up.

- **+ Add Account** — a platform name (anything: Instagram, Facebook, TikTok, WhatsApp, X, YouTube...) and
  its full URL.
- Click **Active**/**Hidden** to show or hide it without deleting it; **Edit** to change the platform, URL,
  or display order; **Remove** to delete it outright (confirms first).

## 8. Support Tickets

*Owner, Store Manager, Support Agent.* (Not Fulfillment.)

![Support Tickets — status tabs and the ticket list](./screenshots/admin-support-tickets.png)

**Admin → Support Tickets** mirrors Order Management's layout — status tabs (Open/In Progress/Resolved/
Closed) with counts, and a search box. Open a ticket to see the customer's original issue, their contact
details, any related order, and the full conversation.

![An open ticket's detail page — the full conversation and a reply box](./screenshots/admin-support-ticket-detail.png)

- **Responding** posts your reply immediately to the customer's own ticket page — a real back-and-forth, not
  a one-shot answer. Replying to an **Open** ticket automatically moves it to **In Progress** — there's no
  separate "claim" step.
- **Status** is otherwise your free choice (Open/In Progress/Resolved/Closed) via the **Move to** row.
- **Closed is a hard stop** — neither you nor the customer can post further until you move it to a different
  status first.

## 9. Users & Settings / Activity Log

*Owner only.*

![Users & Settings — admin user list, Invite Admin, and Integrations/Security panels](./screenshots/admin-settings.png)

**Admin → Users & Settings** lists every admin-console user with their role and whether 2FA is on. ("+
Invite Admin" and the Integrations/Security panels here are informational displays — they don't yet have
working write actions behind them; grant a new login through **HR → Employees** instead, see below.)

![The Activity Log — unified, filterable feed of customer and staff actions](./screenshots/admin-activity-log.png)

**Admin → Activity Log** is a unified, searchable feed of both customer and staff actions across the whole
platform — logins, orders placed, product/order/employee edits, tickets responded to, and more — each row
showing who did it (their real name and department, where known), filterable by actor type, action, and
department, plus free-text search and pagination. This is your audit trail; it doesn't cover literally every
mutation in the system, just the representative write paths that matter most.

## 10. Human Resources

*Owner, HR Manager.*

### HR Dashboard

![The HR Dashboard — headcount, pending leave, open postings, and other live-computed KPIs](./screenshots/admin-hr-dashboard.png)

Headcount by department/status, pending leave requests, open job postings, who's currently clocked in,
documents expiring within 30 days, and goal-completion rate — all computed live, nothing to configure.

### Employees

![The Employees list — searchable, filterable by department and status](./screenshots/admin-hr-employees.png)

The employee list is searchable and filterable by department and status. Each employee's detail page is a
full workbench:

- **Profile** — personal details, department, job title, employment type, hire date, base salary, NSSF/TIN
  numbers — all editable.
- **Employment History** — an automatic, read-only log of every job-title/department/salary/status change.
- **Documents** — attach type/title/file URL/expiry, or remove one.
- **Allowances** — recurring housing/transport/lunch/medical/hardship/other allowances, each flagged taxable
  or not; activate, deactivate, or remove.
- **Salary Advances** — record a principal + monthly installment (auto-recovered from future payslips), with
  a note; cancel if needed.
- **Performance** — set Goals, log Feedback, and create/submit Reviews.
- **Status** — Active / On Leave / Suspended, or **Terminate Employment** (a deliberate, separate danger
  action — employee records are never deleted, only marked terminated).
- **System Login** — grant a login by choosing an email and role; you'll get a **one-time temporary
  password** to hand to them securely (it's shown only once, right here — write it down or copy it now).
- **Staff ID Card** — a printable ID card (browser print, credit-card sized).

![An employee's full detail workbench — profile, employment history, documents, allowances, performance](./screenshots/admin-hr-employee-detail.png)

![+ Add Employee — the blank new-employee form](./screenshots/admin-hr-employee-new.png)

![The printable Staff ID Card view](./screenshots/admin-hr-employee-idcard.png)

### Departments

![The Departments page — department list and Policy & Permissions matrix](./screenshots/admin-hr-departments.png)

Add or remove departments, and set each one's **Policy & Permissions** — a matrix of View/Create/Update/
Delete/Execute per admin area, for documentation purposes. This matrix records intended policy; it does not
itself control what anyone can actually do — that's still governed by each person's role (Owner/Store
Manager/Fulfillment/HR Manager/Support Agent), same as everywhere else in this console.

### Attendance

![The Attendance oversight table — every employee's clock-in/out times and computed hours](./screenshots/admin-hr-attendance.png)

A read-only oversight table of every employee's clock-in/clock-out times and computed hours — see
[My HR](#11-my-hr--self-service) below for how employees clock in themselves. There's no manual
correction tool here yet.

### Leave Requests

![The Leave Requests approval queue](./screenshots/admin-hr-leave-requests.png)

An approval queue — **Pending** and **All** tabs. **Approve** or **Reject** each request; rejecting lets you
add an optional reason.

### Shift Scheduling

![Shift Scheduling — assigned shifts and the Pending Swap Requests panel](./screenshots/admin-hr-shifts.png)

**+ Add Shift** to assign an employee a role and time slot; **Cancel** to remove one. A separate **Pending
Swap Requests** panel lets you Approve or Reject when one employee asks another to cover their shift —
approving actually reassigns the shift to the covering employee.

### Recruitment

![Recruitment — Job Postings and the Applicant pipeline](./screenshots/admin-hr-recruitment.png)

Create **Job Postings** per department (they start as Draft — move them through Draft → Open → Closed →
Filled yourself). Log **Applicants** against a posting and move them through the pipeline (Applied →
Screening → Interview → Offer → Hired/Rejected) with a stage dropdown. **Convert to Employee** on a
hired applicant creates a real employee record in one click and marks the posting Filled.

### Payroll

![Payroll — periods, Run Payroll, Adjustments, and Finalize](./screenshots/admin-hr-payroll.png)

Create a **Payroll Period** for a given month (or **Run 13th Month Pay** for a discretionary year-end
bonus). Within a period:

- **Run Payroll** computes a payslip for every active employee with a base salary set — safe to re-run as
  many times as you like before finalizing.
- **Adjustments** — add Bonus/Penalty/Overtime/Other Earning/Other Deduction items per employee. The
  **overtime comparison** tool shows computed hours from clock-in/out data next to a confirmable amount —
  nothing is paid until you review and confirm it.
- **Finalize** locks the period permanently — payslips are snapshotted and can no longer change. This can't
  be undone, so the button confirms before proceeding.

Every payslip is expandable to show its full breakdown: basic pay, allowances (taxable/non-taxable),
overtime, bonus, PAYE, employer NSSF, penalties, and advance repayments — all computed against Uganda's
real, current tax bands.

## 11. My HR — Self-Service

*Any staff member with a linked employee record, regardless of role.*

- **My Profile** — edit your own personal email, phone, address, date of birth, and gender. (Job title,
  department, and salary are HR-controlled and can't be changed here.)

  ![My Profile](./screenshots/admin-my-hr-profile.png)

- **Clock In / Out** — one button that toggles based on whether you're currently clocked in, plus your recent
  history with computed hours.

  ![Clock In / Out](./screenshots/admin-my-hr-attendance.png)

- **My Leave** — see your annual leave balance (allocated/used/remaining), request new leave (type + dates +
  reason), and cancel your own pending requests.

  ![My Leave](./screenshots/admin-my-hr-leave.png)

- **My Shifts** — view your schedule and request a swap with a named colleague; cancel your own pending swap
  requests.

  ![My Shifts](./screenshots/admin-my-hr-shifts.png)

- **My Performance** — view your Goals (with progress), Feedback, and Reviews; **Acknowledge** any review
  that's been submitted to you (the one action available here).

  ![My Performance](./screenshots/admin-my-hr-performance.png)

- **My Payslips** — read-only, same detailed breakdown HR sees for your payslips.

  ![My Payslips](./screenshots/admin-my-hr-payslips.png)

- **My Salary Advances** — read-only; HR creates and manages these, with each installment automatically
  recovered from your future payslips.

  ![My Salary Advances](./screenshots/admin-my-hr-advances.png)

## 12. Financial & Accounting

*Owner only.*

![Financial & Accounting — entity selector and tabs (Entities, Chart of Accounts, Journal Entries, Reports, Intercompany, Vendors, Expenses)](./screenshots/admin-finance.png)

Its own top-level sidebar section, with a global entity selector and a "Consolidated (group)" option at the
top, and seven tabs:

- **Entities** — ChrisPa's legal-entity tree (a parent company with any subsidiaries); **+ New Legal Entity**
  to add one, with its own functional currency and FX rate to the group's reporting currency.
- **Chart of Accounts** — the selected entity's accounts (read-only view).
- **Journal Entries** — the entity's posted entries, and a form to post a new one — add debit/credit lines
  against real accounts; the **Post Entry** button only enables once your lines balance exactly.
- **Reports** — Balance Sheet, Income Statement, and Cash Flow Statement, for one entity or the whole group
  consolidated, over any date range — each with a live balanced/reconciled indicator.
- **Intercompany** — allocate a management fee from the group parent to a subsidiary in one step (posts both
  sides of the transaction together), and see each entity's due-to/due-from balances.
- **Vendors** — your marketplace vendor directory; **+ New Vendor** to add one (name, contact, Mobile Money
  payout number, commission %); **Compute Vendor Payout** tallies up a vendor's delivered, not-yet-paid sales
  for a date range, and **Mark Paid** records that you've paid them (outside the system — there's no
  automatic Mobile Money disbursement).
- **Expenses** — record a one-off operating expense (server/hosting, software, marketing, etc.) against an
  entity and a "paid from" account.

## 13. Quick Reference: Common Tasks

| Task | Where | Who |
|---|---|---|
| Create/edit/archive a product | Product Manager | Owner, Store Manager |
| Move an order to the next status | Order Management → an order | Owner, Store Manager, Fulfillment |
| Print an order's receipt | Order Management → an order → View / Print Receipt | Owner, Store Manager, Fulfillment |
| Respond to / close a support ticket | Support Tickets → a ticket | Owner, Store Manager, Support Agent |
| Add/edit/publish/remove a page, banner, or social media account | CMS / Site Builder | Owner, Store Manager |
| Compose and send a newsletter (email + in-app) | Marketing & Promos → Compose Newsletter | Owner, Store Manager |
| Grant a staff login | HR → Employees → an employee → System Login | Owner, HR Manager |
| Approve/reject leave | HR → Leave Requests | Owner, HR Manager |
| Run and finalize payroll | HR → Payroll | Owner, HR Manager |
| Edit a department's policy matrix | HR → Departments | Owner, HR Manager |
| Clock in/out, request leave (yourself) | My HR | Any linked staff member |
| Post a journal entry / view financial statements | Financial & Accounting | Owner |
| Compute and mark a vendor payout | Financial & Accounting → Vendors | Owner |
| Review the platform-wide activity feed | Activity Log | Owner |

## Feature Availability at a Glance

| Area | Available now | Coming soon |
|---|---|---|
| Product Manager | Full CRUD, photo upload, wellness tags | — |
| Order Management | Status pipeline, invoice printing | Editing items/address, split shipment, packing slips |
| Inventory | Live read view with low-stock flagging | Purchase orders, transfers, cycle counts |
| Customers (CRM) | Tier & order-count list | Per-customer detail, notes/tags, campaign export |
| Marketing & Promos | View coupons/bundles, newsletter subscriber list, compose &amp; send newsletter (email + in-app, with follow-us links) | Creating/editing coupons and bundles, audience segmentation, scheduling/drafts |
| CMS / Site Builder | Full CRUD on Pages, Banners, Social Media Accounts | Blog Posts write access, drag-and-drop builder, cross-page publish workflow, multi-slide hero carousel |
| Support Tickets | Full review & response workflow | — |
| Users & Settings | Admin user list | Inviting a new admin, integration toggles |
| Activity Log | Full audit feed | — |
| HR (all phases) | Employees, Departments, Attendance, Leave, Shifts, Recruitment, Payroll | Biometric clock-in hardware |
| Department Policy & Permissions | Editable, documented matrix | Does not itself enforce access (roles do) |
| Financial & Accounting | Full multi-entity ledger, reports, intercompany | Period-close workflow, live FX rates |
| Marketplace Vendors | Directory, payout computation | Automatic Mobile Money disbursement |
