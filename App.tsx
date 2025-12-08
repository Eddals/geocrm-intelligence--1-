import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import LeadMap from './components/LeadMap';
import Pipeline from './components/Pipeline';
import Discovery from './components/Discovery';
import Settings from './components/Settings';
import EmailAutomation from './components/EmailAutomation';
import WhatsAppButton from './components/WhatsAppButton';
import Login from './components/Login';
import Register from './components/Register';
import { Lead, PipelineStage, Stats, ViewMode, AutomationRule, AppSettings, Notification, LeadHistory } from './types';
import { enrichLeadData } from './services/geminiService';
import { enrichLeadWithOpenAI } from './services/openaiService';
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { supabaseRequest } from './services/supabaseClient';

// Mock initial data used ONLY if storage is empty
const DEFAULT_AUTOMATIONS: AutomationRule[] = [
    {
        id: 'auto_enrich',
        name: 'Auto-Enriquecimento com IA',
        description: 'Enriquece automaticamente os dados (email, telefone, tags) de novos leads usando Gemini.',
        trigger: 'ON_CREATE',
        action: 'ENRICH_DATA',
        active: true
    },
    {
        id: 'vip_tag',
        name: 'Identificar Clientes VIP',
        description: 'Adiciona a tag "VIP" e notifica para leads acima do limite configurado nas configurações.',
        trigger: 'ON_HIGH_VALUE',
        action: 'ADD_TAG_VIP',
        active: true
    },
    {
        id: 'notify_high_value',
        name: 'Alerta de Alto Valor',
        description: 'Envia uma notificação visual imediata quando um lead de alto valor é detectado.',
        trigger: 'ON_HIGH_VALUE',
        action: 'NOTIFY_WIN',
        active: true
    }
];

const DEFAULT_SETTINGS: AppSettings = {
    userName: 'Admin User',
    userEmail: 'admin@geocrm.com',
    userAvatar: 'https://picsum.photos/200',
    companyName: 'My Agency',
    companySector: 'Marketing Digital', // Default sector
    emailNotifications: true,
    autoEnrichment: true,
    highValueThreshold: 10000,
    openAiKey: ''
};

