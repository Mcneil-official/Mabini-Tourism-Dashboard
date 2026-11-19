# Mabini, Batangas Dive Tourism Dashboard — User Guide

A quick navigation guide for Tourism Office staff using the Mabini, Batangas
Dive Tourism Management Dashboard.

The dashboard brings tourist records, establishment accreditation, dive
manifestos, dive-pass payments, announcements, and analytics into one place.

---

## Quick navigation map

| Page                | Use it to                                                         |
| ------------------- | ----------------------------------------------------------------- |
| **Dashboard**       | See today's activity, pending work, and headline charts           |
| **Tourists**        | Manage Eco-Dive IDs and dive professionals                        |
| **Establishments**  | Review operator applications and manage accredited establishments |
| **Dive Operations** | Verify/print dive manifestos and maintain the dive-site registry  |
| **Dive Pass**       | Verify payment receipts and manage pass pricing/payment details   |
| **Analytics**       | Explore tourism trends and generate official reports              |
| **Announcements**   | Publish, schedule, edit, or remove announcements                  |
| **Settings**        | Manage staff accounts and review audit logs (Super Admin only)    |

---

## 1. Signing in

1. Open the dashboard URL.
2. Enter your **staff email** and **password**.
3. Use the eye icon to show or hide the password if needed.
4. Select **Sign in**.

If this is your first sign-in with a temporary password, the dashboard
immediately asks you to create your own password:

- Minimum 8 characters.
- Enter it twice to confirm.
- You cannot open the dashboard until this is completed.

### Forgot your password?

There is no emailed reset link. Ask a **Super Admin** to set a temporary
password for you from **Settings → Manage Users**. Sign in with that temporary
password and choose a new one when prompted.

### Signing out

Use the sign-out icon in the bottom-left user card (desktop sidebar), then
confirm **Log out**.

---

## 2. Know your role

The dashboard has two roles. Your role is shown as a badge in the top bar.

| Capability                                                                                | TO Staff | Super Admin |
| ----------------------------------------------------------------------------------------- | -------- | ----------- |
| Dashboard, Tourists, Establishments, Dive Operations, Dive Pass, Analytics, Announcements | Yes      | Yes         |
| Review operator applications                                                              | Yes      | Yes         |
| Verify payment receipts                                                                   | Yes      | Yes         |
| Add/edit dive sites and change site status                                                | Yes      | Yes         |
| Update GCash payment details / QR code                                                    | Yes      | Yes         |
| Edit dive-pass prices                                                                     | No       | Yes         |
| Delete a dive site                                                                        | No       | Yes         |
| Settings: Manage Users and Audit Logs                                                     | No       | Yes         |

Notes:

- Settings is hidden from TO Staff. Opening it directly shows a **Restricted
  area** message.
- Locked actions display an **Action locked** message.
- Client-side restrictions are reinforced by database security rules; some
  actions can still be refused by the server even when a button is visible.

---

## 3. Finding your way around

### Sidebar

The sidebar groups pages as follows:

- **Main** — Dashboard, Tourists, Establishments, Dive Operations, Dive Pass
- **Analytics** — Analytics
- **Content** — Announcements
- **System** — Settings (Super Admin only)

The active page is highlighted. On smaller screens the full sidebar is hidden.

### Top bar

From left to right:

- **Breadcrumb** — click **Dashboard** to return to the overview.
- **Date range** — `Today`, `7d`, `30d`, or `Custom`.
  - Custom shows **From** and **To** date fields.
  - Future dates are not accepted.
  - The range applies to Dashboard, Tourists, Establishments applications,
    Dive Manifestos, Dive Pass receipts, and Analytics.
  - It does not filter the establishment registry, the dive-site registry, or
    announcements.
- **Search** — global search across tourists, operators, receipts, and dive
  sites.
- **Install App** — appears when the browser supports installing the dashboard
  as an app.
- **Theme toggle** — switch between light and dark mode.
- **Notifications bell** — unread alerts and recent activity.
- **Data badge** — indicates whether figures are live or sample data.
- **Role badge and avatar** — your access level and account.

### Global search

Press **Ctrl + K** (Windows) or **Cmd + K** (Mac), or click the search box.

- Type a tourist name or ID to jump to the Tourist registry.
- Type an operator name to jump to Operator Applications.
- Type a receipt reference to jump to Dive Pass.
- Type a dive-site name to jump to Dive Sites.

Selecting a result opens the relevant page with the matching filter applied.

### Filters and shareable views

