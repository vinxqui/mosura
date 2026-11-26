# FITBOOK – GTG Fitness System

Gym management system for GTG Fitness: member sign up and login, class booking, trainer schedules, payments, body measurements, feedback, and admin/owner dashboards.

**Live site:** https://mosura-sand.vercel.app

## Stack

- Plain HTML, CSS and JavaScript (no build step), hosted on Vercel
- Supabase for the database, login accounts (Supabase Auth) and access rules

## Database and backend work

1. Real database on Supabase. Before, everything was saved only inside each user's browser, so nothing was shared between devices.
2. Real login accounts (Supabase Auth) instead of 4 accounts written in the code.
3. Sign up now creates a real member account.
4. Roles (member, trainer, admin, owner) come from the database.
5. Admin pages need an admin or owner login; owner pages need the owner.
6. Members only see their own payments, enrollments and measurements.
7. Only staff can verify or reject a payment.
8. Member feedback is saved and shows on the Admin/Owner feedback pages.
9. Contact form messages are saved to the database.
10. Payments and body measurements are saved under the logged-in member.
11. Each user's profile details are saved to their own account.
12. The offline app (service worker) no longer shows old database data.

## Not included (outside the scope of this job)

1. Online payments: the GCash and Maya QR codes are not connected to a real payment gateway. Payments are still confirmed by staff by hand.
2. Forgot password: the "Forgot your password?" link does not go anywhere yet.
3. Email or SMS notifications: none are sent.
4. Trainer's member progress list shows sample members, not real members.
5. Achievements page is fixed content, not linked to member activity.
6. Performance analytics charts are worked out in the browser; PDF export uses the browser's print function.
7. Photo uploads are saved inside the records as text, not in a file storage service.
8. Sample data: pages fill in sample classes, trainers, payments and feedback the first time the owner opens them.
9. Prices and plans are written in the pages (the 1-month All-Inclusive price of 1,490 is marked unconfirmed in the code).
10. Missing from the original project: `calendar-today.js` (used by 3 calendar pages) and the `icons` folder (trainer app icons).
11. `shell.js` shows a temporary red error bar, only when a page has a script error.

## Setup

See [`supabase/README.md`](supabase/README.md) for creating the database and connecting the site. The connection settings are in `supabase-config.js`.

---

Database and backend by **Vince Develop**.
