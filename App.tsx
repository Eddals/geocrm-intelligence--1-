import React, { useState, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import LeadMap from './components/LeadMap';
import Pipeline from './components/Pipeline';
import Discovery from './components/Discovery';
import Settings from './components/Settings';
import Calendar from './components/Calendar';
import Login from './components/Login';
import Register from './components/Register';
import DevtoneChatbox from './components/ChatWidget';
import { Lead, PipelineStage, Stats, ViewMode, AutomationRule, AppSettings, Notification, LeadHistory, PlanTier } from './types';
import { enrichLeadData } from './services/geminiService';
import { enrichLeadWithOpenAI } from './services/openaiService';
import { X, CheckCircle2, AlertTriangle, Info, Sun, Moon, Crown, Gauge, Cpu, MoveUpRight } from 'lucide-react';
import { supabaseRequest } from './services/supabaseClient';

const normalizeLeadFromSupabase = (row: any): Lead => ({
    ...row,
    id: String(row.id ?? row.local_id ?? Date.now()),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    name: row.name || row.contact_name || 'Contato',
    company: row.company || row.company_name || 'Empresa',
    email: row.email ?? null,
    phone: row.phone ?? null,
    address: row.address || '',
    city: row.city || '',
    status: row.status || PipelineStage.NEW,
    source: row.source || 'Manual',
    value: row.value || 0,
    notes: row.notes || '',
    lat: row.lat || 0,
    lng: row.lng || 0,
    tasks: row.tasks || [],
    tags: row.tags || [],
    history: row.history || []
});

const toSupabaseId = (id: string | number) => {
    const numericId = Number(id);
    return Number.isFinite(numericId) ? numericId : null;
};

const toNumeric = (value: any, fallback = 0) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const cleaned = value.replace(/[^0-9.,-]/g, '').replace(',', '.');
        const parsed = parseFloat(cleaned);
        return Number.isFinite(parsed) ? parsed : fallback;
    }
    return fallback;
};

const sanitizeLeadForSupabase = (
    lead: Partial<Lead> & { user_id?: string },
    options: { includeCreatedAt?: boolean; mode?: 'patch' | 'insert' } = {}
) => {
    const { includeCreatedAt = false, mode = 'patch' } = options;
    const allowed: (keyof Lead | 'user_id')[] = [
        'name', 'company', 'email', 'phone', 'address', 'city',
        'status', 'source', 'value', 'notes', 'lat', 'lng',
        'tags', 'tasks', 'history', 'lastContact'
    ];

    const payload: Record<string, any> = {};
    if (lead.user_id !== undefined) payload.user_id = lead.user_id;
    if (includeCreatedAt && lead.createdAt) payload.created_at = lead.createdAt;

    for (const key of allowed) {
        if (lead[key] === undefined) continue;
        if (key === 'lat' || key === 'lng') {
            payload[key] = Number(lead[key]) || 0;
        } else if (key === 'value') {
            payload[key] = toNumeric(lead[key], 0);
        } else if (key === 'lastContact') {
            payload.last_contact = lead.lastContact;
        } else {
            payload[key] = lead[key];
        }
    }

    // For inserts, ensure coordinates exist (avoid NULL on older rows)
    if (mode === 'insert') {
        if (payload.lat === undefined) payload.lat = Number(lead.lat) || 0;
        if (payload.lng === undefined) payload.lng = Number(lead.lng) || 0;
    }

    return payload;
};

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
    userAvatar: '',
    companyName: 'My Agency',
    companySector: 'Marketing Digital', // Default sector
    subscriptionPlan: 'Start',
    emailNotifications: true,
    autoEnrichment: true,
    highValueThreshold: 10000,
    openAiKey: ''
};

// Simple plan matrix to control limits and feature flags
const PLAN_RULES: Record<PlanTier, {
    leadLimit: number;              // monthly limit
    maxAutomations: number;
    allowEnrichment: boolean;
    allowEmailAutomation: boolean;
    allowMapSearch: boolean;
}> = {
    Start: {
        leadLimit: 50,
        maxAutomations: 1,
        allowEnrichment: false,
        allowEmailAutomation: false,
        allowMapSearch: false
    },
    Pro: {
        leadLimit: 200,
        maxAutomations: 3,
        allowEnrichment: true,
        allowEmailAutomation: true,
        allowMapSearch: true
    },
    Growth: {
        leadLimit: 1000,
        maxAutomations: 10,
        allowEnrichment: true,
        allowEmailAutomation: true,
        allowMapSearch: true
    },
    Enterprise: {
        leadLimit: Infinity,
        maxAutomations: 999,
        allowEnrichment: true,
        allowEmailAutomation: true,
        allowMapSearch: true
    }
};

