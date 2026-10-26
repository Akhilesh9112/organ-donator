# OrganSync — connected by care

An updated four-role coordination application for donors, recipients, verified hospitals, and administrators. Release 2.2 applies the approved vibrant blue-and-violet theme to all role dashboards and public pages. See `docs/THEME_UPDATE.md` for the visual update instructions. Release 2.1 adds duration-aware scheduling and concurrent overlap protection. This revision replaces the separate legacy dashboards with one responsive, role-aware care workspace and repairs the core transactional workflow.

**Status:** locally validated development/pilot foundation. It has not been deployed to your infrastructure, clinically validated, load-tested, or approved as an official allocation system. Read `docs/LAUNCH_CHECKLIST.md` before using real data.

## Start in VS Code

Requirements: Node.js **24 LTS**, npm, and an authenticated MongoDB replica set (for example, a dedicated development Atlas cluster). Standalone MongoDB does not support the transactions used by this project. Never point tests at a live patient database.

1. Open this `Test` folder in VS Code.
2. In terminal 1:

```bash
cd backEnd
npm ci
```

Copy `.env.example` to `.env`. Set your own `MONGO_URI`, `MONGO_DATABASE`, and randomly generated `JWT_SECRET`. Leave `MAIL_MODE=disabled` only for local development; do not reuse credentials from the uploaded archive.

3. For a new empty database:

```bash
npm run db:check
npm run db:indexes
```

For an existing database, follow `docs/MIGRATION.md` first. The checker refuses to create indexes when legacy assignments or duplicates remain; it never guesses clinical relationships.

4. Provision the first administrator. Set `ADMIN_EMAIL`, `ADMIN_PHONE`, `ADMIN_NAME`, and a strong `ADMIN_PASSWORD` (12+ characters, mixed case, number, symbol) temporarily in `.env`, then:

```bash
npm run seed:admin
npm run dev
```

Remove `ADMIN_PASSWORD` from `.env` after provisioning. There is no default production administrator or public admin registration.

5. In terminal 2:

```bash
cd frontEnd
npm ci
npm run dev
```

Open **http://localhost:3000**. Vite proxies `/api` to port 8080. The frontend uses `/api` by default; set `VITE_API_URL` only for a separate API origin. Donor/recipient accounts select their care hospital in **Care settings** after registration.

## End-to-end workflow

1. A hospital registers with its licence. An administrator reviews the organization and verifies its account.
2. A donor and recipient register and independently select that verified care hospital.
3. Each submits medical evidence. The assigned hospital reviews the original document, records its notes, and confirms the blood group. PDF extraction assists review; images/scans can be manually reviewed.
4. A donor records a **Living** pledge for kidney or partial-liver screening. A **Deceased pledge** records future intent and is excluded from this living-donor flow.
5. The hospital screens an assigned recipient against active living pledges with matching verified blood groups, then sends a basic-screening recommendation.
6. The recipient requests donor consent from that recommendation. The donor accepts or declines.
7. Acceptance atomically reserves the pledge and closes competing pending requests. Only the assigned hospital can begin allocation review.
8. After confirming required external clinical checks and approvals, the hospital assigns a clinician and schedules a future appointment in IST with an explicit duration (15–480 minutes, in 15-minute increments). The full interval must be free for the clinician, donor, and recipient. Both donor and recipient see it.
9. The hospital can reschedule, cancel with a reason, or complete an appointment whose scheduled end has elapsed. Linked case, allocation, operation, and pledge states stay synchronized.
10. Participants can withdraw from active cases; donor withdrawal closes linked events and competing pending requests. Completed evidence and case history are retained.

Clinical suitability, organ-specific eligibility, crossmatch, consent procedures, and final allocation remain the responsibility of authorized professionals. Self-reported registration data does not establish verified compatibility.

## Commands and verification

Backend:

```bash
cd backEnd
npm test
npm audit --omit=dev
```

The Node test suite starts an isolated temporary MongoDB replica set and uses only synthetic users and reports. Its first run downloads MongoDB 7.0.24. It does not load your `.env` or connect to its database.

Frontend:

```bash
cd frontEnd
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

The browser suite starts an isolated fixture API and serves the built frontend at port 18080. Run the build first. Fixture credentials are test-only (`*@example.test`) and are never created by normal server startup.

See `docs/VALIDATION_REPORT.md` for results and scope. GitHub Actions runs the API, frontend, dependency, build, and browser checks.

## Deployment

`compose.yaml` builds the API and frontend reverse proxy. Configure a replica-set database, SMTP, secure secrets, `FRONTEND_URL=https://your-domain`, `MAIL_MODE=smtp`, persistent private document storage, and a TLS ingress first. Production startup refuses a short JWT secret, non-HTTPS frontend URL, disabled email, or standalone MongoDB.

```bash
docker compose build
docker compose up -d
```

The frontend listens on local port 8081 behind your TLS ingress; the API is not published directly. Set `TRUST_PROXY=1` only when the ingress topology actually has one trusted proxy hop and direct API traffic is blocked. Pin container image digests for your release. Docker images and ingress deployment have not been exercised in this review environment.

Workflow emails use an outbox committed alongside the care transaction, with leased jobs and up to five attempts. Failed jobs appear under the admin **Email delivery** tab and can be retried. Delivery is at-least-once: a crash after SMTP accepts an email but before acknowledgement can produce a duplicate. Password-reset email remains a separate direct send; monitor SMTP independently.

## Main implementation

- `backEnd/app.js`: importable Express API; `index.js`: validated startup and shutdown.
- `backEnd/controllers`: role checks, transactions, private evidence, consent, scheduling.
- `backEnd/services/outboxService.js`: durable notification delivery.
- `backEnd/scripts/checkMigration.js`: read-only preflight and guarded index creation.
- `frontEnd/src/pages/PortalDashboard.jsx`: shared role workspace.
- `frontEnd/src/components/ui`: accessible reusable controls, dialogs, feedback, and tables.
- `frontEnd/e2e/workflow.spec.js`: real browser journeys.

No original secrets or uploaded patient PDFs are included in this deliverable.
