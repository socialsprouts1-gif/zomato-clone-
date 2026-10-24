// Kapso function: appointment store for the WhatsApp booking agent.
// One function serves four agent tools, chosen by `input.action`:
//   check_availability, book_appointment, my_appointments, cancel_appointment
// Bookings live in the project D1 database (env.DB). A UNIQUE index on
// (date, time) stops two customers taking the same slot.

// ---- Business settings: edit these to match your business ----
const CONFIG = {
  businessName: "Our Studio",
  timezone: "Asia/Kolkata",
  slotMinutes: 30,
  // 0 = Sunday ... 6 = Saturday. Missing day = closed.
  hours: {
    1: ["10:00", "19:00"],
    2: ["10:00", "19:00"],
    3: ["10:00", "19:00"],
    4: ["10:00", "19:00"],
    5: ["10:00", "19:00"],
    6: ["10:00", "16:00"],
  },
  services: [
    { id: "consultation", name: "Consultation", minutes: 30 },
    { id: "haircut", name: "Haircut", minutes: 30 },
    { id: "facial", name: "Facial", minutes: 60 },
  ],
  maxDaysAhead: 30,
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const toHHMM = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// Current date and minute-of-day in the business timezone.
function nowLocal() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: CONFIG.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

const weekday = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();
const daysBetween = (a, b) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const isTime = (s) => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

async function ensureSchema(db) {
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS appointments (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        customer_name TEXT,
        service_id TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'booked',
        created_at TEXT NOT NULL
      )`
    ),
    // One booked appointment per slot. Cancelled rows are kept for history.
    db.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS appointments_slot
       ON appointments(date, time) WHERE status = 'booked'`
    ),
  ]);
}

// Slot start times (minutes) that a service of `length` minutes can use on `date`.
function openingSlots(date, length) {
  const hours = CONFIG.hours[weekday(date)];
  if (!hours) return [];
  const [open, close] = hours.map(toMin);
  const slots = [];
  for (let t = open; t + length <= close; t += CONFIG.slotMinutes) slots.push(t);
  return slots;
}

async function bookedMinutes(db, date) {
  const { results } = await db
    .prepare(`SELECT time, service_id FROM appointments WHERE date = ? AND status = 'booked'`)
    .bind(date)
    .all();
  // Each booking blocks every slot its service length covers.
  const taken = new Set();
  for (const r of results) {
    const svc = CONFIG.services.find((s) => s.id === r.service_id);
    const len = svc ? svc.minutes : CONFIG.slotMinutes;
    for (let t = toMin(r.time); t < toMin(r.time) + len; t += CONFIG.slotMinutes) taken.add(t);
  }
  return taken;
}

async function freeSlots(db, date, service) {
  const now = nowLocal();
  const taken = await bookedMinutes(db, date);
  return openingSlots(date, service.minutes).filter((t) => {
    if (date === now.date && t <= now.minutes) return false;
    for (let x = t; x < t + service.minutes; x += CONFIG.slotMinutes) if (taken.has(x)) return false;
    return true;
  });
}

function checkDate(date) {
  if (!isDate(date)) return "date must be YYYY-MM-DD";
  const ahead = daysBetween(nowLocal().date, date);
  if (ahead < 0) return "That date is in the past.";
  if (ahead > CONFIG.maxDaysAhead) return `Bookings open only ${CONFIG.maxDaysAhead} days ahead.`;
  if (!CONFIG.hours[weekday(date)]) return "We are closed on that day.";
  return null;
}

function findService(id) {
  return CONFIG.services.find((s) => s.id === id) || null;
}

async function handler(request, env) {
  const body = await request.json().catch(() => ({}));
  const input = body.input || body;
  const ctx = body.execution_context?.context || {};
  const phone =
    body.whatsapp_context?.conversation?.phone_number || ctx.phone_number || input.phone || null;

  const db = env.DB;
  await ensureSchema(db);

  switch (input.action) {
    case "check_availability": {
      const service = findService(input.service_id) || CONFIG.services[0];
      const base = {
        business: CONFIG.businessName,
        timezone: CONFIG.timezone,
        today: nowLocal().date,
        services: CONFIG.services,
      };
      if (!input.date) return json(base);
      const err = checkDate(input.date);
      if (err) return json({ ...base, date: input.date, available: [], error: err });
      const slots = (await freeSlots(db, input.date, service)).map(toHHMM);
      return json({ ...base, date: input.date, service: service.id, available: slots });
    }

    case "book_appointment": {
      if (!phone) return json({ ok: false, error: "No customer phone number in context." });
      const service = findService(input.service_id);
      if (!service) return json({ ok: false, error: "Unknown service_id.", services: CONFIG.services });
      const err = checkDate(input.date) || (isTime(input.time) ? null : "time must be HH:MM");
      if (err) return json({ ok: false, error: err });

      const free = await freeSlots(db, input.date, service);
      if (!free.includes(toMin(input.time))) {
        return json({ ok: false, error: "That slot is not available.", available: free.map(toHHMM) });
      }

      const id = crypto.randomUUID().slice(0, 8).toUpperCase();
      try {
        await db
          .prepare(
            `INSERT INTO appointments (id, phone, customer_name, service_id, date, time, notes, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'booked', ?)`
          )
          .bind(id, phone, input.customer_name || null, service.id, input.date, input.time,
                input.notes || null, new Date().toISOString())
          .run();
      } catch (e) {
        // Another customer took the slot between the check and the insert.
        const again = await freeSlots(db, input.date, service);
        return json({ ok: false, error: "That slot was just taken.", available: again.map(toHHMM) });
      }
      return json({
        ok: true,
        appointment: { id, service: service.name, date: input.date, time: input.time,
                       customer_name: input.customer_name || null },
        vars: { last_appointment_id: id },
      });
    }

    case "my_appointments": {
      if (!phone) return json({ appointments: [] });
      const today = nowLocal().date;
      const { results } = await db
        .prepare(
          `SELECT id, service_id, date, time, customer_name FROM appointments
           WHERE phone = ? AND status = 'booked' AND date >= ? ORDER BY date, time`
        )
        .bind(phone, today)
        .all();
      return json({
        appointments: results.map((r) => ({ ...r, service: findService(r.service_id)?.name || r.service_id })),
      });
    }

    case "cancel_appointment": {
      if (!phone || !input.appointment_id) return json({ ok: false, error: "appointment_id required." });
      const res = await db
        .prepare(
          `UPDATE appointments SET status = 'cancelled'
           WHERE id = ? AND phone = ? AND status = 'booked'`
        )
        .bind(String(input.appointment_id).toUpperCase(), phone)
        .run();
      const changed = res.meta?.changes ?? 0;
      return json(changed ? { ok: true } : { ok: false, error: "No matching booked appointment for this number." });
    }

    default:
      return json({ error: "Unknown action." }, 400);
  }
}
