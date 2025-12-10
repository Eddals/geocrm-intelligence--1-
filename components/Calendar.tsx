import React, { useMemo, useState } from 'react';
import {
  CalendarDays,
  Clock3,
  Globe2,
  Bell,
  Mail,
  Phone,
  Users,
  Zap,
  Link as LinkIcon,
  ExternalLink,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

type ScheduleType = {
  id: string;
  name: string;
  duration: number;
  description: string;
  channel: 'Google Meet' | 'Zoom' | 'WhatsApp';
};

type LeadForm = {
  name: string;
  email: string;
  phone: string;
  company: string;
  objective: string;
  urgency: 'Baixa' | 'Média' | 'Alta' | '';
};

type Slot = { time: string; tz: string; status: 'livre' | 'ocupado' | 'bloqueado' };

type Appointment = {
  id: string;
  leadName: string;
  typeName: string;
  channel: string;
  time: string;
  status: 'Confirmado' | 'Aguardando' | 'Cancelado';
};

const defaultTypes: ScheduleType[] = [
  { id: 't1', name: 'Chamada rápida', duration: 15, description: 'Triagem inicial', channel: 'Google Meet' },
  { id: 't2', name: 'Reunião estratégica', duration: 30, description: 'Entender objetivo e plano', channel: 'Zoom' },
  { id: 't3', name: 'Demonstração', duration: 45, description: 'Produto + perguntas', channel: 'Google Meet' }
];

const baseSlots: Slot[] = [
  { time: '09:00', tz: 'GMT-3', status: 'livre' },
  { time: '09:30', tz: 'GMT-3', status: 'livre' },
  { time: '10:00', tz: 'GMT-3', status: 'ocupado' },
  { time: '10:30', tz: 'GMT-3', status: 'livre' },
  { time: '11:00', tz: 'GMT-3', status: 'bloqueado' },
  { time: '14:00', tz: 'GMT-3', status: 'livre' },
  { time: '14:30', tz: 'GMT-3', status: 'livre' },
  { time: '15:00', tz: 'GMT-3', status: 'ocupado' }
];

const Calendar: React.FC = () => {
  const [types, setTypes] = useState<ScheduleType[]>(defaultTypes);
  const [newType, setNewType] = useState<ScheduleType>({
    id: '',
    name: '',
    duration: 30,
    description: '',
    channel: 'Google Meet'
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const [lead, setLead] = useState<LeadForm>({
    name: '',
    email: '',
    phone: '',
    company: '',
    objective: '',
    urgency: ''
  });
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadError, setLeadError] = useState<string | null>(null);

  const initialTypeId = defaultTypes[0]?.id || '';
  const [selectedTypeId, setSelectedTypeId] = useState<string>(initialTypeId);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([
    { id: 'a1', leadName: 'Ana Souza', typeName: 'Reunião estratégica', channel: 'Google Meet', time: 'Hoje • 14:30', status: 'Confirmado' },
    { id: 'a2', leadName: 'Loja Nova Era', typeName: 'Demonstração', channel: 'Zoom', time: 'Hoje • 16:00', status: 'Aguardando' }
  ]);
  const [reminders, setReminders] = useState<{ h24: boolean; h1: boolean; m10: boolean }>({ h24: true, h1: true, m10: true });
  const [sync, setSync] = useState<{ google: boolean; outlook: boolean }>({ google: true, outlook: false });

  const freeSlots = useMemo(() => baseSlots.filter((s) => s.status === 'livre'), []);

  const handleAddOrUpdateType = () => {
    if (!newType.name.trim()) return;
    if (editingId) {
      setTypes((prev) => prev.map((t) => (t.id === editingId ? { ...newType, id: editingId } : t)));
      setEditingId(null);
    } else {
      setTypes((prev) => [...prev, { ...newType, id: crypto.randomUUID() }]);
    }
    setNewType({ id: '', name: '', duration: 30, description: '', channel: 'Google Meet' });
  };

  const handleEditType = (id: string) => {
    const t = types.find((x) => x.id === id);
    if (!t) return;
    setNewType(t);
    setEditingId(id);
  };

  const handleDeleteType = (id: string) => {
    setTypes((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (selectedTypeId === id) {
        setSelectedTypeId(next[0]?.id || '');
      }
      return next;
    });
  };

  const validateLead = () => {
    if (!lead.name.trim()) return 'Nome é obrigatório';
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email);
    if (!emailOk) return 'Email inválido';
    if (!lead.phone.trim()) return 'Telefone é obrigatório';
    if (!lead.urgency) return 'Urgência é obrigatória';
    return null;
  };

  const handleLeadSubmit = () => {
    const err = validateLead();
    if (err) {
      setLeadError(err);
      return;
    }
    setLeadError(null);
    setLeadId(crypto.randomUUID());
  };

  const selectedType = useMemo(() => types.find((t) => t.id === selectedTypeId) || types[0] || null, [types, selectedTypeId]);

  const handleCreateAppointment = () => {
    if (!leadId || !selectedType || !selectedSlot) return;
    const appt: Appointment = {
      id: crypto.randomUUID(),
      leadName: lead.name || 'Lead',
      typeName: selectedType.name,
      channel: selectedType.channel,
      time: `${selectedSlot.time} ${selectedSlot.tz}`,
      status: 'Confirmado'
    };
    setAppointments((prev) => [appt, ...prev]);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="glass-panel bg-white/80 dark:bg-white/5 border border-white/40 dark:border-white/10 rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-lg">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400 font-semibold">Módulo</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">Agendamentos Inteligentes</h1>
          <p className="text-sm text-gray-600 dark:text-slate-300 mt-1">Crie tipos de agenda, colete dados do lead, ofereça horários livres e confirme com lembretes.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="glass-purple px-4 py-2 rounded-xl text-sm font-semibold shadow-md flex items-center gap-2">
            <CalendarDays className="w-4 h-4" /> Criar Tipo de Agenda
          </button>
          <button className="px-4 py-2 rounded-xl text-sm font-semibold bg-white/70 dark:bg-white/10 border border-white/50 dark:border-white/10 text-gray-800 dark:text-slate-100 shadow-sm flex items-center gap-2">
            <Zap className="w-4 h-4" /> Conectar Google/Outlook
          </button>
        </div>
      </header>

      {/* Tipos de agendamento */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-50 flex items-center gap-2"><Clock3 className="w-5 h-5 text-indigo-400" /> Tipos de agendamento</h3>
          {editingId && <span className="text-xs text-indigo-400">Editando: {newType.name}</span>}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="space-y-2 glass-panel bg-white/60 dark:bg-white/5 rounded-xl p-3 border border-white/20">
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Nome</label>
            <input value={newType.name} onChange={(e) => setNewType((p) => ({ ...p, name: e.target.value }))} className="w-full rounded-lg border border-white/40 dark:border-white/15 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm text-gray-800 dark:text-slate-100" />
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Duração (min)</label>
            <input type="number" value={newType.duration} onChange={(e) => setNewType((p) => ({ ...p, duration: Number(e.target.value) || 0 }))} className="w-full rounded-lg border border-white/40 dark:border-white/15 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm text-gray-800 dark:text-slate-100" />
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Descrição</label>
            <textarea value={newType.description} onChange={(e) => setNewType((p) => ({ ...p, description: e.target.value }))} className="w-full rounded-lg border border-white/40 dark:border-white/15 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm text-gray-800 dark:text-slate-100 resize-none" rows={2} />
            <label className="text-xs font-semibold text-gray-600 dark:text-slate-300">Canal</label>
            <select value={newType.channel} onChange={(e) => setNewType((p) => ({ ...p, channel: e.target.value as ScheduleType['channel'] }))} className="w-full rounded-lg border border-white/40 dark:border-white/15 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm text-gray-800 dark:text-slate-100">
              <option>Google Meet</option>
              <option>Zoom</option>
              <option>WhatsApp</option>
            </select>
            <button onClick={handleAddOrUpdateType} className="glass-purple w-full rounded-lg py-2 text-sm font-semibold">
              {editingId ? 'Salvar alterações' : 'Adicionar tipo'}
            </button>
          </div>
          <div className="lg:col-span-2 space-y-2">
            {types.map((t) => (
              <div key={t.id} className="glass-panel bg-white/60 dark:bg-white/5 border border-white/20 rounded-xl p-3 flex items-center justify-between">
                <div className="flex flex-col">
                  <p className="text-sm font-semibold text-gray-900 dark:text-slate-50">{t.name} • {t.duration}min</p>
                  <p className="text-xs text-gray-500 dark:text-slate-300">{t.description || 'Sem descrição'}</p>
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 flex items-center gap-1"><LinkIcon className="w-3 h-3" /> {t.channel}</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button onClick={() => handleEditType(t.id)} className="px-2 py-1 rounded-lg bg-white/60 dark:bg-white/10 border border-white/30 flex items-center gap-1 text-gray-700 dark:text-slate-100"><Edit3 className="w-3 h-3" /> Editar</button>
                  <button onClick={() => handleDeleteType(t.id)} className="px-2 py-1 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/30 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Del</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Formulário do lead + slots + criação */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10 shadow-lg space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-50 flex items-center gap-2"><Users className="w-5 h-5 text-indigo-400" /> Formulário do lead</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2">
              <input placeholder="Nome" value={lead.name} onChange={(e) => setLead((p) => ({ ...p, name: e.target.value }))} className="rounded-lg border border-white/30 dark:border-white/15 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm text-gray-800 dark:text-slate-100" />
              <input placeholder="Email" value={lead.email} onChange={(e) => setLead((p) => ({ ...p, email: e.target.value }))} className="rounded-lg border border-white/30 dark:border-white/15 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm text-gray-800 dark:text-slate-100" />
              <input placeholder="Telefone" value={lead.phone} onChange={(e) => setLead((p) => ({ ...p, phone: e.target.value }))} className="rounded-lg border border-white/30 dark:border-white/15 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm text-gray-800 dark:text-slate-100" />
              <input placeholder="Empresa (opcional)" value={lead.company} onChange={(e) => setLead((p) => ({ ...p, company: e.target.value }))} className="rounded-lg border border-white/30 dark:border-white/15 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm text-gray-800 dark:text-slate-100" />
              <textarea placeholder="Objetivo da reunião" value={lead.objective} onChange={(e) => setLead((p) => ({ ...p, objective: e.target.value }))} className="rounded-lg border border-white/30 dark:border-white/15 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm text-gray-800 dark:text-slate-100 resize-none" rows={2} />
              <select value={lead.urgency} onChange={(e) => setLead((p) => ({ ...p, urgency: e.target.value as LeadForm['urgency'] }))} className="rounded-lg border border-white/30 dark:border-white/15 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm text-gray-800 dark:text-slate-100">
                <option value="">Urgência</option>
                <option>Baixa</option>
                <option>Média</option>
                <option>Alta</option>
              </select>
            </div>
            {leadError && <p className="text-xs text-rose-500">{leadError}</p>}
            <button onClick={handleLeadSubmit} className="glass-purple w-full rounded-lg py-2 text-sm font-semibold">
              Salvar lead no CRM
            </button>
            {leadId && <p className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Lead salvo: {leadId.slice(0, 8)}...</p>}
          </div>

          {/* Slots disponíveis */}
          <div className="lg:col-span-1 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-50 flex items-center gap-2"><Clock3 className="w-4 h-4 text-indigo-400" /> Horários disponíveis</h4>
              <span className="text-[11px] text-gray-500 dark:text-slate-300">fuso: {freeSlots[0]?.tz || 'GMT-3'}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {baseSlots.map((s) => (
                <button
                  key={s.time}
                  disabled={s.status !== 'livre'}
                  onClick={() => setSelectedSlot(s)}
                  className={`rounded-lg px-3 py-2 border text-sm transition ${
                    s.status === 'livre'
                      ? selectedSlot?.time === s.time
                        ? 'glass-purple text-white border-transparent'
                        : 'bg-emerald-500/10 border-emerald-400/40 text-emerald-600 dark:text-emerald-200'
                      : s.status === 'ocupado'
                        ? 'bg-rose-500/10 border-rose-400/40 text-rose-500 cursor-not-allowed'
                        : 'bg-slate-500/10 border-slate-400/30 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{s.time}</span>
                    <span className="text-[11px]">{s.tz}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Criação do agendamento */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-50 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-indigo-400" /> Criar agendamento</h4>
            <select value={selectedTypeId} onChange={(e) => setSelectedTypeId(e.target.value)} className="w-full rounded-lg border border-white/30 dark:border-white/15 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm text-gray-800 dark:text-slate-100">
              {types.length === 0 && <option value="">Nenhum tipo cadastrado</option>}
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name} • {t.duration}min</option>
              ))}
            </select>
            <div className="glass-panel bg-white/60 dark:bg-white/5 border border-white/20 rounded-xl p-3 text-sm text-gray-700 dark:text-slate-200">
              <p><strong>Lead:</strong> {lead.name || '—'}</p>
              <p><strong>Tipo:</strong> {selectedType?.name || '—'}</p>
              <p><strong>Canal:</strong> {selectedType?.channel || '—'}</p>
              <p><strong>Horário:</strong> {selectedSlot ? `${selectedSlot.time} ${selectedSlot.tz}` : 'Selecione um horário livre'}</p>
            </div>
            <button
              onClick={handleCreateAppointment}
              disabled={!leadId || !selectedSlot}
              className="glass-purple w-full rounded-lg py-2 text-sm font-semibold disabled:opacity-60"
            >
              Confirmar agendamento
            </button>
            {!leadId && <p className="text-[11px] text-amber-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Salve o lead antes de agendar.</p>}
          </div>
        </div>
      </div>

      {/* Confirmação + lembretes + sincronização */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10 shadow-lg space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="glass-panel bg-white/60 dark:bg-white/5 border border-white/20 rounded-xl p-3 space-y-2">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-50 flex items-center gap-2"><Bell className="w-4 h-4 text-amber-400" /> Confirmação + Lembretes</h4>
            <div className="flex flex-wrap gap-2 text-xs text-gray-700 dark:text-slate-200">
              {['24h antes', '1h antes', '10min antes'].map((t, idx) => {
                const key = idx === 0 ? 'h24' : idx === 1 ? 'h1' : 'm10';
                const checked = reminders[key as keyof typeof reminders];
                return (
                  <button
                    key={t}
                    onClick={() => setReminders((p) => ({ ...p, [key]: !checked }))}
                    className={`px-2 py-1 rounded-full border text-xs ${checked ? 'glass-purple text-white border-transparent' : 'bg-white/70 dark:bg-white/10 border-white/30 text-gray-700 dark:text-slate-200'}`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <textarea className="w-full rounded-lg border border-white/30 dark:border-white/15 bg-white/80 dark:bg-white/10 px-3 py-2 text-sm text-gray-800 dark:text-slate-100 resize-none" rows={2} placeholder="Template de confirmação (email/WhatsApp) com link da reunião." />
          </div>

          <div className="glass-panel bg-white/60 dark:bg-white/5 border border-white/20 rounded-xl p-3 space-y-2">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-50 flex items-center gap-2"><Globe2 className="w-4 h-4 text-emerald-400" /> Sincronização</h4>
            <div className="flex gap-2 text-xs">
              <button onClick={() => setSync((p) => ({ ...p, google: !p.google }))} className={`px-3 py-1 rounded-lg border ${sync.google ? 'glass-purple text-white border-transparent' : 'bg-white/70 dark:bg-white/10 border-white/30 text-gray-700 dark:text-slate-200'}`}>Google Calendar</button>
              <button onClick={() => setSync((p) => ({ ...p, outlook: !p.outlook }))} className={`px-3 py-1 rounded-lg border ${sync.outlook ? 'glass-purple text-white border-transparent' : 'bg-white/70 dark:bg-white/10 border-white/30 text-gray-700 dark:text-slate-200'}`}>Outlook</button>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-300">Eventos são criados/atualizados/removidos ao reagendar/cancelar.</p>
          </div>

          <div className="glass-panel bg-white/60 dark:bg-white/5 border border-white/20 rounded-xl p-3 space-y-2">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-50 flex items-center gap-2"><Users className="w-4 h-4 text-indigo-400" /> Roteamento & Prioridade</h4>
            <p className="text-xs text-gray-500 dark:text-slate-300">Round-robin + regras por setor/ticket/urgência.</p>
            <div className="flex flex-wrap gap-2 text-xs">
              {['Round-robin', 'Setor', 'Ticket', 'Urgência'].map((r) => (
                <span key={r} className="px-2 py-1 rounded-full bg-white/70 dark:bg-white/10 border border-white/30 text-gray-700 dark:text-slate-200">{r}</span>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-300">Lead marcado como Agendado/Confirmado/No-show conforme status.</p>
          </div>
        </div>
      </div>

      {/* Próximas reuniões */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-50 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-indigo-400" /> Próximas reuniões</h3>
          <span className="text-xs text-gray-500 dark:text-slate-300">Sincroniza com CRM</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {appointments.map((a) => (
            <div key={a.id} className="glass-panel bg-white/60 dark:bg-white/5 border border-white/20 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900 dark:text-slate-50">{a.leadName}</p>
                <span className={`px-2 py-1 rounded-full text-[11px] border ${
                  a.status === 'Confirmado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                  a.status === 'Cancelado' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                  'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}>{a.status}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-300">{a.typeName} • {a.channel}</p>
              <p className="text-xs text-gray-500 dark:text-slate-300">{a.time}</p>
              <div className="flex gap-2 text-xs">
                <button className="glass-purple px-2.5 py-1 rounded-lg">Reenviar lembrete</button>
                <button className="px-2.5 py-1 rounded-lg bg-white/70 dark:bg-white/10 border border-white/30 text-gray-700 dark:text-slate-200 flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Abrir reunião
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Calendar;