Tabs, search terms, status filters, and the date range are stored in the page
URL. This means you can bookmark or share a filtered view, and refreshing the
page keeps your current view.

Use **Clear all** or remove individual filter chips to reset a page.

### Notifications

The bell shows unread alerts. **Mark all read** clears the badge. Clicking an
alert marks it read; tourist-linked alerts also open that tourist's record.

### Offline use

If the connection drops, an **Offline Mode** banner appears and cached data is
shown. Reconnect and select **Check connection** to resume live updates.

---

## 4. Page-by-page guide

### 4.1 Dashboard

The landing page gives a quick picture of tourism activity.

- **Welcome banner** — greeting, today's diver count, and pending application
  and receipt counts. Use **View manifestos** or **New announcement** for quick
  actions.
- **KPI cards** — Tourists, Active Users, Divers Today, Approved Operators, and
  Active Sites. Hover the info icon for a definition. Click a card to open the
  related page with filters applied.
- **Action Required strip** — pending operator applications, unverified
  receipts, and passes expiring within 30 days. Each item opens the matching
  work queue.
- **Monthly Trends** — switch between **Tourists** and **Divers**.
- **Nationality Mix**, **Dive Level**, **Dive Type**, and **Top Dive Sites** —
  click a chart segment, slice, or bar to open a drill-down with details and
  sample records.
- **Insight widget** — a short written summary generated from the same figures
  shown on the page.

Cards or panels marked **Sample** or **Sample data** are not yet backed by live
records.

### 4.2 Tourists

Two tabs are available:

#### All Divers & Tourists

- **KPI cards** — Total Divers Registered and dive-professional counts. Click a
  card to jump to the relevant tab or filter.
- **Search and filters** — search by name or ID; filter by status, nationality,
  and dive level.
- **Export CSV** — downloads the currently filtered rows.
- **Registry table** — Tourist ID, name, nationality, dive level, registration
  date, expiry date, and status.
- **Duplicate Name** badge — warns that another record uses the same name.
  Open the profile to check identity details.
- **View** — opens the Tourist Profile with nationality, dive type, level,
  registration and expiry dates, and emergency contact.
  - **Suspend / Reactivate** changes the tourist's status.
  - **Renew ID** extends the Eco-Dive ID by one year from today.
- **Click a table row** — opens the tourist's dive history: date, site, depth,
  divemaster, and operator.

#### Dive Instructors / Masters

This tab lists dive professionals and their accreditation.

- **Search** by name, ID, PCSSD/PTO number, or dive shop.
- **Guiding Credentials** filter — complete documents or missing documents.
- **TO Clearance** filter — Verified, Pending, or Suspended.
- **Registry columns** — Pro ID, name, role, PCSSD and PTO numbers, affiliated
  dive center, document status, and municipal dive pass.
- **Credentials** — opens the full credential dossier with documents.
- **Verify** — requires both a PCSSD accreditation (number and certificate) and
  a Municipal Permit to Operate (number and document). Until both are present,
  verification is disabled.
- **Revoke** — removes verification from an already verified professional.
- **Issue Annual Pass** — after verification, issues a one-year municipal pass.
- **One-Day Pass** — issues a single-day pass.
- **Renew Annual Pass** — shown when an annual pass already exists.

### 4.3 Establishments

The page opens on the registry. Use the tabs to switch views.

#### Registered Establishments

- **KPI cards** — Registered Establishments, Pending Applications, and Active
  Operators. Click a card to open the matching view.
- **Search and filters** — search by establishment; filter by status (Active,
  Suspended, Expired) and barangay.
- **Export CSV** — downloads the filtered registry.
- **Registry table** — establishment, owner, barangay, status, permit expiry,
  manifestos, and credit balance.
- **Row detail** — opens the establishment profile with permit information,
  contact details, address, documents, manifest/credit totals, and accreditation
  documents (PCSSD, DOT, and others).
- **Suspend** — available for Active establishments; requires a reason.
- **Reactivate** — restores a Suspended establishment.
- **Renew** — shown for Expired establishments.

#### Operator Applications

This view is for reviewing new operator applications.

- Use the sub-tabs **Applications** and **Active Operators**.
- The **Applications** tab shows pending and rejected applications. Approved
  applications graduate into the Registered Establishments list.
- **Search and filters** — search by name, owner, or ID; filter by status.
- **Document indicators** — Business Permit, PCSSD Accreditation, and DOT
  Accreditation show whether each document is attached.
