"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, startOfDay, startOfMonth, startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";
import { Button, EmptyState, InlineNotice, PageHeader, SelectInput, StatusBadge, TextArea, TextInput, type StatusTone } from "@/components/ui/primitives";
import { ApiError, apiRequest } from "@/lib/api/client";
import {
  createAppointment, getAppointments, getAssignees, updateAppointment,
  type Appointment, type AppointmentStatus, type AppointmentType, type Assignee,
} from "@/lib/api/appointments";
import { getLeads, type Lead } from "@/lib/api/leads";
import { appointmentStatuses, appointmentTypes } from "@/lib/appointments/rules";

type View = "month" | "week" | "day" | "agenda";
const views: View[] = ["month", "week", "day", "agenda"];
const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

const statusTone: Record<AppointmentStatus, StatusTone> = {
  SCHEDULED: "info", CONFIRMED: "success", COMPLETED: "neutral", CANCELLED: "danger", NO_SHOW: "warning",
};
const label = (value: string) => value.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const timeOf = (iso: string) => format(new Date(iso), "p");

function rangeFor(view: View, cursor: Date) {
  if (view === "month") return { from: startOfWeek(startOfMonth(cursor)), to: addDays(endOfWeek(endOfMonth(cursor)), 1) };
  if (view === "week") return { from: startOfWeek(cursor), to: addDays(endOfWeek(cursor), 1) };
  if (view === "day") return { from: startOfDay(cursor), to: addDays(startOfDay(cursor), 1) };
  return { from: startOfDay(cursor), to: addDays(startOfDay(cursor), 31) };
}

function shift(view: View, cursor: Date, dir: 1 | -1) {
  if (view === "month") return addMonths(cursor, dir);
  if (view === "week") return addWeeks(cursor, dir);
  return addDays(cursor, view === "day" ? dir : dir * 30);
}

function title(view: View, cursor: Date) {
  if (view === "month") return format(cursor, "MMMM yyyy");
  if (view === "week") { const s = startOfWeek(cursor); return `${format(s, "d MMM")} – ${format(addDays(s, 6), "d MMM yyyy")}`; }
  if (view === "day") return format(cursor, "EEEE, d MMMM yyyy");
  return `From ${format(cursor, "d MMM yyyy")}`;
}

const msg = (reason: unknown, fallback: string) => reason instanceof ApiError ? (reason.serverMessage ?? reason.message) : fallback;

