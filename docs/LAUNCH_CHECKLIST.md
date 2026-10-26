# Launch gates and practical limits

## Implemented and locally exercised

- Four distinct role workspaces; no public admin signup.
- Private, assigned-hospital medical records and original-file access auditing.
- Hospital licence persistence and explicit manual verification before clinical actions.
- Verified blood-group evidence, active living pledge checks, and scoped recommendations.
- Transactional recipient request, donor acceptance, allocation, scheduling, completion, cancellation, and withdrawal.
- Database uniqueness constraints and transactional resource locks for racing actions and overlapping clinician/participant bookings.
- Session validation on reload and revocation on password reset/suspension.
- Signature/size checks on private file uploads; no public uploads directory.
- Durable workflow email retries; generic messages do not include medical details.
- Responsive dashboards, role navigation, searchable paginated tables, keyboard dialogs, and actionable errors.

## Required before real patients or public launch

- Have the clinical operating team and appropriate legal/compliance professionals validate the actual donation pathway, hospital authority, consent wording/versioning, eligibility evidence, retention policy, breach response, and applicable requirements. This app is not an official deceased-organ registry or allocation authority.
- Replace organizational shared logins with individual hospital staff identities and finer permissions. Add MFA for hospital/admin accounts and an approved identity-verification process.
- Review the generic account consent language with your privacy policy and local requirements. Record clinical informed consent and authorized approvals in your real operational process; an app checkbox is not that process.
- Complete the documented migration and review records/indexes on a backup before rollout.
- Configure and exercise real SMTP, sender-domain authentication, password-reset delivery, outbox alerts, TLS, trusted proxies, restricted DB access, and rotated secrets.
- Add malware scanning/quarantine before accepting public medical uploads. File signatures alone do not prove a file is safe. Choose private encrypted object storage or a hardened persistent volume, with encrypted backups and an appropriate restore/retention process.
- Validate parsing on your actual laboratory formats. Current extraction handles text PDFs and a small field set; scanned PDFs require manual review. HLA, organ-specific eligibility, crossmatch, urgency, and final allocation are not computed. Data completeness is intentionally not marketed as a compatibility score.
- Add independently managed, tamper-resistant audit retention and fail-closed audit requirements where the clinical process requires them. Current audit storage is application-managed; the helper tolerates log-write failures.
- Perform independent security review, accessibility review, load tests, outage/recovery drills, and real-device UAT. Automated browser checks cover 1440px desktop and 390px mobile, not every device or assistive technology.
- Implement server-side pagination and retention/archiving strategies before large datasets; current lists are designed for a controlled pilot. Notifications and audit views show the latest 50/100 records, respectively.
- Scheduling now checks full appointment intervals for a normalized clinician name within a hospital, plus donor/recipient conflicts across appointments. A production scheduling service still needs verified clinician IDs (aliases can bypass name normalization), external resource calendars, rooms/equipment, and facility-specific hours. Appointment durations are coordination inputs, not clinical recommendations.
- Use a shared rate-limit store for multiple API replicas; the current limiter is per process. Outbox leases support multiple workers, but SMTP delivery is at-least-once.
- Add operational monitoring/alerts, production metric definitions, support ownership, and a tested escalation/transfer process. Hospital transfer with retained evidence is deliberately blocked pending a governed transfer workflow.
- Lock/pin release dependencies and container image digests. Re-run dependency audits at every release; a clean audit is not proof of security.

The checked-in production Docker topology is provided for deployment preparation, but no Docker build, cloud deployment, real SMTP delivery, real patient workflow, regulatory approval, or load capacity has been certified in this work.
