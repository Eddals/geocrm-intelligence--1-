
import React, { useState } from 'react';
import { PipelineStage, Lead } from '../types';
import { rankLeadsForEmailCampaign } from '../services/geminiService';
import { rankLeadsForEmailCampaign as rankLeadsOpenAI } from '../services/openaiService';
import { generateWhatsappMessage } from '../services/perplexityService';
import { MoreHorizontal, Plus, Phone, Mail, MapPin, Edit, Trash2, ArrowRightCircle, Download, Save, X, Building, User, DollarSign, Bot, Target, MessageSquare, Send, Sparkles, Loader2, ChevronDown, ChevronUp, FileText, Clock, FileClock, AlertTriangle, AlertOctagon, Briefcase, MessageCircle } from 'lucide-react';

interface PipelineProps {
  leads: Lead[];
  updateLeadStatus: (id: string, status: PipelineStage) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  enrichLead: (id: string) => void;
  deleteLead: (id: string) => void;
  addNewLead: (lead: Partial<Lead>) => void;
  settings: AppSettings;
  openAiKey?: string;
  notify?: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

const Pipeline: React.FC<PipelineProps> = ({ leads, updateLeadStatus, updateLead, enrichLead, deleteLead, addNewLead, settings, openAiKey, notify }) => {
  const stages = Object.values(PipelineStage);
  const WIP_LIMITS: Partial<Record<PipelineStage, number>> = {
    [PipelineStage.CONTACT]: 6,
    [PipelineStage.ANALYSIS]: 8,
    [PipelineStage.WAITING]: 6
  };
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  
  // Validation State
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Edit Modal State
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState<Partial<Lead>>({});

  // Email Campaign Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recommendedLeads, setRecommendedLeads] = useState<{lead: Lead, reason: string}[]>([]);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);
  const [whatsLead, setWhatsLead] = useState<Lead | null>(null);
  const [whatsLang, setWhatsLang] = useState<'pt' | 'en'>('pt');
  const [whatsTone, setWhatsTone] = useState<'consultivo' | 'direto' | 'amigavel' | 'urgente'>('consultivo');
  const [whatsMessage, setWhatsMessage] = useState('');
  const [isGeneratingWhats, setIsGeneratingWhats] = useState(false);

  // Create Modal State
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<Partial<Lead>>({
      company: '',
      name: '',
      email: '',
      phone: '',
      value: undefined,
      city: '',
      status: PipelineStage.NEW,
      contactRole: '',
      tags: []
  });
  const [isIndustryOpen, setIsIndustryOpen] = useState(false);

  const INDUSTRY_OPTIONS = [
    "Construção",
    "Limpeza Comercial",
    "Agência / Marketing",
    "Tecnologia / SaaS",
    "Saúde e Clínicas",
    "Imobiliário",
    "Educação"
  ];

  // Helper to prevent showing "null" string
  const hasData = (val: string | null | undefined) => {
      return val && val !== 'null' && val !== 'undefined' && val !== '';
  };

  const isWhatsappNumber = (phone?: string | null) => {
      if (!hasData(phone)) return false;
      const digits = `${phone}`.replace(/\D/g, '');
      return digits.length >= 10;
  };

  const BRL_TO_USD = 5.2;
  const isBrazilLead = (lead: Partial<Lead>) => {
      const phone = lead.phone || '';
      const city = (lead.city || '').toLowerCase();
      return phone.replace(/\D/g, '').startsWith('55') || city.includes('brasil') || city.includes('brazil') || city.includes('rio') || city.includes('são') || city.includes('sao');
  };
  const formatUSD = (val: number) => val.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const formatBRL = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const leadValueUSD = (lead: Lead) => {
      const v = Number(lead.value) || 0;
      return isBrazilLead(lead) ? v / BRL_TO_USD : v;
  };

  const displayValue = (val: string | null | undefined, fallback: string) => {
      return hasData(val) ? val : fallback;
  };

  const validateLeadForm = (data: Partial<Lead>) => {
    const newErrors: Record<string, string> = {};
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!data.company?.trim()) {
        newErrors.company = "Nome da empresa é obrigatório";
    }

    if (data.email && hasData(data.email) && !emailRegex.test(data.email)) {
        newErrors.email = "Formato de email inválido";
    }

    if (data.value !== undefined && data.value < 0) {
        newErrors.value = "O valor não pode ser negativo";
    }

    return newErrors;
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault();
    if (!draggedLeadId) return;

    const stageCount = leads.filter(l => l.status === stage).length;
    const limit = WIP_LIMITS[stage] || Infinity;
    if (stageCount >= limit) {
        notify?.(`Limite de WIP atingido em ${stage}. Conclua ou mova leads antes de adicionar mais.`, 'warning');
        return;
    }
    updateLeadStatus(draggedLeadId, stage);
    setDraggedLeadId(null);
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedLeadId(expandedLeadId === id ? null : id);
  };