- **Review** — opens the application dossier for a full check.
- **Approve** — approves the application and creates the establishment record.
- **Reject** — requires a reason; rejected applications stay on record.
- **Reopen** — returns a settled application to Pending.
- **Bulk actions** — select multiple rows to approve or reject them together.
  Failed rows remain selected so you can retry.
- **Active Operators** sub-tab lists approved operators; **Deactivate** starts
  the rejection flow.

### 4.4 Dive Operations

#### Dive Manifestos

- **KPI cards** — Active Dives, Manifestos This Month, and Dive Sites.
- **Search and filters** — search by operator, site, or ID; filter by dive site.
- **Verification filter** — All, Verified, or Unverified.
- **Sync Live Data** — refreshes manifestos from the database.
- **Select rows** — use the checkboxes to enable bulk actions.
  - **Export CSV** downloads the selected manifestos.
  - **Forward** opens the dispatch dialog.
- **Manifesto card actions**
  - **Shield button** — mark verified or unverified.
  - **Image button** — download the manifesto as a PNG.
  - **Forward button** — share the manifesto.
  - **Eye button** — open full details, including the diver roster.
- **Full details**
  - **Print / PDF** opens a formatted, print-ready manifesto in a new tab.
  - **Copy Photo**, **Download Photo**, and **Copy details as text** are quick
    sharing options.
  - **Agency Email Dispatch** lets you select accredited agencies, add an
    official message, and forward the manifesto.

#### Dive Sites

- **Search and filters** — search by name, ID, or barangay; filter by status,
  difficulty, and site type.
- **Add Site** — opens the site form.
- **Registry table** — photo, Site ID, name, barangay, depth, difficulty, type,
  total dives, and status.
- **Row actions**
  - **View** opens the site profile.
  - **Status cycle** rotates Active → Restricted → Seasonal → Active.
  - **Edit** is available from the site profile.
  - **Delete** is Super Admin only and is blocked while manifestos reference
    the site. Set the site to **Restricted** instead.
- **Dive Site Heatmap** — shows site pins and activity density within Mabini
  waters. Restricted sites show an indicative marine zone. Click a pin to open
  the site.
- **Site form fields** — name, barangay, depth range (for example `10-30 m`),
  difficulty, one or more site types, latitude, longitude, description, and an
  optional photo. New sites start as **Active**; change the status from the
  registry.

### 4.5 Dive Pass

- **KPI cards** — Total Passes, Active Passes, and Expiring Soon.
- **Receipt cards** — each card shows the uploaded receipt image and its status.
- **Search and filters** — search by operator, reference number, or receipt ID;
  filter by Pending, Approved, or Rejected.
- **Payment Details / QR** — opens the official GCash recipient details and QR
  code. Staff can update the recipient name, number, and QR image.
- **Edit pricing** (Super Admin only) — opens one dialog for all pass prices.
  Only changed rows are saved.
- **Open a receipt image** — click the receipt thumbnail to open a larger
  lightbox view.
- **Select receipts** — use the checkboxes to enable bulk approve or reject.
- **Receipt details** — click a card to view operator, reference number,
  purchased quantity, total amount, price per pass, status, and submission date.
- **Approve / Reject** — settles the receipt. Rejection requires a reason.
  Approved and rejected receipts remain visible for the record.

### 4.6 Analytics

The page shows the active date range and aggregation grain (daily, weekly, or
monthly). A small **Updating…** indicator appears while figures refresh.

Tabs:

- **Tourist** — planned trip demand from the dive planner (preferred activities,
  length of stay, group size, budget tier, forward demand) plus registry trends,
  nationality distribution, dive levels, and a tourist leaderboard.
- **Dive Activity** — dive type breakdown, depth distribution, hourly activity,
  site-by-type mix, seasonal trends, and site capacity utilization.
- **Dive Pass** — verified revenue, credits used, average utilization, pending
  queue, pass-type distribution, purchases over time, and revenue versus credit
  burn.
- **Establishment** — establishments by location, permit/compliance status,
  manifests and credits per establishment, and a leaderboard.
- **Operator** — active operators, manifestos filed, divers logged, revenue,
  revenue contribution, manifests/credits per operator, and a leaderboard.
- **Reports** — generate official summaries.

#### Reports

1. Choose **Daily**, **Weekly**, or **Monthly**.
2. Pick a preset: **30d**, **This Month**, **Last Month**, or **YTD**, or set
   **From** and **To** dates.
3. Select **Generate report**.
4. Review the preview table: period, tourists, operators, manifestos, dives, and
   revenue, plus a dive-type aggregation.