const VIEW_PATHS: Record<ViewMode, string> = {
    dashboard: '/dashboard',
    map: '/map',
    pipeline: '/pipeline',
    discovery: '/discovery',
    calendar: '/calendar',
    settings: '/settings',
};

const viewFromPathname = (pathname: string): ViewMode => {
    const normalized = pathname.replace(/\/+$/, '') || '/';
    if (normalized === '/' || normalized.startsWith('/dashboard')) return 'dashboard';
    if (normalized.startsWith('/map')) return 'map';
    if (normalized.startsWith('/pipeline')) return 'pipeline';
    if (normalized.startsWith('/discovery')) return 'discovery';
    if (normalized.startsWith('/calendar')) return 'calendar';
    if (normalized.startsWith('/settings')) return 'settings';
    return 'dashboard';
};

const viewLabel = (view: ViewMode) => {
    switch (view) {
        case 'dashboard':
            return 'Dashboard';
        case 'map':
            return 'Mapa Inteligente';
        case 'pipeline':
            return 'CRM Pipeline';
        case 'discovery':
            return 'Captação de Leads';
        case 'calendar':
            return 'Calendário';
        case 'settings':
            return 'Configurações';
        default:
            return 'Dashboard';
    }
};

const App: React.FC = () => {
  const navigate = useNavigate();
  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
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
  const [authLoaded, setAuthLoaded] = useState(false);
  const hasAppliedThemeOnce = React.useRef(false);
  const themeTransitionTimeout = React.useRef<number | null>(null);
  
  // ---------------------------------------

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [discoveryResults, setDiscoveryResults] = useState<Partial<Lead>[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    return (localStorage.getItem('geocrm_theme') as 'light' | 'dark') || 'light';
  });

  const activePlan: PlanTier = settings.subscriptionPlan || 'Start';
  const planRules = PLAN_RULES[activePlan];

  const location = useLocation();
  const currentView = viewFromPathname(location.pathname);
  const setCurrentView = (view: ViewMode) => {
      navigate(VIEW_PATHS[view] || '/dashboard');
  };

  // --- PLAN + USAGE HELPERS ---
  const leadsCreatedThisMonth = (list: Lead[]) => {
      const now = new Date();
      return list.filter(l => {
          const d = new Date(l.createdAt);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;
  };

  const remainingLeadQuota = () => {
      if (!Number.isFinite(planRules.leadLimit)) return Infinity;
      const used = leadsCreatedThisMonth(leads);
      return Math.max(planRules.leadLimit - used, 0);
  };

  // Currency helpers
  const BRL_TO_USD = 5.2;
  const isBrazilLead = (lead: Partial<Lead>) => {
      const phone = lead.phone || '';
      const city = (lead.city || '').toLowerCase();
      return phone.replace(/\D/g, '').startsWith('55') || city.includes('brasil') || city.includes('brazil') || city.includes('rio') || city.includes('são') || city.includes('sao');
  };
  const leadValueUSD = (lead: Partial<Lead>) => {
      const v = Number(lead.value) || 0;
      return isBrazilLead(lead) ? v / BRL_TO_USD : v;
  };

  // Apply theme + restore auth session
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('geocrm_theme', theme);
    const savedAuth = localStorage.getItem('geocrm_auth');
    if (savedAuth) {
        try {
            const parsed = JSON.parse(savedAuth);
            if (parsed?.userId) {
                setCurrentUserId(parsed.userId);
                setIsAuthenticated(true);
                if (parsed.settings) {
                    setSettings((prev) => ({ ...prev, ...parsed.settings }));
                }
                loadLeads(parsed.userId);
            }
        } catch (e) {
            console.warn('Falha ao restaurar sessão', e);
            localStorage.removeItem('geocrm_auth');
        }
    }
    setAuthLoaded(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to theme changes (e.g., after toggle)
  useEffect(() => {
    const triggerThemeTransition = () => {
        document.documentElement.classList.add('theme-transition');
        if (themeTransitionTimeout.current) {
            window.clearTimeout(themeTransitionTimeout.current);
        }
        themeTransitionTimeout.current = window.setTimeout(() => {
            document.documentElement.classList.remove('theme-transition');
        }, 300);
    };

    if (hasAppliedThemeOnce.current) {
        triggerThemeTransition();
    } else {
        hasAppliedThemeOnce.current = true;
    }

    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('geocrm_theme', theme);

    return () => {
        if (themeTransitionTimeout.current) {
            window.clearTimeout(themeTransitionTimeout.current);
        }
    };
  }, [theme]);

  // Persist settings to localStorage when authenticated to keep plan info/resume session
  useEffect(() => {
    if (isAuthenticated && currentUserId) {
        localStorage.setItem('geocrm_auth', JSON.stringify({
            userId: currentUserId,
            settings
        }));
    }
  }, [isAuthenticated, currentUserId, settings]);

  // --------------------------

  // --- AUTH HANDLERS ---
  const loadLeads = async (userId?: string) => {
      try {
          if (!userId) {
              setLeads([]);
              return;
          }
          const data = await supabaseRequest<any[]>('leads', { query: `?user_id=eq.${userId}` });
          const normalized = (data || []).map(normalizeLeadFromSupabase);
          setLeads(normalized as Lead[]);
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
              userRole: userData.userRole || prev.userRole,
              subscriptionPlan: (userData as any).subscriptionPlan || (userData as any).plan || prev.subscriptionPlan || 'Start',
              smtpHost: userData.smtpHost || prev.smtpHost,
              smtpPort: userData.smtpPort || prev.smtpPort,
              smtpUser: userData.smtpUser || prev.smtpUser,
              smtpPass: userData.smtpPass || prev.smtpPass
          }));
          if (userData.id) {
              setCurrentUserId(userData.id);
              await loadLeads(userData.id);
              const authPayload = {
                  userId: userData.id,
                  settings: {
                    userName: userData.userName,
                    userEmail: userData.userEmail,
                    companyName: userData.companyName,
                    companySector: userData.companySector,
                    businessSummary: userData.businessSummary,
                    userRole: userData.userRole,
                    subscriptionPlan: (userData as any).subscriptionPlan || (userData as any).plan || 'Start',
                    smtpHost: userData.smtpHost,
                    smtpPort: userData.smtpPort,
                    smtpUser: userData.smtpUser,
                    smtpPass: userData.smtpPass
                  }
              };
              localStorage.setItem('geocrm_auth', JSON.stringify(authPayload));
	          }
	      }
	      setIsAuthenticated(true);
	  };

	  const handleLogout = () => {
	      setIsAuthenticated(false);
	      setCurrentUserId(null);
	      setLeads([]);
	      localStorage.removeItem('geocrm_auth');
	      navigate('/login', { replace: true });
	  };

  const handleUpdateSettings = async (newSettings: AppSettings) => {
      setSettings(newSettings);
      localStorage.setItem('geocrm_settings', JSON.stringify(newSettings));
      const savedAuth = localStorage.getItem('geocrm_auth');
      if (savedAuth) {
          try {
              const parsed = JSON.parse(savedAuth);
              if (parsed?.userId) {
                  localStorage.setItem('geocrm_auth', JSON.stringify({
                      ...parsed,
                      settings: { ...(parsed.settings || {}), ...newSettings }
                  }));
              }
          } catch {
              // ignore
          }
      }
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
                social_website: newSettings.socialWebsite,
                plan: newSettings.subscriptionPlan,
                smtp_host: newSettings.smtpHost,
                smtp_port: newSettings.smtpPort,
                smtp_user: newSettings.smtpUser,
                smtp_pass: newSettings.smtpPass
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
    totalPipelineValue: leads.reduce((acc, curr) => acc + leadValueUSD(curr), 0),
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
      const newNotification = { id, message, type };
      setNotifications(prev => {
          const next = [...prev, newNotification];
          return next.slice(-4);
      });
      setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== id));
      }, 5000);
  };

  const removeNotification = (id: string) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Notify when credits are ending or exceeded (per month)
  const creditAlertRef = React.useRef<'ok' | 'warn' | 'exceeded'>('ok');
  useEffect(() => {
      if (!Number.isFinite(planRules.leadLimit)) {
          creditAlertRef.current = 'ok';
          return;
      }
      const used = leadsCreatedThisMonth(leads);
      const warnThreshold = planRules.leadLimit * 0.8;

      if (used >= planRules.leadLimit) {
          if (creditAlertRef.current !== 'exceeded') {
              addNotification(`Você ultrapassou o limite de ${planRules.leadLimit} leads do plano ${activePlan}. Faça upgrade para continuar gerando.`, 'warning');
              creditAlertRef.current = 'exceeded';
          }
      } else if (used >= warnThreshold) {
          if (creditAlertRef.current !== 'warn') {
              addNotification(`Atenção: você já usou ${used}/${planRules.leadLimit} leads este mês. O limite do plano ${activePlan} está acabando.`, 'info');
              creditAlertRef.current = 'warn';
          }
      } else {
          // reset state when back under threshold (e.g., new month)
          creditAlertRef.current = 'ok';
      }
  }, [leads, activePlan, planRules.leadLimit]);

  // --- Automation Logic ---
  const runAutomations = async (trigger: string, lead: Lead, context?: any, options?: { silent?: boolean }): Promise<Lead> => {
    let updatedLead = { ...lead };
    const activeRules = automations.filter(r => r.active).slice(0, planRules.maxAutomations);

    for (const rule of activeRules) {
        if (rule.trigger === 'ON_CREATE' && trigger === 'ON_CREATE') {
            if (rule.action === 'ENRICH_DATA') {
                if (!planRules.allowEnrichment) {
                    if (!options?.silent) {
                        addNotification(`Enriquecimento avançado é recurso do plano Pro+. Considere fazer upgrade.`, 'warning');
                    }
                    continue;
                }
                if (settings.openAiKey) {
                    if (!options?.silent) {
                        addNotification(`IA Iniciada: Analisando ${lead.company} para setor ${settings.companySector}...`, 'info');
                    }
                    try {
                        const enrichedData = await enrichLeadWithOpenAI(lead, settings.openAiKey, settings.companySector);
                        updatedLead = { ...updatedLead, ...enrichedData, enriched: true };
                        if (!options?.silent) {
                            addNotification(`Dados avançados encontrados para ${lead.company}`, 'success');
                        }
                    } catch (e) {
                         console.error(e);
                         const enrichedData = await enrichLeadData(lead.company, lead.city, settings.companySector);
                         updatedLead = { ...updatedLead, ...enrichedData, enriched: true };
                    }
                } else {
                    if (!options?.silent) {
                        addNotification(`IA Iniciada: Enriquecendo ${lead.company}...`, 'info');
                    }
                    const enrichedData = await enrichLeadData(lead.company, lead.city, settings.companySector);
                    updatedLead = { ...updatedLead, ...enrichedData, enriched: true };
                    if (!options?.silent) {
                        addNotification(`Dados enriquecidos para ${lead.company}`, 'success');
                    }
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
    const supabaseId = toSupabaseId(id);
    if (currentUserId && supabaseId !== null) {
        try {
            const payload = sanitizeLeadForSupabase(
                { status: newStatus, history: updatedLeadWithHistory.history, lastContact: newHistoryEntry.date },
                { mode: 'patch' }
            );
            await supabaseRequest('leads', { method: 'PATCH', body: payload, query: `?id=eq.${supabaseId}` });
        } catch (e) {
            console.error('Erro ao atualizar status no Supabase', e);
        }
    } else if (currentUserId) {
        console.warn('Ignorando atualização de status no Supabase: ID não numérico', id);
    }
  };

  const updateLeadDetails = async (id: string, updates: Partial<Lead>) => {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
      addNotification('Lead atualizado com sucesso.', 'success');
      const supabaseId = toSupabaseId(id);
      if (currentUserId && supabaseId !== null) {
        try {
            const payload = sanitizeLeadForSupabase(updates as Lead, { mode: 'patch' });
            await supabaseRequest('leads', { method: 'PATCH', body: payload, query: `?id=eq.${supabaseId}` });
        } catch (e) {
            console.error('Erro ao salvar lead no Supabase', e);
        }
      } else if (currentUserId) {
        console.warn('Ignorando atualização no Supabase: ID não numérico', id);
      }
  };

  const deleteLead = async (id: string) => {
      setLeads(prev => prev.filter(l => l.id !== id));
      addNotification('Lead excluído com sucesso.', 'success');
      const supabaseId = toSupabaseId(id);
      if (currentUserId && supabaseId !== null) {
        try {
            await supabaseRequest('leads', { method: 'DELETE', query: `?id=eq.${supabaseId}` });
        } catch (e) {
            console.error('Erro ao excluir lead no Supabase', e);
        }
      } else if (currentUserId) {
        console.warn('Ignorando exclusão no Supabase: ID não numérico', id);
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
        } else {
            leadsToProcess.push(newLead);
        }
    }

    if (leadsToProcess.length === 0) {
        if (duplicates > 0) addNotification('Nenhum lead novo. Todos já existem.', 'warning');
        return;
    }

    // Enforce plan quota
    const remaining = remainingLeadQuota();
    if (remaining <= 0) {
        addNotification(`Limite mensal do plano ${activePlan} atingido. Faça upgrade para continuar gerando leads.`, 'warning');
        return;
    }
    let allowedList = leadsToProcess;
    if (Number.isFinite(planRules.leadLimit) && leadsToProcess.length > remaining) {
        allowedList = leadsToProcess.slice(0, remaining);
        addNotification(`Só foi possível adicionar ${remaining} lead(s) com seu plano ${activePlan}. Considere upgrade para mais capacidade.`, 'warning');
    }

    const makeNumericId = () => Date.now() + Math.floor(Math.random() * 1000);

    let leadsToAdd: Lead[] = allowedList.map((l, idx) => {
        const safeName = l.name && String(l.name).trim().length > 0
            ? String(l.name).trim()
            : (l.company && String(l.company).trim().length > 0 ? String(l.company).trim() : 'Contato');
        const safeCompany = l.company && String(l.company).trim().length > 0
            ? String(l.company).trim()
            : (safeName || 'Empresa Desconhecida');

        return {
            id: String(makeNumericId() + idx),
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
            name: safeName,
            company: safeCompany,
            value: toNumeric(l.value, 0),
        } as Lead;
    });

    const processedLeads: Lead[] = [];
    for (const lead of leadsToAdd) {
        let tempLead = await runAutomations('ON_HIGH_VALUE', lead, {}, { silent: true });
        tempLead = await runAutomations('ON_CREATE', tempLead, {}, { silent: true });
        processedLeads.push(tempLead);
    }

    setLeads(prev => [...prev, ...processedLeads]);
    const duplicateNote = duplicates > 0 ? ` ${duplicates} duplicado(s) ignorado(s).` : '';
    const monthlyUsed = leadsCreatedThisMonth([...leads, ...processedLeads]);
    if (Number.isFinite(planRules.leadLimit)) {
        const threshold = planRules.leadLimit * 0.8;
        if (monthlyUsed >= planRules.leadLimit) {
            addNotification(`Você atingiu o limite mensal de ${planRules.leadLimit} leads do plano ${activePlan}.`, 'warning');
        } else if (monthlyUsed >= threshold) {
            addNotification(`Você usou ${monthlyUsed}/${planRules.leadLimit} leads neste mês. Estamos chegando ao limite do plano ${activePlan}.`, 'info');
        }
    }
    addNotification(`Leads adicionados ao CRM Pipeline: ${processedLeads.length} lead(s) incluído(s).${duplicateNote}`, 'success');

    if (currentUserId) {
        try {
            const payload = processedLeads.map(lead =>
                sanitizeLeadForSupabase({ ...lead, user_id: currentUserId }, { includeCreatedAt: true, mode: 'insert' })
            );
            await supabaseRequest('leads', { method: 'POST', body: payload, query: '' });
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
        if (!planRules.allowMapSearch) {
            return (
                <div className="bg-white border border-amber-200 text-amber-800 p-6 rounded-xl shadow-sm">
                    Mapa Inteligente e extração de leads por localização estão disponíveis apenas a partir do plano Pro. Faça upgrade para usar este recurso.
                </div>
            );
        }
        return <LeadMap 
            leads={leads} 
            discoveryResults={discoveryResults}
            openAiKey={settings.openAiKey}
            addLead={(lead) => handleAddLeads([lead])}
            notify={addNotification}
        />;
      case 'pipeline':
        return <Pipeline 
            leads={leads} 
            updateLeadStatus={updateLeadStatus} 
            enrichLead={handleEnrichLead} 
            deleteLead={deleteLead}
            updateLead={updateLeadDetails}
            addNewLead={(lead) => handleAddLeads([lead])}
            settings={settings}
            openAiKey={settings.openAiKey}
            notify={addNotification}
        />;
      case 'discovery':
        if (!planRules.allowMapSearch) {
            return (
                <div className="bg-white border border-amber-200 text-amber-800 p-6 rounded-xl shadow-sm">
                    Captação de leads está disponível somente para planos Pro ou superiores. Faça upgrade para liberar.
                </div>
            );
        }
        return <Discovery 
            addLeads={handleAddLeads} 
            setDiscoveryResults={setDiscoveryResults} 
            openAiKey={settings.openAiKey} 
            userSector={settings.companySector}
            notify={addNotification}
        />;
      case 'calendar':
        return (
          <Calendar
            currentUserId={currentUserId}
            settings={settings}
            notify={addNotification}
          />
        );
      case 'settings':
        return <Settings 
            settings={settings} 
            updateSettings={handleUpdateSettings} 
            isSaving={isSavingSettings}
        />;
      default: return <Dashboard stats={stats} leads={leads} userName={settings.userName} />;
    }
  };

	  if (!authLoaded) {
	      return <div className="dark min-h-[100svh] bg-transparent" />;
	  }

	  const LoginRoute: React.FC = () => {
	      const loc = useLocation();
	      const nav = useNavigate();
	      if (isAuthenticated) return <Navigate to="/dashboard" replace />;
	      const from = (loc.state as any)?.from as string | undefined;
	      return (
	          <Login
	              onLogin={async (userData) => {
	                  await handleLogin(userData);
	                  nav(from || '/dashboard', { replace: true });
	              }}
	              onSwitchToRegister={() => nav('/register')}
	          />
	      );
	  };

	  const RegisterRoute: React.FC = () => {
	      const nav = useNavigate();
	      if (isAuthenticated) return <Navigate to="/dashboard" replace />;
	      return (
	          <Register
	              onRegister={async (userData) => {
	                  await handleLogin(userData);
	                  nav('/dashboard', { replace: true });
	              }}
	              onSwitchToLogin={() => nav('/login')}
	          />
	      );
	  };

	  const ProtectedShell: React.FC = () => {
	      const loc = useLocation();
	      if (!isAuthenticated) {
	          return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
	      }

	      return (
	    <div className={`app-shell flex min-h-screen bg-transparent text-gray-900 dark:text-slate-100 font-sans transition-colors duration-200 relative overflow-hidden`}>
	      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(168,85,247,0.22),transparent_38%),radial-gradient(circle_at_86%_16%,rgba(217,70,239,0.14),transparent_40%),radial-gradient(circle_at_55%_84%,rgba(59,130,246,0.10),transparent_44%)] opacity-95" />
	      <div className="pointer-events-none absolute inset-0 opacity-35 bg-[linear-gradient(to_right,rgba(168,85,247,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(168,85,247,0.14)_1px,transparent_1px),linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:56px_56px,56px_56px,8px_8px,8px_8px] [mask-image:radial-gradient(circle_at_45%_18%,black_0%,transparent_70%)]" />
	      <div className="pointer-events-none absolute -left-40 -top-36 h-96 w-96 rounded-full bg-purple-500/14 blur-3xl" />
      <div className="pointer-events-none absolute -right-36 top-10 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="pointer-events-none absolute right-24 bottom-10 h-72 w-72 rounded-full bg-indigo-500/12 blur-3xl" />
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
                  className="pointer-events-auto flex items-start gap-3 w-auto min-w-[320px] max-w-sm glass-panel bg-white/90 dark:bg-white/10 backdrop-blur-2xl text-gray-800 dark:text-slate-50 px-4 py-4 rounded-xl shadow-2xl border border-white/80 dark:border-white/10 animate-in slide-in-from-right-full fade-in duration-300 relative overflow-hidden"
              >
                  {/* Accent Line */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${
                      n.type === 'success' ? 'from-emerald-400 via-emerald-500 to-emerald-600' : 
                      n.type === 'warning' ? 'from-amber-400 via-amber-500 to-amber-600' : 
                      'from-indigo-400 via-purple-500 to-fuchsia-500'
                  }`}></div>

                  {/* Icon */}
                  <div className={`mt-0.5 shrink-0 p-1.5 rounded-full shadow-sm ${
                      n.type === 'success' ? 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200' : 
                      n.type === 'warning' ? 'bg-amber-100/80 text-amber-700 dark:bg-amber-400/10 dark:text-amber-200' : 
                      'bg-indigo-100/80 text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200'
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
                      <p className="text-sm text-gray-600 dark:text-slate-200 leading-snug">{n.message}</p>
                  </div>

                  {/* Close */}
                  <button 
                    onClick={() => removeNotification(n.id)} 
                    className="text-gray-400 dark:text-slate-300 hover:text-gray-600 dark:hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
              </div>
          ))}
      </div>

      <main className="relative flex-1 md:ml-64 p-4 sm:p-6 lg:p-8 pt-16 md:pt-8 min-h-screen overflow-y-auto page-animate">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="mb-2">
              <div className="glass-panel rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-xl shadow-lg shadow-purple-900/20">
                  <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white text-[#9b01ec] shadow-sm border border-[#e9d5ff] dark:bg-[#9b01ec]/20 dark:text-[#d8b4fe] dark:border-[#9b01ec]/30 flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5 animate-pulse" />
                          Plano {activePlan}
                      </span>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 text-gray-800 dark:text-slate-100">
                        <span className="text-sm font-semibold leading-tight flex items-center gap-1.5">
                          <Gauge className="w-4 h-4 text-indigo-500 animate-pulse" />
                          Leads no mês: {Number.isFinite(planRules.leadLimit) ? `${leadsCreatedThisMonth(leads)}/${planRules.leadLimit}` : `${leadsCreatedThisMonth(leads)} / ilimitado`}
                        </span>
                        <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-600 font-semibold bg-emerald-50/80 border border-emerald-100 px-2.5 py-1 rounded-full dark:bg-emerald-400/10 dark:text-emerald-200 dark:border-emerald-500/30 shadow-sm flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 animate-pulse" />
                          CRM Inteligente
                        </span>
                      </div>
                  </div>
                  {!Number.isFinite(planRules.leadLimit) ? (
                      <span className="text-xs text-emerald-700 dark:text-emerald-200 font-semibold bg-emerald-50/80 dark:bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-500/30 shadow-sm">
                        Limite ilimitado
                      </span>
                  ) : (
                      <span className="text-xs text-gray-600 dark:text-slate-200 flex items-center gap-2 bg-white/70 dark:bg-white/5 px-3 py-1.5 rounded-full border border-white/60 dark:border-white/10 shadow-sm">
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping shadow-[0_0_0_6px_rgba(251,191,36,0.18)]" />
                        Ultrapassou o limite? Faça upgrade para liberar mais leads.
                        <MoveUpRight className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                      </span>
                  )}
              </div>
          </div>
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400 font-semibold">Painel</p>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-800">
	                {viewLabel(currentView)}
		                </h1>
	              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="px-3 py-2 rounded-full border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-xs font-semibold text-gray-700 dark:text-slate-100 shadow-sm flex items-center gap-2 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
                </button>
              </div>
          </header>

          <div key={currentView} className="page-animate space-y-6">
            {renderContent()}
          </div>
        </div>
      </main>
      <DevtoneChatbox />
      
    </div>
  );
  };

  return (
    <Routes>
      <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route path="/register" element={<RegisterRoute />} />

      <Route path="/dashboard" element={<ProtectedShell />} />
      <Route path="/map" element={<ProtectedShell />} />
      <Route path="/pipeline" element={<ProtectedShell />} />
      <Route path="/discovery" element={<ProtectedShell />} />
      <Route path="/calendar" element={<ProtectedShell />} />
      <Route path="/settings" element={<ProtectedShell />} />

      <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
};

export default App;
