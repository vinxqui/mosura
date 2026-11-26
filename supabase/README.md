# FITBOOK: Supabase setup

## Why the old version "had no database"
Every page saved its data in the browser's `localStorage`, and login only accepted four built-in accounts. So nothing was shared between computers, and clearing the browser wiped everything.

## What changed
* **`supabase/fitbook_schema.sql`** creates the database: user profiles with roles, the data tables, the security rules, and the four test accounts.
* **`gtg-db.js`** (loaded first on every page) loads the latest data from Supabase before the page's own scripts run, and sends every change back to Supabase. The page code itself did not need rewriting.
* **`supabase-config.js`** is where the project URL and anon key go.
* **`login.html` / `signup.html`** now use Supabase Auth (real accounts, hashed passwords).
* **`auth.js`** takes the role from the `profiles` table.
* **`sw.js`** no longer caches database requests.

## Setup (5 minutes)
1. Create a Supabase project.
2. **SQL Editor → New query**, paste all of `supabase/fitbook_schema.sql`, click **Run**. Running it again later is safe.
3. **Project Settings → API**: copy the **Project URL** and the **anon public** key into `supabase-config.js`.
4. **Authentication → Sign In / Providers → Email**: turn **Confirm email** off while testing (otherwise new sign ups must click the email link first).
5. Open the site and log in with one of the test accounts:

| Email | Password | Role |
|---|---|---|
| owner1@gmail.com | owner | Owner |
| admin1@gmail.com | admin | Admin |
| trainer1@gmail.com | trainer | Trainer |
| member1@gmail.com | member | Member |

Change these passwords (Authentication → Users) before going live.

6. First run: log in as **owner** and open the owner/admin pages once (classes, trainers, equipment, employees, payments ...). Their starter data is saved to the database at that moment. After that every browser sees the same data.

## Making someone a trainer / admin / owner
New sign ups are **members**. To change a role, run in the SQL Editor:
```sql
update public.profiles set role = 'trainer' where email = 'person@example.com';
```

## Where the data is
* `app_records`: every saved item (one row per trainer, class, payment, enrollment, feedback, ...). `collection` says which list it belongs to and `data` holds the item.
* Easy-to-read views: `v_payments`, `v_trainers`, `v_classes`, `v_employees`, `v_equipment`, `v_feedback`, `v_enrollments`.
* `profiles`: user accounts and their roles.
* `contact_messages`: messages sent from the Contact page (admin and owner can read them in the Table Editor).
* `app_collection_rules`: which role can read and change each list, and which lists are private to each member (`own_only`). Edit it to tighten or loosen access.

## Security notes
* Guests can only read public lists (classes, trainers, equipment, schedules, announcements).
* Members can add payments, enrollments and feedback. A member cannot verify a payment; only trainer, admin and owner can change a payment status.
* Members only see their own payments, enrollments and measurements, and cannot change anyone else's.
* Admin pages need an admin or owner login; owner pages need the owner.
* The `?role=` demo switch in `auth.js` turns itself off once `supabase-config.js` is filled in.
