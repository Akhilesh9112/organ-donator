# Existing-database migration

Do this on a restored staging copy first. Do not run the revised app against production until the mappings and indexes have been reviewed.

1. Back up the MongoDB database and document storage together, record restore instructions, and prove the backup restores.
2. Revoke exposed database/mail/JWT credentials from the original uploaded environment. Supply new values through your deployment secrets.
3. Decide and verify each patient's `careHospitalId` with an authorized coordinator. Do not choose a hospital merely because it is first in a list.
4. Map historical `MedicalRecord.hospitalId` and `OrganRequest.hospitalId` from documented care relationships. Cross-check historical verifiers and allocation ownership; do not silently authorize every hospital.
5. Classify each existing pledge's `donationType` as `Living` or `Deceased pledge` based on actual recorded intent. Living screening is limited to kidney or partial liver. Do not infer intent from the organ name alone.
6. Backfill each legacy appointment's `donorId` from its verified allocation and `scheduledAt` from its recorded date/time in the correct timezone. Confirm ambiguous legacy dates manually. Release 2.1 also requires an explicitly approved `durationMinutes`, `scheduledEndAt`, and normalized `surgeonKey` for existing appointments. Do not guess historical durations from the new-form default. `surgeonKey` is Unicode NFKC normalized, trimmed, whitespace-collapsed, and lowercased.
7. Reconcile duplicate active pledges, accepted requests sharing a pledge, duplicate allocations/appointments, and duplicate recommended matches. Keep an audit of the resolution. Do not discard patient history to force an index to build.
8. Run `npm run db:check`. It reports counts only and changes no records. The schedule audit also rejects invalid time bounds and reports overlapping clinician/participant intervals; resolve those with the care coordinator. Resolve every reported issue.
9. Run `npm run db:indexes` to create the new uniqueness indexes. This does not alter records or drop old indexes. An additional legacy index may still require separate review.
10. Exercise the complete four-role journey and cancellation/withdrawal paths on staging. Only then plan a maintenance window and deployment.

Historical records without an explicit hospital mapping remain inaccessible to hospital accounts. The app never broadens access as a migration fallback. The migration checker catches required-field gaps and common duplicates; it is not a complete semantic validator of historical clinical data.
