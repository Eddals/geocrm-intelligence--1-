
import React, { useMemo } from 'react';
import { Lead, Stats, PipelineStage } from '../types';
import { TrendingUp, Users, UserPlus, PhoneOutgoing, CheckCircle2, DollarSign, Clock3 } from 'lucide-react';

interface DashboardProps {
  stats: Stats;
  leads: Lead[];
  userName?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ stats, leads, userName = 'Usuário' }) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const getTime = () => {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
        stages[lead.status].value += lead.value || 0;
      }
    });

    const total = Object.values(stages).reduce((sum, s) => sum + s.value, 0);
    return { stages, total };
  }, [leads]);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Faturamento por Estágio</h2>
            <p className="text-sm text-gray-500 mt-1">Distribuição de valor no pipeline</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-gray-800">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pipelineRevenue.total)}
            </p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(pipelineRevenue.stages).map(([key, stage]) => {
            const percentage = pipelineRevenue.total > 0 ? (stage.value / pipelineRevenue.total) * 100 : 0;
            return (
              <div key={key} className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${stage.color}`}></div>
                  <span className="text-xs font-bold text-gray-600 uppercase">{stage.label}</span>
                </div>
                <p className="text-xl font-bold text-gray-800">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }).format(stage.value)}
                </p>
                <p className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}% do total</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color, trend }: any) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col justify-between h-full hover:shadow-md transition-shadow">
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
