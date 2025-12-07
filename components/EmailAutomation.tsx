
import React, { useState } from 'react';
import { 
  Zap, Mail, Clock, GitFork, Trash2, Plus, Play, 
  Settings, Save, X, Smartphone, Monitor, 
  Wand2, RefreshCw, Send, CheckCircle2, AlertTriangle,
  Users, CheckSquare, Square, Filter, Bot, Search, Ban
} from 'lucide-react';
import { Lead, AppSettings } from '../types';
import { sendRealEmail } from '../services/emailApi';
import { generateEmailWithPerplexity } from '../services/perplexityService';
import { isValidEmail } from '../utils/validators';

// --- Types for Flow Builder ---

type NodeType = 'trigger' | 'email' | 'delay' | 'condition' | 'action';

interface FlowNode {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  data: any; // Flexible data storage for email body, delay time, etc.
}

interface EmailAutomationProps {
  leads: Lead[];
  settings: AppSettings;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  updateSettings?: (newSettings: AppSettings) => void;
}

const VARIABLES = [
  { label: 'Nome do Contato', value: '{{name}}' },
  { label: 'Empresa', value: '{{company}}' },
  { label: 'Cidade', value: '{{city}}' },
  { label: 'Cargo', value: '{{role}}' },
  { label: 'Setor', value: '{{sector}}' },
];

// --- Default Initial Flow ---
const INITIAL_FLOW: FlowNode[] = [
  { 
    id: 'start', 
    type: 'trigger', 
    title: 'Novo Lead Cadastrado', 
    description: 'Inicia quando um lead entra no CRM', 
    data: { triggerType: 'ON_CREATE' } 
  },
  { 
    id: 'delay_1', 
    type: 'delay', 
    title: 'Aguardar 2 Horas', 
    description: 'Espera para parecer natural', 
    data: { time: 2, unit: 'hours' } 
  },
  { 
    id: 'email_1', 
    type: 'email', 
    title: 'Email de Boas-vindas', 
    description: 'Envia apresentação da empresa', 
    data: { 
      subject: 'Oportunidade para {{company}}', 
      body: 'Olá {{name}},\n\nVi que sua empresa atua em {{city}} e gostaria de apresentar nossas soluções.\n\nPodemos conversar?',
      tone: 'professional'
    } 
  }
];

