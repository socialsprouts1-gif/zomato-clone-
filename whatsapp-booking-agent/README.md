# WhatsApp Appointment Booking Agent (Kapso)

An AI agent on WhatsApp that books, lists and cancels appointments. It runs on
[Kapso](https://kapso.ai): a workflow with one AI agent node, backed by a Kapso
function that stores bookings in the project database.

Both pieces are already created and live in the Kapso "Default project":

| Piece | Kapso name | ID |
| --- | --- | --- |
| Workflow (published) | WhatsApp Appointment Booking Agent | `8623db44-e1d3-4e8d-9278-171ce46427d4` |
| Function (deployed) | Appointments (`appointments`) | `9895819b-c5dc-4f5e-98fa-c3cfe5204697` |

The files here are the source copies:

- `function/appointments.js` – the booking logic and business settings.
- `workflow/definition.json` – the agent's prompt, tools and WhatsApp buttons/lists.

## What a customer sees

1. Customer says "Hi, I want to book".
2. Agent shows a list of services, then asks for a date.
3. Agent shows free times as a tappable list.
4. Agent asks for their name and shows a Confirm / Change button.
5. On Confirm, the slot is booked and the customer gets a booking ID.

Customers can also say "my bookings" or "cancel my appointment". The agent
replies in the customer's language (English, Hindi, Hinglish…) and hands off to a
human when it can't help.

## Go live

1. **Connect a WhatsApp number** in Kapso (Dashboard → WhatsApp → Connect number).
2. **Add a trigger**: open the workflow → Triggers → *Inbound message* → pick the number.
3. Message the number from your phone.

You can try it first with **Test workflow** in the Kapso dashboard.

## Customize

Edit `CONFIG` at the top of the function (in Kapso: Functions → Appointments),
then redeploy:

- `businessName`, `timezone` (default `Asia/Kolkata`)
- `hours` per weekday (default Mon–Fri 10:00–19:00, Sat 10:00–16:00, Sun closed)
- `services` with their length in minutes
- `slotMinutes` (default 30) and `maxDaysAhead` (default 30)

## How bookings are stored

Bookings live in the `appointments` table of the Kapso project database (D1).
The table is created automatically on first use. Overlapping bookings are
rejected, and a unique index stops two customers taking the same start time at
the same moment. Cancelled bookings are kept with `status = 'cancelled'`.
