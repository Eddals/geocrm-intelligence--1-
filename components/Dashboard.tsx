
import React, { useMemo } from 'react';
import { Lead, Stats, PipelineStage } from '../types';
import { TrendingUp, TrendingDown, Minus, Users, UserPlus, PhoneOutgoing, CheckCircle2, Clock3, Flame, Ban, Building2, Download, Sparkles, Search } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  stats: Stats;
  leads: Lead[];
  userName?: string;
}

type TrendDirection = 'up' | 'down' | 'flat';

const toDayKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const endOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const parseStatusFromHistoryDescription = (description: string) => {
  const match = /Status alterado para (.+)\s*$/.exec(description || '');
  if (!match) return null;
  const candidate = match[1]?.trim();
  const values = Object.values(PipelineStage) as string[];
  return values.includes(candidate) ? (candidate as PipelineStage) : null;
};

const getLeadStatusAt = (lead: Lead, at: Date) => {
  const createdAt = new Date(lead.createdAt);
  if (!(createdAt instanceof Date) || Number.isNaN(createdAt.valueOf())) return lead.status;
  if (createdAt > at) return null;

  const history = (lead.history || [])
    .filter(h => h.type === 'status_change')
    .map(h => ({ date: new Date(h.date), status: parseStatusFromHistoryDescription(h.description) }))
    .filter((h): h is { date: Date; status: PipelineStage } => !!h.status && !Number.isNaN(h.date.valueOf()))
    .sort((a, b) => a.date.valueOf() - b.date.valueOf());

  // Se não há histórico de mudança, assume status atual como status do período.
  if (history.length === 0) return lead.status;

  // Para leads criados dentro do app, o primeiro status costuma ser "Novo".
  let status: PipelineStage = PipelineStage.NEW;
  for (const entry of history) {
    if (entry.date <= at) status = entry.status;
  }
  return status;
};

const buildDailySeries = (leads: Lead[], days: number) => {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const series: Array<{
    day: string;
    totalLeads: number;
    newLeads: number;
    inContact: number;
    converted: number;
    conversionRate: number;
    hot: number;
    weak: number;
  }> = [];

  for (let i = 0; i < days; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const dayEnd = endOfDay(day);
    const dayKey = toDayKey(day);

    let totalLeads = 0;
    let newLeads = 0;
    let inContact = 0;
    let converted = 0;
    let hot = 0;
    let weak = 0;

    for (const lead of leads) {
      const createdAt = new Date(lead.createdAt);
      if (Number.isNaN(createdAt.valueOf())) continue;
      if (createdAt > dayEnd) continue;

      totalLeads += 1;
      if (toDayKey(createdAt) === dayKey) newLeads += 1;

      const status = getLeadStatusAt(lead, dayEnd);
      if (status === PipelineStage.CONTACT) inContact += 1;
      if (status === PipelineStage.CLOSED) converted += 1;

      const highPriority = lead.leadPriority === 'High';
      const highValue = Number(lead.value) >= 10000;
      const qualifiedStage = status !== null && [PipelineStage.QUALIFIED, PipelineStage.CONTACT, PipelineStage.ANALYSIS].includes(status);
      const isHot = (highPriority || highValue) && qualifiedStage;
      const isWeak = lead.leadPriority === 'Low' || status === PipelineStage.LOST;
      if (isHot) hot += 1;
      if (isWeak) weak += 1;
    }

    const conversionRate = totalLeads > 0 ? (converted / totalLeads) * 100 : 0;
    series.push({ day: dayKey, totalLeads, newLeads, inContact, converted, conversionRate, hot, weak });
  }

  return series;
};

const getTrendFromSeries = (values?: number[]) => {
  if (!values || values.length < 2) return { direction: 'flat' as TrendDirection, delta: 0 };
  const last = values[values.length - 1] ?? 0;
  const prev = values[values.length - 2] ?? 0;
  const delta = last - prev;
  const direction: TrendDirection = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  return { direction, delta };
};

