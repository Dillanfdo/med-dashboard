# Data model

One tenant in the prototype (`ten_northlight`). Every entity carries `tenantId` so a later SaaS build can add clinics without reshaping the records.

Ages and “minor” are derived from date of birth in Asia/Kolkata. They are not stored.

## Entities

| Entity | Purpose |
| --- | --- |
| Tenant | Clinic account. |
| User | Staff login. `roles` is `ADMIN`, `DOCTOR`, or both. Optional `doctorId`. |
| DoctorProfile | Professional record: designation, qualification, institution, optional RCI number, registration status and expiry, other registration, Google email, phone, modes, default fee, duration, buffer, active flag, `alsoAdmin`. |
| Patient | Demographics, contacts, assigned doctor, preferred mode, referral source, active/closed. |
| Guardian | Required in the product rules when the patient is under 18. Consent obtained and a verification note. |
| Consent | One row per kind: treatment records, calendar invites, Google Meet, promotional. Each has its own timestamp. |
| Session | Appointment. Patient may be null until a website request is linked. Mode, location, fee, scheduling note, status, source, Meet link and status, calendar invite status, previous times, cancellation. |
| SessionStatusEvent | Who changed the status, when, and a short note. |
| WebsiteBookingRequest | Public request: name, phone, email, consent flags, opaque token, link to the session. |
| ClinicalNote | Assessment, observations, plan, next steps. Version list stores prior wording for the author only. |
| ProcessNote | Author-only working note. Same version rule. |
| Payment | Amount, method, status, reference, receipt number, who recorded it. No card data. |
| AvailabilityRule | Weekly block: day, start, end, modes. |
| BlockedDate | Leave for one doctor on one date. |
| RightsRequest | Access, correction, erasure, or grievance. Status and due date. |
| AuditEvent | Actor, role, action, resource, outcome, optional reason. |
| ClinicSettings | Name, locations, session types, website booking rules, clinical-note admin toggle, consent text versions, per-doctor Google connection, prototype flags. |

## Relationships

```text
Tenant
  ├── Users
  ├── DoctorProfiles ──── User (1:1)
  │     ├── AvailabilityRules
  │     ├── BlockedDates
  │     └── Sessions
  ├── Patients
  │     ├── Guardian (0..1)
  │     ├── Consents
  │     ├── RightsRequests
  │     └── Sessions
  ├── Sessions
  │     ├── SessionStatusEvents
  │     ├── ClinicalNote (0..1)
  │     ├── ProcessNote (0..1)
  │     ├── Payments
  │     └── WebsiteBookingRequest (0..1, when source is WEBSITE)
  └── AuditEvents (point at any resource id)
```

Session status values: `REQUESTED`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`, `RESCHEDULED`.

`REQUESTED`, `CONFIRMED`, and `RESCHEDULED` occupy the doctor’s calendar, including the buffer stored on the doctor profile.

Payment status values: `PENDING`, `PAID`, `PARTIALLY_PAID`, `REFUNDED`, `WAIVED`.

A session’s balance is its fee minus paid and partially paid amounts. Waived and refunded sessions are not outstanding. Cancelled and no-show sessions are not outstanding.

## Notes visibility

| Reader | Clinical note | Process note |
| --- | --- | --- |
| Treating doctor (author) | Read and edit | Read and edit |
| Admin, setting on | Read. Edit only if they are the author. | Locked. Break-glass reveals it for that view and writes `BREAK_GLASS`. |
| Admin, setting off | Read only if they are the treating doctor. | Same locked / break-glass behaviour. |
| Any other doctor | No access | No access |

Calendar event titles are `Appointment` plus initials or an opaque id. They are not a field on the session.
