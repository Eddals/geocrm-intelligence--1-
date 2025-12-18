import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Link as LinkIcon,
  List,
  Mail,
  MessageCircle,
  Pencil,
  Plus,
  Save,
  SlidersHorizontal,
  Trash2,
  X
} from 'lucide-react';

import { AppSettings, Lead, PipelineStage } from '../types';
import { cancelScheduledEmailJob, scheduleEmail, sendRealEmail } from '../services/emailApi';
import CalendarSidebar from './CalendarSidebar';
import {
  CalendarAppointment,
  CalendarBlock,
  CalendarChannel,
  CalendarConfig,
  CalendarWindow,
  deleteCalendarAppointment,
  loadCalendarAppointments,
  loadCalendarConfig,
  upsertCalendarAppointment,
  upsertCalendarConfig
} from '../services/calendarStore';

interface CalendarProps {
  currentUserId?: string | null;
  settings: AppSettings;
  leads: Lead[];
  notify?: (msg: string, type?: 'success' | 'info' | 'warning') => void;
  updateLeadFromCalendar?: (leadId: string, updates: Partial<Lead>) => Promise<void> | void;
  updateLeadStatusFromCalendar?: (leadId: string, status: PipelineStage) => Promise<void> | void;
}

const LS_CONFIG_V1 = 'geocrm_calendar_config_v1';
const LS_APPTS_V1 = 'geocrm_calendar_appointments_v1';
const LS_CONFIG = 'geocrm_calendar_config_v2';
const LS_APPTS = 'geocrm_calendar_appointments_v2';

type LocalConfig = Omit<CalendarConfig, 'userId'>;
type LocalAppointment = CalendarAppointment;

const pad2 = (n: number) => String(n).padStart(2, '0');

const uuidv4 = () => {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID() as string;
  }
  const rnds = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(rnds);
  } else {
    for (let i = 0; i < rnds.length; i++) rnds[i] = Math.floor(Math.random() * 256);
  }
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;
  const hex = Array.from(rnds).map((b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
};

const parseTimeToMinutes = (hhmm: string) => {
  const [h, m] = (hhmm || '').split(':').map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const setDateWithMinutes = (date: Date, minutes: number) => {
  const d = new Date(date);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
};

const formatDateTime = (isoOrDate: string | Date, timeZone?: string) => {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.valueOf())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timeZone || undefined,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

const weekdayLabel: Record<number, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb'
};

const TIMEZONES = [
  'America/Sao_Paulo',
  'America/Fortaleza',
  'America/Manaus',
  'America/Belem',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Lisbon',
  'Europe/London'
] as const;

const loadJSON = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

const saveJSON = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const defaultConfig = (): LocalConfig => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  return {
    timezone: tz,
    workingDays: [1, 2, 3, 4, 5],
    windows: [{ start: '09:00', end: '18:00' }],
    slotMinutes: 30,
    bufferMinutes: 0,
    blocks: [],
    autoEmailConfirm: false,
    autoEmailReminders: false,
    autoWhatsApp: false,
    whatsappNumber: ''
  };
};

const normalizeWindows = (windows: any): CalendarWindow[] => {
  if (!Array.isArray(windows) || windows.length === 0) return [{ start: '09:00', end: '18:00' }];
  return windows
    .map((w) => ({ start: String(w?.start || '09:00'), end: String(w?.end || '18:00') }))
    .filter((w) => /^\d\d:\d\d$/.test(w.start) && /^\d\d:\d\d$/.test(w.end));
};