  const exportToCSV = () => {
      // Define headers
      const headers = ['ID', 'Company', 'Contact Name', 'Email', 'Phone', 'City', 'Status', 'Value', 'Source', 'Priority', 'Role', 'Notes'];
      
      // Map leads to CSV rows
      const rows = leads.map(l => [
          l.id,
          `"${l.company}"`,
          `"${l.name}"`,
          l.email || '',
          l.phone || '',
          l.city,
          l.status,
          l.value,
          l.source,
          l.leadPriority || '',
          l.contactRole || '',
          `"${l.notes || ''}"`
      ].join(','));

      const csvContent = "data:text/csv;charset=utf-8," 
          + headers.join(',') + "\n" 
          + rows.join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "geocrm_leads.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // --- Smart Email Logic ---
  const handleSmartEmailBlast = async () => {
      setShowEmailModal(true);
      setIsAnalyzing(true);
      setEmailSentSuccess(false);

      // Filter leads that have emails
      const leadsWithEmail = leads.filter(l => hasData(l.email));
      
      if (leadsWithEmail.length === 0) {
          setRecommendedLeads([]);
          setIsAnalyzing(false);
          return;
      }

      try {
          let recommendations;
          if (openAiKey) {
              recommendations = await rankLeadsOpenAI(leadsWithEmail, openAiKey);
          } else {
              recommendations = await rankLeadsForEmailCampaign(leadsWithEmail);
          }
          
          // Map back to full lead objects
          const fullData = recommendations.map(rec => {
              const lead = leads.find(l => l.id === rec.id);
              return lead ? { lead, reason: rec.reason } : null;
          }).filter(Boolean) as {lead: Lead, reason: string}[];

          setRecommendedLeads(fullData);

      } catch (error) {
          console.error("Failed to analyze leads", error);
          setRecommendedLeads([]);
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleConfirmSend = () => {
      // Simulate sending
      setTimeout(() => {
          setEmailSentSuccess(true);
          // Auto close after 2 seconds
          setTimeout(() => {
              setShowEmailModal(false);
          }, 2000);
      }, 1000);
  };


  // --- Edit Logic ---

  const openEditModal = (lead: Lead) => {
      setEditingLead(lead);
      setEditForm(lead);
      setOpenMenuId(null);
      setErrors({});
  };

  const handleEditSave = () => {
      if (editingLead && editForm) {
          const validationErrors = validateLeadForm(editForm);
          if (Object.keys(validationErrors).length > 0) {
              setErrors(validationErrors);
              return;
          }

          updateLead(editingLead.id, editForm);
          // Also update status if changed via dropdown
          if (editForm.status && editForm.status !== editingLead.status) {
              updateLeadStatus(editingLead.id, editForm.status);
          }
          setEditingLead(null);
          setErrors({});
      }
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
      setEditForm({ ...editForm, [e.target.name]: value });
      // Clear error when user types
      if (errors[e.target.name]) {
          setErrors({ ...errors, [e.target.name]: '' });
      }
  };

  const handleDelete = (id: string) => {
      // Removed confirm for faster action
      deleteLead(id);
      setOpenMenuId(null);
  };

  const openWhatsModal = async (lead: Lead) => {
      if (!lead.phone) return;
      setWhatsLead(lead);
      setWhatsMessage('');
      setIsGeneratingWhats(true);
      setWhatsLang('pt');
      setWhatsTone('consultivo');
      try {
          const msg = await generateWhatsappMessage(lead, settings, 'pt', 'consultivo');
          setWhatsMessage(msg);
      } catch (e: any) {
          notify?.(`Erro ao gerar mensagem: ${e.message || e}`, 'warning');
      } finally {
          setIsGeneratingWhats(false);
      }
  };

  const regenerateWhats = async (lang: 'pt' | 'en', tone?: 'consultivo' | 'direto' | 'amigavel' | 'urgente') => {
      if (!whatsLead) return;
      setIsGeneratingWhats(true);
      setWhatsLang(lang);
      if (tone) setWhatsTone(tone);
      try {
          const msg = await generateWhatsappMessage(whatsLead, settings, lang, tone || whatsTone);
          setWhatsMessage(msg);
      } catch (e: any) {
          notify?.(`Erro ao gerar mensagem: ${e.message || e}`, 'warning');
      } finally {
          setIsGeneratingWhats(false);
      }
  };

  const sendWhatsApp = () => {
      if (!whatsLead || !whatsLead.phone || !whatsMessage) return;
      const digits = (whatsLead.phone || '').replace(/\D/g, '');
      const url = `https://wa.me/${digits}?text=${encodeURIComponent(whatsMessage)}`;
      window.open(url, '_blank');
  };

  const openLeadInMaps = (lead: Lead) => {
      if (lead.mapsUri) {
          window.open(lead.mapsUri, '_blank');
          return;
      }
      if (lead.lat && lead.lng) {
          window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lead.lat},${lead.lng}`)}`, '_blank');
          return;
      }
      const query = lead.company || lead.name || lead.address;
      if (query) {
          window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${query} ${lead.address || ''}`)}`, '_blank');
      }
  };

  const handleNoteChange = (id: string, newNote: string) => {
      // Update local state is handled by the textarea default behavior,
      // we just need to save it to the app state on blur.
      updateLead(id, { notes: newNote });
  };

  // --- Create Logic ---

