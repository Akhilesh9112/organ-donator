# OrganSync validation report

Validated on 22 October 2026 using Node.js 24.19.0 and an isolated temporary MongoDB 7.0.24 replica set. No original database credentials were used. All users, reports, and browser fixtures were synthetic.

## Before fixes

The original frontend built. All four roles could log in, and pledge/request/allocation/scheduling endpoints worked in a simple sequential path. However:

- Anonymous callers could list profiles.
- A recipient request triggered an unhandled SMTP error that stopped the process under normal Node behavior.
- Continuing the baseline with unhandled rejection warnings allowed the remaining workflow to be inspected: the donor's appointment history was empty, and completing an appointment left its allocation Scheduled.
- Hospital record access was not restricted by care relationship.
- Hospital licence data and reset-password navigation were incomplete.

## Final automated results

| Check | Result |
| --- | --- |
| Backend Node test runner | **44 passed, 0 failed** (28 original scenario subtests, their parent test, and 15 scheduling/migration tests) |
| Frontend Vitest | **11 passed, 0 failed** |
| Playwright browser tests | **5 passed, 0 failed** |
| Vite production build | **Passed** |
| Backend production dependency audit | **0 known vulnerabilities reported** |
| Frontend dependency audit, including dev tooling | **0 known vulnerabilities reported** |

Release 2.1 additionally verifies duration validation, midnight rollover, normalized clinician conflicts, donor/recipient conflicts with different clinicians, adjacent bookings, racing overlapping bookings, atomic rescheduling rollback, completion after the end time, cancellation releasing time, actor attribution, and read-only migration checks for invalid/overlapping intervals. Frontend checks cover duration submission and in-progress completion restrictions. The browser journey selects a 90-minute appointment and verifies it in both participant views.

The build's main JavaScript asset is approximately 65.7 kB gzip; CSS is approximately 6.5 kB gzip. These are build outputs, not performance/load-test results.

### Backend coverage

- Health/readiness, login, validation, hospital licence persistence, role restrictions, malformed IDs.
- Explicit care-hospital selection and access boundaries for unrelated/unverified hospitals.
- Spoofed-file rejection and cleanup; private owner download; text-PDF extraction and manual verification.
- Duplicate pledge races, recommendation evidence, request creation, concurrent donor acceptance, competing-recipient acceptance.
- Assigned-hospital allocation, duplicate allocation races, future dates, required clinical confirmation, and rollback on invalid scheduling.
- Donor and recipient appointment history, future-completion prevention, synchronized completion and cancellation.
- Exact-slot and interval-overlap rollback, retained pledge withdrawal, consent withdrawal after scheduling.
- Deceased pledge exclusion from living-donor screening.
- Admin statistics/audit, account suspension, archive restrictions, reset-token single use under concurrent requests, and JWT revocation.
- Durable email outbox creation, SMTP failure retries, failed-job admin retry, and disabled-mode behavior.

### Browser coverage

1. Donor workspace: every navigation section, 1440px desktop and 390px mobile.
2. Recipient workspace: every navigation section, desktop and mobile.
3. Hospital workspace: every navigation section, desktop and mobile.
4. Admin workspace: every navigation section, desktop and mobile.
5. Full multi-user UI journey: hospital registration → administrator verification → donor and recipient registration → each chooses that hospital → each uploads synthetic evidence → hospital verifies evidence → donor pledges → hospital screens and recommends → recipient requests → donor accepts → hospital reviews and schedules → both participants see the appointment → hospital cancels → donor sees withdrawn pledge history.

Browser runs reported no page errors on the role navigation checks and no document-wide horizontal overflow at the checked mobile width. Internal screenshots were visually inspected; they are not included as user deliverables.

## Verification limits

Actual SMTP, production secrets, cloud hosting, Docker builds, TLS ingress, existing-data migration, medical-report diversity, clinical approvals, load capacity, independent penetration testing, and legal/regulatory requirements were not verified. There is no automatic clinical HLA/crossmatch or official deceased-organ allocation engine. See LAUNCH_CHECKLIST.md and MIGRATION.md.

## Reproduce

- Backend: `cd backEnd` then `npm ci` and `npm test`.
- Frontend: `cd frontEnd` then `npm ci`, `npm test`, `npm run build`, `npx playwright install chromium`, and `npm run test:browser`.
- Browser tests start their own isolated fixture. They do not use your `.env` or real database.
- For a restricted environment with an existing compatible Chromium, Playwright also accepts `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.

## Visual release 2.2 — 25 October 2026

The approved vibrant blue-and-violet theme was applied to all four dashboards and public pages. This visual release passed 11 frontend unit tests, 6 browser tests (including the complete care workflow and public-page navigation), and the production build. Desktop/mobile layouts were visually inspected. The backend was not changed in this release; its 44-test result above is historical, not a newly executed backend run. See THEME_UPDATE.md for applying the visual files to an existing installation.
