# Release 2.2 — vibrant dashboard and public-page theme

- Applied the approved navy, cobalt, violet, cyan, emerald, and orange palette across donor, recipient, hospital, and admin workspaces.
- Added bright metric icon tiles, gradient active navigation, a glowing CSS heart emblem, and stronger text contrast.
- Updated the public home page with matching hero artwork and colorful feature cards.
- The shared theme also covers sign-in, registration, reset-password, dialogs, tables, notifications, and settings.
- Added restrained hover effects, visible keyboard focus, reduced-motion support, and responsive layouts.
- Kept the care workflow and backend behavior intact.
- Validation: 11 frontend unit tests, 6 browser tests, and the production build passed. Backend files were unchanged in this visual release; the previous 44-test backend result is retained as historical validation.

# Release 2.1 — scheduling integrity

- Appointment durations: 15–480 minutes, in 15-minute increments; 60 minutes is the new-form default, not a clinical recommendation.
- Persisted scheduled end times, shown alongside the start time and duration in role dashboards.
- Transactional resource locks serialize competing bookings. Full-interval conflicts are checked for the clinician within the hospital and for both participants across their appointments.
- Clinician matching normalizes Unicode, case, and whitespace. Verified clinician IDs and facility calendars remain separate launch work.
- Safe back-to-back bookings; cancellation frees the interval while retaining history.
- Rescheduling updates the appointment and operation together; a conflict rolls back all related writes and notifications.
- Completion requires the scheduled end to have elapsed. Terminal status changes cannot be combined with schedule edits.
- Read-only migration preflight detects missing/invalid interval fields and overlapping scheduled resources. Legacy hospital schedules with missing bounds block new bookings until reviewed.
- Human audit actions now record the acting account's name.
- Strict rejection of non-object JSON request bodies.

Validation: 44 backend tests, 11 frontend tests, 5 browser tests, and the production build pass. Full deployment/clinical launch prerequisites remain in docs/LAUNCH_CHECKLIST.md.