const toCsvCell = (value: unknown) => {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const downloadCsv = (filename: string, rows: Array<Array<unknown>>) => {
  const csv = rows.map((r) => r.map(toCsvCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const Sparkline = ({ values }: { values: number[] }) => {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div
      className="h-12 w-full cursor-default select-none pointer-events-none opacity-90"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sparkGreen" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke="#22c55e" strokeWidth={2} fill="url(#sparkGreen)" dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

const MiniTrend = ({
  label,
  value,
  series
}: {
  label: string;
  value: string;
  series: number[];
}) => {
  const { direction, delta } = getTrendFromSeries(series);
  const TrendIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  const deltaText = Number.isFinite(delta) ? (Number.isInteger(delta) ? String(Math.abs(delta)) : Math.abs(delta).toFixed(1)) : '0';
  const trendText =
    direction === 'up'
      ? `Subindo +${deltaText}`
      : direction === 'down'
        ? `Caindo -${deltaText}`
        : 'Estável';

  return (
    <div className="glass-panel rounded-2xl relative overflow-hidden h-full transition-shadow">
      <div
        aria-hidden
        className="absolute inset-0 opacity-35 bg-[linear-gradient(to_right,rgba(34,197,94,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,197,94,0.12)_1px,transparent_1px)] bg-[size:14px_14px]"
      />
      <div className="p-4 relative z-10 flex flex-col justify-between h-full">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1 whitespace-nowrap">
            <TrendIcon className="w-3 h-3" />
            {trendText}
          </span>
        </div>
        <p className="text-2xl font-bold text-gray-800 mt-2">{value}</p>
        <div className="mt-3 -mx-4 -mb-4">
          <Sparkline values={series} />
        </div>
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ stats, leads, userName = 'Usuário' }) => {
  const BRL_TO_USD = 5.2;
  const isBrazilLead = (lead: Lead) => {
    const phone = lead.phone || '';
    const city = (lead.city || '').toLowerCase();
    return phone.replace(/\D/g, '').startsWith('55') || city.includes('brasil') || city.includes('brazil') || city.includes('rio') || city.includes('são') || city.includes('sao');
  };
  const leadValueUSD = (lead: Lead) => {
    const v = Number(lead.value) || 0;
    return isBrazilLead(lead) ? v / BRL_TO_USD : v;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getTime = () => {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const isHotLead = (lead: Lead) => {
    const highPriority = lead.leadPriority === 'High';
    const highValue = Number(lead.value) >= 10000;
    const qualifiedStage = [PipelineStage.QUALIFIED, PipelineStage.CONTACT, PipelineStage.ANALYSIS].includes(lead.status);
    return (highPriority || highValue) && qualifiedStage;
  };

  const isWeakLead = (lead: Lead) => {
    return lead.leadPriority === 'Low' || lead.status === PipelineStage.LOST;
  };

  const pipelineRevenue = useMemo(() => {
    const stages = {
      [PipelineStage.NEW]: { label: 'Novos', value: 0, color: 'bg-blue-500', icon: Sparkles },
      [PipelineStage.ANALYSIS]: { label: 'Em Análise', value: 0, color: 'bg-violet-500', icon: Search },
      [PipelineStage.CONTACT]: { label: 'Em Contato', value: 0, color: 'bg-amber-500', icon: PhoneOutgoing },
      [PipelineStage.QUALIFIED]: { label: 'Qualificados', value: 0, color: 'bg-purple-500', icon: CheckCircle2 },
      [PipelineStage.WAITING]: { label: 'Aguardando', value: 0, color: 'bg-orange-500', icon: Clock3 },
      [PipelineStage.CLOSED]: { label: 'Fechados', value: 0, color: 'bg-emerald-500', icon: CheckCircle2 },
      [PipelineStage.LOST]: { label: 'Perdidos', value: 0, color: 'bg-rose-500', icon: Ban },
    };

    leads.forEach(lead => {
      if (stages[lead.status]) {
        stages[lead.status].value += leadValueUSD(lead);
      }
    });

    const total = Object.values(stages).reduce((sum, s) => sum + s.value, 0);
    return { stages, total };
  }, [leads]);

  const normalizeIndustryLabel = (name?: string) => {
    if (!name) return 'Outros';
    const cleaned = name.trim();
    if (/perplexity\s*maps/i.test(cleaned) || /perplexity/i.test(cleaned)) return 'Mapa Inteligente';
    return cleaned;
  };

  const industryBreakdown = useMemo(() => {
    const bucket = new Map<string, { industry: string; hot: number; weak: number; total: number }>();
    leads.forEach((lead) => {
      const raw = (lead.tags && lead.tags.length > 0 ? lead.tags[0] : lead.source || 'Outros').slice(0, 48);
      const industry = normalizeIndustryLabel(raw);
      if (!bucket.has(industry)) bucket.set(industry, { industry, hot: 0, weak: 0, total: 0 });
      const entry = bucket.get(industry)!;
      entry.total += 1;
      if (isHotLead(lead)) entry.hot += 1;
      if (isWeakLead(lead)) entry.weak += 1;
    });
    return Array.from(bucket.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [leads]);

  const hotLeads = leads.filter(isHotLead);
  const weakLeads = leads.filter(isWeakLead);
  const topIndustry = industryBreakdown[0]?.industry || '—';

  const daily = useMemo(() => buildDailySeries(leads, 14), [leads]);
  const totalSeries = useMemo(() => daily.map(d => d.totalLeads), [daily]);
  const newSeries = useMemo(() => daily.map(d => d.newLeads), [daily]);
  const contactSeries = useMemo(() => daily.map(d => d.inContact), [daily]);
  const convertedSeries = useMemo(() => daily.map(d => d.converted), [daily]);
  const conversionSeries = useMemo(() => daily.map(d => Number(d.conversionRate.toFixed(1))), [daily]);
  const hotSeries = useMemo(() => daily.map(d => d.hot), [daily]);
  const weakSeries = useMemo(() => daily.map(d => d.weak), [daily]);

  const exportLeadsCsv = () => {
    const rows: Array<Array<unknown>> = [
      ['id', 'name', 'company', 'email', 'phone', 'city', 'status', 'source', 'value', 'leadPriority', 'tags', 'createdAt', 'lastContact']
    ];

    for (const lead of leads) {
      rows.push([
        lead.id,
        lead.name,
        lead.company,
        lead.email ?? '',
        lead.phone ?? '',
        lead.city ?? '',
        lead.status,
        lead.source,
        Number(lead.value) || 0,
        lead.leadPriority ?? '',
        (lead.tags || []).join('|'),
        lead.createdAt,
        lead.lastContact ?? ''
      ]);
    }

    const dateKey = new Date().toISOString().slice(0, 10);
    downloadCsv(`leads-${dateKey}.csv`, rows);
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="glass-panel rounded-3xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-gray-800">
              {getGreeting()}, {userName} 👋
            </h1>
            <p className="text-gray-500 mt-1 flex items-center gap-2 text-base">
              <Clock3 className="w-4 h-4 text-indigo-500" />
              <span className="font-semibold text-gray-700">{getTime()}</span>
              <span className="text-gray-400">•</span>
              <span>Aqui está um resumo do seu pipeline</span>
            </p>
          </div>

          <button
            type="button"
            onClick={exportLeadsCsv}
            disabled={leads.length === 0}
            className={`shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition ${
              leads.length === 0
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
            title={leads.length === 0 ? 'Sem leads para exportar' : 'Exportar leads em CSV'}
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
            icon={Users} 
            label="Total Leads" 
            value={stats.totalLeads.toString()} 
            color="bg-blue-50 text-blue-600" 
            series={totalSeries}
        />
        <StatCard 
            icon={UserPlus} 
            label="Novos Hoje" 
            value={stats.newLeadsToday.toString()} 
            color="bg-indigo-50 text-indigo-600" 
            trend={stats.newLeadsToday > 0 ? "+ Novos" : ""}
            series={newSeries}
        />
         <StatCard 
            icon={PhoneOutgoing} 
            label="Em Contato" 
            value={stats.leadsInContact.toString()} 
            color="bg-amber-50 text-amber-600" 
            series={contactSeries}
        />
        <StatCard 
            icon={CheckCircle2} 
            label="Convertidos" 
            value={stats.leadsConverted.toString()} 
            color="bg-emerald-50 text-emerald-600" 
            series={convertedSeries}
        />
        <StatCard 
            icon={TrendingUp} 
            label="Taxa Conv." 
            value={`${stats.conversionRate.toFixed(1)}%`} 
            color="bg-purple-50 text-purple-600" 
            series={conversionSeries}
        />
      </div>

      {/* Revenue Chart */}
      <div className="glass-panel rounded-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Faturamento por Estágio</h2>
            <p className="text-sm text-gray-500 mt-1">Distribuição de valor no pipeline</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-800">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(pipelineRevenue.total)}
            </p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(pipelineRevenue.stages).map(([key, stage]) => {
            const percentage = pipelineRevenue.total > 0 ? (stage.value / pipelineRevenue.total) * 100 : 0;
            const StageIcon = (stage as any).icon as React.ComponentType<{ className?: string }>;
            return (
              <div key={key} className="bg-gray-50 dark:bg-white/5 rounded-lg p-4 border border-gray-100 dark:border-transparent shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  {StageIcon ? (
                    <div className="w-7 h-7 rounded-lg grid place-items-center text-purple-600 dark:text-purple-300 bg-white/60 dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/10 shadow-sm transition-transform duration-150 hover:scale-105 cursor-default">
                      <StageIcon className="w-4 h-4" />
                    </div>
                  ) : null}
                  <span className="text-xs font-bold text-gray-600 uppercase">{stage.label}</span>
                </div>
                <p className="text-xl font-bold text-gray-800">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(stage.value)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}% do total</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hot vs Weak Leads by Industry */}
      <div className="glass-panel rounded-3xl p-6 border border-transparent">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Qualificação por Indústria</h2>
            <p className="text-sm text-gray-500 mt-1">
              Onde estão os leads quentes e fracos no seu CRM Pipeline.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">Quentes: {hotLeads.length}</span>
            <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-100">Fracos: {weakLeads.length}</span>
          </div>
        </div>

        {industryBreakdown.length === 0 ? (
          <p className="text-sm text-gray-500">Cadastre leads com tags/indústria para visualizar.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MiniTrend label="Leads Quentes" value={hotLeads.length.toString()} series={hotSeries} />
                <MiniTrend label="Leads Fracos" value={weakLeads.length.toString()} series={weakSeries} />
              </div>
            </div>
            <div className="glass-panel bg-white/5 dark:bg-white/5 rounded-2xl p-4 space-y-3 border border-transparent shadow-sm">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-100">Resumo</h3>
              <p className="text-sm text-gray-600 dark:text-slate-200">
                {hotLeads.length > 0
                  ? `Você tem ${hotLeads.length} leads quentes, principalmente em ${topIndustry}.`
                  : 'Nenhum lead quente identificado ainda.'}
              </p>
              <p className="text-sm text-gray-600 dark:text-slate-200">
                {weakLeads.length > 0
                  ? `${weakLeads.length} leads foram marcados como fracos ou perdidos. Revise abordagem ou descarte.`
                  : 'Nenhum lead fraco/perdido no momento.'}
              </p>
              <div className="space-y-2">
                {industryBreakdown.slice(0, 3).map((item) => (
                  <div key={item.industry} className="flex justify-between text-xs text-gray-600 dark:text-slate-200 items-center">
                    <span className="font-medium text-gray-700 dark:text-slate-100 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-emerald-500" /> {item.industry}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-emerald-600 font-semibold flex items-center gap-1">
                        <Flame className="w-3 h-3" /> {item.hot}
                      </span>
                      <span className="text-rose-600 font-semibold flex items-center gap-1">
                        <Ban className="w-3 h-3" /> {item.weak}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({
  icon: Icon,
  label,
  value,
  color,
  trend,
  series
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
  trend?: string;
  series?: number[];
}) => {
  const { direction, delta } = getTrendFromSeries(series);
  const TrendIcon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  const deltaText = Number.isFinite(delta) ? (Number.isInteger(delta) ? String(Math.abs(delta)) : Math.abs(delta).toFixed(1)) : '0';
  const trendText =
    trend ||
    (direction === 'up'
      ? `Subindo +${deltaText}`
      : direction === 'down'
        ? `Caindo -${deltaText}`
        : 'Estável');

  return (
    <div className="glass-panel rounded-2xl relative overflow-hidden h-full transition-shadow">
      <div
        aria-hidden
        className="absolute inset-0 opacity-35 bg-[linear-gradient(to_right,rgba(34,197,94,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,197,94,0.12)_1px,transparent_1px)] bg-[size:14px_14px]"
      />
      <div className="p-4 relative z-10 flex flex-col justify-between h-full">
        <div className="flex justify-between items-start mb-2 gap-2">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1 whitespace-nowrap">
            <TrendIcon className="w-3 h-3" />
            {trendText}
          </span>
        </div>
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
        {series && series.length > 1 ? (
          <div className="mt-3 -mx-4 -mb-4">
            <Sparkline values={series} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Dashboard;