const App: React.FC = () => {
  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [currentView, setCurrentView] = useState<ViewMode>('dashboard');
  
  // --- PERSISTENT STATE INITIALIZATION ---
  const [leads, setLeads] = useState<Lead[]>([]);

  const [automations, setAutomations] = useState<AutomationRule[]>(() => {
      const saved = localStorage.getItem('geocrm_automations');
      return saved ? JSON.parse(saved) : DEFAULT_AUTOMATIONS;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
      const saved = localStorage.getItem('geocrm_settings');
      return saved ? JSON.parse(saved) : DEFAULT_SETTINGS;
  });
  
  // ---------------------------------------

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [discoveryResults, setDiscoveryResults] = useState<Partial<Lead>[]>([]);

  // Ensure dark mode is removed on mount
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('geocrm_theme');
  }, []);

  // --------------------------

  // --- AUTH HANDLERS ---
  const loadLeads = async (userId: string) => {
      try {
          const data = await supabaseRequest<Lead[]>('leads', { query: `?user_id=eq.${userId}` });
          setLeads(data || []);
      } catch (e) {
          console.error('Erro ao carregar leads', e);
          setLeads([]);
      }
  };

  const handleLogin = async (userData?: Partial<AppSettings> & { id?: string }) => {
      if (userData) {
          setSettings(prev => ({
              ...prev,
              userName: userData.userName || prev.userName,
              userEmail: userData.userEmail || prev.userEmail,
              companyName: userData.companyName || prev.companyName,
              companySector: userData.companySector || prev.companySector,
              businessSummary: userData.businessSummary || prev.businessSummary,
              userRole: userData.userRole || prev.userRole
          }));
          if (userData.id) {
              setCurrentUserId(userData.id);
              await loadLeads(userData.id);
          }
      }
      setIsAuthenticated(true);
      setAuthMode('login');
  };

  const handleLogout = () => {
      setIsAuthenticated(false);
      setCurrentUserId(null);
      setLeads([]);
      setAuthMode('login');
      localStorage.removeItem('geocrm_auth');
      setCurrentView('dashboard'); // Reset view on logout
  };

  const handleUpdateSettings = async (newSettings: AppSettings) => {
      setSettings(newSettings);
      if (currentUserId) {
        setIsSavingSettings(true);
        try {
            await supabaseRequest('users', { 
              method: 'PATCH', 
              body: {
                name: newSettings.userName,
                email: newSettings.userEmail,
                company_name: newSettings.companyName,
                company_sector: newSettings.companySector,
                business_summary: newSettings.businessSummary,
                user_role: newSettings.userRole,
                avatar_url: newSettings.userAvatar,
                contact_phone: newSettings.contactPhone,
                social_linkedin: newSettings.socialLinkedin,
                social_instagram: newSettings.socialInstagram,
                social_website: newSettings.socialWebsite
              }, 
              query: `?id=eq.${currentUserId}` 
            });
        } catch (e) {
            console.error('Erro ao salvar configurações no Supabase', e);
        } finally {
            setIsSavingSettings(false);
        }
      }
  };

  // Derived Stats
  const stats: Stats = {
    totalLeads: leads.length,
    newLeadsToday: leads.filter(l => {
        const leadDate = new Date(l.createdAt);
        const today = new Date();
        return leadDate.getDate() === today.getDate() &&
               leadDate.getMonth() === today.getMonth() &&
               leadDate.getFullYear() === today.getFullYear();
    }).length,
    leadsInContact: leads.filter(l => l.status === PipelineStage.CONTACT).length,
    leadsConverted: leads.filter(l => l.status === PipelineStage.CLOSED).length,
    conversionRate: leads.length > 0 ? (leads.filter(l => l.status === PipelineStage.CLOSED).length / leads.length) * 100 : 0,
    totalPipelineValue: leads.reduce((acc, curr) => acc + curr.value, 0),
    topCity: (() => {
      if (leads.length === 0) return 'N/A';
      const cityCounts = leads.reduce((acc, lead) => {
        acc[lead.city] = (acc[lead.city] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const sortedCities = Object.entries(cityCounts).sort((a, b) => b[1] - a[1]);
      return sortedCities.length > 0 ? sortedCities[0][0] : 'N/A';
    })()
  };

  const addNotification = (message: string, type: 'success' | 'info' | 'warning' = 'info') => {
      const id = Math.random().toString(36).substr(2, 9);
      setNotifications(prev => [...prev, { id, message, type }]);
      setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== id));
      }, 5000);
  };

  const removeNotification = (id: string) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // --- Automation Logic ---
  const runAutomations = async (trigger: string, lead: Lead, context?: any): Promise<Lead> => {
    let updatedLead = { ...lead };
    const activeRules = automations.filter(r => r.active);

    for (const rule of activeRules) {
        if (rule.trigger === 'ON_CREATE' && trigger === 'ON_CREATE') {
            if (rule.action === 'ENRICH_DATA') {
                if (settings.openAiKey) {
                    addNotification(`IA Iniciada: Analisando ${lead.company} para setor ${settings.companySector}...`, 'info');
                    try {
                        const enrichedData = await enrichLeadWithOpenAI(lead, settings.openAiKey, settings.companySector);
                        updatedLead = { ...updatedLead, ...enrichedData, enriched: true };
                        addNotification(`Dados avançados encontrados para ${lead.company}`, 'success');
                    } catch (e) {
                         console.error(e);
                         const enrichedData = await enrichLeadData(lead.company, lead.city, settings.companySector);
                         updatedLead = { ...updatedLead, ...enrichedData, enriched: true };
                    }
                } else {
                    addNotification(`IA Iniciada: Enriquecendo ${lead.company}...`, 'info');
                    const enrichedData = await enrichLeadData(lead.company, lead.city, settings.companySector);
                    updatedLead = { ...updatedLead, ...enrichedData, enriched: true };
                    addNotification(`Dados enriquecidos para ${lead.company}`, 'success');
                }
            }
        }
        // ... (rest of automation logic same as before)
    }
    return updatedLead;
  };

  const updateLeadStatus = async (id: string, newStatus: PipelineStage) => {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;
    
    const newHistoryEntry: LeadHistory = {
        date: new Date().toISOString(),
        description: `Status alterado para ${newStatus}`,
        type: 'status_change'
    };

    let updatedLeadWithHistory = { ...lead, history: [...(lead.history || []), newHistoryEntry] };
    updatedLeadWithHistory = await runAutomations('ON_MOVE_STAGE', updatedLeadWithHistory, { stage: newStatus });

    setLeads(prev => prev.map(l => 
      l.id === id ? { ...updatedLeadWithHistory, status: newStatus } : l
    ));
    if (currentUserId) {
        try {
            await supabaseRequest('leads', { method: 'PATCH', body: { status: newStatus, history: updatedLeadWithHistory.history }, query: `?id=eq.${id}` });
        } catch (e) {
            console.error('Erro ao atualizar status no Supabase', e);
        }
    }
  };

  const updateLeadDetails = async (id: string, updates: Partial<Lead>) => {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
      addNotification('Lead atualizado com sucesso.', 'success');
      if (currentUserId) {
        try {
            await supabaseRequest('leads', { method: 'PATCH', body: updates, query: `?id=eq.${id}` });
        } catch (e) {
            console.error('Erro ao salvar lead no Supabase', e);
        }
      }
  };

  const deleteLead = async (id: string) => {
      setLeads(prev => prev.filter(l => l.id !== id));
      addNotification('Lead excluído com sucesso.', 'success');
      if (currentUserId) {
        try {
            await supabaseRequest('leads', { method: 'DELETE', query: `?id=eq.${id}` });
        } catch (e) {
            console.error('Erro ao excluir lead no Supabase', e);
        }
      }
  };

  const handleAddLeads = async (newLeads: Partial<Lead>[]) => {
    const leadsToProcess: Partial<Lead>[] = [];
    let duplicates = 0;

    for (const newLead of newLeads) {
        const emailExists = newLead.email && leads.some(l => l.email === newLead.email);
        const companyExists = newLead.company && leads.some(l => 
            l.company.toLowerCase().trim() === newLead.company!.toLowerCase().trim()
        );

        if (emailExists || companyExists) {
            duplicates++;
            addNotification(`Duplicado ignorado: ${newLead.company}`, 'warning');
        } else {
            leadsToProcess.push(newLead);
        }
    }

    if (leadsToProcess.length === 0) {
        if (duplicates > 0) addNotification('Nenhum lead novo. Todos já existem.', 'warning');
        return;
    }

    let leadsToAdd: Lead[] = leadsToProcess.map(l => ({
        id: Math.random().toString(36).substr(2, 9),
        tasks: [],
        notes: l.notes || '',
        enriched: false,
        source: 'Manual',
        status: PipelineStage.NEW,
        tags: [],
        lat: 0,
        lng: 0,
        createdAt: new Date().toISOString(),
        history: [{ date: new Date().toISOString(), description: 'Lead criado no sistema', type: 'creation' }],
        ...l,
    } as Lead));

    const processedLeads: Lead[] = [];
    for (const lead of leadsToAdd) {
        let tempLead = await runAutomations('ON_HIGH_VALUE', lead, {});
        tempLead = await runAutomations('ON_CREATE', tempLead);
        processedLeads.push(tempLead);
    }

    setLeads(prev => [...prev, ...processedLeads]);
    addNotification(`${processedLeads.length} lead(s) adicionado(s).`, 'success');

    if (currentUserId) {
        try {
            await supabaseRequest('leads', { method: 'POST', body: processedLeads.map(l => ({ ...l, user_id: currentUserId })), query: '' });
            await loadLeads(currentUserId);
        } catch (e) {
            console.error('Erro ao persistir leads no Supabase', e);
        }
    }
  };

  const handleEnrichLead = async (id: string) => {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;
    
    const historyItem: LeadHistory = {
        date: new Date().toISOString(),
        description: 'Enriquecimento de dados via IA',
        type: 'update'
    };

    if (settings.openAiKey) {
        addNotification(`Enriquecendo ${lead.company} (GPT-4) considerando setor ${settings.companySector}...`, 'info');
        try {
            const enrichedData = await enrichLeadWithOpenAI(lead, settings.openAiKey, settings.companySector);
            setLeads(prev => prev.map(l => 
                l.id === id ? { ...l, ...enrichedData, enriched: true, history: [...(l.history || []), historyItem] } : l
            ));
            addNotification(`Dados avançados gerados!`, 'success');
        } catch (error: any) {
            addNotification(`Erro OpenAI: ${error.message}`, 'warning');
        }
    } else {
        addNotification(`Enriquecendo ${lead.company} (Gemini)...`, 'info');
        const enrichedData = await enrichLeadData(lead.company, lead.city, settings.companySector);
        setLeads(prev => prev.map(l => 
            l.id === id ? { ...l, ...enrichedData, enriched: true, history: [...(l.history || []), historyItem] } : l
        ));
        addNotification(`Dados atualizados.`, 'success');
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard stats={stats} leads={leads} userName={settings.userName} />;
      case 'map':
        return <LeadMap 
            leads={leads} 
            discoveryResults={discoveryResults}
            openAiKey={settings.openAiKey}
            addLead={(lead) => handleAddLeads([lead])}
        />;
      case 'pipeline':
        return <Pipeline 
            leads={leads} 
            updateLeadStatus={updateLeadStatus} 
            enrichLead={handleEnrichLead} 
            deleteLead={deleteLead}
            updateLead={updateLeadDetails}
            addNewLead={(lead) => handleAddLeads([lead])}
            openAiKey={settings.openAiKey}
        />;
      case 'discovery':
        return <Discovery 
            addLeads={handleAddLeads} 
            setDiscoveryResults={setDiscoveryResults} 
            openAiKey={settings.openAiKey} 
            userSector={settings.companySector}
        />;
      case 'email-automation':
        return <EmailAutomation 
            leads={leads}
            settings={settings}
            updateLead={updateLeadDetails}
        />;
      case 'settings':
        return <Settings 
            settings={settings} 
            updateSettings={handleUpdateSettings} 
            isSaving={isSavingSettings}
        />;
      default: return <Dashboard stats={stats} leads={leads} userName={settings.userName} />;
    }
  };

  // If not authenticated, show Auth pages
  if (!isAuthenticated) {
      return authMode === 'login' ? (
        <Login onLogin={handleLogin} onSwitchToRegister={() => setAuthMode('register')} />
      ) : (
        <Register onRegister={handleLogin} onSwitchToLogin={() => setAuthMode('login')} />
      );
  }

  return (
    <div className={`flex h-screen bg-gray-50 text-gray-900 font-sans transition-colors duration-200`}>
      <Sidebar 
        currentView={currentView} 
        setView={setCurrentView} 
        onLogout={handleLogout} 
      />
      
      {/* Toast Notifications - White Clean Style */}
      <div className="fixed bottom-24 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
          {notifications.map((n) => (
              <div 
                  key={n.id} 
                  className="pointer-events-auto flex items-start gap-3 w-auto min-w-[320px] max-w-sm bg-white text-gray-800 px-4 py-4 rounded-lg shadow-xl border border-gray-100 animate-in slide-in-from-right-full fade-in duration-300 relative overflow-hidden"
              >
                  {/* Accent Line */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                      n.type === 'success' ? 'bg-emerald-500' : 
                      n.type === 'warning' ? 'bg-amber-500' : 
                      'bg-blue-500'
                  }`}></div>

                  {/* Icon */}
                  <div className={`mt-0.5 shrink-0 p-1.5 rounded-full ${
                      n.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 
                      n.type === 'warning' ? 'bg-amber-50 text-amber-600' : 
                      'bg-blue-50 text-blue-600'
                  }`}>
                      {n.type === 'success' && <CheckCircle2 size={18} />}
                      {n.type === 'warning' && <AlertTriangle size={18} />}
                      {n.type === 'info' && <Info size={18} />}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                      <p className="text-sm font-semibold leading-none mb-1">
                          {n.type === 'success' ? 'Sucesso' : n.type === 'warning' ? 'Atenção' : 'Informação'}
                      </p>
                      <p className="text-sm text-gray-500 leading-snug">{n.message}</p>
                  </div>

                  {/* Close */}
                  <button 
                    onClick={() => removeNotification(n.id)} 
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
              </div>
          ))}
      </div>

      <main className="flex-1 ml-64 p-8 overflow-hidden h-screen">
        <header className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold capitalize text-gray-800">
                {currentView === 'map' ? 'Mapa Inteligente' : currentView === 'settings' ? 'Configurações' : currentView === 'email-automation' ? 'Automação' : currentView}
            </h1>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <img 
                        src={settings.userAvatar || "https://picsum.photos/40/40"} 
                        alt="User" 
                        className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover"
                    />
                    <div className="hidden md:block text-left">
                        <p className="text-xs font-bold text-gray-700">{settings.userName}</p>
                        <p className="text-[10px] text-gray-500">{settings.companySector}</p>
                    </div>
                </div>
            </div>
        </header>

        {renderContent()}
      </main>
      
      <WhatsAppButton />
    </div>
  );
};

export default App;
