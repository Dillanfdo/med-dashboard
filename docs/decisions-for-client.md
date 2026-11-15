# Decisions to confirm with the clinic

The prototype picks a default so the review can be clicked through. None of these are locked.

| # | Question | Prototype default |
| --- | --- | --- |
| 1 | Should admins see clinical notes? | Yes. Settings has **Admins can view clinical notes**, on by default. Turning it off hides other doctors’ clinical notes from the admin role. A doctor who wrote the note can still open it. |
| 2 | Should process notes exist at all? | Yes. They are private working notes for the author. Admins see a lock and can break-glass with a typed reason. That access is logged and is not remembered after the page is closed. |
| 3 | Are calendar invites sent from each doctor’s Google account, or from one clinic account? | Each doctor’s own Google account. Settings shows a connection status per doctor. |
| 4 | Should website bookings auto-confirm or wait for staff? | Manual confirm. The setting can be switched to auto-confirm, but this prototype still holds the request so staff can match an existing patient and collect date of birth. |
| 5 | Can a doctor see another doctor’s patient when covering for them? | No. A doctor sees people assigned to them and people who already have a session with them. |
| 6 | Is there a cancellation or late-cancel fee? | None. Cancel asks for a reason and who cancelled. It does not create a charge. |
| 7 | Is the fee per doctor or per session type? | Per doctor. The book form starts from that default. Only the Admin role can change it on a session. |
| 8 | Are GST invoices required, or is a simple receipt enough? | Simple receipt: clinic name, patient, amount, method, reference, receipt number. No tax lines and no card number. |
| 9 | What is the minimum notice for website bookings, and who handles a minor who books on the website? | 12 hours, editable in Settings. The public form does not collect date of birth. Staff enter it when confirming. If the person is under 18, a guardian is required before confirm. |
| 10 | How long must records be kept? | Not specified. Ask the clinic’s lawyer before the real system deletes or archives anything. The prototype has no retention job. |

Related behaviour already in the prototype, in case it is useful during the review:

- Online sessions are blocked when the patient has no email, because the Meet link travels on the calendar invite.
- The app does not send its own SMS, WhatsApp, or email reminders. The UI only records that a Google Calendar invite will be sent, updated, or cancelled.
- Session recording is shown as “not offered” and cannot be turned on.
- Promotional consent is off unless someone opts in.
- Analytics hide any group with fewer than 5 records.
- Patient names are not placed in the page title, the URL, or the calendar event title.