5. Export:
   - **Print PDF Report** — choose A4, Letter, or Legal, then print or save as
     PDF.
   - **Export Raw Data as CSV** — opens the tabular breakdown for spreadsheets.

### 4.7 Announcements

The page has two columns: the announcement list and the **New announcement**
form.

- **Status filters** — All, Published, Scheduled, Draft, and Archived, with
  counts.
- **Announcement cards** — show the hero preview, title, status, timing, and
  body.
- **Edit** — changes the title, body, event dates, and photo. Editing does not
  change the announcement's status or schedule.
- **Delete** — removes the announcement.
- **Draft actions** — **Publish** sends immediately.
- **Scheduled actions** — **Cancel** returns it to Draft; **Send now** publishes
  immediately.
- **Archived actions** — **Republish** makes it live again.
- **Published** — already live for tourists.

#### Create an announcement

1. Enter a **Title** and **Body** (both required).
2. Optionally add a **Hero photo**. Without a photo, a blue gradient is used.
3. Turn on **Send later** to choose a send **Date** and **Time**.
4. Optionally set an **Event date** range. The end date cannot be before the
   start date.
5. Select **Publish** to send now, or **Schedule** when **Send later** is on.

### 4.8 Settings (Super Admin only)

#### Manage Users

The staff roster is loaded from the live database.

- **Invite Staff** — enter full name, email, temporary password (at least 8
  characters), and role (TO Staff or Super Admin).
- **Role** — change a staff member's role from the roster.
- **Change pw / Reset pw** — set a new password.
  - For another user, this sets a temporary password and forces a change at
    their next sign-in. Share it out-of-band.
  - For yourself, it updates your password without signing you out.
- **Suspend / Reactivate** — blocks or restores access immediately.
- **Delete** — permanently removes a suspended account. You must type the
  account email to confirm.
- **Guards** — you cannot suspend, delete, or change your own access, and the
  last active Super Admin cannot be removed.
- **Temp password** badge — the account is still using an administrator-set
  temporary password.

#### Session Timeout

The timeout selector at the top of Settings controls how long an idle session
lasts, from 30 seconds to 30 minutes, or **Never**.

#### Audit Logs

- **Search** by user or action.
- Filter by **User**, **Action type**, **From**, and **To** dates.
- **Export CSV** downloads the filtered log.
- Logs combine recent database entries with the current session and show
  whether syncing is in progress.

---

## 5. Common workflows

### Review an operator application

1. Open **Establishments → Operator Applications**.
2. Select **Applications**.
3. Find the application and select **Review**.
4. Check the Business Permit, PCSSD Accreditation, and DOT Accreditation.
5. Select **Approve** or **Reject** (with a reason).

Approved operators move to **Registered Establishments**.

### Verify a payment receipt

1. Open **Dive Pass**.
2. Search by operator or reference number, or filter to **Pending**.
3. Click the receipt image to inspect it.
4. Open the receipt details to check quantity, amount, and price per pass.
5. Select **Approve** or **Reject** (with a reason).

To settle several at once, select their checkboxes and use the bulk approve or
reject buttons.

### Verify and print a manifesto

1. Open **Dive Operations → Dive Manifestos**.
2. Search by operator, site, or ID.
3. Use the shield button to mark the manifesto **Verified**.
4. Open the manifesto with the eye button.
5. Select **Print / PDF** for a print-ready document, or download the PNG image.

### Verify a dive professional and issue a pass

1. Open **Tourists → Dive Instructors / Masters**.
2. Search for the professional and open **Credentials**.
3. Confirm the PCSSD certificate and Municipal Permit to Operate are attached.
4. Select **Verify Pro Credentials**.
5. Issue an **Annual Pass** or **One-Day Pass**.
6. Use **Renew Annual Pass** when the annual pass is due again.

### Add a dive site

1. Open **Dive Operations → Dive Sites**.
2. Select **Add Site**.
3. Enter the name, barangay, depth range, difficulty, site types, coordinates,
   and optional photo.
4. Save. The site appears in the registry and on the heatmap as **Active**.

### Publish an announcement

1. Open **Announcements**.
2. Fill in the **New announcement** form.
3. Add an optional photo, schedule, or event dates.
4. Publish now or schedule it for later.

### Export data

- Tourists, Establishments, Dive Manifestos, and Audit Logs have their own
  **Export CSV** actions.
- Analytics exports are under **Analytics → Reports**.

---

## 6. Task finder

