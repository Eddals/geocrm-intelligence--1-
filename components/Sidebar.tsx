import React from 'react';
import { LayoutDashboard, Map, KanbanSquare, Search, Settings, LogOut, Mail } from 'lucide-react';
import { ViewMode } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  setView: (view: ViewMode) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, onLogout }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'map', label: 'Mapa Inteligente', icon: Map },
    { id: 'pipeline', label: 'CRM Pipeline', icon: KanbanSquare },
    { id: 'discovery', label: 'Captação de Leads', icon: Search },
    { id: 'email-automation', label: 'Automação Email', icon: Mail },
  ];

  const handleLogoutClick = () => {
      if (confirm("Tem certeza que deseja sair do sistema?")) {
          onLogout();
      }
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed left-0 top-0 shadow-sm z-50 transition-colors duration-200">
      <div className="p-6 flex items-center justify-center">
        <img 
          src="https://i.imgur.com/HkMra5d.png" 
          alt="GeoCRM Logo" 
          className="h-24 w-auto object-contain animate-in slide-in-from-left duration-700 hover:scale-105 transition-transform"
        />
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id as ViewMode)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                ${isActive 
                  ? 'bg-[#9b01ec]/10 text-[#9b01ec] shadow-sm ring-1 ring-[#9b01ec]/20' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-[#9b01ec]' : 'text-gray-400'}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 space-y-2">
        
        <button
          onClick={() => setView('settings')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
            ${currentView === 'settings' 
              ? 'bg-[#9b01ec]/10 text-[#9b01ec]' 
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
        >
          <Settings className={`w-5 h-5 ${currentView === 'settings' ? 'text-[#9b01ec]' : 'text-gray-400'}`} />
          Configurações
        </button>

        <button
          onClick={handleLogoutClick}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-200"
        >
          <LogOut className="w-5 h-5 text-red-400 group-hover:text-red-600" />
          Sair
        </button>
      </div>
    </div>
  );
};

export default Sidebar;