  const handleCreateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.type === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value;
      setCreateForm({ ...createForm, [e.target.name]: value });
       // Clear error when user types
       if (errors[e.target.name]) {
          setErrors({ ...errors, [e.target.name]: '' });
      }
  };

  const handleCreateSubmit = () => {
      const validationErrors = validateLeadForm(createForm);
      if (Object.keys(validationErrors).length > 0) {
          setErrors(validationErrors);
          return;
      }

      addNewLead({ ...createForm, value: createForm.value ?? 0 });
      setIsCreating(false);
      setErrors({});
      setCreateForm({
          company: '',
          name: '',
          email: '',
          phone: '',
          value: undefined,
          city: '',
          status: PipelineStage.NEW,
          contactRole: '',
          tags: []
      });
      setIsIndustryOpen(false);
  };


  const getStageColor = (stage: PipelineStage) => {
    switch (stage) {
      case PipelineStage.NEW:
        return 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-slate-800/70 dark:border-slate-700 dark:text-slate-100';
      case PipelineStage.QUALIFIED:
        return 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-slate-800/70 dark:border-slate-700 dark:text-slate-100';
      case PipelineStage.CLOSED:
        return 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-slate-800/70 dark:border-slate-700 dark:text-slate-100';
      case PipelineStage.LOST:
        return 'bg-red-50 border-red-200 text-red-700 dark:bg-slate-800/70 dark:border-slate-700 dark:text-slate-100';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-slate-800/70 dark:border-slate-700 dark:text-slate-200';
    }
  };

  const getPriorityColor = (priority?: string) => {
      switch(priority) {
          case 'High': return 'bg-rose-100 text-rose-700 border-rose-200';
          case 'Medium': return 'bg-amber-100 text-amber-700 border-amber-200';
          case 'Low': return 'bg-slate-100 text-slate-600 border-slate-200';
          default: return 'hidden';
      }
  };

  const getRiskFlags = (lead: Lead) => {
      const now = new Date().getTime();
      const lastTouch = lead.lastContact ? new Date(lead.lastContact).getTime() : new Date(lead.createdAt).getTime();
      const days = Math.floor((now - lastTouch) / (1000 * 60 * 60 * 24));
      const stale = days >= 7;
      const noOwner = !hasData(lead.contactRole);
      const noContact = !hasData(lead.email) && !hasData(lead.phone);
      return { stale, noOwner, noContact, days };
  };

  const priorityRank = (p?: string) => p === 'High' ? 3 : p === 'Medium' ? 2 : p === 'Low' ? 1 : 0;

  return (
    <div className="flex flex-col min-h-full">
        <header className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-slate-100">Pipeline de Vendas</h2>
                <p className="text-gray-500 dark:text-slate-400 text-xs">Gerencie seus leads arrastando os cards.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
                <button 
                    onClick={exportToCSV}
                    className="glass-purple text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all"
                >
                    <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button 
                    onClick={() => { setIsCreating(true); setErrors({}); }}
                    className="glass-purple text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all"
                >
                    <Plus className="w-3.5 h-3.5" /> Novo Lead
                </button>
            </div>
        </header>

        {/* Changed from overflow-x-auto flex to Grid for multi-row layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-10">
            {stages.map((stage) => {
            const stageLeads = leads
              .filter(l => l.status === stage)
              .sort((a, b) => priorityRank(b.leadPriority) - priorityRank(a.leadPriority) || b.value - a.value);
            
            return (
                <div 
                    key={stage}
                    className="flex flex-col rounded-2xl glass-panel h-fit backdrop-blur relative overflow-hidden"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, stage)}
                >
                    <div
                      aria-hidden
                      className="absolute inset-0 opacity-30 pointer-events-none bg-[linear-gradient(to_right,rgba(34,197,94,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,197,94,0.12)_1px,transparent_1px)] bg-[size:14px_14px]"
                    />
                    <div className="relative z-10">
                      {/* Compact Column Header */}
                      <div className={`p-2 border-b border-gray-200/50 dark:border-slate-700 rounded-t-xl flex justify-between items-center ${getStageColor(stage)} dark:text-slate-200`}>
                          <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full ${stage === PipelineStage.CLOSED ? 'bg-emerald-500' : 'bg-indigo-400'}`}></span>
                              <h3 className="font-semibold text-gray-700 dark:text-slate-100 text-xs uppercase tracking-wide">{stage}</h3>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-bold bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded text-gray-500 dark:text-slate-200 shadow-sm border border-gray-100 dark:border-slate-700">
                                {stageLeads.length}
                            </span>
                            {WIP_LIMITS[stage] && (
                              <span className="text-[9px] text-amber-600 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-400/40 rounded px-1">
                                  WIP {stageLeads.length}/{WIP_LIMITS[stage]}
                              </span>
                            )}
                          </div>
                      </div>

                      {/* Drop Zone / List */}
                      <div className="p-2 space-y-2 min-h-[160px] max-h-[65vh] overflow-y-auto custom-scrollbar kanban-scroll pr-1">
                          {stageLeads.map((lead) => (
                            <div
                                key={lead.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, lead.id)}
                                className="cursor-grab active:cursor-grabbing rounded-xl border border-white/15 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(168,85,247,0.12),transparent_55%),linear-gradient(145deg,rgba(14,19,36,0.95),rgba(19,28,52,0.9))] backdrop-blur-xl p-3 shadow-[0_12px_35px_rgba(0,0,0,0.32)] hover:shadow-[0_16px_40px_rgba(88,28,135,0.35)] transition-all group relative"
                                style={{ zIndex: openMenuId === lead.id ? 50 : 'auto' }}
                            >
                                <div className="flex justify-between items-start mb-1.5 relative">
                                    <div className="flex-1 pr-2">
                                        {lead.leadPriority && (
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full mb-1 inline-block border backdrop-blur ${getPriorityColor(lead.leadPriority)} bg-white/5`}>
                                                {lead.leadPriority === 'High' ? '🔥 Alta' : lead.leadPriority === 'Medium' ? '⚠️ Média' : '💤 Baixa'}
                                            </span>
                                        )}
                                <h4 className="font-extrabold text-slate-50 text-sm leading-tight break-words whitespace-normal tracking-tight" title={lead.company}>{lead.company}</h4>
                                    </div>
                                    <div className="relative shrink-0 flex gap-1 items-center">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); openLeadInMaps(lead); }}
                                            className="text-slate-300 hover:text-emerald-400 hover:bg-white/10 p-1 rounded transition-colors"
                                            title="Abrir no Google Maps"
                                        >
                                            <MapPin className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => toggleExpand(lead.id, e)}
                                            className="text-slate-300 hover:text-indigo-300 hover:bg-white/10 p-1 rounded transition-colors"
                                            title="Expandir Notas e Histórico"
                                        >
                                            {expandedLeadId === lead.id ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                        <div className="hidden sm:block">
                                          <button 
                                              onClick={(e) => {
                                                  e.stopPropagation();
                                                  setOpenMenuId(openMenuId === lead.id ? null : lead.id);
                                              }}
                                              className="text-slate-300 hover:text-white hover:bg-white/10 p-1 rounded transition-colors"
                                              aria-label="Mais opções"
                                          >
                                              <MoreHorizontal className="w-4 h-4" />
                                          </button>

                                          {openMenuId === lead.id && (
                                              <>
                                                  <div 
                                                      className="fixed inset-0 z-40" 
                                                      onClick={(e) => {
                                                          e.stopPropagation();
                                                          setOpenMenuId(null);
                                                      }} 
                                                  />
                                                  <div className="absolute right-0 top-6 w-32 bg-slate-900 text-slate-100 rounded-lg shadow-xl border border-white/10 z-50 py-1 animate-in fade-in zoom-in-95 duration-100 backdrop-blur">
                                                      <button 
                                                          onClick={(e) => { e.stopPropagation(); openEditModal(lead); }}
                                                          className="w-full text-left px-3 py-2 text-xs hover:bg-white/10 flex items-center gap-2 transition-colors"
                                                      >
                                                          <Edit className="w-3 h-3 text-indigo-200" /> Editar
                                                      </button>
                                                      <div className="border-t border-white/10 my-1"></div>
                                                      <button 
                                                          onClick={(e) => { e.stopPropagation(); handleDelete(lead.id); }}
                                                          className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-900/40 flex items-center gap-2 transition-colors"
                                                      >
                                                          <Trash2 className="w-3 h-3 text-red-300" /> Excluir
                                                      </button>
                                                  </div>
                                              </>
                                          )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-1 text-[10px] text-indigo-200 font-semibold mb-1 whitespace-normal break-words">
                                    <User className="w-3 h-3" /> 
                                    {displayValue(lead.contactRole, 'Cargo não identificado')}
                                    {lead.name && lead.name !== 'Gerente' && hasData(lead.name) && (
                                        <span className="text-slate-400 font-normal"> - {lead.name}</span>
                                    )}
                                </div>

                                <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-2 whitespace-normal break-words">
                                    <MapPin className="w-3 h-3" />
                                    {displayValue(lead.city, 'Localização não encontrada')}
                                </div>

                                {/* Mini Actions / Contacts */}
                                <div className="flex gap-1 mb-2">
                                    {hasData(lead.email) && (
                                        <div title={`Email: ${lead.email}`} className="p-1 bg-blue-500/15 text-blue-200 rounded opacity-75 group-hover:opacity-100 transition-opacity border border-blue-400/30">
                                            <Mail className="w-3 h-3" />
                                        </div>
                                    )}
                                    {hasData(lead.phone) && (
                                        <>
                                          <div title={`Telefone: ${lead.phone}`} className="p-1 bg-emerald-500/15 text-emerald-200 rounded opacity-75 group-hover:opacity-100 transition-opacity border border-emerald-400/30">
                                              <Phone className="w-3 h-3" />
                                          </div>
                                          {isWhatsappNumber(lead.phone) && (
                                            <div title="Verificado no WhatsApp" className="p-1 bg-emerald-500/20 text-emerald-200 rounded opacity-75 group-hover:opacity-100 transition-opacity border border-emerald-400/40">
                                                <MessageCircle className="w-3 h-3" />
                                            </div>
                                          )}
                                          <button
                                            onClick={(e) => { e.stopPropagation(); openWhatsModal(lead); }}
                                            className="p-1 bg-emerald-500/20 text-emerald-100 rounded opacity-85 hover:opacity-100 transition-opacity border border-emerald-400/40"
                                            title="Gerar e enviar mensagem no WhatsApp"
                                          >
                                            <MessageCircle className="w-3 h-3" />
                                          </button>
                                        </>
                                    )}
                                {hasData(lead.approachMessage) && (
                                    <div title="Mensagem Gerada pela IA" className="p-1 bg-purple-500/15 text-purple-200 rounded opacity-75 group-hover:opacity-100 transition-opacity border border-purple-400/30">
                                        <MessageSquare className="w-3 h-3" />
                                    </div>
                                )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleNoteChange(lead.id, `${lead.notes || ''}\nPróxima ação marcada.`); }}
                                        className="p-1 bg-white/5 text-slate-200 rounded opacity-75 hover:opacity-100 transition-opacity text-[9px] flex items-center gap-1 border border-white/10"
                                        title="Adicionar próxima ação"
                                    >
                                        <Clock className="w-3 h-3" /> Próxima tarefa
                                    </button>
                                </div>

                                {/* Mobile actions */}
                                <div className="flex sm:hidden gap-2 mt-2">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); openEditModal(lead); }}
                                        className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100"
                                    >
                                        Editar
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDelete(lead.id); }}
                                        className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-700 border border-red-100"
                                    >
                                        Excluir
                                    </button>
                                </div>
                                
                                <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-emerald-100 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-400/40">
                                            {formatUSD(leadValueUSD(lead))}
                                        </span>
                                        {isBrazilLead(lead) && (
                                          <span className="text-[9px] text-slate-400">{formatBRL(Number(lead.value) || 0)}</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {!lead.enriched && (
                                            <button 
                                            onClick={() => enrichLead(lead.id)}
                                            className="text-[9px] bg-indigo-500/15 text-indigo-100 px-2 py-0.5 rounded-full hover:bg-indigo-500/25 font-medium flex items-center gap-1 border border-indigo-400/30"
                                            >
                                            <Bot className="w-3 h-3" /> Enriquecer
                                            </button>
                                        )}
                                        {lead.enriched && (
                                            <span className="text-[9px] text-indigo-200 flex items-center gap-0.5">
                                                <Bot className="w-3 h-3" /> IA check
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Missing Data Alert */}
                                {(() => {
                                    const risk = getRiskFlags(lead);
                                    const alerts: JSX.Element[] = [];
                                    if (!hasData(lead.email) && !hasData(lead.phone)) {
                                        alerts.push(
                                            <div key="contact" className="mt-2 bg-red-500/10 border border-red-400/30 rounded p-1.5 flex items-start gap-1.5">
                                                <AlertOctagon className="w-3 h-3 text-red-300 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-[9px] font-bold text-red-200 leading-none mb-0.5">Dados insuficientes</p>
                                                    <p className="text-[8px] text-red-200/80 leading-tight">Contato não encontrado. Baixa chance de conversão.</p>
                                                </div>
                                            </div>
                                        );
                                    }
                                    if (risk.stale) {
                                        alerts.push(
                                            <div key="stale" className="mt-2 bg-amber-500/10 border border-amber-400/30 rounded p-1.5 flex items-start gap-1.5">
                                                <AlertTriangle className="w-3 h-3 text-amber-200 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-[9px] font-bold text-amber-100 leading-none mb-0.5">Sem contato há {risk.days}d</p>
                                                    <p className="text-[8px] text-amber-100/80 leading-tight">Faça um follow-up rápido.</p>
                                                </div>
                                            </div>
                                        );
                                    }
                                    if (risk.noOwner) {
                                        alerts.push(
                                            <div key="owner" className="mt-2 bg-blue-500/10 border border-blue-400/30 rounded p-1.5 flex items-start gap-1.5">
                                                <AlertTriangle className="w-3 h-3 text-blue-200 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-[9px] font-bold text-blue-100 leading-none mb-0.5">Sem dono definido</p>
                                                    <p className="text-[8px] text-blue-100/80 leading-tight">Atribua um responsável.</p>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return alerts;
                                })()}

                                {/* Expanded Content: Notes & History */}
                                {expandedLeadId === lead.id && (
                                    <div className="mt-3 pt-3 border-t border-white/10 bg-white/5 -mx-3 px-3 pb-2 rounded-b-lg">
                                        <div className="mb-3">
                                            <label className="text-[10px] font-bold text-indigo-200 uppercase flex items-center gap-1 mb-1">
                                                <FileText className="w-3 h-3" /> Notas
                                            </label>
                                            <textarea 
                                                className="w-full text-xs p-2 border border-white/15 rounded-lg bg-white/5 text-slate-100 focus:outline-none focus:border-indigo-400 resize-none h-20"
                                                defaultValue={lead.notes}
                                                placeholder="Adicione observações..."
                                                onBlur={(e) => handleNoteChange(lead.id, e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-indigo-200 uppercase flex items-center gap-1 mb-2">
                                                <FileClock className="w-3 h-3" /> Histórico
                                            </label>
                                            <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                                                {lead.history && lead.history.length > 0 ? (
                                                    [...lead.history].reverse().map((item, idx) => (
                                                        <div key={idx} className="flex gap-2 items-start text-[10px] text-slate-200">
                                                            <div className="mt-0.5 min-w-[6px] h-1.5 rounded-full bg-indigo-300 shrink-0 shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"></div>
                                                            <div>
                                                                <p className="text-slate-200 leading-tight">{item.description}</p>
                                                                <p className="text-slate-400 text-[9px]">
                                                                    {new Date(item.date).toLocaleDateString('pt-BR')} {new Date(item.date).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p className="text-[10px] text-gray-400 italic">Sem histórico registrado.</p>
                                                )}
                                                <div className="flex gap-2 items-start text-[10px]">
                                                    <div className="mt-0.5 min-w-[6px] h-1.5 rounded-full bg-gray-300 shrink-0"></div>
                                                    <div>
                                                        <p className="text-gray-500">Lead Criado</p>
                                                        <p className="text-gray-400 text-[9px]">{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                          ))}
                      </div>
                    </div>
                </div>
            );
            })}
        </div>

        {/* AI Email Blast Modal */}
        {showEmailModal && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-indigo-600 text-white">
                        <div>
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-indigo-200" />
                                Disparo Inteligente IA
                            </h3>
                            <p className="text-xs text-indigo-100 opacity-90">A IA seleciona os melhores leads para contato.</p>
                        </div>
                        <button onClick={() => setShowEmailModal(false)} className="text-white/70 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="p-0 min-h-[300px] max-h-[60vh] overflow-y-auto bg-gray-50">
                        {isAnalyzing ? (
                            <div className="flex flex-col items-center justify-center h-[300px] space-y-4">
                                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                                <div className="text-center">
                                    <p className="font-semibold text-gray-800">Analisando seus leads...</p>
                                    <p className="text-sm text-gray-500">Calculando probabilidade de conversão com {openAiKey ? 'GPT-4' : 'Gemini'}</p>
                                </div>
                            </div>
                        ) : emailSentSuccess ? (
                            <div className="flex flex-col items-center justify-center h-[300px] space-y-4 animate-in zoom-in-95">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                                    <Send className="w-8 h-8 text-green-600" />
                                </div>
                                <div className="text-center">
                                    <h4 className="text-xl font-bold text-gray-800">Emails Enviados!</h4>
                                    <p className="text-gray-500">A campanha foi iniciada com sucesso.</p>
                                </div>
                            </div>
                        ) : recommendedLeads.length > 0 ? (
                            <div className="p-6 space-y-4">
                                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg text-sm text-blue-700 flex gap-3">
                                    <Bot className="w-5 h-5 shrink-0" />
                                    <p>Selecionei estes {recommendedLeads.length} leads com base no perfil, valor e setor. Eles têm a maior chance de resposta hoje.</p>
                                </div>
                                
                                <div className="space-y-3">
                                    {recommendedLeads.map(({lead, reason}, idx) => (
                                        <div key={lead.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center group hover:border-indigo-300 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 text-xs">
                                                    #{idx + 1}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-gray-800">{lead.company}</h4>
                                                    <p className="text-xs text-gray-500">{lead.email}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                 <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                                    $ {lead.value.toLocaleString()}
                                                </span>
                                                <p className="text-xs text-indigo-600 mt-1 italic max-w-[200px] text-right">
                                                    "{reason}"
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-[300px] text-center p-6">
                                <Mail className="w-12 h-12 text-gray-300 mb-2" />
                                <p className="text-gray-600 font-medium">Nenhum lead com email encontrado.</p>
                                <p className="text-gray-400 text-sm">Adicione emails aos seus leads para usar esta função.</p>
                            </div>
                        )}
                    </div>

                    {!isAnalyzing && !emailSentSuccess && recommendedLeads.length > 0 && (
                        <div className="p-5 border-t border-gray-200 bg-white flex justify-end gap-3">
                             <button 
                                onClick={() => setShowEmailModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleConfirmSend}
                                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm"
                            >
                                <Send className="w-4 h-4" /> Disparar Campanha
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Edit Modal */}
        {editingLead && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                <div className="glass-panel bg-white/90 dark:bg-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto border border-white/50 dark:border-white/10">
                    <div className="px-6 py-4 border-b border-gray-100 dark:border-white/10 flex justify-between items-center bg-gray-50/80 dark:bg-white/5 sticky top-0 z-10 backdrop-blur">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">Editar Lead</h3>
                        <button onClick={() => setEditingLead(null)} className="text-gray-400 hover:text-gray-600 dark:text-slate-300 dark:hover:text-white bg-transparent p-1 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empresa *</label>
                                <input 
                                    name="company" 
                                    value={editForm.company || ''} 
                                    onChange={handleEditChange}
                                    className={`w-full px-3 py-2 border ${errors.company ? 'border-red-500' : 'border-white/30 dark:border-white/20'} rounded-lg text-sm bg-white/40 dark:bg-white/5 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none placeholder-gray-400 dark:placeholder-slate-400`}
                                />
                                {errors.company && <p className="text-xs text-red-500 mt-1">{errors.company}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor ($)</label>
                                <input 
                                    name="value" 
                                    type="number" 
                                    value={editForm.value || 0} 
                                    onChange={handleEditChange}
                                    className={`w-full px-3 py-2 border ${errors.value ? 'border-red-500' : 'border-white/30 dark:border-white/20'} rounded-lg text-sm bg-white/40 dark:bg-white/5 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none placeholder-gray-400 dark:placeholder-slate-400`}
                                />
                                {errors.value && <p className="text-xs text-red-500 mt-1">{errors.value}</p>}
                            </div>
                        </div>
                         <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estágio do Pipeline</label>
                            <select 
                                name="status" 
                                value={editForm.status} 
                                onChange={handleEditChange}
                                className="w-full px-3 py-2 border border-white/30 dark:border-white/20 rounded-lg text-sm bg-white/40 dark:bg-white/5 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                {Object.values(PipelineStage).map(stage => (
                                    <option key={stage} value={stage}>{stage}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                                <input 
                                    name="email" 
                                    value={displayValue(editForm.email, '')} 
                                    onChange={handleEditChange}
                                    className={`w-full px-3 py-2 border ${errors.email ? 'border-red-500' : 'border-white/30 dark:border-white/20'} rounded-lg text-sm bg-white/40 dark:bg-white/5 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none placeholder-gray-400 dark:placeholder-slate-400`}
                                />
                                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone</label>
                                <input 
                                    name="phone" 
                                    value={displayValue(editForm.phone, '')} 
                                    onChange={handleEditChange}
                                    className="w-full px-3 py-2 border border-white/30 dark:border-white/20 rounded-lg text-sm bg-white/40 dark:bg-white/5 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none placeholder-gray-400 dark:placeholder-slate-400" 
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cidade</label>
                            <input 
                                name="city" 
                                value={displayValue(editForm.city, '')} 
                                onChange={handleEditChange}
                                className="w-full px-3 py-2 border border-white/30 dark:border-white/20 rounded-lg text-sm bg-white/40 dark:bg-white/5 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none placeholder-gray-400 dark:placeholder-slate-400" 
                            />
                        </div>

                        {/* AI Insights Section in Modal */}
                        {(editForm.contactRole || editForm.approachMessage) && (
                            <div className="glass-panel bg-white/10 dark:bg-white/5 p-4 rounded-lg border border-indigo-100/60 dark:border-white/10 space-y-3">
                                <h4 className="font-bold text-indigo-800 dark:text-indigo-200 text-sm flex items-center gap-2">
                                    <Bot className="w-4 h-4 text-indigo-600 dark:text-indigo-300" /> Insights da IA
                                </h4>
                                
                                {hasData(editForm.contactRole) && (
                                    <div>
                                        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-200 uppercase">Cargo Provável</p>
                                        <p className="text-sm text-gray-700 dark:text-slate-100">{editForm.contactRole}</p>
                                    </div>
                                )}
                                
                                {hasData(editForm.approachMessage) && (
                                    <div>
                                        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-200 uppercase">Sugestão de Abordagem</p>
                                        <p className="text-sm text-gray-700 dark:text-slate-100 italic">"{editForm.approachMessage}"</p>
                                    </div>
                                )}

                                {editForm.leadPriority && (
                                    <div>
                                        <p className="text-xs font-bold text-indigo-600 dark:text-indigo-200 uppercase">Prioridade</p>
                                        <span className={`text-xs px-2 py-0.5 rounded border ${getPriorityColor(editForm.leadPriority)}`}>
                                            {editForm.leadPriority}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="px-6 py-4 bg-gray-50/80 dark:bg-white/5 flex justify-end gap-2 sticky bottom-0 z-10 border-t border-gray-200 dark:border-white/10 backdrop-blur">
                        <button 
                            onClick={() => setEditingLead(null)} 
                            className="px-4 py-2 text-gray-600 dark:text-slate-200 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleEditSave} 
                            className="glass-purple px-4 py-2 text-white hover:brightness-110 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
                        >
                            <Save className="w-4 h-4" /> Salvar Alterações
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Create Modal */}
        {isCreating && (
             <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
                <div className="glass-panel rounded-2xl w-full max-w-lg overflow-hidden bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.08),transparent_50%),radial-gradient(circle_at_80%_30%,rgba(180,129,255,0.14),transparent_55%),rgba(12,10,29,0.92)]">
                    <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/10">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-slate-100">Novo Lead</h3>
                        <button onClick={() => setIsCreating(false)} className="text-gray-300 hover:text-white bg-transparent p-1 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empresa *</label>
                            <div className="relative">
                                <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input 
                                    name="company" 
                                    value={createForm.company || ''} 
                                    onChange={handleCreateChange}
                                    className={`w-full pl-10 pr-3 py-2 rounded-lg text-sm bg-white/10 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-gray-500 ${errors.company ? 'border border-red-500' : 'border border-white/15'}`}
                                    placeholder="Nome da empresa"
                                    required
                                />
                            </div>
                            {errors.company && <p className="text-xs text-red-500 mt-1">{errors.company}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Setor / Indústria</label>
                                <div className="relative" onClick={() => setIsIndustryOpen(!isIndustryOpen)}>
                                    <Target className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4 pointer-events-none z-10" />
                                    <button
                                        type="button"
                                        className="w-full pl-10 pr-9 py-2 border border-white/15 rounded-lg text-sm bg-white/10 dark:bg-slate-900/70 text-gray-900 dark:text-slate-100 text-left focus:ring-2 focus:ring-indigo-500 outline-none flex justify-between items-center backdrop-blur transition-colors"
                                    >
                                        <span className={createForm.tags && createForm.tags[0] ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-400'}>
                                            {createForm.tags && createForm.tags[0] ? createForm.tags[0] : 'Selecione a indústria'}
                                        </span>
                                        <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3" />
                                    </button>
                                    {isIndustryOpen && (
                                        <div className="absolute top-full left-0 w-full mt-1 bg-white/95 dark:bg-slate-900/95 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl z-50 max-h-56 overflow-y-auto custom-scrollbar">
                                            {INDUSTRY_OPTIONS.map(opt => (
                                                <div
                                                    key={opt}
                                                    onClick={() => { setCreateForm(prev => ({ ...prev, tags: [opt] })); setIsIndustryOpen(false); }}
                                                    className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                                                        createForm.tags && createForm.tags[0] === opt
                                                        ? 'bg-indigo-50 text-indigo-700 font-semibold dark:bg-indigo-950 dark:text-indigo-100'
                                                        : 'text-gray-700 dark:text-slate-100 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-900/40 dark:hover:text-white'
                                                    }`}
                                                >
                                                    {opt}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                             </div>
                             <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cargo</label>
                                <div className="relative">
                                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input 
                                        name="contactRole" 
                                        value={createForm.contactRole || ''} 
                                        onChange={handleCreateChange}
                                    className="w-full pl-10 pr-3 py-2 border border-white/15 rounded-lg text-sm bg-white/10 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-gray-500" 
                                    placeholder="Dono, Gerente..."
                                />
                             </div>
                             </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Contato *</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input 
                                        name="name" 
                                        value={createForm.name || ''} 
                                        onChange={handleCreateChange}
                                    className="w-full pl-10 pr-3 py-2 border border-white/15 rounded-lg text-sm bg-white/10 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-gray-500" 
                                    placeholder="João Silva"
                                    required
                                />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor ($)</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input 
                                        name="value" 
                                        type="number" 
                                        inputMode="numeric"
                                        min={0}
                                        value={createForm.value ?? ''} 
                                        onChange={handleCreateChange}
                                    className={`w-full pl-10 pr-3 py-2 rounded-lg text-sm bg-white/10 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-gray-500 ${errors.value ? 'border border-red-500' : 'border border-white/15'}`}
                                />
                                </div>
                                {errors.value && <p className="text-xs text-red-500 mt-1">{errors.value}</p>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                                <input 
                                    name="email" 
                                    value={createForm.email || ''} 
                                    onChange={handleCreateChange}
                                    className={`w-full px-3 py-2 rounded-lg text-sm bg-white/10 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-gray-500 ${errors.email ? 'border border-red-500' : 'border border-white/15'}`}
                                    placeholder="contato@empresa.com"
                                />
                                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone *</label>
                                <input 
                                    name="phone" 
                                    value={createForm.phone || ''} 
                                    onChange={handleCreateChange}
                                    className="w-full px-3 py-2 border border-white/15 rounded-lg text-sm bg-white/10 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-gray-500" 
                                    placeholder="(00) 00000-0000"
                                    required
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cidade *</label>
                            <input 
                                name="city" 
                                value={createForm.city || ''} 
                                onChange={handleCreateChange}
                                className="w-full px-3 py-2 border border-white/15 rounded-lg text-sm bg-white/10 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-gray-500" 
                                placeholder="São Paulo"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estágio Inicial</label>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.values(PipelineStage).map(stage => (
                                    <button
                                        key={stage}
                                        type="button"
                                        onClick={() => setCreateForm({ ...createForm, status: stage })}
                                        className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 ${
                                            createForm.status === stage 
                                            ? 'glass-purple text-white border border-transparent' 
                                            : 'bg-white/10 border border-white/15 text-white/80 hover:bg-white/15'
                                        }`}
                                    >
                                        <span className="w-4 h-4 rounded-full bg-white/20 inline-flex items-center justify-center text-[10px] text-gray-900">
                                          {stage === PipelineStage.NEW ? 'N' :
                                           stage === PipelineStage.ANALYSIS ? 'A' :
                                           stage === PipelineStage.CONTACT ? 'C' :
                                           stage === PipelineStage.QUALIFIED ? 'Q' :
                                           stage === PipelineStage.WAITING ? 'W' :
                                           stage === PipelineStage.CLOSED ? 'F' : 'P'}
                                        </span>
                                        {stage}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2">
                        <button 
                            onClick={() => setIsCreating(false)} 
                            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleCreateSubmit} 
                            className="glass-purple px-4 py-2 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-all"
                        >
                            <Plus className="w-4 h-4" /> Criar Lead
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* WhatsApp Modal */}
        {whatsLead && (
          <div className="fixed inset-0 bg-black/40 z-[120] flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-lg w-full p-6 space-y-4">
                  <div className="flex items-start justify-between">
                      <div>
                          <p className="text-xs uppercase text-gray-500 font-bold mb-1">WhatsApp</p>
                          <h3 className="text-lg font-bold text-gray-800">{whatsLead.company || whatsLead.name}</h3>
                          <p className="text-sm text-gray-500">{whatsLead.phone}</p>
                      </div>
                      <button onClick={() => { setWhatsLead(null); setWhatsMessage(''); }} className="text-gray-400 hover:text-gray-600">
                          <X className="w-5 h-5" />
                      </button>
                  </div>

                <div className="flex gap-2">
                    <button
                      onClick={() => regenerateWhats('pt')}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border ${whatsLang === 'pt' ? 'border-indigo-500 text-indigo-600 bg-indigo-50' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                      disabled={isGeneratingWhats}
                    >
                      PT-BR
                    </button>
                    <button
                      onClick={() => regenerateWhats('en')}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border ${whatsLang === 'en' ? 'border-indigo-500 text-indigo-600 bg-indigo-50' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                      disabled={isGeneratingWhats}
                    >
                      English
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    {(['consultivo','direto','amigavel','urgente'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => regenerateWhats(whatsLang, t)}
                          className={`px-3 py-2 text-sm rounded-lg border ${whatsTone === t ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                          disabled={isGeneratingWhats}
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                    ))}
                </div>

                  <div className="min-h-[140px] border border-gray-200 rounded-lg p-3 bg-gray-50 text-sm text-gray-800">
                      {isGeneratingWhats ? (
                          <div className="flex items-center gap-2 text-gray-500">
                              <Loader2 className="w-4 h-4 animate-spin" /> Gerando mensagem...
                          </div>
                      ) : (
                          <textarea
                            value={whatsMessage}
                            onChange={(e) => setWhatsMessage(e.target.value)}
                            className="w-full h-32 bg-transparent outline-none resize-none"
                          />
                      )}
                  </div>

                  <div className="flex justify-end gap-2">
                      <button
                        onClick={() => { setWhatsLead(null); setWhatsMessage(''); }}
                        className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={sendWhatsApp}
                        disabled={!whatsMessage || isGeneratingWhats}
                        className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2"
                      >
                        <Send className="w-4 h-4" /> Enviar no WhatsApp
                      </button>
                  </div>
              </div>
          </div>
        )}
    </div>
  );
};

export default Pipeline;
