# API contract

The UI calls `ClinicApi` in `src/api/interfaces.ts` through TanStack Query hooks. A real backend should expose the routes below and return the same JSON shapes as the TypeScript entities in `src/types`. All staff routes are tenant-scoped and require a staff session.

Times are ISO-8601 instants. The client displays them in Asia/Kolkata. Money is integer rupees.

Staff routes below are illustrative. The public website routes are the ones a separate site will call.

## Staff

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/v1/auth/sign-in` | Email and password. Returns a short-lived challenge id. |
| POST | `/v1/auth/mfa` | 6-digit code. Returns the user and roles. |
| GET | `/v1/sessions` | Filters: status, doctor, mode, source, from, to. Scoped by role. |
| POST | `/v1/sessions` | Book. Online requires a patient email. Returns the session; Meet creation can finish slightly later. |
| GET | `/v1/sessions/{id}` | |
| POST | `/v1/sessions/{id}/reschedule` | New start, duration, required reason. |
| POST | `/v1/sessions/{id}/cancel` | Reason and `cancelledBy` of `CLINIC` or `PATIENT`. |
| POST | `/v1/sessions/{id}/meet` | Retry Meet link creation. |
| POST | `/v1/website-requests/{id}/confirm` | Link `patientId` or create a patient. Sets the doctor. |
| POST | `/v1/website-requests/{id}/propose` | New time and reason. Stays `REQUESTED`. |
| POST | `/v1/website-requests/{id}/decline` | Reason. |
| GET | `/v1/patients` | Search and filters. Doctors receive only their patients. |
| POST | `/v1/patients` | Onboard, including guardian when under 18 and separate consent rows. |
| GET | `/v1/patients/{id}` | 404 or 403. The id is opaque (`pat_1001`). Do not put the name in the URL. |
| PATCH | `/v1/patients/{id}` | |
| POST | `/v1/patients/{id}/consents` | One kind at a time. |
| POST | `/v1/patients/{id}/export` | Body: reason. Writes an audit `EXPORT`. |
| GET/POST | `/v1/patients/{id}/rights-requests` | |
| GET | `/v1/patients/{id}/notes` | Permission-filtered. Process notes omit the body for non-authors. |
| PUT | `/v1/sessions/{id}/clinical-note` | Author only. |
| PUT | `/v1/sessions/{id}/process-note` | Author only. |
| POST | `/v1/sessions/{id}/process-note/break-glass` | Admin. Body: reason. Returns the note once. |
| GET/POST | `/v1/doctors` | Admin. |
| POST | `/v1/doctors/{id}/deactivate` | Body: reassignment list for upcoming sessions. |
| GET/PUT | `/v1/doctors/{id}/availability` | Rules, buffer, duration, blocked dates, plus the website preview. |
| GET/POST | `/v1/payments` | Admin only. Reference is a transaction id, never a PAN. |
| POST | `/v1/payments/{id}/refund` | |
| POST | `/v1/payments/export` | CSV. Body: reason. |
| GET | `/v1/analytics` | Aggregates. Omit or null any bucket with fewer than 5 source rows. Doctors do not receive revenue. |
| GET | `/v1/audit` | Admin. Read-only. |
| GET/PATCH | `/v1/settings` | Clinic profile, website rules, consent text, Google connection state. |

Errors should be a JSON `{ message, code }` with a human-readable `message`. The UI shows that string.

Suggested codes: `FORBIDDEN`, `EMAIL_REQUIRED`, `CONFLICT`, `UNAUTHENTICATED`.

## Public website booking API

These routes are unauthenticated except for a per-tenant API key. They must not accept or return clinical information.

### `GET /public/v1/availability`

Query: `doctorId`, `from`, `to` (dates).

Returns free slots only:

```json
{
  "slots": [
    {
      "start": "2026-11-16T05:30:00.000Z",
      "end": "2026-11-16T06:20:00.000Z",
      "modes": ["IN_PERSON", "ONLINE"]
    }
  ]
}
```

No patient names, fees, or notes. Honour minimum notice and the doctor’s leave and buffer. If `doctorId` is omitted, return slots grouped by doctor id with no biography beyond the id and modes.

### `POST /public/v1/booking-requests`

Creates a session in `REQUESTED` and a `WebsiteBookingRequest`.

```json
{
  "name": "Riya Sample",
  "phone": "9000000007",
  "email": "riya.sample@example.com",
  "start": "2026-11-16T05:30:00.000Z",
  "mode": "ONLINE",
  "doctorId": "doc_kabir",
  "consents": {
    "records": true,
    "calendar": true,
    "meet": true,
    "promo": false
  }
}
```

`doctorId` is optional. `email` is required when `mode` is `ONLINE`.

Response:

```json
{
  "token": "tok_opaque",
  "status": "REQUESTED"
}
```

The token is unguessable and is the only identifier the public site keeps. Do not return internal patient or session ids.

### `GET /public/v1/booking-requests/{token}`

```json
{ "status": "REQUESTED", "start": "2026-11-16T05:30:00.000Z", "mode": "ONLINE" }
```

Allowed statuses to show the visitor: `REQUESTED`, `CONFIRMED`, `CANCELLED`. Do not include notes, fees, or other patients.

## Later requirements for the public API

- Per-tenant API key, rotated independently of staff passwords.
- Rate limiting and a CAPTCHA on `POST`.
- Idempotency-Key header so a double submit does not create two requests.
- The public form collects no clinical history.
- On confirm or decline, notify the person by the clinic’s chosen channel (webhook to the website, or email). This staff app does not send SMS or WhatsApp.
- Manual confirm is the prototype default. Auto-confirm must still decide how minors are handled, because the public form does not collect date of birth or a guardian.
- Staff confirmation of an online request creates the Meet link and sends the Google Calendar invite from the doctor’s Google account (see decisions).