const normalizeBlocks = (blocks: any): CalendarBlock[] => {
  if (!Array.isArray(blocks)) return [];
  return blocks
    .map((b) => {
      const date = String(b?.date || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      if (b?.allDay) return { date, allDay: true as const, reason: b?.reason ? String(b.reason) : undefined };
      const start = String(b?.start || '');
      const end = String(b?.end || '');
      if (!/^\d\d:\d\d$/.test(start) || !/^\d\d:\d\d$/.test(end)) return null;
      return { date, start, end, reason: b?.reason ? String(b.reason) : undefined } as CalendarBlock;
    })
    .filter(Boolean) as CalendarBlock[];
};

const migrateFromV1 = () => {
  const v2Already = localStorage.getItem(LS_CONFIG) || localStorage.getItem(LS_APPTS);
  if (v2Already) return;

  const v1Config = loadJSON<any>(LS_CONFIG_V1);
  if (v1Config) {
    const next: LocalConfig = {
      timezone: v1Config.timezone || defaultConfig().timezone,
      workingDays: Array.isArray(v1Config.workingDays) ? v1Config.workingDays : defaultConfig().workingDays,
      windows: normalizeWindows([{ start: v1Config.startTime || '09:00', end: v1Config.endTime || '18:00' }]),
      slotMinutes: Number(v1Config.slotMinutes) || 30,
      bufferMinutes: Number(v1Config.bufferMinutes) || 0,
      blocks: [],
      autoEmailConfirm: false,
      autoEmailReminders: false,
      autoWhatsApp: false,
      whatsappNumber: ''
    };
    saveJSON(LS_CONFIG, next);
  }

  const v1Appts = loadJSON<any[]>(LS_APPTS_V1);
  if (Array.isArray(v1Appts)) {
    const next: LocalAppointment[] = v1Appts
      .map((a) => {
        const statusMap: Record<string, LocalAppointment['status']> = {
          Confirmado: 'confirmed',
          Aguardando: 'pending',
          Cancelado: 'canceled'
        };
        const status = statusMap[String(a?.status)] || 'confirmed';
        const startAt = a?.startAt;
        if (!startAt) return null;
        const leadName = a?.lead?.name || 'Lead';
        return {
          id: String(a?.id || uuidv4()),
          status,
          startAt: String(startAt),
          durationMinutes: Number(a?.durationMinutes) || 30,
          channel: (String(a?.channel || 'Google Meet') as CalendarChannel) || 'Google Meet',
          meetingLink: a?.meetingLink || null,
          leadName,
          leadEmail: a?.lead?.email || null,
          leadPhone: a?.lead?.phone || null,
          leadCompany: a?.lead?.company || null,
          leadNotes: a?.lead?.notes || null,
          leadId: null,
          emailJobs: [],
          googleEventId: null,
          createdAt: a?.createdAt || new Date().toISOString(),
          updatedAt: a?.createdAt || new Date().toISOString()
        } as LocalAppointment;
      })
      .filter(Boolean) as LocalAppointment[];
    saveJSON(LS_APPTS, next);
  }
};

const hasSmtp = (settings: AppSettings) =>
  !!(settings.smtpHost && settings.smtpPort && settings.smtpUser && settings.smtpPass);

const toWhatsAppUrl = (rawPhone: string, text: string) => {
  const digits = (rawPhone || '').replace(/\D/g, '');
  const phone = digits.startsWith('55') ? digits : digits; // keep user-provided country if any
  return `https://wa.me/${encodeURIComponent(phone)}?text=${encodeURIComponent(text)}`;
};

const buildEmailHtml = (appt: CalendarAppointment, cfg: CalendarConfig) => {
  const title = `Confirmação de agendamento — ${appt.leadName}`;
  const when = formatDateTime(appt.startAt, cfg.timezone);
  const link = appt.meetingLink ? `<p><strong>Link:</strong> <a href="${appt.meetingLink}">${appt.meetingLink}</a></p>` : '';
  return `
    <div style="font-family: Inter, Arial, sans-serif; line-height: 1.4;">
      <h2 style="margin:0 0 12px 0;">${title}</h2>
      <p>Olá ${appt.leadName}, tudo bem?</p>
      <p><strong>Data/Hora:</strong> ${when}</p>
      <p><strong>Canal:</strong> ${appt.channel}</p>
      ${link}
      <p style="margin-top:16px;">Se precisar remarcar, responda este e-mail.</p>
    </div>
  `;
};

const resolveBackendBaseUrl = () => {
  const host =
    (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
  return (import.meta as any)?.env?.VITE_BACKEND_URL || `http://${host}:3001`;
};

const Calendar: React.FC<CalendarProps> = ({
  currentUserId,
  settings,
  leads,
  notify,
  updateLeadFromCalendar,
  updateLeadStatusFromCalendar
}) => {
  const [tab, setTab] = useState<'agendar' | 'agenda' | 'config'>('agendar');
  const [persistMode, setPersistMode] = useState<'supabase' | 'local'>('local');
  const [persistMsg, setPersistMsg] = useState<string>('');
  const [googleCal, setGoogleCal] = useState<{ configured: boolean; connected: boolean; message?: string; loading: boolean }>({
    configured: false,
    connected: false,
    message: '',
    loading: false
  });

  const [config, setConfig] = useState<LocalConfig>(() => {
    migrateFromV1();
    return loadJSON<LocalConfig>(LS_CONFIG) || defaultConfig();
  });
  const [appointments, setAppointments] = useState<LocalAppointment[]>(() => {
    const raw = loadJSON<any[]>(LS_APPTS);
    if (!Array.isArray(raw)) return [];
    // tolerate older shapes
    return raw
      .map((a) => {
        const id = String(a?.id || uuidv4());
        const startAt = String(a?.startAt || '');
        if (!startAt) return null;
        return {
          id,
          userId: String(a?.userId || currentUserId || ''),
          leadId: a?.leadId ?? null,
          status: (a?.status as any) || 'confirmed',
          startAt,
          durationMinutes: Number(a?.durationMinutes) || 30,
          channel: (a?.channel as CalendarChannel) || 'Google Meet',
          meetingLink: a?.meetingLink ?? null,
          leadName: String(a?.leadName || a?.lead?.name || 'Lead'),
          leadEmail: a?.leadEmail ?? a?.lead?.email ?? null,
          leadPhone: a?.leadPhone ?? a?.lead?.phone ?? null,
          leadCompany: a?.leadCompany ?? a?.lead?.company ?? null,
          leadNotes: a?.leadNotes ?? a?.lead?.notes ?? null,
          emailJobs: Array.isArray(a?.emailJobs) ? a.emailJobs : [],
          googleEventId: a?.googleEventId ?? null,
          createdAt: a?.createdAt,
          updatedAt: a?.updatedAt
        } as LocalAppointment;
      })
      .filter(Boolean) as LocalAppointment[];
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const hasLoadedFromSupabase = useRef(false);

  // Lead selection
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');

  // Blocks form
  const [blockDate, setBlockDate] = useState('');
  const [blockAllDay, setBlockAllDay] = useState(true);
  const [blockStart, setBlockStart] = useState('12:00');
  const [blockEnd, setBlockEnd] = useState('13:00');
  const [blockReason, setBlockReason] = useState('');

  // Appointment form
  const [dateStr, setDateStr] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  });
  const [slotIso, setSlotIso] = useState<string>('');
  const [channel, setChannel] = useState<CalendarChannel>('Google Meet');
  const [meetingLink, setMeetingLink] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [status, setStatus] = useState<LocalAppointment['status']>('confirmed');
  const [leadForm, setLeadForm] = useState({ name: '', email: '', phone: '', company: '', notes: '' });
  const [error, setError] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customTimezone, setCustomTimezone] = useState(false);

  useEffect(() => {
    saveJSON(LS_CONFIG, config);
  }, [config]);

  useEffect(() => {
    saveJSON(LS_APPTS, appointments);
  }, [appointments]);

  useEffect(() => {
    const isPreset = (TIMEZONES as readonly string[]).includes(config.timezone || '');
    setCustomTimezone(!isPreset);
  }, [config.timezone]);

  useEffect(() => {
    if (channel === 'Telefone' || channel === 'WhatsApp') {
      setMeetingLink('');
    }
  }, [channel]);

  const availabilityOk = useMemo(() => {
    const daysOk = Array.isArray(config.workingDays) && config.workingDays.length > 0;
    const windows = normalizeWindows(config.windows);
    const windowsOk = windows.some((w) => {
      const s = parseTimeToMinutes(w.start);
      const e = parseTimeToMinutes(w.end);
      return s !== null && e !== null && e > s;
    });
    const slot = Number(config.slotMinutes);
    const slotOk = Number.isFinite(slot) && slot >= 5 && slot <= 180;
    return daysOk && windowsOk && slotOk;
  }, [config.workingDays, config.windows, config.slotMinutes]);

  const notificationsOk = useMemo(() => {
    const needsEmail = !!(config.autoEmailConfirm || config.autoEmailReminders);
    const needsWhats = !!config.autoWhatsApp;
    const emailOk = !needsEmail || hasSmtp(settings);
    const waDigits = String(config.whatsappNumber || '').replace(/\D/g, '');
    const whatsappOk = !needsWhats || waDigits.length >= 10;
    return emailOk && whatsappOk;
  }, [config.autoEmailConfirm, config.autoEmailReminders, config.autoWhatsApp, config.whatsappNumber, settings]);

  const setupStep = !availabilityOk ? 1 : !notificationsOk ? 2 : 3;

  const requestTab = (next: typeof tab) => {
    if ((next === 'agendar' || next === 'agenda') && setupStep < 3) {
      notify?.('Complete a Configuração (Passo 1 e 2) para desbloquear.', 'warning');
      setTab('config');
      return;
    }
    setTab(next);
  };

  // Load from Supabase (best-effort, fallback local)
  useEffect(() => {
    const userId = currentUserId || '';
    if (!userId) {
      setPersistMode('local');
      setPersistMsg('Modo local (sem login).');
      return;
    }
    if (hasLoadedFromSupabase.current) return;

    (async () => {
      try {
        const [cfg, appts] = await Promise.all([loadCalendarConfig(userId), loadCalendarAppointments(userId)]);
        if (cfg) {
          setConfig({
            timezone: cfg.timezone,
            workingDays: cfg.workingDays,
            windows: normalizeWindows(cfg.windows),
            slotMinutes: cfg.slotMinutes,
            bufferMinutes: cfg.bufferMinutes,
            blocks: normalizeBlocks(cfg.blocks),
            autoEmailConfirm: cfg.autoEmailConfirm,
            autoEmailReminders: cfg.autoEmailReminders,
            autoWhatsApp: cfg.autoWhatsApp,
            whatsappNumber: cfg.whatsappNumber || ''
          });
        }
        if (Array.isArray(appts)) {
          setAppointments(
            appts.map((a) => ({
              ...a,
              userId
            }))
          );
        }
        setPersistMode('supabase');
        setPersistMsg('Persistindo no Supabase.');
        hasLoadedFromSupabase.current = true;
      } catch (e: any) {
        setPersistMode('local');
        setPersistMsg('Falha ao carregar do Supabase. Usando modo local.');
      }
    })();
  }, [currentUserId]);

  const refreshGoogleCalendarStatus = async () => {
    if (!currentUserId) {
      setGoogleCal({ configured: false, connected: false, message: 'Faça login para conectar.', loading: false });
      return;
    }
    const baseUrl = resolveBackendBaseUrl();
    try {
      setGoogleCal((p) => ({ ...p, loading: true }));
      const res = await fetch(`${baseUrl}/calendar/google/status?userId=${encodeURIComponent(currentUserId)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Erro HTTP ${res.status}`);
      setGoogleCal({
        configured: !!data?.configured,
        connected: !!data?.connected,
        message: data?.message,
        loading: false
      });
    } catch (e: any) {
      setGoogleCal({ configured: false, connected: false, message: e?.message || 'Falha ao verificar status.', loading: false });
    }
  };

  const connectGoogleCalendar = async () => {
    if (!currentUserId) {
      notify?.('Faça login para conectar.', 'warning');
      return;
    }
    const baseUrl = resolveBackendBaseUrl();
    try {
      setGoogleCal((p) => ({ ...p, loading: true }));
      const res = await fetch(`${baseUrl}/calendar/google/auth?userId=${encodeURIComponent(currentUserId)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || `Erro HTTP ${res.status}`);
      const authUrl = data?.authUrl;
      if (!authUrl) throw new Error('Auth URL não retornou.');
      window.open(authUrl, 'geocrm_google_calendar', 'width=520,height=720');
      setGoogleCal((p) => ({ ...p, loading: false }));
    } catch (e: any) {
      setGoogleCal((p) => ({ ...p, loading: false }));
      notify?.(e?.message || 'Falha ao conectar Google Calendar.', 'warning');
    }
  };

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev?.data?.type === 'geocrm_google_calendar_connected') {
        refreshGoogleCalendarStatus();
        notify?.('Google Calendar conectado.', 'success');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  useEffect(() => {
    if (tab === 'config') refreshGoogleCalendarStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, currentUserId]);

  const fullConfig: CalendarConfig = useMemo(() => {
    return {
      userId: currentUserId || '',
      timezone: config.timezone,
      workingDays: config.workingDays,
      windows: normalizeWindows(config.windows),
      slotMinutes: Number(config.slotMinutes) || 30,
      bufferMinutes: Number(config.bufferMinutes) || 0,
      blocks: normalizeBlocks(config.blocks),
      autoEmailConfirm: !!config.autoEmailConfirm,
      autoEmailReminders: !!config.autoEmailReminders,
      autoWhatsApp: !!config.autoWhatsApp,
      whatsappNumber: config.whatsappNumber || null
    };
  }, [config, currentUserId]);

  const selectedDate = useMemo(() => {
    const d = new Date(`${dateStr}T00:00:00`);
    return Number.isNaN(d.valueOf()) ? new Date() : d;
  }, [dateStr]);

  const isWorkingDay = useMemo(
    () => fullConfig.workingDays.includes(selectedDate.getDay()),
    [fullConfig.workingDays, selectedDate]
  );

  const dayAppointments = useMemo(() => {
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(selectedDate);
    end.setHours(23, 59, 59, 999);
    return (appointments || [])
      .filter((a) => {
        const t = new Date(a.startAt);
        return t >= start && t <= end;
      })
      .sort((a, b) => new Date(a.startAt).valueOf() - new Date(b.startAt).valueOf());
  }, [appointments, selectedDate]);

  const occupiedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const a of dayAppointments) {
      if (a.status === 'canceled') continue;
      const start = new Date(a.startAt);
      const key = `${pad2(start.getHours())}:${pad2(start.getMinutes())}`;
      set.add(key);
    }
    return set;
  }, [dayAppointments]);

  const blocksForDay = useMemo(() => {
    const day = dateStr;
    return normalizeBlocks(fullConfig.blocks).filter((b) => b.date === day);
  }, [fullConfig.blocks, dateStr]);

  const isSlotBlocked = (label: string) => {
    if (blocksForDay.length === 0) return false;
    for (const b of blocksForDay) {
      if ('allDay' in b && b.allDay) return true;
      if ('start' in b) {
        const s = parseTimeToMinutes(b.start);
        const e = parseTimeToMinutes(b.end);
        const t = parseTimeToMinutes(label);
        if (s === null || e === null || t === null) continue;
        if (t >= s && t < e) return true;
      }
    }
    return false;
  };

  const slots = useMemo(() => {
    const windows = normalizeWindows(fullConfig.windows);
    const step = Math.max(5, Number(fullConfig.slotMinutes) || 30);
    const buffer = Math.max(0, Number(fullConfig.bufferMinutes) || 0);
    const result: { label: string; iso: string; disabled: boolean }[] = [];

    for (const w of windows) {
      const startMin = parseTimeToMinutes(w.start);
      const endMin = parseTimeToMinutes(w.end);
      if (startMin === null || endMin === null) continue;
      for (let minutes = startMin; minutes + step <= endMin; minutes += step + buffer) {
        const d = setDateWithMinutes(selectedDate, minutes);
        const label = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
        const disabled = !isWorkingDay || occupiedKeys.has(label) || isSlotBlocked(label);
        result.push({ label, iso: d.toISOString(), disabled });
      }
    }
    // de-dup + sort
    const uniq = new Map<string, { label: string; iso: string; disabled: boolean }>();
    for (const s of result) uniq.set(s.iso, s);
    return Array.from(uniq.values()).sort((a, b) => new Date(a.iso).valueOf() - new Date(b.iso).valueOf());
  }, [fullConfig.windows, fullConfig.slotMinutes, fullConfig.bufferMinutes, selectedDate, isWorkingDay, occupiedKeys, blocksForDay]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    return (appointments || [])
      .slice()
      .sort((a, b) => new Date(a.startAt).valueOf() - new Date(b.startAt).valueOf())
      .filter((a) => new Date(a.startAt).valueOf() + a.durationMinutes * 60_000 >= now);
  }, [appointments]);

  const filteredLeadSuggestions = useMemo(() => {
    const q = leadSearch.trim().toLowerCase();
    if (!q) return [];
    return (leads || [])
      .filter((l) => (l.company || '').toLowerCase().includes(q) || (l.name || '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [leadSearch, leads]);

  const selectLead = (lead: Lead) => {
    setSelectedLeadId(lead.id);
    setLeadSearch(`${lead.company || lead.name}`);
    setLeadForm({
      name: lead.name || '',
      email: lead.email || '',
      phone: lead.phone || '',
      company: lead.company || '',
      notes: ''
    });
  };

  const resetAppointmentForm = () => {
    setEditingId(null);
    setSelectedLeadId('');
    setLeadSearch('');
    setSlotIso('');
    setChannel('Google Meet');
    setMeetingLink('');
    setDurationMinutes(30);
    setStatus('confirmed');
    setLeadForm({ name: '', email: '', phone: '', company: '', notes: '' });
    setError('');
  };

  const saveConfig = async () => {
    setIsSavingConfig(true);
    try {
      saveJSON(LS_CONFIG, config);
      if (currentUserId) {
        await upsertCalendarConfig({ ...fullConfig, userId: currentUserId });
        setPersistMode('supabase');
        setPersistMsg('Config salva no Supabase.');
      }
      notify?.('Configuração do calendário salva.', 'success');
    } catch (e: any) {
      setPersistMode('local');
      setPersistMsg('Falha ao salvar no Supabase. Mantendo local.');
      notify?.('Falha ao salvar no Supabase. Salvando localmente.', 'warning');
    } finally {
      window.setTimeout(() => setIsSavingConfig(false), 350);
    }
  };

  const addWindow = () => {
    setConfig((p) => ({ ...p, windows: [...normalizeWindows(p.windows), { start: '14:00', end: '18:00' }] }));
  };
  const updateWindow = (idx: number, patch: Partial<CalendarWindow>) => {
    setConfig((p) => ({
      ...p,
      windows: normalizeWindows(p.windows).map((w, i) => (i === idx ? { ...w, ...patch } : w))
    }));
  };
  const removeWindow = (idx: number) => {
    setConfig((p) => {
      const next = normalizeWindows(p.windows).filter((_, i) => i !== idx);
      return { ...p, windows: next.length ? next : [{ start: '09:00', end: '18:00' }] };
    });
  };

  const addBlock = () => {
    if (!blockDate || !/^\d{4}-\d{2}-\d{2}$/.test(blockDate)) {
      notify?.('Escolha uma data válida para bloquear.', 'warning');
      return;
    }
    const nextBlock: CalendarBlock = blockAllDay
      ? { date: blockDate, allDay: true, reason: blockReason.trim() || undefined }
      : { date: blockDate, start: blockStart, end: blockEnd, reason: blockReason.trim() || undefined };
    setConfig((p) => ({ ...p, blocks: [...normalizeBlocks(p.blocks), nextBlock] }));
    setBlockReason('');
  };

  const removeBlock = (idx: number) => {
    if (!window.confirm('Remover este bloqueio?')) return;
    setConfig((p) => ({ ...p, blocks: normalizeBlocks(p.blocks).filter((_, i) => i !== idx) }));
  };

  const validateAppointment = () => {
    if (!leadForm.name.trim()) return 'Nome do lead é obrigatório.';
    if (!slotIso) return 'Selecione um horário.';
    if (channel !== 'Telefone' && channel !== 'WhatsApp' && meetingLink && !/^https?:\/\//i.test(meetingLink.trim())) {
      return 'Link da reunião deve começar com http:// ou https://';
    }
    if (meetingLink && /^(javascript|data):/i.test(meetingLink.trim())) return 'Link inválido.';
    const minutes = Math.max(5, Number(durationMinutes) || 30);
    if (minutes > 240) return 'Duração muito alta (máx 240 min).';
    return '';
  };

  const buildApptKey = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  };

  const upsertAppointment = async () => {
    const err = validateAppointment();
    if (err) {
      setError(err);
      return;
    }
    setError('');
    const minutes = Math.max(5, Number(durationMinutes) || 30);

    const leadIdNum = selectedLeadId ? Number(selectedLeadId) : NaN;
    const leadId = Number.isFinite(leadIdNum) ? leadIdNum : null;

    const appt: CalendarAppointment = {
      id: editingId || uuidv4(),
      userId: currentUserId || '',
      leadId,
      status,
      startAt: slotIso,
      durationMinutes: minutes,
      channel,
      meetingLink: meetingLink.trim() ? meetingLink.trim() : null,
      leadName: leadForm.name.trim(),
      leadEmail: leadForm.email.trim() ? leadForm.email.trim() : null,
      leadPhone: leadForm.phone.trim() ? leadForm.phone.trim() : null,
      leadCompany: leadForm.company.trim() ? leadForm.company.trim() : null,
      leadNotes: leadForm.notes.trim() ? leadForm.notes.trim() : null,
      emailJobs: [],
      googleEventId: null
    };

    const key = buildApptKey(appt.startAt);
    const conflict = appointments.some((a) => {
      if (a.status === 'canceled') return false;
      if (editingId && a.id === editingId) return false;
      return buildApptKey(a.startAt) === key;
    });
    if (conflict) {
      setError('Esse horário já está ocupado.');
      return;
    }

    // local update first
    setAppointments((prev) => {
      const list = prev || [];
      const next: LocalAppointment = {
        ...appt,
        createdAt: editingId ? list.find((x) => x.id === editingId)?.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      if (editingId) return list.map((a) => (a.id === editingId ? next : a));
      return [next, ...list];
    });

    // Supabase persistence best-effort
    if (currentUserId) {
      try {
        const saved = await upsertCalendarAppointment(appt);
        setPersistMode('supabase');
        setPersistMsg('Agendamento salvo no Supabase.');
        // reflect any server values
        setAppointments((prev) => (prev || []).map((a) => (a.id === appt.id ? { ...a, ...saved } : a)));
      } catch (e: any) {
        setPersistMode('local');
        setPersistMsg('Falha ao salvar agendamento no Supabase. Mantendo local.');
        notify?.('Falha ao salvar agendamento no Supabase. Salvando localmente.', 'warning');
      }
    }

    // Update lead status (best-effort)
    if (selectedLeadId) {
      try {
        await updateLeadStatusFromCalendar?.(selectedLeadId, PipelineStage.WAITING);
        const leadRow = leads.find((l) => l.id === selectedLeadId);
        const baseHistory = Array.isArray(leadRow?.history) ? leadRow!.history : [];
        const historyEntry = {
          date: new Date().toISOString(),
          description: `Agendamento criado: ${formatDateTime(appt.startAt, fullConfig.timezone)} • ${appt.channel}`,
          type: 'update'
        } as any;
        await updateLeadFromCalendar?.(selectedLeadId, {
          lastContact: new Date().toISOString(),
          history: [...baseHistory, historyEntry]
        });
      } catch {
        // ignore
      }
    }

    // Notifications (best-effort)
    const apptForNotify: CalendarAppointment = { ...appt, userId: currentUserId || '' };
    await maybeSendConfirmations(apptForNotify);

    resetAppointmentForm();
    notify?.('Agendamento salvo.', 'success');
    setTab('agenda');
  };

  const maybeSendConfirmations = async (appt: CalendarAppointment) => {
    // WhatsApp: just show link (cannot auto-send without provider)
    if (fullConfig.autoWhatsApp && (appt.leadPhone || fullConfig.whatsappNumber)) {
      const phone = appt.leadPhone || fullConfig.whatsappNumber || '';
      if (phone) {
        const text = `Olá ${appt.leadName}! Confirmando nosso agendamento em ${formatDateTime(appt.startAt, fullConfig.timezone)}.`;
        const url = toWhatsAppUrl(phone, text);
        notify?.(`WhatsApp pronto: ${url}`, 'info');
      }
    }

    if (!fullConfig.autoEmailConfirm && !fullConfig.autoEmailReminders) return;
    if (!appt.leadEmail) {
      if (fullConfig.autoEmailConfirm || fullConfig.autoEmailReminders) {
        notify?.('Lead sem email: não foi possível enviar lembretes.', 'warning');
      }
      return;
    }
    if (!hasSmtp(settings)) {
      notify?.('Configure SMTP em Configurações para enviar emails.', 'warning');
      return;
    }

    if (fullConfig.autoEmailConfirm) {
      const subject = `Confirmação de agendamento — ${appt.leadCompany || appt.leadName}`;
      const html = buildEmailHtml(appt, fullConfig);
      const resp = await sendRealEmail(settings, appt.leadEmail, subject, html);
      if (!resp.success) notify?.(`Falha ao enviar confirmação: ${resp.error || 'erro'}`, 'warning');
      else notify?.('Email de confirmação enviado.', 'success');
    }

    if (fullConfig.autoEmailReminders) {
      const start = new Date(appt.startAt).valueOf();
      const now = Date.now();
      const reminders = [
        { minutesBefore: 24 * 60, label: '24h' },
        { minutesBefore: 60, label: '1h' },
        { minutesBefore: 10, label: '10min' }
      ];
      const jobIds: string[] = [];
      for (const r of reminders) {
        const runAt = new Date(start - r.minutesBefore * 60_000);
        if (runAt.valueOf() <= now) continue;
        const subject = `Lembrete (${r.label}) — ${appt.leadCompany || appt.leadName}`;
        const html = buildEmailHtml(appt, fullConfig);
        const scheduled = await scheduleEmail(settings, appt.leadEmail, subject, html, runAt.toISOString(), {
          timeZone: fullConfig.timezone,
          sendWindow: 'any'
        });
        if (scheduled.success && scheduled.jobId) jobIds.push(scheduled.jobId);
      }

      if (jobIds.length) {
        notify?.(`Lembretes agendados: ${jobIds.length}`, 'success');
        // persist job ids in appointment
        setAppointments((prev) => (prev || []).map((a) => (a.id === appt.id ? { ...a, emailJobs: jobIds } : a)));
        if (currentUserId) {
          try {
            await upsertCalendarAppointment({ ...appt, emailJobs: jobIds, userId: currentUserId });
          } catch {
            // ignore
          }
        }
      }
    }
  };

  const startEdit = (a: LocalAppointment) => {
    setEditingId(a.id);
    setTab('agendar');
    const d = new Date(a.startAt);
    setDateStr(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
    setSlotIso(a.startAt);
    setChannel(a.channel);
    setMeetingLink(a.meetingLink || '');
    setDurationMinutes(a.durationMinutes);
    setStatus(a.status);
    setLeadForm({
      name: a.leadName || '',
      email: a.leadEmail || '',
      phone: a.leadPhone || '',
      company: a.leadCompany || '',
      notes: a.leadNotes || ''
    });
    if (a.leadId) setSelectedLeadId(String(a.leadId));
    else setSelectedLeadId('');
    setError('');
  };

  const cancelAppointment = async (id: string) => {
    const target = appointments.find((a) => a.id === id);
    if (!target) return;
    setAppointments((prev) => (prev || []).map((a) => (a.id === id ? { ...a, status: 'canceled', updatedAt: new Date().toISOString() } : a)));

    const jobs = Array.isArray(target.emailJobs) ? target.emailJobs : [];
    for (const jobId of jobs) {
      await cancelScheduledEmailJob(jobId);
    }

    if (currentUserId) {
      try {
        await upsertCalendarAppointment({ ...(target as any), userId: currentUserId, status: 'canceled' });
      } catch {
        // ignore
      }
    }
  };

  const removeAppointment = async (id: string) => {
    const target = appointments.find((a) => a.id === id);
    if (!window.confirm('Apagar este agendamento?')) return;
    setAppointments((prev) => (prev || []).filter((a) => a.id !== id));
    if (target?.emailJobs?.length) {
      for (const jobId of target.emailJobs) {
        await cancelScheduledEmailJob(jobId);
      }
    }
    if (currentUserId) {
      try {
        await deleteCalendarAppointment(id);
      } catch {
        // ignore
      }
    }
  };

  const dayName = weekdayLabel[selectedDate.getDay()] || '';

  const statusChip = (s: LocalAppointment['status']) => {
    if (s === 'confirmed') return 'Confirmado';
    if (s === 'pending') return 'Aguardando';
    return 'Cancelado';
  };

  const statusChipClass = (s: LocalAppointment['status']) => {
    if (s === 'confirmed') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (s === 'pending') return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  };

  const selectedLeadPreview = useMemo(() => {
    if (!selectedLeadId) return null;
    return leads.find((l) => l.id === selectedLeadId) || null;
  }, [leads, selectedLeadId]);

  const persistLabel = persistMode === 'supabase' ? 'Supabase' : 'Local';

  const appHeader = (
    <header className="glass-panel bg-white/80 dark:bg-white/5 border border-white/40 dark:border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-lg">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-gray-400 font-semibold">Módulo</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50 flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-indigo-400" />
          Calendário
        </h1>
        <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">
          Simples de configurar, com persistência {persistMode === 'supabase' ? 'no Supabase' : 'local'}.
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {(
          [
            { id: 'agendar', label: 'Agendar', icon: CalendarDays },
            { id: 'agenda', label: 'Agenda', icon: List },
            { id: 'config', label: 'Configuração', icon: SlidersHorizontal }
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => requestTab(t.id)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
              tab === t.id
                ? 'glass-purple text-white border-transparent'
                : 'bg-white/70 dark:bg-white/10 text-gray-800 dark:text-slate-100 border-white/50 dark:border-white/10 hover:bg-white/80 dark:hover:bg-white/15'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <t.icon className="w-4 h-4" />
              {t.label}
            </span>
          </button>
        ))}
      </div>
    </header>
  );

  return (
    <div className="space-y-4 animate-fade-in max-w-5xl mx-auto">
      {appHeader}
      {persistMsg ? (
        <div className="text-sm text-gray-600 dark:text-slate-300 glass-panel backdrop-blur-xl rounded-xl p-3 border border-white/10">
          <p>{persistMsg}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 items-start">
        <CalendarSidebar
          tab={tab}
          setTab={requestTab}
          persistLabel={persistLabel}
          googleStatus={googleCal}
          locks={{
            agendar: { locked: setupStep < 3, reason: setupStep === 1 ? 'Configure disponibilidade' : 'Configure notificações' },
            agenda: { locked: setupStep < 3, reason: setupStep === 1 ? 'Configure disponibilidade' : 'Configure notificações' },
            config: { locked: false }
          }}
        />

        {tab === 'config' && (
        <div className="glass-panel bg-white/50 dark:bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-lg space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-base font-semibold text-gray-900 dark:text-slate-50 flex items-center gap-2">
              <Clock3 className="w-5 h-5 text-indigo-400" />
              Passo 1 • Disponibilidade
            </h3>
            <button onClick={saveConfig} className="glass-purple px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
              <Save className="w-4 h-4" />
              {isSavingConfig ? 'Salvando…' : 'Salvar'}
            </button>
          </div>

	          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
	            <div className="space-y-2">
	              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Fuso horário</label>
	              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
	                <select
	                  value={customTimezone ? '__custom__' : config.timezone}
	                  onChange={(e) => {
	                    if (e.target.value === '__custom__') {
	                      setCustomTimezone(true);
	                      return;
	                    }
	                    setCustomTimezone(false);
	                    setConfig((p) => ({ ...p, timezone: e.target.value }));
	                  }}
	                  className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
	                >
	                  {TIMEZONES.map((tz) => (
	                    <option key={tz} value={tz}>
	                      {tz}
	                    </option>
	                  ))}
	                  <option value="__custom__">Outro…</option>
	                </select>
	                <input
	                  value={customTimezone ? config.timezone : ''}
	                  onChange={(e) => setConfig((p) => ({ ...p, timezone: e.target.value }))}
	                  disabled={!customTimezone}
	                  className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100 disabled:opacity-60"
	                  placeholder="Ex: America/Sao_Paulo"
	                />
	              </div>
	              <p className="text-[11px] text-gray-500 dark:text-slate-300">Escolha pronto ou digite um fuso (IANA).</p>
	            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Dias de atendimento</label>
              <div className="flex flex-wrap gap-2">
                {Object.keys(weekdayLabel)
                  .map((k) => Number(k))
                  .sort((a, b) => a - b)
                  .map((d) => {
                    const active = config.workingDays.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() =>
                          setConfig((p) => ({
                            ...p,
                            workingDays: active ? p.workingDays.filter((x) => x !== d) : [...p.workingDays, d].sort((a, b) => a - b)
                          }))
                        }
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                          active
                            ? 'glass-purple text-white border-transparent'
                            : 'bg-white/70 dark:bg-white/10 border-white/30 text-gray-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-white/15'
                        }`}
                      >
                        {weekdayLabel[d]}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="glass-panel bg-white/45 dark:bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-50">Janelas de atendimento</p>
              <button
                type="button"
                onClick={addWindow}
                className="px-3 py-2 rounded-lg text-sm font-semibold bg-white/70 dark:bg-white/10 border border-white/30 text-gray-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-white/15 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Slot (min)</label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={config.slotMinutes}
                  onChange={(e) => setConfig((p) => ({ ...p, slotMinutes: Number(e.target.value) || 30 }))}
                  className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Buffer (min)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={config.bufferMinutes}
                  onChange={(e) => setConfig((p) => ({ ...p, bufferMinutes: Number(e.target.value) || 0 }))}
                  className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="space-y-2">
              {normalizeWindows(config.windows).map((w, idx) => (
                <div key={idx} className="flex items-center gap-2 flex-wrap">
                  <input
                    type="time"
                    value={w.start}
                    onChange={(e) => updateWindow(idx, { start: e.target.value })}
                    className="rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
                  />
                  <span className="text-sm text-gray-500 dark:text-slate-300">até</span>
                  <input
                    type="time"
                    value={w.end}
                    onChange={(e) => updateWindow(idx, { end: e.target.value })}
                    className="rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => removeWindow(idx)}
                    className="ml-auto px-3 py-2 rounded-lg text-sm font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/15 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remover
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel bg-white/45 dark:bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-slate-50">Bloqueios (exceções)</p>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Data</label>
                <input
                  type="date"
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                  className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo</label>
                <select
                  value={blockAllDay ? 'all' : 'range'}
                  onChange={(e) => setBlockAllDay(e.target.value === 'all')}
                  className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
                >
                  <option value="all">Dia todo</option>
                  <option value="range">Faixa</option>
                </select>
              </div>
              {!blockAllDay ? (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Hora</label>
                  <div className="flex gap-2">
                    <input
                      type="time"
                      value={blockStart}
                      onChange={(e) => setBlockStart(e.target.value)}
                      className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
                    />
                    <input
                      type="time"
                      value={blockEnd}
                      onChange={(e) => setBlockEnd(e.target.value)}
                      className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
                    />
                  </div>
                </div>
              ) : (
                <div />
              )}
              <div className="space-y-2">
                <button onClick={addBlock} className="glass-purple w-full rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  Bloquear
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Motivo (opcional)</label>
              <input
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
                placeholder="Ex: almoço, feriado, reunião interna..."
              />
            </div>
            <div className="space-y-2">
              {normalizeBlocks(config.blocks).length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-slate-300">Sem bloqueios.</p>
              ) : (
                normalizeBlocks(config.blocks).map((b, idx) => (
                  <div key={idx} className="flex items-center gap-2 glass-panel bg-white/50 dark:bg-white/5 border border-white/20 rounded-xl p-3">
                    <div className="text-sm text-gray-800 dark:text-slate-100">
                      <span className="font-semibold">{b.date}</span>{' '}
                      {'allDay' in b && b.allDay ? (
                        <span className="text-gray-500 dark:text-slate-300">• dia todo</span>
                      ) : (
                        <span className="text-gray-500 dark:text-slate-300">
                          • {(b as any).start}–{(b as any).end}
                        </span>
                      )}
                      {b.reason ? <span className="text-gray-500 dark:text-slate-300"> • {b.reason}</span> : null}
                    </div>
                    <button
                      onClick={() => removeBlock(idx)}
                      className="ml-auto px-3 py-2 rounded-lg text-sm font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/15 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remover
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="relative">
          <div className={`glass-panel bg-white/45 dark:bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-4 space-y-3 ${!availabilityOk ? 'opacity-60 blur-[1px] pointer-events-none select-none' : ''}`}>
            <p className="text-base font-semibold text-gray-900 dark:text-slate-50 flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-400" />
              Passo 2 • Notificações
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setConfig((p) => ({ ...p, autoEmailConfirm: !p.autoEmailConfirm }))}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold flex items-center gap-2 ${
                  config.autoEmailConfirm ? 'glass-purple text-white border-transparent' : 'bg-white/70 dark:bg-white/10 border-white/30 text-gray-700 dark:text-slate-200'
                }`}
              >
                <Mail className="w-4 h-4" />
                Enviar confirmação (email)
              </button>
              <button
                type="button"
                onClick={() => setConfig((p) => ({ ...p, autoEmailReminders: !p.autoEmailReminders }))}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold flex items-center gap-2 ${
                  config.autoEmailReminders ? 'glass-purple text-white border-transparent' : 'bg-white/70 dark:bg-white/10 border-white/30 text-gray-700 dark:text-slate-200'
                }`}
              >
                <Clock3 className="w-4 h-4" />
                Lembretes (24h/1h/10m)
              </button>
              <button
                type="button"
                onClick={() => setConfig((p) => ({ ...p, autoWhatsApp: !p.autoWhatsApp }))}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold flex items-center gap-2 ${
                  config.autoWhatsApp ? 'glass-purple text-white border-transparent' : 'bg-white/70 dark:bg-white/10 border-white/30 text-gray-700 dark:text-slate-200'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp (link)
              </button>
            </div>
            {config.autoWhatsApp ? (
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">WhatsApp padrão (opcional)</label>
                <input
                  value={config.whatsappNumber || ''}
                  onChange={(e) => setConfig((p) => ({ ...p, whatsappNumber: e.target.value }))}
                  className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
                  placeholder="+55..."
                />
                <p className="text-[11px] text-gray-500 dark:text-slate-300">Usado se o lead não tiver telefone.</p>
              </div>
            ) : null}
          </div>
          {!availabilityOk ? (
            <div className="absolute inset-0 grid place-items-center">
              <div className="px-4 py-3 rounded-xl border border-white/20 bg-black/40 backdrop-blur-xl text-white text-sm">
                Complete o Passo 1 para desbloquear
              </div>
            </div>
          ) : null}
          </div>

          <div className="relative">
          <div className={`glass-panel bg-white/45 dark:bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-4 space-y-3 ${(!availabilityOk || !notificationsOk) ? 'opacity-60 blur-[1px] pointer-events-none select-none' : ''}`}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-50">Passo 3 • Google Calendar (opcional)</p>
              <button
                type="button"
                onClick={connectGoogleCalendar}
                disabled={googleCal.loading || !currentUserId}
                className="glass-purple px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {googleCal.connected ? 'Conectado' : 'Conectar'}
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-300">
              {googleCal.message || (googleCal.configured ? 'Pronto para conectar.' : 'Backend não configurado.')}
            </p>
            {!googleCal.configured ? (
              <p className="text-[11px] text-gray-500 dark:text-slate-300">
                No `server.js`, defina `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI` (ex: `http://localhost:3001/calendar/google/callback`).
              </p>
            ) : null}
          </div>
          {(!availabilityOk || !notificationsOk) ? (
            <div className="absolute inset-0 grid place-items-center">
              <div className="px-4 py-3 rounded-xl border border-white/20 bg-black/40 backdrop-blur-xl text-white text-sm">
                Complete os passos anteriores para desbloquear
              </div>
            </div>
          ) : null}
          </div>

          <div className="glass-panel bg-white/45 dark:bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-4">
            <p className="text-sm text-gray-600 dark:text-slate-300">
              Dica: para lembretes por email funcionarem, rode o backend `server.js` na porta 3001.
              Base atual: <span className="font-semibold">{resolveBackendBaseUrl()}</span>
            </p>
          </div>
        </div>
        )}

      {tab === 'agendar' && (
        <div className="relative">
          {setupStep < 3 ? (
            <div className="mb-4 glass-panel bg-white/45 dark:bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-4 text-sm text-gray-700 dark:text-slate-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Complete a Configuração (Passo 1 e 2) para desbloquear o agendamento.
            </div>
          ) : null}
        <div className={`grid grid-cols-1 lg:grid-cols-5 gap-4 ${setupStep < 3 ? 'opacity-60 blur-[1px] pointer-events-none select-none' : ''}`}>
          <div className="lg:col-span-3 glass-panel bg-white/45 dark:bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-50 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                {editingId ? 'Editar agendamento' : 'Novo agendamento'}
              </h3>
              {editingId ? (
                <button
                  onClick={resetAppointmentForm}
                  className="px-3 py-2 rounded-lg text-sm font-semibold bg-white/70 dark:bg-white/10 border border-white/30 text-gray-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-white/15 flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Cancelar edição
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Data</label>
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => {
                    setDateStr(e.target.value);
                    setSlotIso('');
                  }}
                  className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
                />
                <p className="text-[11px] text-gray-500 dark:text-slate-300">
                  {dayName} • {isWorkingDay ? 'dia de atendimento' : 'fora do atendimento'}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
                >
                  <option value="confirmed">Confirmado</option>
                  <option value="pending">Aguardando</option>
                  <option value="canceled">Cancelado</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Canal</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as CalendarChannel)}
                  className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
                >
                  {(['Google Meet', 'Zoom', 'WhatsApp', 'Telefone'] as CalendarChannel[]).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
	              <div className="space-y-2">
	                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Link (opcional)</label>
	                <div className="flex items-center gap-2">
	                  <LinkIcon className="w-4 h-4 text-gray-400" />
	                  <input
	                    value={meetingLink}
	                    onChange={(e) => setMeetingLink(e.target.value)}
	                    disabled={channel === 'Telefone' || channel === 'WhatsApp'}
	                    className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100 disabled:opacity-60"
	                    placeholder={channel === 'Telefone' || channel === 'WhatsApp' ? 'Não precisa' : 'https://...'}
	                  />
	                </div>
	              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Horário</label>
              {slots.length === 0 ? (
                <div className="text-sm text-gray-600 dark:text-slate-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Ajuste sua disponibilidade em Configuração.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <button
                      key={s.iso}
                      type="button"
                      disabled={s.disabled}
                      onClick={() => setSlotIso(s.iso)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold border transition ${
                        slotIso === s.iso
                          ? 'glass-purple text-white border-transparent'
                          : s.disabled
                            ? 'bg-slate-500/10 border-slate-400/30 text-slate-500 cursor-not-allowed'
                            : 'bg-emerald-500/10 border-emerald-400/40 text-emerald-600 dark:text-emerald-200 hover:bg-emerald-500/15'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="glass-panel bg-white/60 dark:bg-white/5 border border-white/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-50">Vincular lead (opcional)</p>
                {selectedLeadPreview ? (
                  <span className="text-xs text-gray-600 dark:text-slate-300">ID: {selectedLeadPreview.id}</span>
                ) : null}
              </div>
              <div className="relative">
                <input
                  value={leadSearch}
                  onChange={(e) => {
                    setLeadSearch(e.target.value);
                    setSelectedLeadId('');
                  }}
                  className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
                  placeholder="Buscar lead por empresa/nome…"
                />
                {filteredLeadSuggestions.length > 0 && !selectedLeadId ? (
                  <div className="absolute z-20 mt-2 w-full rounded-xl border border-white/20 bg-white/95 dark:bg-slate-900/95 shadow-xl overflow-hidden">
                    {filteredLeadSuggestions.map((l) => (
                      <button
                        type="button"
                        key={l.id}
                        onClick={() => selectLead(l)}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-purple-50 dark:hover:bg-purple-500/10 text-gray-800 dark:text-slate-100"
                      >
                        <span className="font-semibold">{l.company}</span> <span className="text-gray-500 dark:text-slate-300">• {l.name}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-slate-300">Se escolher um lead, o status muda para “Aguardando”.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nome do lead</label>
                <input
                  value={leadForm.name}
                  onChange={(e) => setLeadForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
                  placeholder="Ex: João Silva"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Duração (min)</label>
                <input
                  type="number"
                  min={5}
                  max={240}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value) || 30)}
                  className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
	              <div className="space-y-2">
	                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email</label>
	                <input
	                  type="email"
	                  autoComplete="email"
	                  value={leadForm.email}
	                  onChange={(e) => setLeadForm((p) => ({ ...p, email: e.target.value }))}
	                  className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
	                  placeholder="contato@empresa.com"
	                />
	              </div>
	              <div className="space-y-2">
	                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Telefone</label>
	                <input
	                  type="tel"
	                  inputMode="tel"
	                  autoComplete="tel"
	                  value={leadForm.phone}
	                  onChange={(e) => setLeadForm((p) => ({ ...p, phone: e.target.value }))}
	                  className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
	                  placeholder="(11) 99999-9999"
	                />
	              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Empresa</label>
                <input
                  value={leadForm.company}
                  onChange={(e) => setLeadForm((p) => ({ ...p, company: e.target.value }))}
                  className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100"
                  placeholder="Nome da empresa"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Observações</label>
              <textarea
                value={leadForm.notes}
                onChange={(e) => setLeadForm((p) => ({ ...p, notes: e.target.value }))}
                className="w-full rounded-lg border border-white/30 dark:border-white/20 bg-white/80 dark:bg-white/15 px-3 py-2 text-sm text-gray-800 dark:text-slate-100 resize-none"
                rows={2}
                placeholder="Contexto, objetivo, próximos passos..."
              />
            </div>

            {error ? (
              <p className="text-sm text-rose-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> {error}
              </p>
            ) : null}

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setTab('agenda')}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-white/70 dark:bg-white/10 border border-white/30 text-gray-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-white/15"
              >
                Ver agenda
              </button>
              <button onClick={upsertAppointment} className="glass-purple px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {editingId ? 'Salvar' : 'Agendar'}
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 glass-panel bg-white/45 dark:bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-lg space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-50">Do dia</h3>
            {dayAppointments.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-slate-300">Nenhum agendamento nesse dia.</p>
            ) : (
              <div className="space-y-2">
                {dayAppointments.map((a) => (
                  <div
                    key={a.id}
                    className="glass-panel bg-white/60 dark:bg-white/5 border border-white/20 rounded-xl p-3 flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-50">
                        {a.leadName}{' '}
                        <span className={`ml-2 text-[11px] px-2 py-0.5 rounded-full border ${statusChipClass(a.status)}`}>
                          {statusChip(a.status)}
                        </span>
                      </p>
                      <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">
                        {formatDateTime(a.startAt, fullConfig.timezone)} • {a.durationMinutes}min • {a.channel}
                      </p>
                      {a.meetingLink ? (
                        <a
                          className="text-xs text-indigo-300 hover:text-indigo-200 inline-flex items-center gap-1 mt-1"
                          href={a.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <LinkIcon className="w-3.5 h-3.5" />
                          Abrir link
                        </a>
                      ) : null}
                      {a.leadPhone && config.autoWhatsApp ? (
                        <a
                          className="text-xs text-emerald-300 hover:text-emerald-200 inline-flex items-center gap-1 mt-1 ml-3"
                          href={toWhatsAppUrl(a.leadPhone, `Olá ${a.leadName}! Confirmando nosso agendamento em ${formatDateTime(a.startAt, fullConfig.timezone)}.`)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(a)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/70 dark:bg-white/10 border border-white/30 text-gray-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-white/15 flex items-center gap-1.5"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Editar
                      </button>
                      {a.status !== 'canceled' ? (
                        <button
                          onClick={() => cancelAppointment(a.id)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/15 flex items-center gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancelar
                        </button>
                      ) : (
                        <button
                          onClick={() => removeAppointment(a.id)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/70 dark:bg-white/10 border border-white/30 text-gray-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-white/15 flex items-center gap-1.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Apagar
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {tab === 'agenda' && (
        <div className="relative">
          {setupStep < 3 ? (
            <div className="mb-4 glass-panel bg-white/45 dark:bg-white/5 backdrop-blur-xl border border-white/20 rounded-2xl p-4 text-sm text-gray-700 dark:text-slate-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Complete a Configuração (Passo 1 e 2) para desbloquear a agenda.
            </div>
          ) : null}
        <div className={`glass-panel bg-white/45 dark:bg-white/5 backdrop-blur-xl rounded-2xl p-4 border border-white/10 shadow-lg space-y-4 ${setupStep < 3 ? 'opacity-60 blur-[1px] pointer-events-none select-none' : ''}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-50">Próximos agendamentos</h3>
            <button onClick={() => requestTab('agendar')} className="glass-purple px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Novo
            </button>
          </div>

          {upcoming.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-slate-300">Sem agendamentos futuros.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {upcoming.map((a) => (
                <div key={a.id} className="glass-panel bg-white/60 dark:bg-white/5 border border-white/20 rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-slate-50">{a.leadName}</p>
                      <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">{formatDateTime(a.startAt, fullConfig.timezone)}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[11px] border ${statusChipClass(a.status)}`}>{statusChip(a.status)}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-600 dark:text-slate-300">
                    <span className="px-2 py-1 rounded-full bg-white/70 dark:bg-white/10 border border-white/30">{a.channel}</span>
                    <span className="px-2 py-1 rounded-full bg-white/70 dark:bg-white/10 border border-white/30">{a.durationMinutes}min</span>
                    {a.leadCompany ? (
                      <span className="px-2 py-1 rounded-full bg-white/70 dark:bg-white/10 border border-white/30">{a.leadCompany}</span>
                    ) : null}
                  </div>
                  {a.leadNotes ? <p className="text-xs text-gray-700 dark:text-slate-200 whitespace-pre-line">{a.leadNotes}</p> : null}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => startEdit(a)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/70 dark:bg-white/10 border border-white/30 text-gray-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-white/15 flex items-center gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    {a.status !== 'canceled' ? (
                      <button
                        onClick={() => cancelAppointment(a.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/15 flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        Cancelar
                      </button>
                    ) : (
                      <button
                        onClick={() => removeAppointment(a.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/70 dark:bg-white/10 border border-white/30 text-gray-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-white/15 flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Apagar
                      </button>
                    )}
                    {a.meetingLink ? (
                      <a
                        className="ml-auto px-3 py-1.5 rounded-lg text-xs font-semibold glass-purple flex items-center gap-1.5"
                        href={a.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <LinkIcon className="w-3.5 h-3.5" />
                        Abrir
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default Calendar;
