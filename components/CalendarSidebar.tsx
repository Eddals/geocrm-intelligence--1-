import React from 'react';
import { CalendarDays, List, SlidersHorizontal, Shield, Link2, Lock } from 'lucide-react';

type CalendarTab = 'agendar' | 'agenda' | 'config';

interface CalendarSidebarProps {
  tab: CalendarTab;
  setTab: (tab: CalendarTab) => void;
  persistLabel?: string;
  googleStatus?: { configured: boolean; connected: boolean; message?: string };
  locks?: Partial<Record<CalendarTab, { locked: boolean; reason?: string }>>;
}

const CalendarSidebar: React.FC<CalendarSidebarProps> = ({ tab, setTab, persistLabel, googleStatus, locks }) => {
  const items: Array<{ id: CalendarTab; label: string; icon: React.ElementType; desc: string }> = [
    { id: 'agendar', label: 'Agendar', icon: CalendarDays, desc: 'Criar/editar reunião' },
    { id: 'agenda', label: 'Agenda', icon: List, desc: 'Próximos agendamentos' },
    { id: 'config', label: 'Configuração', icon: SlidersHorizontal, desc: 'Disponibilidade + avisos' }
  ];

  return (
    <aside className="hidden lg:block w-full max-w-[260px] glass-panel bg-white/50 dark:bg-white/5 border border-white/20 rounded-3xl p-4 h-fit sticky top-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-xs uppercase tracking-[0.3em] text-gray-500 dark:text-slate-300 font-semibold">Calendário</div>
        {persistLabel ? (
          <span className="text-[11px] px-2 py-1 rounded-full border border-white/25 bg-white/60 dark:bg-white/10 text-gray-700 dark:text-slate-200">
            {persistLabel}
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          const locked = !!locks?.[item.id]?.locked;
          const reason = locks?.[item.id]?.reason;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              disabled={locked}
              className={`w-full text-left px-4 py-3 rounded-2xl border transition-all flex items-start gap-3 ${
                active
                  ? 'glass-purple text-white border-transparent shadow-lg shadow-purple-900/20'
                  : locked
                    ? 'bg-white/40 dark:bg-white/5 border-white/20 text-gray-600 dark:text-slate-400 opacity-70 cursor-not-allowed'
                    : 'bg-white/70 dark:bg-white/10 border-white/30 text-gray-800 dark:text-slate-100 hover:bg-white/80 dark:hover:bg-white/15'
              }`}
            >
              <Icon className={`w-5 h-5 mt-0.5 ${active ? 'text-white' : 'text-purple-500'}`} />
              <div className="flex-1">
                <div className="text-sm font-semibold leading-tight flex items-center justify-between gap-2">
                  <span>{item.label}</span>
                  {locked ? <Lock className={`w-4 h-4 ${active ? 'text-white/90' : 'text-purple-500'}`} /> : null}
                </div>
                <div className={`text-[11px] mt-1 ${active ? 'text-white/80' : 'text-gray-500 dark:text-slate-300'}`}>
                  {locked ? reason || 'Complete etapas anteriores' : item.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-white/15 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-slate-200">
          <Shield className="w-4 h-4 text-purple-500" />
          Proteção
        </div>
        <p className="text-[11px] text-gray-500 dark:text-slate-300 leading-snug">
          Links validados, conflitos bloqueados e lembretes só com SMTP configurado.
        </p>

        {googleStatus ? (
          <div className="mt-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-slate-200">
              <Link2 className="w-4 h-4 text-purple-500" />
              Google Calendar
            </div>
            <p className="text-[11px] text-gray-500 dark:text-slate-300 leading-snug mt-1">
              {googleStatus.connected ? 'Conectado' : googleStatus.configured ? 'Disponível' : 'Não configurado'}
            </p>
          </div>
        ) : null}
      </div>
    </aside>
  );
};

export default CalendarSidebar;
