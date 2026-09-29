# PMC — Tech Billing Software

A patient billing workspace for Positive Mind Care, built with Next.js (App Router) and a real MongoDB backend. Register patients, bill them for services, track dues and payments, and see revenue reports — no GST anywhere, since healthcare services are tax-exempt in India. Every page and every API route requires a signed-in staff account, so only authorised people can create or edit a bill.

## Run locally

**1. MongoDB must be running locally** (Windows service `MongoDB`, or `mongod` however you normally start it). This app talks to `mongodb://127.0.0.1:27017/pmc_billing` by default — copy `.env.example` to `.env.local` and edit `MONGODB_URI` if yours is different. Also set `AUTH_SECRET` in `.env.local` to a random string (used to sign login sessions) — generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

```bash
npm install
npm run seed   # creates the pmc_billing database and fills it with demo data
npm run dev
```

Open http://localhost:3000 — you'll land on **/register** since nobody is signed in yet. Create a staff account (name, email, password); it takes you to **/login** to sign in with those details next (registering doesn't auto sign-in). From there, every page and API route is locked behind that session cookie. Open the same `mongodb://127.0.0.1:27017` connection in **MongoDB Compass** to browse the `pmc_billing` database directly — you'll see five collections: `patients`, `services`, `bills`, `profile`, `users`.

`npm run seed` is safe to re-run any time — it wipes and reinserts the demo data (patients/services/bills/profile only, staff accounts in `users` are untouched), so use it to reset back to a clean state.

## Architecture

- **`lib/models/`** — Mongoose schemas (`Patient`, `ServiceItem`, `Bill`, `Profile`). This is the real "database tables."
- **`lib/mongodb.ts`** — the cached MongoDB connection Next.js route handlers share.
- **`app/api/*/route.ts`** — the REST API (see below). Every read/write goes through here; nothing talks to MongoDB directly from the browser.
- **`lib/store.tsx`** — a React Context (`BillingProvider`) that fetches from the API on load and exposes typed actions (`addPatient`, `addBill`, `recordPayment`, ...) that call the API and update local state from the response. Every page reads from this, never from Mongo/fetch directly.
- **`scripts/seed.ts`** — the `npm run seed` script; seed data itself lives in `lib/seed-data.ts`.

## API reference

All routes are under `/api` and return JSON. Errors come back as `{ "error": "message" }` with a 4xx/5xx status.

| Method | Route | What it does |
|---|---|---|
| POST | `/api/auth/register` | Create a staff account (`name`, `email`, `password`) and sign them in |
| POST | `/api/auth/login` | Sign in with `email` + `password` |
| POST | `/api/auth/logout` | Clear the session cookie |
| GET | `/api/auth/me` | Who's currently signed in |
| GET | `/api/patients?q=` | List patients, optionally filtered by name/phone/email |
| POST | `/api/patients` | Register a patient — only `name` is required |
| GET | `/api/patients/:id` | One patient |
| PUT | `/api/patients/:id` | Update a patient's fields |
| DELETE | `/api/patients/:id` | Remove a patient |
| GET | `/api/services?q=` | List the billable service catalog |
| POST | `/api/services` | Add a service (consultation, test, procedure, ...) |
| PUT | `/api/services/:id` | Edit a service |
| DELETE | `/api/services/:id` | Remove a service |
| GET | `/api/bills` | List all bills, newest first |
| POST | `/api/bills` | Create a bill for an already-registered patient — pass `patientId`, or a `patientName` that matches one exactly (billing never creates a patient; register them via `/api/patients` first); pass `id` to pick your own bill number, or omit it to auto-number |
| GET | `/api/bills/:id` | One bill |
| PUT | `/api/bills/:id` | Record a payment (`paidAmount`) or edit `notes` — status (Pending/Paid — Paid only once `paidAmount` reaches the full `amount`) is always recomputed server-side, never trusted from the client |
| GET | `/api/profile` | The clinic's settings (created with defaults on first read) |
| PUT | `/api/profile` | Update clinic name, contact info, currency, bill number prefix |

Line-item prices are always re-read from the `services` collection when a bill is created — the client can't inflate or fake a price. Bill numbers auto-increment atomically (`$inc` on the profile document) so two bills created at the same instant can never collide, unless you explicitly type your own number.

Every route above except the auth ones requires a valid session cookie — `middleware.ts` checks that on every request (page or API) and either 401s (API) or redirects to `/login` (page) if you're signed out.

## Authentication

`middleware.ts` gates the entire app: `/login` and `/register` (plus the `/api/auth/*` routes) are the only things a signed-out visitor can reach — everything else redirects there, defaulting to `/register` (a brand-new visitor's first stop). Registering creates the account but does not sign it in — the page sends you to `/login` to sign in explicitly. Sessions are a signed JWT (`jose`, `HS256`) in an httpOnly `pmc_session` cookie, valid for 30 days; passwords are hashed with `bcryptjs` (`lib/password.ts`) and never stored in plain text. `lib/auth.ts` only touches `jose` (no `mongoose`/`bcryptjs`) so it can run in the Edge middleware; the Node-only pieces stay inside the API routes. There's no role system yet — every signed-in account can do everything.

## Feedback toasts

Every save/create/payment/sign-in action shows a toast (top-right) confirming what happened — `lib/toast.tsx`'s `ToastProvider` (mounted in the root layout) exposes `useToast().showToast(message)` for in-app actions. Actions that end in a hard redirect (register, login, logout) use `flashToast()` instead, which queues the message in `sessionStorage` so the *next* page — loaded fresh after the redirect — picks it up once on mount and shows it.

## Downloading a bill

Every bill has a receipt view at `/bills/:id` (open it from the download icon on the Bills list, or by clicking a bill number). Its "Download / Print" button calls the browser's native print dialog with a print stylesheet that hides the sidebar/topbar and keeps just the receipt — choosing "Save as PDF" there is how a bill gets downloaded, no extra PDF library needed.

## Branding

The sidebar and favicon use Positive Mind Care's actual logo (`public/pmc-logo.png`, and an inline SVG mark for the favicon in `app/icon.svg`), and the color palette (`app/globals.css`) is built from the brand's own primary green (`#385246`), not an invented color.

## Recommended next steps

1. Add roles (e.g. reception vs. admin) — right now every signed-in account can do everything.
2. Rate-limit `/api/auth/login` so repeated wrong passwords can't be brute-forced.
3. Add indexes in MongoDB for the fields the app queries most (`patients.name`, `bills.patientId`, `bills.date`, `users.email`) once real data volume grows.
4. Add audit logging (who created/edited a bill) if more than one staff member will use this.
5. Move validation currently duplicated between the API and the forms into a shared schema (e.g. Zod) so both stay in sync automatically.