export function CalendarPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [statuses, setStatuses] = useState<AppointmentStatus[]>([]);
  const [assignedTo, setAssignedTo] = useState("");
  const [items, setItems] = useState<Appointment[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [form, setForm] = useState<{ appointment?: Appointment; leadId?: string; date?: Date } | null>(null);

  const range = useMemo(() => rangeFor(view, cursor), [view, cursor]);
  const statusKey = statuses.join(",");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await getAppointments({ from: range.from, to: range.to, statuses, assignedTo: assignedTo || undefined });
      setItems(result.appointments);
      setTruncated(result.truncated);
    } catch (reason) {
      setError(msg(reason, "We couldn't load the calendar."));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, statusKey, assignedTo]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useEffect(() => { void getAssignees().then(setAssignees).catch(() => undefined); }, []);

  // Deep links: ?appointment=<id> opens details, ?new=1&leadId=<id> opens the form.
  const deepAppointment = params.get("appointment");
  const deepNew = params.get("new");
  const deepLead = params.get("leadId");
  useEffect(() => {
    if (deepAppointment) {
      void apiRequest<{ appointment: Appointment }>(`/api/appointments/${encodeURIComponent(deepAppointment)}`)
        .then((r) => { setSelected(r.appointment); setCursor(new Date(r.appointment.startsAt)); })
        .catch((reason) => setError(msg(reason, "We couldn't open that appointment.")));
    } else if (deepNew) {
      void Promise.resolve().then(() => setForm({ leadId: deepLead ?? undefined }));
    }
  }, [deepAppointment, deepNew, deepLead]);

  function clearDeepLink() {
    if (deepAppointment || deepNew) router.replace("/calendar");
  }

  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const item of items) {
      const key = format(new Date(item.startsAt), "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return map;
  }, [items]);
  const forDay = (day: Date) => byDay.get(format(day, "yyyy-MM-dd")) ?? [];

  const chip = (a: Appointment) => (
    <button key={a.id} type="button" onClick={() => setSelected(a)}
      className={`block w-full truncate rounded-md border px-2 py-1 text-left text-xs hover:bg-surface-muted ${a.status === "CANCELLED" ? "border-border text-muted line-through" : "border-primary/25 bg-success-foreground"}`}>
      <span className="font-semibold">{timeOf(a.startsAt)}</span> {a.title}
    </button>
  );

  return (
    <>
      <PageHeader title="Calendar" description={`Appointments with your leads. Times shown in ${timezone()}.`}
        actions={<Button onClick={() => setForm({ date: cursor })}><Plus className="h-4 w-4" aria-hidden="true" /> New appointment</Button>} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border-strong bg-surface p-0.5" role="group" aria-label="Calendar view">
          {views.map((v) => <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`min-h-9 rounded-md px-3 text-sm font-medium capitalize ${view === v ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"}`}>{v}</button>)}
        </div>
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous" onClick={() => setCursor(shift(view, cursor, -1))} className="grid h-10 w-10 place-items-center rounded-lg border border-border-strong bg-surface hover:bg-surface-muted"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setCursor(new Date())} className="min-h-10 rounded-lg border border-border-strong bg-surface px-3 text-sm font-semibold hover:bg-surface-muted">Today</button>
          <button type="button" aria-label="Next" onClick={() => setCursor(shift(view, cursor, 1))} className="grid h-10 w-10 place-items-center rounded-lg border border-border-strong bg-surface hover:bg-surface-muted"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <h2 className="mr-auto text-base font-semibold" aria-live="polite">{title(view, cursor)}</h2>
        <select aria-label="Filter by status" value={statuses[0] ?? ""} onChange={(e) => setStatuses(e.target.value ? [e.target.value as AppointmentStatus] : [])} className="min-h-10 rounded-lg border border-border-strong bg-surface px-3 text-sm">
          <option value="">All statuses</option>
          {appointmentStatuses.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        <select aria-label="Filter by salesperson" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="min-h-10 rounded-lg border border-border-strong bg-surface px-3 text-sm">
          <option value="">All salespeople</option>
          {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {error ? <div className="mb-4"><InlineNotice>{error}</InlineNotice><button className="mt-2 text-sm font-semibold text-primary underline" type="button" onClick={() => void load()}>Try again</button></div> : null}
      {truncated ? <div className="mb-4"><InlineNotice tone="info">Showing the first 500 appointments in this range. Narrow the view or filters to see the rest.</InlineNotice></div> : null}

      <div className={loading ? "opacity-60" : ""} aria-busy={loading}>
        {view === "month" ? (
          <div className="surface-card overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-7 border-b border-border bg-surface-muted text-xs font-medium text-muted">
                {eachDayOfInterval({ start: startOfWeek(new Date()), end: endOfWeek(new Date()) }).map((d) => <div key={d.toISOString()} className="px-2 py-2">{format(d, "EEE")}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {eachDayOfInterval({ start: range.from, end: addDays(range.to, -1) }).map((day) => {
                  const list = forDay(day);
                  return (
                    <div key={day.toISOString()} className={`min-h-28 border-b border-r border-border p-1.5 ${isSameMonth(day, cursor) ? "" : "bg-surface-muted/60"}`}>
                      <button type="button" onClick={() => { setCursor(day); setView("day"); }} className={`mb-1 grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-semibold ${isSameDay(day, new Date()) ? "bg-primary text-primary-foreground" : "text-muted hover:bg-surface-muted"}`} aria-label={format(day, "EEEE d MMMM")}>{format(day, "d")}</button>
                      <div className="grid gap-1">
                        {list.slice(0, 3).map(chip)}
                        {list.length > 3 ? <button type="button" onClick={() => { setCursor(day); setView("day"); }} className="text-left text-xs font-medium text-primary hover:underline">+{list.length - 3} more</button> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}

        {view === "week" ? (
          <div className="grid gap-3 md:grid-cols-7">
            {eachDayOfInterval({ start: range.from, end: addDays(range.to, -1) }).map((day) => (
              <section key={day.toISOString()} className={`surface-card p-2 ${isSameDay(day, new Date()) ? "border-primary" : ""}`}>
                <h3 className="mb-2 text-xs font-semibold text-muted">{format(day, "EEE d MMM")}</h3>
                <div className="grid gap-1">{forDay(day).map(chip)}{forDay(day).length === 0 ? <p className="text-xs text-muted">Free</p> : null}</div>
              </section>
            ))}
          </div>
        ) : null}

        {view === "day" || view === "agenda" ? (
          <div className="grid gap-4">
            {(view === "day" ? [startOfDay(cursor)] : eachDayOfInterval({ start: range.from, end: addDays(range.to, -1) }).filter((d) => forDay(d).length)).map((day) => (
              <section key={day.toISOString()} className="surface-card overflow-hidden">
                <h3 className="border-b border-border bg-surface-muted px-5 py-2 text-sm font-semibold">{format(day, "EEEE, d MMMM")}</h3>
                {forDay(day).length ? (
                  <ul className="divide-y divide-border">
                    {forDay(day).map((a) => (
                      <li key={a.id}>
                        <button type="button" onClick={() => setSelected(a)} className="flex min-h-16 w-full items-center justify-between gap-4 px-5 py-3 text-left hover:bg-surface-muted">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{a.title}</p>
                            <p className="mt-0.5 truncate text-xs text-muted">{timeOf(a.startsAt)} – {timeOf(a.endsAt)} · {label(a.type)}{a.leadName ? ` · ${a.leadName}` : ""}{a.assigneeName ? ` · ${a.assigneeName}` : ""}</p>
                          </div>
                          <StatusBadge tone={statusTone[a.status]}>{label(a.status)}</StatusBadge>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : <p className="px-5 py-6 text-sm text-muted">Nothing scheduled.</p>}
              </section>
            ))}
            {view === "agenda" && !items.length && !loading ? <section className="surface-card"><EmptyState title="No upcoming appointments" description="Appointments in the next 30 days will be listed here." /></section> : null}
          </div>
        ) : null}
      </div>

      <DetailDialog
        appointment={selected}
        onClose={() => { setSelected(null); clearDeepLink(); }}
        onEdit={(a) => { setSelected(null); setForm({ appointment: a }); }}
        onChanged={async (a) => { setSelected(a); await load(); }}
      />
      <FormDialog
        state={form}
        assignees={assignees}
        onClose={() => { setForm(null); clearDeepLink(); }}
        onSaved={async (a) => { setForm(null); clearDeepLink(); await load(); setSelected(a); }}
      />
    </>
  );
}

function DetailDialog({ appointment, onClose, onEdit, onChanged }: {
  appointment: Appointment | null; onClose: () => void; onEdit: (a: Appointment) => void; onChanged: (a: Appointment) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function setStatus(status: AppointmentStatus) {
    if (!appointment || busy) return;
    if (status === "CANCELLED" && !window.confirm("Cancel this appointment?")) return;
    setBusy(true); setError("");
    try { await onChanged(await updateAppointment(appointment.id, { status })); }
    catch (reason) { setError(msg(reason, "We couldn't update the appointment.")); }
    finally { setBusy(false); }
  }
  const a = appointment;
  const open = a ? a.status === "SCHEDULED" || a.status === "CONFIRMED" : false;
  return (
    <Dialog open={a !== null} onClose={onClose} title={a?.title ?? ""} description={a ? `${format(new Date(a.startsAt), "EEE d MMM yyyy, p")} – ${timeOf(a.endsAt)}` : undefined}>
      {a ? (
        <>
          <div className="mb-3"><StatusBadge tone={statusTone[a.status]}>{label(a.status)}</StatusBadge></div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted">Type</dt><dd>{label(a.type)}</dd></div>
            <div><dt className="text-xs text-muted">Salesperson</dt><dd>{a.assigneeName ?? "Unassigned"}</dd></div>
            <div><dt className="text-xs text-muted">Lead</dt><dd>{a.leadId ? <Link className="font-medium text-primary hover:underline" href={`/leads/${encodeURIComponent(a.leadId)}`}>{a.leadName || "Unnamed lead"} (open lead and conversation)</Link> : (a.leadName ?? "No lead linked")}</dd></div>
            <div><dt className="text-xs text-muted">Location or link</dt><dd className="break-words">{a.location || "Not set"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs text-muted">Notes</dt><dd className="whitespace-pre-wrap">{a.notes || "None"}</dd></div>
          </dl>
          {error ? <div className="mt-3"><InlineNotice>{error}</InlineNotice></div> : null}
          {open ? (
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {a.status === "SCHEDULED" ? <Button variant="secondary" disabled={busy} onClick={() => void setStatus("CONFIRMED")}>Confirm</Button> : null}
              <Button variant="secondary" disabled={busy} onClick={() => onEdit(a)}>Edit / reschedule</Button>
              <Button variant="secondary" disabled={busy} onClick={() => void setStatus("NO_SHOW")}>No-show</Button>
              <Button variant="secondary" disabled={busy} onClick={() => void setStatus("CANCELLED")}>Cancel</Button>
              <Button disabled={busy} onClick={() => void setStatus("COMPLETED")}>Mark completed</Button>
            </div>
          ) : null}
        </>
      ) : null}
    </Dialog>
  );
}

function FormDialog({ state, assignees, onClose, onSaved }: {
  state: { appointment?: Appointment; leadId?: string; date?: Date } | null; assignees: Assignee[];
  onClose: () => void; onSaved: (a: Appointment) => Promise<void>;
}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [values, setValues] = useState({ title: "", type: "MEETING" as AppointmentType, leadId: "", assignedToUserId: "", date: "", start: "10:00", end: "10:30", location: "", notes: "" });
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState<Array<{ id: string; title: string; startsAt: string; endsAt: string }>>([]);
  const [busy, setBusy] = useState(false);
  const editing = state?.appointment;

  useEffect(() => { if (state) void getLeads().then(setLeads).catch(() => undefined); }, [state]);
  useEffect(() => {
    if (!state) return;
    void Promise.resolve().then(() => {
      setError(""); setConflicts([]);
    if (editing) {
      setValues({ title: editing.title, type: editing.type, leadId: editing.leadId ?? "", assignedToUserId: editing.assignedToUserId ?? "", date: format(new Date(editing.startsAt), "yyyy-MM-dd"), start: format(new Date(editing.startsAt), "HH:mm"), end: format(new Date(editing.endsAt), "HH:mm"), location: editing.location ?? "", notes: editing.notes ?? "" });
    } else {
      setValues({ title: "", type: "MEETING", leadId: state.leadId ?? "", assignedToUserId: "", date: format(state.date ?? new Date(), "yyyy-MM-dd"), start: "10:00", end: "10:30", location: "", notes: "" });
    }
    });
  }, [state, editing]);

  const set = (key: keyof typeof values) => (e: { target: { value: string } }) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function submit(allowConflict = false) {
    if (busy) return;
    setError("");
    const start = new Date(`${values.date}T${values.start}`);
    const end = new Date(`${values.date}T${values.end}`);
    if (!values.title.trim()) return setError("Enter a title.");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return setError("Choose a valid date and time.");
    if (end <= start) return setError("End time must be after the start time.");
    setBusy(true);
    const payload = {
      title: values.title.trim(), type: values.type, startsAt: start.toISOString(), endsAt: end.toISOString(), timezone: timezone(),
      leadId: values.leadId || null, assignedToUserId: values.assignedToUserId || null, location: values.location || null, notes: values.notes || null, allowConflict,
    };
    try {
      const saved = editing ? await updateAppointment(editing.id, payload) : await createAppointment(payload);
      await onSaved(saved);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 409 && Array.isArray(reason.body?.conflicts) && reason.body.conflicts.length) {
        setConflicts(reason.body.conflicts as typeof conflicts);
      }
      setError(msg(reason, "We couldn't save the appointment."));
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={state !== null} onClose={onClose} title={editing ? "Edit appointment" : "New appointment"} description={`Times are in ${timezone()}.`} wide>
      <form className="grid gap-4" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <TextInput label="Title" name="appt-title" value={values.title} onChange={set("title")} maxLength={160} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectInput label="Type" name="appt-type" value={values.type} onChange={set("type")}>{appointmentTypes.map((t) => <option key={t} value={t}>{label(t)}</option>)}</SelectInput>
          <SelectInput label="Lead" name="appt-lead" value={values.leadId} onChange={set("leadId")}>
            <option value="">No lead</option>
            {values.leadId && !leads.some((l) => l.id === values.leadId) ? <option value={values.leadId}>Selected lead</option> : null}
            {leads.map((l) => <option key={l.id} value={l.id}>{l.name || "Unnamed lead"}</option>)}
          </SelectInput>
          <SelectInput label="Salesperson" name="appt-assignee" value={values.assignedToUserId} onChange={set("assignedToUserId")}>
            <option value="">Unassigned</option>
            {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </SelectInput>
          <TextInput label="Date" name="appt-date" type="date" value={values.date} onChange={set("date")} />
          <TextInput label="Start" name="appt-start" type="time" value={values.start} onChange={set("start")} />
          <TextInput label="End" name="appt-end" type="time" value={values.end} onChange={set("end")} />
        </div>
        <TextInput label="Location or meeting link" name="appt-location" value={values.location} onChange={set("location")} maxLength={500} />
        <TextArea label="Notes" name="appt-notes" value={values.notes} onChange={set("notes")} maxLength={4000} />
        {error ? <InlineNotice>{error}</InlineNotice> : null}
        {conflicts.length ? (
          <div className="rounded-lg border border-warning/30 bg-warning-foreground p-3 text-sm">
            <p className="font-semibold text-warning">Overlaps for this salesperson:</p>
            <ul className="mt-1 list-disc pl-5">{conflicts.map((c) => <li key={c.id}>{c.title}, {timeOf(c.startsAt)} – {timeOf(c.endsAt)}</li>)}</ul>
            <Button type="button" variant="secondary" className="mt-3" disabled={busy} onClick={() => void submit(true)}>Schedule anyway</Button>
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving..." : editing ? "Save changes" : "Create appointment"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
