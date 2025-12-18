import { supabaseRequest } from './supabaseClient';

export type CalendarChannel = 'Google Meet' | 'Zoom' | 'WhatsApp' | 'Telefone';
export type CalendarAppointmentStatus = 'confirmed' | 'pending' | 'canceled';

export type CalendarWindow = { start: string; end: string };
export type CalendarBlock =
  | { date: string; allDay: true; reason?: string }
  | { date: string; start: string; end: string; reason?: string };

export type CalendarConfig = {
  userId: string;
  timezone: string;
  workingDays: number[];
  windows: CalendarWindow[];
  slotMinutes: number;
  bufferMinutes: number;
  blocks: CalendarBlock[];
  autoEmailConfirm: boolean;
  autoEmailReminders: boolean;
  autoWhatsApp: boolean;
  whatsappNumber?: string | null;
};

export type CalendarAppointment = {
  id: string;
  userId: string;
  leadId?: number | null;
  status: CalendarAppointmentStatus;
  startAt: string; // ISO
  durationMinutes: number;
  channel: CalendarChannel;
  meetingLink?: string | null;
  leadName: string;
  leadEmail?: string | null;
  leadPhone?: string | null;
  leadCompany?: string | null;
  leadNotes?: string | null;
  emailJobs?: string[]; // scheduler job ids
  googleEventId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const CONFIG_TABLE = 'calendar_configs';
const APPT_TABLE = 'calendar_appointments';

const normalizeConfigRow = (row: any, userId: string): CalendarConfig => ({
  userId,
  timezone: row?.timezone || 'America/Sao_Paulo',
  workingDays: Array.isArray(row?.working_days) ? row.working_days : [1, 2, 3, 4, 5],
  windows: Array.isArray(row?.windows) ? row.windows : [{ start: '09:00', end: '18:00' }],
  slotMinutes: Number(row?.slot_minutes) || 30,
  bufferMinutes: Number(row?.buffer_minutes) || 0,
  blocks: Array.isArray(row?.blocks) ? row.blocks : [],
  autoEmailConfirm: !!row?.auto_email_confirm,
  autoEmailReminders: !!row?.auto_email_reminders,
  autoWhatsApp: !!row?.auto_whatsapp,
  whatsappNumber: row?.whatsapp_number ?? null
});

const serializeConfig = (config: CalendarConfig) => ({
  user_id: config.userId,
  timezone: config.timezone,
  working_days: config.workingDays,
  windows: config.windows,
  slot_minutes: config.slotMinutes,
  buffer_minutes: config.bufferMinutes,
  blocks: config.blocks,
  auto_email_confirm: config.autoEmailConfirm,
  auto_email_reminders: config.autoEmailReminders,
  auto_whatsapp: config.autoWhatsApp,
  whatsapp_number: config.whatsappNumber || null,
  updated_at: new Date().toISOString()
});

const normalizeAppointmentRow = (row: any): CalendarAppointment => ({
  id: String(row?.id),
  userId: String(row?.user_id),
  leadId: row?.lead_id ?? null,
  status: (row?.status as CalendarAppointmentStatus) || 'confirmed',
  startAt: row?.start_at,
  durationMinutes: Number(row?.duration_minutes) || 30,
  channel: (row?.channel as CalendarChannel) || 'Google Meet',
  meetingLink: row?.meeting_link ?? null,
  leadName: row?.lead_name || 'Lead',
  leadEmail: row?.lead_email ?? null,
  leadPhone: row?.lead_phone ?? null,
  leadCompany: row?.lead_company ?? null,
  leadNotes: row?.lead_notes ?? null,
  emailJobs: Array.isArray(row?.email_jobs) ? row.email_jobs : [],
  googleEventId: row?.google_event_id ?? null,
  createdAt: row?.created_at,
  updatedAt: row?.updated_at
});

const serializeAppointment = (appt: CalendarAppointment) => ({
  id: appt.id,
  user_id: appt.userId,
  lead_id: appt.leadId ?? null,
  status: appt.status,
  start_at: appt.startAt,
  duration_minutes: appt.durationMinutes,
  channel: appt.channel,
  meeting_link: appt.meetingLink || null,
  lead_name: appt.leadName,
  lead_email: appt.leadEmail || null,
  lead_phone: appt.leadPhone || null,
  lead_company: appt.leadCompany || null,
  lead_notes: appt.leadNotes || null,
  email_jobs: appt.emailJobs || [],
  google_event_id: appt.googleEventId || null,
  updated_at: new Date().toISOString()
});

export const loadCalendarConfig = async (userId: string): Promise<CalendarConfig | null> => {
  const rows = await supabaseRequest<any[]>(CONFIG_TABLE, { query: `?user_id=eq.${userId}&select=*` });
  const row = rows && rows[0];
  if (!row) return null;
  return normalizeConfigRow(row, userId);
};

export const upsertCalendarConfig = async (config: CalendarConfig): Promise<CalendarConfig> => {
  const payload = serializeConfig(config);
  // Try PATCH first (row exists), fallback to POST.
  try {
    const updated = await supabaseRequest<any[]>(CONFIG_TABLE, {
      method: 'PATCH',
      body: payload,
      query: `?user_id=eq.${encodeURIComponent(config.userId)}`
    });
    return normalizeConfigRow(updated?.[0] || payload, config.userId);
  } catch {
    const created = await supabaseRequest<any[]>(CONFIG_TABLE, { method: 'POST', body: payload, query: '' });
    return normalizeConfigRow(created?.[0] || payload, config.userId);
  }
};

export const loadCalendarAppointments = async (userId: string): Promise<CalendarAppointment[]> => {
  const rows = await supabaseRequest<any[]>(APPT_TABLE, { query: `?user_id=eq.${userId}&select=*` });
  return (rows || []).map(normalizeAppointmentRow);
};

export const upsertCalendarAppointment = async (appt: CalendarAppointment): Promise<CalendarAppointment> => {
  const payload = serializeAppointment(appt);
  // PATCH by id; if row missing, POST.
  try {
    const updated = await supabaseRequest<any[]>(APPT_TABLE, {
      method: 'PATCH',
      body: payload,
      query: `?id=eq.${encodeURIComponent(appt.id)}`
    });
    return normalizeAppointmentRow(updated?.[0] || payload);
  } catch {
    const created = await supabaseRequest<any[]>(APPT_TABLE, { method: 'POST', body: payload, query: '' });
    return normalizeAppointmentRow(created?.[0] || payload);
  }
};

export const deleteCalendarAppointment = async (id: string): Promise<void> => {
  await supabaseRequest(APPT_TABLE, { method: 'DELETE', query: `?id=eq.${encodeURIComponent(id)}` });
};

