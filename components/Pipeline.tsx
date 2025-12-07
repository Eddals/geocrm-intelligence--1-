
import React, { useState } from 'react';
import { PipelineStage, Lead } from '../types';
import { rankLeadsForEmailCampaign } from '../services/geminiService';
import { rankLeadsForEmailCampaign as rankLeadsOpenAI } from '../services/openaiService';
import { MoreHorizontal, Plus, Phone, Mail, MapPin, Edit, Trash2, ArrowRightCircle, Download, Save, X, Building, User, DollarSign, Bot, Target, MessageSquare, Send, Sparkles, Loader2, ChevronDown, ChevronUp, FileText, Clock, FileClock, AlertTriangle, AlertOctagon } from 'lucide-react';

interface PipelineProps {
  leads: Lead[];
  updateLeadStatus: (id: string, status: PipelineStage) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  enrichLead: (id: string) => void;
  deleteLead: (id: string) => void;
  addNewLead: (lead: Partial<Lead>) => void;
  openAiKey?: string;
}

const Pipeline: React.FC<PipelineProps> = ({ leads, updateLeadStatus, updateLead, enrichLead, deleteLead, addNewLead, openAiKey }) => {
  const stages = Object.values(PipelineStage);
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

  // Create Modal State
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<Partial<Lead>>({
      company: '',
      name: '',
      email: '',
      phone: '',
      value: 0,
      city: '',
      status: PipelineStage.NEW
  });

  // Helper to prevent showing "null" string
  const hasData = (val: string | null | undefined) => {
      return val && val !== 'null' && val !== 'undefined' && val !== '';
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
    if (draggedLeadId) {
      updateLeadStatus(draggedLeadId, stage);
      setDraggedLeadId(null);
    }
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

  const handleNoteChange = (id: string, newNote: string) => {
      // Update local state is handled by the textarea default behavior,
      // we just need to save it to the app state on blur.
      updateLead(id, { notes: newNote });
  };

  // --- Create Logic ---

  const handleCreateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
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

      addNewLead(createForm);
      setIsCreating(false);
      setErrors({});
      setCreateForm({
          company: '',
          name: '',
          email: '',
          phone: '',
          value: 0,
          city: '',
          status: PipelineStage.NEW
      });
  };


  const getStageColor = (stage: PipelineStage) => {
    switch (stage) {
      case PipelineStage.NEW: return 'bg-blue-50 border-blue-200 text-blue-700';
      case PipelineStage.QUALIFIED: return 'bg-purple-50 border-purple-200 text-purple-700';
      case PipelineStage.CLOSED: return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case PipelineStage.LOST: return 'bg-red-50 border-red-200 text-red-700';
      default: return 'bg-gray-50 border-gray-200 text-gray-700';
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

  return (
    <div className="flex flex-col min-h-full">
        <header className="mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h2 className="text-xl font-bold text-gray-800">Pipeline de Vendas</h2>
                <p className="text-gray-500 text-xs">Gerencie seus leads arrastando os cards.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
                <button 
                    onClick={exportToCSV}
                    className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Download className="w-3.5 h-3.5" /> CSV
                </button>
                <button 
                    onClick={() => { setIsCreating(true); setErrors({}); }}
                    className="bg-gray-900 hover:bg-black text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Plus className="w-3.5 h-3.5" /> Novo Lead
                </button>
            </div>
        </header>

        {/* Changed from overflow-x-auto flex to Grid for multi-row layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-10">
            {stages.map((stage) => {
            const stageLeads = leads.filter(l => l.status === stage);
            
            return (
                <div 
                    key={stage}
                    className="flex flex-col rounded-xl bg-gray-100/50 border border-gray-200 h-fit"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, stage)}
                >
                    {/* Compact Column Header */}
                    <div className={`p-2 border-b border-gray-200/50 rounded-t-xl flex justify-between items-center ${getStageColor(stage).split(' ')[0]}`}>
                        <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${stage === PipelineStage.CLOSED ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
                            <h3 className="font-semibold text-gray-700 text-xs uppercase tracking-wide">{stage}</h3>
                        </div>
                        <span className="text-[10px] font-bold bg-white px-1.5 py-0.5 rounded text-gray-500 shadow-sm border border-gray-100">
                            {stageLeads.length}
                        </span>
                    </div>

                    {/* Drop Zone / List */}
                    <div className="p-2 space-y-2 min-h-[100px]">
                        {stageLeads.map((lead) => (
                            <div
                                key={lead.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, lead.id)}
                                className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 cursor-grab active:cursor-grabbing hover:shadow-md transition-all group relative"
                                style={{ zIndex: openMenuId === lead.id ? 50 : 'auto' }}
                            >
                                <div className="flex justify-between items-start mb-1.5 relative">
                                    <div className="flex-1 pr-2">
                                        {lead.leadPriority && (
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded mb-1 inline-block border ${getPriorityColor(lead.leadPriority)}`}>
                                                {lead.leadPriority === 'High' ? '🔥 Alta' : lead.leadPriority === 'Medium' ? '⚠️ Média' : '💤 Baixa'}
                                            </span>
                                        )}
                                        <h4 className="font-bold text-gray-800 text-sm leading-tight truncate" title={lead.company}>{lead.company}</h4>
                                    </div>
                                    <div className="relative shrink-0 flex gap-1">
                                        <button
                                            onClick={(e) => toggleExpand(lead.id, e)}
                                            className="text-gray-300 hover:text-indigo-600 hover:bg-gray-50 p-0.5 rounded transition-colors"
                                            title="Expandir Notas e Histórico"
                                        >
                                            {expandedLeadId === lead.id ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setOpenMenuId(openMenuId === lead.id ? null : lead.id);
                                            }}
                                            className="text-gray-300 hover:text-gray-600 hover:bg-gray-50 p-0.5 rounded transition-colors"
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
                                                <div className="absolute right-0 top-6 w-32 bg-white rounded-lg shadow-xl border border-gray-100 z-50 py-1 animate-in fade-in zoom-in-95 duration-100">
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); openEditModal(lead); }}
                                                        className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                                    >
                                                        <Edit className="w-3 h-3 text-gray-400" /> Editar
                                                    </button>
                                                    <div className="border-t border-gray-100 my-1"></div>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleDelete(lead.id); }}
                                                        className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                                    >
                                                        <Trash2 className="w-3 h-3 text-red-400" /> Excluir
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-1 text-[10px] text-indigo-600 font-medium mb-1 truncate">
                                    <User className="w-3 h-3" /> 
                                    {displayValue(lead.contactRole, 'Cargo não identificado')}
                                    {lead.name && lead.name !== 'Gerente' && hasData(lead.name) && (
                                        <span className="text-gray-500 font-normal"> - {lead.name}</span>
                                    )}
                                </div>

                                <div className="flex items-center gap-1 text-[10px] text-gray-500 mb-2 truncate">
                                    <MapPin className="w-3 h-3" />
                                    {displayValue(lead.city, 'Localização não encontrada')}
                                </div>

                                {/* Mini Actions / Contacts */}
                                <div className="flex gap-1 mb-2">
                                    {hasData(lead.email) && (
                                        <div title={`Email: ${lead.email}`} className="p-1 bg-blue-50 text-blue-600 rounded opacity-75 group-hover:opacity-100 transition-opacity">
                                            <Mail className="w-3 h-3" />
                                        </div>
                                    )}
                                    {hasData(lead.phone) && (
                                        <div title={`Telefone: ${lead.phone}`} className="p-1 bg-green-50 text-green-600 rounded opacity-75 group-hover:opacity-100 transition-opacity">
                                            <Phone className="w-3 h-3" />
                                        </div>
                                    )}
                                    {hasData(lead.approachMessage) && (
                                        <div title="Mensagem Gerada pela IA" className="p-1 bg-purple-50 text-purple-600 rounded opacity-75 group-hover:opacity-100 transition-opacity">
                                            <MessageSquare className="w-3 h-3" />
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                        $ {lead.value.toLocaleString()}
                                    </span>
                                    {!lead.enriched && (
                                            <button 
                                            onClick={() => enrichLead(lead.id)}
                                            className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded hover:bg-indigo-100 font-medium flex items-center gap-1 border border-indigo-100"
                                            >
                                            <Bot className="w-3 h-3" /> Enriquecer
                                            </button>
                                    )}
                                    {lead.enriched && (
                                        <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
                                            <Bot className="w-3 h-3" /> IA Check
                                        </span>
                                    )}
                                </div>

                                {/* Missing Data Alert */}
                                {!hasData(lead.email) && !hasData(lead.phone) && (
                                    <div className="mt-2 bg-red-50 border border-red-100 rounded p-1.5 flex items-start gap-1.5">
                                        <AlertOctagon className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-[9px] font-bold text-red-600 leading-none mb-0.5">Dados Insuficientes</p>
                                            <p className="text-[8px] text-red-400 leading-tight">Contato não encontrado. Baixa chance de conversão.</p>
                                        </div>
                                    </div>
                                )}

                                {/* Expanded Content: Notes & History */}
                                {expandedLeadId === lead.id && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 bg-gray-50/50 -mx-3 px-3 pb-2 rounded-b-lg">
                                        <div className="mb-3">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1 mb-1">
                                                <FileText className="w-3 h-3" /> Notas
                                            </label>
                                            <textarea 
                                                className="w-full text-xs p-2 border border-gray-200 rounded bg-white text-gray-700 focus:outline-none focus:border-indigo-300 resize-none h-20 bg-transparent"
                                                defaultValue={lead.notes}
                                                placeholder="Adicione observações..."
                                                onBlur={(e) => handleNoteChange(lead.id, e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase flex items-center gap-1 mb-2">
                                                <FileClock className="w-3 h-3" /> Histórico
                                            </label>
                                            <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                                                {lead.history && lead.history.length > 0 ? (
                                                    [...lead.history].reverse().map((item, idx) => (
                                                        <div key={idx} className="flex gap-2 items-start text-[10px]">
                                                            <div className="mt-0.5 min-w-[6px] h-1.5 rounded-full bg-indigo-300 shrink-0"></div>
                                                            <div>
                                                                <p className="text-gray-600 leading-tight">{item.description}</p>
                                                                <p className="text-gray-400 text-[9px]">
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
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 sticky top-0 z-10">
                        <h3 className="text-lg font-bold text-gray-800">Editar Lead</h3>
                        <button onClick={() => setEditingLead(null)} className="text-gray-400 hover:text-gray-600">
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
                                    className={`w-full px-3 py-2 border ${errors.company ? 'border-red-500' : 'border-gray-300'} rounded-lg text-sm bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none`}
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
                                    className={`w-full px-3 py-2 border ${errors.value ? 'border-red-500' : 'border-gray-300'} rounded-lg text-sm bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none`}
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
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
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
                                    className={`w-full px-3 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-lg text-sm bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none`}
                                />
                                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone</label>
                                <input 
                                    name="phone" 
                                    value={displayValue(editForm.phone, '')} 
                                    onChange={handleEditChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cidade</label>
                            <input 
                                name="city" 
                                value={displayValue(editForm.city, '')} 
                                onChange={handleEditChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" 
                            />
                        </div>

                        {/* AI Insights Section in Modal */}
                        {(editForm.contactRole || editForm.approachMessage) && (
                            <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 space-y-3">
                                <h4 className="font-bold text-indigo-800 text-sm flex items-center gap-2">
                                    <Bot className="w-4 h-4" /> Insights da IA
                                </h4>
                                
                                {hasData(editForm.contactRole) && (
                                    <div>
                                        <p className="text-xs font-bold text-indigo-600 uppercase">Cargo Provável</p>
                                        <p className="text-sm text-gray-700">{editForm.contactRole}</p>
                                    </div>
                                )}
                                
                                {hasData(editForm.approachMessage) && (
                                    <div>
                                        <p className="text-xs font-bold text-indigo-600 uppercase">Sugestão de Abordagem</p>
                                        <p className="text-sm text-gray-700 italic">"{editForm.approachMessage}"</p>
                                    </div>
                                )}

                                {editForm.leadPriority && (
                                    <div>
                                        <p className="text-xs font-bold text-indigo-600 uppercase">Prioridade</p>
                                        <span className={`text-xs px-2 py-0.5 rounded border ${getPriorityColor(editForm.leadPriority)}`}>
                                            {editForm.leadPriority}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="px-6 py-4 bg-gray-50 flex justify-end gap-2 sticky bottom-0 z-10 border-t border-gray-200">
                        <button 
                            onClick={() => setEditingLead(null)} 
                            className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleEditSave} 
                            className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
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
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="text-lg font-bold text-gray-800">Novo Lead</h3>
                        <button onClick={() => setIsCreating(false)} className="text-gray-400 hover:text-gray-600">
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
                                    className={`w-full pl-10 pr-3 py-2 border ${errors.company ? 'border-red-500' : 'border-gray-300'} rounded-lg text-sm bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none`}
                                    placeholder="Nome da empresa"
                                />
                            </div>
                            {errors.company && <p className="text-xs text-red-500 mt-1">{errors.company}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nome Contato</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                    <input 
                                        name="name" 
                                        value={createForm.name || ''} 
                                        onChange={handleCreateChange}
                                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                        placeholder="João Silva"
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
                                        value={createForm.value || 0} 
                                        onChange={handleCreateChange}
                                        className={`w-full pl-10 pr-3 py-2 border ${errors.value ? 'border-red-500' : 'border-gray-300'} rounded-lg text-sm bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none`}
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
                                    className={`w-full px-3 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-300'} rounded-lg text-sm bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none`}
                                    placeholder="contato@empresa.com"
                                />
                                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Telefone</label>
                                <input 
                                    name="phone" 
                                    value={createForm.phone || ''} 
                                    onChange={handleCreateChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                    placeholder="(00) 00000-0000"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cidade</label>
                            <input 
                                name="city" 
                                value={createForm.city || ''} 
                                onChange={handleCreateChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none" 
                                placeholder="São Paulo"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Estágio Inicial</label>
                            <select 
                                name="status" 
                                value={createForm.status} 
                                onChange={handleCreateChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                            >
                                {Object.values(PipelineStage).map(stage => (
                                    <option key={stage} value={stage}>{stage}</option>
                                ))}
                            </select>
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
                            className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
                        >
                            <Plus className="w-4 h-4" /> Criar Lead
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Pipeline;
