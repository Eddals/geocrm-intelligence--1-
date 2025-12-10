import React, { useState } from 'react';
import { LayoutDashboard, Map, KanbanSquare, Search, Settings, LogOut, Mail, CalendarCheck2 } from 'lucide-react';
import { ViewMode } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  setView: (view: ViewMode) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, onLogout }) => {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Prevent background scroll when sidebar is open on mobile
  React.useEffect(() => {
    if (isOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => document.body.classList.remove('overflow-hidden');
  }, [isOpen]);
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'map', label: 'Mapa Inteligente', icon: Map },
    { id: 'pipeline', label: 'CRM Pipeline', icon: KanbanSquare },
    { id: 'discovery', label: 'Captação de Leads', icon: Search },
    { id: 'calendar', label: 'Calendário', icon: CalendarCheck2 },
    { id: 'email-automation', label: 'Automação Email', icon: Mail },
  ];

  return (
    <>
      <button
        className={`md:hidden fixed top-4 left-4 z-[140] flex items-center gap-2 px-3 py-2 rounded-full bg-white/95 backdrop-blur-sm border border-gray-200 shadow-lg text-gray-700 transition-opacity ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Abrir menu"
      >
        <span className="text-sm font-semibold">Menu</span>
      </button>

      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[90]"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className={`w-64 bg-white border-r border-gray-200 h-screen flex flex-col fixed left-0 top-0 shadow-sm z-[100] transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 flex items-center justify-center">
          <img 
            src="https://i.imgur.com/HkMra5d.png" 
            alt="GeoCRM Logo" 
            className="h-28 md:h-32 w-auto object-contain animate-in slide-in-from-left duration-700 hover:scale-105 transition-transform drop-shadow-lg"
          />
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setView(item.id as ViewMode); setIsOpen(false); }}
                className={`group w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                  ${isActive 
                    ? 'bg-[#f3e8ff] text-[#9b01ec] border border-[#e9d5ff] shadow-sm dark:bg-[#9b01ec]/20 dark:text-[#d8b4fe] dark:border-transparent' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-[#9b01ec] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-[#d8b4fe]'
                  }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#9b01ec] dark:text-[#d8b4fe]' : 'text-gray-400 dark:text-slate-400'} group-hover:text-[#9b01ec] dark:group-hover:text-[#d8b4fe]`} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 space-y-2">
          
          <button
            onClick={() => { setView('settings'); setIsOpen(false); }}
            className={`group w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
              ${currentView === 'settings' 
                ? 'bg-[#f3e8ff] text-[#9b01ec] border border-[#e9d5ff] dark:bg-[#9b01ec]/20 dark:text-[#d8b4fe] dark:border-transparent' 
                : 'text-gray-600 hover:bg-gray-50 hover:text-[#9b01ec] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-[#d8b4fe]'
              }`}
          >
            <Settings className={`w-5 h-5 ${currentView === 'settings' ? 'text-[#9b01ec] dark:text-[#d8b4fe]' : 'text-gray-400 dark:text-slate-400'} group-hover:text-[#9b01ec] dark:group-hover:text-[#d8b4fe]`} />
            Configurações
          </button>

          <button
            onClick={() => setConfirmLogout(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-all duration-200"
          >
            <LogOut className="w-5 h-5 text-red-400 group-hover:text-red-600" />
            Sair
          </button>
        </div>
      </div>

      {confirmLogout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 p-6 w-80">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Deseja sair?</h3>
            <p className="text-sm text-gray-600 mb-4">Você será desconectado do sistema.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmLogout(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={onLogout}
                className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