const EmailAutomation: React.FC<EmailAutomationProps> = ({ leads, settings, updateLead, updateSettings }) => {
  const [activeTab, setActiveTab] = useState<'flow' | 'campaign'>('flow');

  // --- State for Flow Builder ---
  const [flow, setFlow] = useState<FlowNode[]>(INITIAL_FLOW);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  // SMTP & Settings State
  const [showSmtpModal, setShowSmtpModal] = useState(false);
  const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
  const [smtpStatus, setSmtpStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Preview & Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStep, setSimulationStep] = useState<number>(-1);
  const [simulationLog, setSimulationLog] = useState<string[]>([]);
  
  // --- State for Campaign (Mass Email) ---
  // We now use all leads for display, but filter for operations
  const leadsWithEmail = leads.filter(l => isValidEmail(l.email));
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [campaignSubject, setCampaignSubject] = useState('');
  const [campaignBody, setCampaignBody] = useState('');
  const [isSendingCampaign, setIsSendingCampaign] = useState(false);
  const [sendingProgress, setSendingProgress] = useState({ current: 0, total: 0, successes: 0, failures: 0 });
  const [campaignSearch, setCampaignSearch] = useState('');
  
  // AI Generation State
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // Helper to get selected node
  const selectedNode = flow.find(n => n.id === selectedNodeId);

  // --- Campaign Functions ---

  const toggleLeadSelection = (id: string) => {
    const lead = leads.find(l => l.id === id);
    if (!lead || !isValidEmail(lead.email)) return; // Prevent selecting invalid

    if (selectedLeadIds.includes(id)) {
        setSelectedLeadIds(selectedLeadIds.filter(lid => lid !== id));
    } else {
        setSelectedLeadIds([...selectedLeadIds, id]);
    }
  };

  const toggleSelectAll = () => {
      // If all VALID leads are selected, deselect all. Otherwise, select all VALID.
      const allValidIds = leadsWithEmail.map(l => l.id);
      const isAllSelected = allValidIds.every(id => selectedLeadIds.includes(id));

      if (isAllSelected) {
          setSelectedLeadIds([]);
      } else {
          setSelectedLeadIds(allValidIds);
      }
  };

  const generateCampaignAi = async () => {
    setIsGeneratingAi(true);
    try {
        // Use a generic lead context for the template
        const templateContext: any = {
            company: "{{company}}",
            name: "{{name}}",
            city: "{{city}}",
            contactRole: "{{role}}",
            tags: ["Campanha Geral"],
            notes: "Generate a generic but powerful B2B sales email template."
        };

        const result = await generateEmailWithPerplexity(
            templateContext, 
            'persuasive', 
            'sales', 
            localSettings
        );

        setCampaignSubject(result.subject);
        setCampaignBody(result.body);

    } catch (e) {
        alert("Erro ao gerar com IA: " + e);
    } finally {
        setIsGeneratingAi(false);
    }
  };

  const insertVariableCampaign = (variable: string) => {
      setCampaignBody(prev => prev + ' ' + variable);
  };

  const handleSendCampaign = async () => {
      if (!localSettings.smtpHost || !localSettings.smtpUser) {
          alert("Configure o SMTP primeiro!");
          setShowSmtpModal(true);
          return;
      }
      if (selectedLeadIds.length === 0) {
          alert("Selecione pelo menos um lead.");
          return;
      }
      if (!campaignSubject || !campaignBody) {
          alert("Preencha o assunto e corpo do email.");
          return;
      }

      if (!confirm(`Tem certeza que deseja enviar este email para ${selectedLeadIds.length} leads?`)) return;

      setIsSendingCampaign(true);
      setSendingProgress({ current: 0, total: selectedLeadIds.length, successes: 0, failures: 0 });

      let successes = 0;
      let failures = 0;

      for (let i = 0; i < selectedLeadIds.length; i++) {
          const leadId = selectedLeadIds[i];
          const lead = leads.find(l => l.id === leadId);

          if (lead && isValidEmail(lead.email)) {
              // 1. Personalize Content
              let personalizedBody = campaignBody
                .replace(/{{name}}/g, lead.name || 'Gestor')
                .replace(/{{company}}/g, lead.company)
                .replace(/{{city}}/g, lead.city)
                .replace(/{{role}}/g, lead.contactRole || 'Responsável')
                .replace(/{{sector}}/g, lead.tags?.[0] || 'Setor');
              
              let personalizedSubject = campaignSubject
                .replace(/{{name}}/g, lead.name || 'Gestor')
                .replace(/{{company}}/g, lead.company);

              // 2. Send Real Email
              const res = await sendRealEmail(localSettings, lead.email!, personalizedSubject, personalizedBody);

              if (res.success) {
                  successes++;
                  // Optionally log to lead history here
                  updateLead(lead.id, { 
                      history: [...(lead.history || []), { 
                          date: new Date().toISOString(), 
                          description: `Email de campanha enviado: ${personalizedSubject}`, 
                          type: 'email_sent' 
                      }] 
                  });
              } else {
                  failures++;
                  console.error(`Falha ao enviar para ${lead.email}:`, res.error);
              }
          }

          setSendingProgress({ current: i + 1, total: selectedLeadIds.length, successes, failures });
          // Small delay to be polite to SMTP server
          await new Promise(r => setTimeout(r, 500));
      }

      setIsSendingCampaign(false);
      alert(`Campanha finalizada!\nSucessos: ${successes}\nFalhas: ${failures}`);
  };

  // --- Flow Management Functions ---

  const addNode = (index: number, type: NodeType) => {
    const newNode: FlowNode = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      title: type === 'email' ? 'Novo Email' : type === 'delay' ? 'Novo Atraso' : 'Nova Ação',
      data: type === 'email' ? { subject: '', body: '' } : type === 'delay' ? { time: 1, unit: 'days' } : {}
    };
    
    const newFlow = [...flow];
    newFlow.splice(index + 1, 0, newNode);
    setFlow(newFlow);
    setSelectedNodeId(newNode.id);
  };

  const removeNode = (id: string) => {
    setFlow(flow.filter(n => n.id !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
  };

  const updateNodeData = (id: string, data: any) => {
    setFlow(flow.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n));
  };

  // --- SMTP Functions ---

  const handleSmtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSettings({ ...localSettings, [e.target.name]: e.target.value });
  };

  const testSmtp = async () => {
    setSmtpStatus('testing');
    // Simulated Check
    setTimeout(() => {
        if (localSettings.smtpHost && localSettings.smtpUser && localSettings.smtpPass) {
            setSmtpStatus('success');
            if (updateSettings) updateSettings(localSettings);
        } else {
            setSmtpStatus('error');
        }
    }, 1500);
  };

  // --- AI Email Functions (Flow) ---

  const insertVariable = (variable: string) => {
    if (!selectedNode || selectedNode.type !== 'email') return;
    const currentBody = selectedNode.data.body || '';
    updateNodeData(selectedNode.id, { body: currentBody + ' ' + variable });
  };

  const generateAiEmail = async (tone: string) => {
    if (!selectedNode) return;
    setIsGeneratingAi(true);

    try {
        // Mocking a lead for context generation
        const mockLead = leads[0] || { 
            company: "Empresa Exemplo", 
            name: "Cliente", 
            city: "São Paulo", 
            tags: ["Interesse"] 
        };

        const result = await generateEmailWithPerplexity(
            mockLead as any, 
            tone as any, 
            'sales', 
            localSettings
        );

        updateNodeData(selectedNode.id, {
            subject: result.subject,
            body: result.body
        });

    } catch (e) {
        alert("Erro ao gerar com IA. Verifique sua chave API.");
    } finally {
        setIsGeneratingAi(false);
    }
  };

  // --- Simulation Functions ---

  const runSimulation = async () => {
    setIsSimulating(true);
    setSimulationStep(-1);
    setSimulationLog([]);
    
    const logs: string[] = [];

    for (let i = 0; i < flow.length; i++) {
        setSimulationStep(i);
        const node = flow[i];
        
        // Visual delay
        await new Promise(r => setTimeout(r, 1000));
        
        let logMsg = `[${new Date().toLocaleTimeString()}] Passo ${i+1}: ${node.title} - Executado.`;
        
        if (node.type === 'trigger') {
            logMsg = `✅ TRIGGER: Lead entrou no funil.`;
        } else if (node.type === 'delay') {
            logMsg = `⏳ DELAY: Aguardando ${node.data.time} ${node.data.unit}... (Simulado)`;
        } else if (node.type === 'email') {
            logMsg = `📧 EMAIL: Enviado para lead (Simulação). Assunto: "${node.data.subject}"`;
        }
        
        logs.push(logMsg);
        setSimulationLog([...logs]);
    }

    await new Promise(r => setTimeout(r, 1000));
    setIsSimulating(false);
    setSimulationStep(-1);
    alert("Simulação concluída com sucesso!");
  };

  // --- Renders ---

  const renderIcon = (type: NodeType) => {
    switch(type) {
        case 'trigger': return <Zap className="w-5 h-5 text-amber-500" />;
        case 'email': return <Mail className="w-5 h-5 text-indigo-500" />;
        case 'delay': return <Clock className="w-5 h-5 text-gray-500" />;
        case 'condition': return <GitFork className="w-5 h-5 text-orange-500" />;
        case 'action': return <Bot className="w-5 h-5 text-emerald-500" />;
        default: return <Settings className="w-5 h-5" />;
    }
  };

  // Filter leads for display in Campaign Tab
  const filteredLeads = leads.filter(l => 
    l.company.toLowerCase().includes(campaignSearch.toLowerCase()) || 
    (l.email && l.email.toLowerCase().includes(campaignSearch.toLowerCase()))
  );

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-hidden">
      
      {/* --- TOP BAR --- */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center shadow-sm z-20">
        <div>
            <h2 className="text-xl font-bold text-gray-800">Automação de Email</h2>
            <p className="text-xs text-gray-500">Gerencie fluxos automáticos e campanhas de massa.</p>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
                onClick={() => setActiveTab('flow')}
                className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeTab === 'flow' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Fluxo Automático
            </button>
             <button 
                onClick={() => setActiveTab('campaign')}
                className={`px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'campaign' ? 'bg-white shadow text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
                <Users className="w-3 h-3" /> Disparo em Massa
            </button>
        </div>
        <div className="flex gap-3">
             <button 
                onClick={() => setShowSmtpModal(true)}
                className={`px-4 py-2 rounded-lg text-xs font-bold border flex items-center gap-2 transition-colors ${
                    localSettings.smtpHost 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
             >
                <Settings className="w-4 h-4" /> Configurar SMTP
             </button>
             {activeTab === 'flow' && (
                <button 
                    onClick={runSimulation}
                    disabled={isSimulating}
                    className="px-4 py-2 bg-gray-900 text-white hover:bg-black rounded-lg text-xs font-bold flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                >
                    {isSimulating ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Play className="w-4 h-4" />}
                    Simular Fluxo
                </button>
             )}
        </div>
      </div>

      {/* --- MAIN CONTENT: TAB SWITCHER --- */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* --- TAB 1: FLOW BUILDER (EXISTING) --- */}
        {activeTab === 'flow' && (
            <>
                {/* LEFT: FLOW BUILDER */}
                <div className="flex-1 overflow-y-auto p-8 relative custom-scrollbar bg-gray-50/50">
                    <div className="max-w-xl mx-auto space-y-4 pb-20">
                        {flow.map((node, index) => (
                            <div key={node.id} className="relative group">
                                {/* Connecting Line */}
                                {index > 0 && (
                                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 h-6 w-0.5 bg-gray-300"></div>
                                )}
                                {/* Node Card */}
                                <div 
                                    onClick={() => setSelectedNodeId(node.id)}
                                    className={`relative bg-white p-4 rounded-xl border-2 cursor-pointer transition-all shadow-sm hover:shadow-md flex items-center gap-4 z-10 ${
                                        selectedNodeId === node.id 
                                        ? 'border-indigo-500 ring-4 ring-indigo-50' 
                                        : simulationStep === index 
                                            ? 'border-emerald-500 ring-4 ring-emerald-50 scale-105 transition-transform duration-500' 
                                            : 'border-gray-200 hover:border-indigo-300'
                                    }`}
                                >
                                    <div className={`p-3 rounded-lg bg-gray-50 border border-gray-100 ${simulationStep === index ? 'bg-emerald-100' : ''}`}>
                                        {renderIcon(node.type)}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold text-gray-800 text-sm">{node.title}</h4>
                                        <p className="text-xs text-gray-500">{node.description}</p>
                                    </div>
                                    {node.type !== 'trigger' && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                                {/* Add Button */}
                                <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <div className="dropdown relative group/add">
                                        <button className="bg-indigo-600 text-white rounded-full p-1 shadow-md hover:scale-110 transition-transform">
                                            <Plus className="w-4 h-4" />
                                        </button>
                                        <div className="hidden group-hover/add:block absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden py-1 z-50">
                                            <button onClick={() => addNode(index, 'email')} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><Mail className="w-3 h-3"/> Enviar Email</button>
                                            <button onClick={() => addNode(index, 'delay')} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><Clock className="w-3 h-3"/> Atraso (Delay)</button>
                                            <button onClick={() => addNode(index, 'condition')} className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 flex items-center gap-2"><GitFork className="w-3 h-3"/> Condição (Se/Senão)</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {/* End Node */}
                        <div className="relative pt-6 flex flex-col items-center justify-center opacity-50">
                            <div className="h-6 w-0.5 bg-gray-300 absolute top-0"></div>
                            <div className="bg-gray-200 rounded-full px-4 py-1 text-[10px] font-bold text-gray-500">
                                FIM DO FLUXO
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT: NODE EDITOR & PREVIEW */}
                <div className="w-[450px] bg-white border-l border-gray-200 flex flex-col shadow-xl z-30">
                    {selectedNode ? (
                        <>
                            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    {renderIcon(selectedNode.type)}
                                    Editar: {selectedNode.title}
                                </h3>
                                <button onClick={() => setSelectedNodeId(null)} className="text-gray-400 hover:text-gray-600">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* NAME INPUT */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Nome do Passo</label>
                                    <input 
                                        value={selectedNode.title}
                                        onChange={(e) => setFlow(flow.map(n => n.id === selectedNode.id ? {...n, title: e.target.value} : n))}
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                {/* EMAIL EDITOR */}
                                {selectedNode.type === 'email' && (
                                    <>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Assunto do Email</label>
                                            <input 
                                                value={selectedNode.data.subject}
                                                onChange={(e) => updateNodeData(selectedNode.id, { subject: e.target.value })}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                                placeholder="Ex: Proposta para {{company}}"
                                            />
                                        </div>
                                        {/* AI TOOLS */}
                                        <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                                            <p className="text-[10px] font-bold text-indigo-700 uppercase mb-2 flex items-center gap-1">
                                                <Wand2 className="w-3 h-3"/> IA Assistant (Perplexity)
                                            </p>
                                            <div className="flex gap-2 flex-wrap">
                                                <button onClick={() => generateAiEmail('formal')} disabled={isGeneratingAi} className="px-2 py-1 bg-white border border-indigo-200 text-indigo-600 rounded text-xs hover:bg-indigo-100 transition-colors">Formal</button>
                                                <button onClick={() => generateAiEmail('persuasive')} disabled={isGeneratingAi} className="px-2 py-1 bg-white border-indigo-200 text-indigo-600 rounded text-xs hover:bg-indigo-100 transition-colors">Persuasivo</button>
                                                <button onClick={() => generateAiEmail('friendly')} disabled={isGeneratingAi} className="px-2 py-1 bg-white border-indigo-200 text-indigo-600 rounded text-xs hover:bg-indigo-100 transition-colors">Amigável</button>
                                            </div>
                                            {isGeneratingAi && <p className="text-xs text-indigo-500 mt-2 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin"/> Escrevendo email...</p>}
                                        </div>
                                        {/* VARIABLES */}
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Variáveis Dinâmicas</label>
                                            <div className="flex flex-wrap gap-2">
                                                {VARIABLES.map(v => (
                                                    <button key={v.value} onClick={() => insertVariable(v.value)} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] hover:bg-gray-200 border border-gray-200">{v.label}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Corpo do Email</label>
                                            <textarea 
                                                rows={12}
                                                value={selectedNode.data.body}
                                                onChange={(e) => updateNodeData(selectedNode.id, { body: e.target.value })}
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed resize-none"
                                                placeholder="Olá {{name}}..."
                                            />
                                        </div>
                                    </>
                                )}
                                {/* DELAY EDITOR */}
                                {selectedNode.type === 'delay' && (
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Tempo de Espera</label>
                                        <div className="flex gap-2">
                                            <input type="number" min="1" value={selectedNode.data.time} onChange={(e) => updateNodeData(selectedNode.id, { time: parseInt(e.target.value) })} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900" />
                                            <select value={selectedNode.data.unit} onChange={(e) => updateNodeData(selectedNode.id, { unit: e.target.value })} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900">
                                                <option value="hours">Horas</option>
                                                <option value="days">Dias</option>
                                                <option value="minutes">Minutos</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-t border-gray-200 bg-gray-50 text-right">
                                <button onClick={() => setSelectedNodeId(null)} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm">Concluir Edição</button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4"><GitFork className="w-8 h-8 text-gray-300" /></div>
                            <h3 className="text-lg font-bold text-gray-600">Editor de Fluxo</h3>
                            <p className="text-sm max-w-xs mt-2">Clique em qualquer etapa à esquerda para editar, ou use o botão "+" para adicionar novas ações.</p>
                            {isSimulating && (
                                <div className="mt-8 w-full bg-gray-900 text-green-400 p-4 rounded-xl text-left font-mono text-xs h-64 overflow-y-auto shadow-lg border border-gray-700">
                                    <p className="text-white border-b border-gray-700 pb-2 mb-2 font-bold flex items-center gap-2"><Play className="w-3 h-3" /> Console de Simulação</p>
                                    <div className="space-y-1">
                                        {simulationLog.map((log, i) => (<p key={i} className="animate-in fade-in slide-in-from-left-2">{log}</p>))}
                                        <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse mt-2"></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </>
        )}

        {/* --- TAB 2: MASS CAMPAIGN (NEW) --- */}
        {activeTab === 'campaign' && (
            <div className="flex-1 flex overflow-hidden">
                {/* LEFT: LEAD SELECTION TABLE */}
                <div className="w-[500px] bg-white border-r border-gray-200 flex flex-col">
                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-gray-700 text-sm">Leads no CRM ({leads.length})</h3>
                                <p className="text-xs text-gray-400">
                                    <span className="text-indigo-600 font-bold">{leadsWithEmail.length}</span> com email válido
                                </p>
                            </div>
                            <div className="flex gap-2">
                                 <button onClick={toggleSelectAll} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded">
                                     {(selectedLeadIds.length === leadsWithEmail.length && leadsWithEmail.length > 0) ? 'Desmarcar Todos' : 'Selecionar Válidos'}
                                 </button>
                            </div>
                        </div>
                        {/* Search Filter */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input 
                                type="text"
                                placeholder="Filtrar lead..."
                                value={campaignSearch}
                                onChange={(e) => setCampaignSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
                        {filteredLeads.length === 0 ? (
                            <div className="text-center p-8 text-gray-400">
                                <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                                <p className="text-sm">Nenhum lead encontrado.</p>
                            </div>
                        ) : (
                            filteredLeads.map(lead => {
                                const hasEmail = isValidEmail(lead.email);
                                const isSelected = selectedLeadIds.includes(lead.id);

                                return (
                                    <div 
                                        key={lead.id}
                                        onClick={() => toggleLeadSelection(lead.id)}
                                        className={`p-3 rounded-lg border flex items-center gap-3 transition-all ${
                                            hasEmail 
                                            ? 'cursor-pointer hover:border-indigo-300' 
                                            : 'cursor-not-allowed opacity-60 bg-gray-50 border-dashed'
                                        } ${
                                            isSelected 
                                            ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' 
                                            : 'bg-white border-gray-100'
                                        }`}
                                    >
                                        {hasEmail ? (
                                            isSelected ? (
                                                <CheckSquare className="w-5 h-5 text-indigo-600 shrink-0" />
                                            ) : (
                                                <Square className="w-5 h-5 text-gray-300 shrink-0" />
                                            )
                                        ) : (
                                            <Ban className="w-5 h-5 text-gray-300 shrink-0" />
                                        )}
                                        
                                        <div className="overflow-hidden flex-1">
                                            <h4 className={`font-bold text-sm truncate ${hasEmail ? 'text-gray-800' : 'text-gray-500'}`}>{lead.company}</h4>
                                            {hasEmail ? (
                                                <p className="text-xs text-gray-500 truncate">{lead.email}</p>
                                            ) : (
                                                <p className="text-[10px] text-red-400 flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3"/> Sem Email
                                                </p>
                                            )}
                                        </div>
                                        <div className="ml-auto">
                                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                                                {lead.tags?.[0] || 'Geral'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                    
                    <div className="p-4 border-t border-gray-100 bg-gray-50">
                        <p className="text-xs text-gray-500 font-bold text-center">
                            {selectedLeadIds.length} leads selecionados para envio
                        </p>
                    </div>
                </div>

                {/* RIGHT: EMAIL EDITOR & SENDER */}
                <div className="flex-1 bg-gray-50 flex flex-col p-6 overflow-y-auto custom-scrollbar">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-2xl mx-auto w-full">
                        <h3 className="font-bold text-xl text-gray-800 mb-6 flex items-center gap-2">
                            <Send className="w-5 h-5 text-indigo-600" />
                            Configurar Campanha
                        </h3>

                        <div className="space-y-4">
                            {/* Template Generator */}
                            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 mb-4">
                                <h4 className="font-bold text-indigo-800 text-sm flex items-center gap-2 mb-2">
                                    <Wand2 className="w-4 h-4" /> Gerador de Template IA
                                </h4>
                                <p className="text-xs text-indigo-600 mb-3">
                                    A IA usará os dados dos leads selecionados para criar um template genérico que se adapta a todos.
                                </p>
                                <button 
                                    onClick={generateCampaignAi}
                                    disabled={isGeneratingAi}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm disabled:opacity-50"
                                >
                                    {isGeneratingAi ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                    Gerar Template de Vendas
                                </button>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Assunto</label>
                                <input 
                                    value={campaignSubject}
                                    onChange={(e) => setCampaignSubject(e.target.value)}
                                    placeholder="Ex: Parceria com {{company}}"
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Corpo do Email</label>
                                <div className="flex gap-2 mb-2 flex-wrap">
                                    {VARIABLES.map(v => (
                                        <button key={v.value} onClick={() => insertVariableCampaign(v.value)} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[10px] hover:bg-gray-200 border border-gray-200">{v.label}</button>
                                    ))}
                                </div>
                                <textarea 
                                    rows={10}
                                    value={campaignBody}
                                    onChange={(e) => setCampaignBody(e.target.value)}
                                    placeholder="Olá {{name}}..."
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none resize-none leading-relaxed"
                                />
                            </div>

                            {/* PROGRESS BAR */}
                            {isSendingCampaign && (
                                <div className="bg-gray-900 text-white p-4 rounded-xl mt-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-bold">Enviando Campanha...</span>
                                        <span className="text-xs text-gray-400">{sendingProgress.current}/{sendingProgress.total}</span>
                                    </div>
                                    <div className="w-full bg-gray-700 rounded-full h-2 mb-2 overflow-hidden">
                                        <div 
                                            className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                                            style={{ width: `${(sendingProgress.current / sendingProgress.total) * 100}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex gap-4 text-[10px]">
                                        <span className="text-green-400">Sucessos: {sendingProgress.successes}</span>
                                        <span className="text-red-400">Falhas: {sendingProgress.failures}</span>
                                    </div>
                                </div>
                            )}

                            <button 
                                onClick={handleSendCampaign}
                                disabled={isSendingCampaign || selectedLeadIds.length === 0}
                                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-green-100 transition-all flex items-center justify-center gap-2 mt-4"
                            >
                                {isSendingCampaign ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {isSendingCampaign ? 'Enviando...' : `Disparar para ${selectedLeadIds.length} Leads`}
                            </button>
                            
                            <p className="text-center text-[10px] text-gray-400 mt-2">
                                * Os emails serão enviados usando seu servidor SMTP configurado.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )}

      </div>

      {/* --- SMTP MODAL --- */}
      {showSmtpModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">Configurações de Envio (SMTP)</h3>
                    <button onClick={() => setShowSmtpModal(false)}><X className="w-5 h-5 text-gray-400 hover:text-gray-600" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-700 mb-4">
                        ℹ️ Configure seu servidor de email para permitir que o CRM envie mensagens reais em seu nome.
                    </div>
                    
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Host SMTP</label>
                        <input name="smtpHost" value={localSettings.smtpHost} onChange={handleSmtpChange} placeholder="smtp.gmail.com" className="w-full border p-2 rounded text-sm bg-white text-gray-900"/>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Porta</label>
                             <input name="smtpPort" value={localSettings.smtpPort} onChange={handleSmtpChange} placeholder="465" className="w-full border p-2 rounded text-sm bg-white text-gray-900"/>
                        </div>
                        <div>
                             <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Usuário</label>
                             <input name="smtpUser" value={localSettings.smtpUser} onChange={handleSmtpChange} placeholder="email@dominio.com" className="w-full border p-2 rounded text-sm bg-white text-gray-900"/>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Senha / App Key</label>
                        <input type="password" name="smtpPass" value={localSettings.smtpPass} onChange={handleSmtpChange} placeholder="••••••••" className="w-full border p-2 rounded text-sm bg-white text-gray-900"/>
                    </div>

                    {smtpStatus === 'success' && (
                        <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 p-2 rounded border border-green-200">
                            <CheckCircle2 className="w-4 h-4" /> Conexão SMTP Verificada!
                        </div>
                    )}
                     {smtpStatus === 'error' && (
                        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded border border-red-200">
                            <AlertTriangle className="w-4 h-4" /> Falha na conexão. Verifique dados.
                        </div>
                    )}

                </div>
                <div className="p-4 bg-gray-50 flex justify-between items-center border-t border-gray-100">
                    <button 
                        onClick={testSmtp}
                        disabled={smtpStatus === 'testing'}
                        className="text-indigo-600 text-xs font-bold hover:underline flex items-center gap-1"
                    >
                         {smtpStatus === 'testing' && <RefreshCw className="w-3 h-3 animate-spin"/>} Testar Conexão
                    </button>
                    <button 
                        onClick={() => { setShowSmtpModal(false); if(updateSettings) updateSettings(localSettings); }}
                        className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-black"
                    >
                        Salvar Configuração
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default EmailAutomation;
