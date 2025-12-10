
import React, { useMemo } from 'react';
import { Lead, Stats, PipelineStage } from '../types';
import { TrendingUp, Users, UserPlus, PhoneOutgoing, CheckCircle2, DollarSign, Clock3, Flame, Ban, Building2 } from 'lucide-react';
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface DashboardProps {
  stats: Stats;
  leads: Lead[];
  userName?: string;
}

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
      [PipelineStage.NEW]: { label: 'Novos', value: 0, color: 'bg-blue-500' },
      [PipelineStage.CONTACTED]: { label: 'Contatados', value: 0, color: 'bg-indigo-500' },
      [PipelineStage.QUALIFIED]: { label: 'Qualificados', value: 0, color: 'bg-purple-500' },
      [PipelineStage.PROPOSAL]: { label: 'Proposta', value: 0, color: 'bg-amber-500' },
      [PipelineStage.NEGOTIATION]: { label: 'Negociação', value: 0, color: 'bg-orange-500' },
      [PipelineStage.WON]: { label: 'Ganhos', value: 0, color: 'bg-emerald-500' },
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

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="glass-panel rounded-3xl p-6">
        <h1 className="text-3xl font-bold text-gray-800">{getGreeting()}, {userName} 👋</h1>
        <p className="text-gray-500 mt-1 flex items-center gap-2 text-base">
          <Clock3 className="w-4 h-4 text-indigo-500" />
          <span className="font-semibold text-gray-700">{getTime()}</span>
          <span className="text-gray-400">•</span>
          <span>Aqui está um resumo do seu pipeline</span>
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard 
            icon={Users} 
            label="Total Leads" 
            value={stats.totalLeads.toString()} 
            color="bg-blue-50 text-blue-600" 
        />
        <StatCard 
            icon={UserPlus} 
            label="Novos Hoje" 
            value={stats.newLeadsToday.toString()} 
            color="bg-indigo-50 text-indigo-600" 
            trend={stats.newLeadsToday > 0 ? "+ Novos" : ""}
        />
         <StatCard 
            icon={PhoneOutgoing} 
            label="Em Contato" 
            value={stats.leadsInContact.toString()} 
            color="bg-amber-50 text-amber-600" 
        />
        <StatCard 
            icon={CheckCircle2} 
            label="Convertidos" 
            value={stats.leadsConverted.toString()} 
            color="bg-emerald-50 text-emerald-600" 
        />
        <StatCard 
            icon={TrendingUp} 
            label="Taxa Conv." 
            value={`${stats.conversionRate.toFixed(1)}%`} 
            color="bg-purple-50 text-purple-600" 
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
            return (
              <div key={key} className="bg-gray-50 dark:bg-white/5 rounded-lg p-4 border border-gray-100 dark:border-transparent shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${stage.color}`}></div>
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
            <div className="lg:col-span-2 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={industryBreakdown}>
                  <defs>
                    <linearGradient id="hotGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#34d399" stopOpacity={0.7}/>
                    </linearGradient>
                    <linearGradient id="weakGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#fb7185" stopOpacity={0.9}/>
                      <stop offset="95%" stopColor="#fda4af" stopOpacity={0.7}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="industry" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ 
                      background: 'rgba(45, 38, 89, 0.9)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      backdropFilter: 'blur(10px)',
                      color: '#e5e7eb',
                      boxShadow: '0 10px 30px rgba(79, 70, 229, 0.25)'
                    }}
                    labelStyle={{ color: '#c7d2fe', fontWeight: 700 }}
                    itemStyle={{ color: '#e5e7eb' }}
                    cursor={{ fill: 'rgba(124, 58, 237, 0.12)', stroke: 'rgba(255,255,255,0.08)', radius: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#e5e7eb' }} />
                  <Bar dataKey="hot" name="Quentes" fill="url(#hotGrad)" radius={[6,6,0,0]} />
                  <Bar dataKey="weak" name="Fracos" fill="url(#weakGrad)" radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
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

const StatCard = ({ icon: Icon, label, value, color, trend }: any) => (
    <div className="glass-panel p-4 rounded-2xl flex flex-col justify-between h-full hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-2">
            <div className={`p-2 rounded-lg ${color}`}>
                <Icon className="w-5 h-5" />
            </div>
            {trend && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{trend}</span>}
        </div>
        <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

export default Dashboard;
