
import React from 'react';
import { Lead, Stats } from '../types';
import { TrendingUp, Users, UserPlus, PhoneOutgoing, CheckCircle2 } from 'lucide-react';

interface DashboardProps {
  stats: Stats;
  leads: Lead[];
}

const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  return (
    <div className="space-y-6">
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