| I need to…                             | Go to…                                              |
| -------------------------------------- | --------------------------------------------------- |
| Review a new operator                  | Establishments → Operator Applications → Review     |
| Verify a receipt                       | Dive Pass → select a receipt → Approve/Reject       |
| Verify or print a manifesto            | Dive Operations → Dive Manifestos                   |
| Add or edit a dive site                | Dive Operations → Dive Sites                        |
| Verify an instructor or divemaster     | Tourists → Dive Instructors / Masters → Verify      |
| Issue or renew a dive pass             | Tourists → Dive Instructors / Masters → Credentials |
| Renew a tourist Eco-Dive ID            | Tourists → All Divers & Tourists → View → Renew ID  |
| Suspend or reactivate an establishment | Establishments → Registered Establishments          |
| Export a registry                      | Use the page's **Export CSV** button                |
| Generate an official report            | Analytics → Reports                                 |
| Publish an announcement                | Announcements → New announcement                    |
| Add staff or reset a password          | Settings → Manage Users                             |
| Review who changed what                | Settings → Audit Logs                               |

---

## 7. Reference

### Status glossary

| Area                  | Statuses and meaning                                                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tourist / Eco-Dive ID | **Active** — valid; **Expired** — past expiry; **Suspended** — access blocked                                                                                                                                                    |
| Operator application  | **Pending** — awaiting review; **Approved** — graduates to the registry; **Rejected** — declined with a reason                                                                                                                   |
| Establishment         | **Active** — accredited; **Suspended** — temporarily blocked; **Expired** — permit lapsed                                                                                                                                        |
| Manifesto             | **Verified** — checked by the Tourism Office; **Unverified** — awaiting check                                                                                                                                                    |
| Dive site             | **Active** — open; **Seasonal** — limited period; **Restricted** — use instead of deletion when references exist                                                                                                                 |
| Receipt               | **Pending** — awaiting verification; **Approved** — accepted; **Rejected** — declined with a reason                                                                                                                              |
| Announcement          | **Published** — live; **Scheduled** — queued; **Draft** — not sent; **Archived** — retired                                                                                                                                       |
| Dive professional     | **Pending Review** — awaiting verification; **Verified (No Pass)** — credentials checked, no municipal pass yet; **Annual Pass** — annual pass issued; **One-Day Pass** — single-day pass issued; **Suspended** — access blocked |

### Data badges

- **Live** — figures come from the connected database.
- **Demo data** — built-in sample data is being shown.
- **Live error — demo fallback** — a live query failed and sample data is shown
  instead.
- **Sample** / **Sample data** — that individual card or panel is not yet backed
  by live records.

### Tips

- Press **Ctrl + K** or **Cmd + K** anywhere to search.
- Where available, click KPI cards and chart segments to drill into the
  underlying records.
- Use the date range to keep date-filtered pages on the same reporting window.
- Copy the page URL to share a filtered view with a colleague.
- Hover info icons, where available, for KPI definitions.

### Troubleshooting

| Problem                                        | What to do                                                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Cannot sign in                                 | Check your email and password. Your account may be suspended. Contact a Super Admin.                                       |
| Forgot password                                | Ask a Super Admin to set a temporary password from Settings → Manage Users.                                                |
| Settings is missing or shows "Restricted area" | Settings is limited to Super Admins. Ask a Super Admin for help.                                                           |
| "Action locked" message                        | Your role does not allow that action. Super Admin-only actions include pass pricing and dive-site deletion.                |
| Live data unavailable                          | Check your connection and reload. The dashboard may show a demo fallback until the connection returns.                     |
| Receipt image will not load                    | Close and reopen the receipt. If it still fails, check the connection; receipt links expire.                               |
| Cannot delete a dive site                      | Only a Super Admin can delete sites, and sites referenced by manifestos cannot be deleted. Set the site to **Restricted**. |
| Offline Mode banner                            | You are viewing cached data. Reconnect and select **Check connection**.                                                    |
| Session expired                                | Sign in again. Live writes require a valid session.                                                                        |

### Terms

- **Eco-Dive ID** — the tourist's municipal dive registration record.
- **Dive Pass** — a municipal pass required to dive in Mabini waters. It can be
  annual or one-day.
- **Manifesto** — the boat's official list of divers for a trip.
- **PCSSD** — Philippine Commission on Sports Scuba Diving accreditation.
- **PTO** — Municipal Permit to Operate.
- **DOT** — Department of Tourism accreditation.
- **Credits** — the establishment's remaining dive-pass credit balance.

---

For setup, deployment, and developer details, see `README.md`.
