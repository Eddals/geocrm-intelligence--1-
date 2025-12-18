
import React, { useState, useRef, useEffect } from 'react';
import { AppSettings } from '../types';
import { Camera, Save, Check, Loader2, Globe, Phone, Linkedin, Instagram, Link, Palette, Mail, User, ChevronDown, Building, CalendarDays, Video, MessageCircle, Lock } from 'lucide-react';
import { verifySmtp } from '../services/emailApi';

interface SettingsProps {
  settings: AppSettings;
  updateSettings: (newSettings: AppSettings) => void;
  isSaving?: boolean;
}

const SECTORS = [
    "Marketing Digital & Agência",
    "Serviços de Limpeza Comercial",
    "Imobiliário & Corretores",
    "Construção Civil & Reformas",
    "Consultoria Jurídica",
    "Desenvolvimento de Software",
    "Vendas B2B Geral",
    "Logística & Transporte",
    "Saúde & Clínicas",
    "Energia Solar",
    "Outro"
];

const COLORS = [
    "#9b01ec", // Default Purple
    "#2563eb", // Blue
    "#059669", // Emerald
    "#db2777", // Pink
    "#e11d48", // Rose
    "#d97706", // Amber
    "#000000"  // Black
];

const Settings: React.FC<SettingsProps> = ({ settings, updateSettings, isSaving }) => {
  const [form, setForm] = useState<AppSettings>({
      ...settings,
      brandColor: settings.brandColor || "#9b01ec"
  });
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSmtpPass, setShowSmtpPass] = useState(false);
  const [smtpTestLoading, setSmtpTestLoading] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  
  // Sector Dropdown State
  const [isSectorOpen, setIsSectorOpen] = useState(false);
  const sectorRef = useRef<HTMLDivElement>(null);

  const [emailError, setEmailError] = useState('');

  // Handle outside click for sector dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (sectorRef.current && !sectorRef.current.contains(event.target as Node)) {
            setIsSectorOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (e.target.name === 'userEmail' && emailError) setEmailError('');
  };

  const handleSectorSelect = (sector: string) => {
      setForm({ ...form, companySector: sector });
      setIsSectorOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm({ ...form, userAvatar: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleSave = () => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (form.userEmail && !emailRegex.test(form.userEmail)) {
        setEmailError('Email inválido.');
        return;
    }
    updateSettings(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const applySmtpPreset = (provider: 'brevo' | 'gmail' | 'outlook') => {
    if (provider === 'brevo') {
      setForm((prev) => ({ ...prev, smtpHost: 'smtp-relay.brevo.com', smtpPort: '587' }));
      return;
    }
    if (provider === 'gmail') {
      setForm((prev) => ({ ...prev, smtpHost: 'smtp.gmail.com', smtpPort: '587' }));
      return;
    }
    setForm((prev) => ({ ...prev, smtpHost: 'smtp.office365.com', smtpPort: '587' }));
  };

  const runSmtpTest = async () => {
    setSmtpTestResult(null);
    setSmtpTestLoading(true);
    try {
      const res = await verifySmtp(form);
      if (res.success) {
        setSmtpTestResult({ ok: true, message: res.message || 'SMTP OK.' });
        return;
      }
      const code = res.responseCode ? ` (${res.responseCode})` : res.code ? ` (${res.code})` : '';
      let hint = '';
      const msg = (res.error || '').toLowerCase();
      if (res.responseCode === 535 || msg.includes('535') || msg.includes('auth')) {
        hint = ' Dica: no Brevo, use seu e-mail da conta como usuário e a SMTP Key como senha.';
      } else if (msg.includes('timeout') || msg.includes('connect')) {
        hint = ' Dica: confira host/porta e se seu provedor permite conexões SMTP.';
      }
      setSmtpTestResult({ ok: false, message: `Falha no SMTP${code}: ${res.error || 'erro desconhecido'}.${hint}` });
    } finally {
      setSmtpTestLoading(false);
    }
  };

  return (
    <div className="flex flex-col max-w-5xl mx-auto">
      {/* Header Updated to Match Other Pages */}
      <div className="mb-6 text-center">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-slate-100 mb-2">Configurações</h2>
        <p className="text-gray-500 dark:text-slate-400">Gerencie seu perfil, integrações e preferências do sistema.</p>
      </div>

      <div className="glass-panel rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 overflow-hidden animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-12">
            
            {/* LEFT SIDE: PROFILE & BRANDING (Compact Sidebar) */}
            <div className="lg:col-span-4 bg-gray-50/60 dark:bg-slate-800/60 border-r border-gray-200 dark:border-slate-800 p-6 flex flex-col gap-5">
                <div className="flex flex-col items-center text-center pb-4 border-b border-gray-200/60 dark:border-slate-700/60">
                    <div className="relative group cursor-pointer mb-3" onClick={triggerFileUpload}>
                        {form.userAvatar ? (
                            <img 
                                src={form.userAvatar} 
                                alt="Avatar" 
                                className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-md group-hover:opacity-90 transition-opacity" 
                            />
                        ) : (
                            <div className="w-24 h-24 rounded-2xl border-4 border-white shadow-md bg-gray-100 flex items-center justify-center text-gray-400 text-sm font-semibold">
                                Foto
                            </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 rounded-2xl transition-opacity">
                            <Camera className="w-6 h-6 text-white" />
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 dark:text-slate-100 text-lg">{form.userName || 'Seu Nome'}</h3>
                        <p className="text-xs text-gray-500 dark:text-slate-400">{form.companySector || 'Setor não definido'}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nome Completo</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white w-4 h-4" />
                            <input 
                                name="userName" 
                                value={form.userName} 
                                onChange={handleChange} 
                                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg glass-panel/70 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-gray-400 dark:text-slate-100 placeholder:dark:text-slate-500"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nome da Empresa</label>
                        <div className="relative">
                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white w-4 h-4" />
                            <input 
                                name="companyName" 
                                value={form.companyName} 
                                onChange={handleChange} 
                                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg glass-panel/70 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-gray-400 dark:text-slate-100 placeholder:dark:text-slate-500"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Email de Login</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white w-4 h-4" />
                            <input 
                                name="userEmail" 
                                value={form.userEmail} 
                                onChange={handleChange} 
                                className={`w-full pl-9 pr-3 py-2.5 text-sm border ${emailError ? 'border-red-500' : 'border-gray-200 dark:border-slate-700'} rounded-lg glass-panel/70 focus:ring-1 focus:ring-indigo-500 outline-none dark:text-slate-100 placeholder:dark:text-slate-500`}
                            />
                        </div>
                    </div>
                    {/* Plano removido para evitar troca manual */}
                    
                    {/* Custom Scrollable Sector Dropdown */}
                    <div className="space-y-1" ref={sectorRef}>
                         <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Setor de Atuação</label>
                         <div className="relative">
                            <button
                                onClick={() => setIsSectorOpen(!isSectorOpen)}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-slate-700 rounded-lg glass-panel/70 focus:ring-1 focus:ring-indigo-500 outline-none flex justify-between items-center text-left text-gray-900 dark:text-slate-100"
                            >
                                <span className={form.companySector ? "text-gray-900" : "text-gray-400"}>
                                    {form.companySector || "Selecione o setor..."}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-white transition-transform ${isSectorOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isSectorOpen && (
                                <div className="absolute top-full left-0 w-full mt-1 glass-panel border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                                    {SECTORS.map(sector => (
                                        <div
                                            key={sector}
                                            onClick={() => handleSectorSelect(sector)}
                                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 dark:hover:bg-slate-800 transition-colors ${form.companySector === sector ? 'text-indigo-600 font-medium bg-indigo-50 dark:bg-slate-800 dark:text-indigo-200' : 'text-gray-700 dark:text-slate-200'}`}
                                        >
                                            {sector}
                                        </div>
                                    ))}
                                </div>
                            )}
                         </div>
                    </div>
                    
                    {/* Removed brand color section */}
                </div>
            </div>

            {/* RIGHT SIDE: DETAILS */}
            <div className="lg:col-span-8 p-6 flex flex-col gap-6">
                
                {/* Section: Contacts */}
                <div>
                     <h4 className="font-bold text-gray-700 dark:text-slate-100 text-xs uppercase tracking-wide mb-3 flex items-center gap-2 border-b border-gray-100 dark:border-slate-700 pb-2">
                        <Link className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" /> Assinatura & Contato
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Telefone / WhatsApp</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white w-3.5 h-3.5" />
                                <input 
                                    name="contactPhone" 
                                    value={form.contactPhone || ''} 
                                    onChange={handleChange} 
                                    placeholder="(00) 99999-9999"
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg glass-panel/70 focus:ring-1 focus:ring-indigo-500 outline-none text-gray-900 dark:text-slate-100 placeholder:dark:text-slate-500"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Website</label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white w-3.5 h-3.5" />
                                <input 
                                    name="socialWebsite" 
                                    value={form.socialWebsite || ''} 
                                    onChange={handleChange} 
                                    placeholder="www.site.com"
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg glass-panel/70 focus:ring-1 focus:ring-indigo-500 outline-none text-gray-900 dark:text-slate-100 placeholder:dark:text-slate-500"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">LinkedIn</label>
                            <div className="relative">
                                <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white w-3.5 h-3.5" />
                                <input 
                                    name="socialLinkedin" 
                                    value={form.socialLinkedin || ''} 
                                    onChange={handleChange} 
                                    placeholder="linkedin.com/in/..."
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg glass-panel/70 focus:ring-1 focus:ring-indigo-500 outline-none text-gray-900 dark:text-slate-100 placeholder:dark:text-slate-500"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Instagram</label>
                            <div className="relative">
                                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white w-3.5 h-3.5" />
                                <input 
                                    name="socialInstagram" 
                                    value={form.socialInstagram || ''} 
                                    onChange={handleChange} 
                                    placeholder="@usuario"
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg glass-panel/70 focus:ring-1 focus:ring-indigo-500 outline-none text-gray-900 dark:text-slate-100 placeholder:dark:text-slate-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Contexto do negócio */}
                <div>
                     <h4 className="font-bold text-gray-700 dark:text-slate-100 text-xs uppercase tracking-wide mb-3 flex items-center gap-2 border-b border-gray-100 dark:border-slate-700 pb-2">
                        <Link className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" /> Contexto do Negócio
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Você é?</label>
                            <input
                                name="userRole"
                                value={form.userRole || ''}
                                onChange={handleChange}
                                placeholder="Dono, Gerente, Supervisor..."
                                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg glass-panel/70 focus:ring-1 focus:ring-indigo-500 outline-none text-gray-900 dark:text-slate-100 placeholder:dark:text-slate-500"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Fale sobre seu negócio</label>
                            <textarea
                                name="businessSummary"
                                value={form.businessSummary || ''}
                                onChange={handleChange}
                                rows={3}
                                placeholder="Setor, ticket médio, diferenciais..."
                                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg glass-panel/70 focus:ring-1 focus:ring-indigo-500 outline-none resize-none text-gray-900 dark:text-slate-100 placeholder:dark:text-slate-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Calendário & Conferência */}
                <div>
                     <h4 className="font-bold text-gray-700 dark:text-slate-100 text-xs uppercase tracking-wide mb-3 flex items-center gap-2 border-b border-gray-100 dark:border-slate-700 pb-2">
                        <CalendarDays className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" /> Calendário & Conferência
                    </h4>
                    <p className="text-[12px] text-gray-500 dark:text-slate-400 mb-3">Configure as integrações usadas nos agendamentos (Google Meet, Zoom e WhatsApp).</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">API Key Google Meet</label>
                        <div className="relative">
                            <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white w-3.5 h-3.5" />
                            <input 
                                name="calendarMeetApiKey" 
                                value={(form as any).calendarMeetApiKey || ''} 
                                onChange={handleChange} 
                                placeholder="Chave da API do Google Meet"
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg glass-panel/70 focus:ring-1 focus:ring-indigo-500 outline-none text-gray-900 dark:text-slate-100 placeholder:dark:text-slate-500"
                            />
                        </div>
                    </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">API Key Google Calendar</label>
                            <div className="relative">
                                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white w-3.5 h-3.5" />
                                <input 
                                    name="calendarGoogleApiKey" 
                                    value={(form as any).calendarGoogleApiKey || ''} 
                                    onChange={handleChange} 
                                    placeholder="AIzaSyDGs4JcS5xzhKY--a_-Jnmamg2p4UNujp4"
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg glass-panel/70 focus:ring-1 focus:ring-indigo-500 outline-none text-gray-900 dark:text-slate-100 placeholder:dark:text-slate-500"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">API Key Zoom</label>
                            <div className="relative">
                                <Video className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white w-3.5 h-3.5" />
                                <input 
                                    name="calendarZoomApiKey" 
                                    value={(form as any).calendarZoomApiKey || ''} 
                                    onChange={handleChange} 
                                    placeholder="Chave da API do Zoom"
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg glass-panel/70 focus:ring-1 focus:ring-indigo-500 outline-none text-gray-900 dark:text-slate-100 placeholder:dark:text-slate-500"
                                />
                            </div>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">WhatsApp para agendamentos</label>
                            <div className="relative">
                                <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white w-3.5 h-3.5" />
                                <input 
                                    name="calendarWhatsAppNumber" 
                                    value={(form as any).calendarWhatsAppNumber || ''} 
                                    onChange={handleChange} 
                                    placeholder="(00) 99999-9999 ou URL da API WhatsApp"
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg glass-panel/70 focus:ring-1 focus:ring-indigo-500 outline-none text-gray-900 dark:text-slate-100 placeholder:dark:text-slate-500"
                                />
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">Usado para enviar links de confirmação e follow-up por WhatsApp.</p>
                        </div>
                    </div>
                </div>

                {/* SMTP */}
                <div>
                     <h4 className="font-bold text-gray-700 dark:text-slate-100 text-xs uppercase tracking-wide mb-3 flex items-center gap-2 border-b border-gray-100 dark:border-slate-700 pb-2">
                        <Mail className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" /> SMTP (Envio de E-mail)
                    </h4>
                    <div className="mb-4 rounded-xl border border-gray-200 dark:border-slate-700 bg-white/60 dark:bg-white/[0.04] p-4 text-sm text-gray-700 dark:text-slate-200">
                      <p className="font-semibold text-gray-800 dark:text-slate-100">Como configurar (SMTP Keys)</p>
                      <p className="mt-1 text-[13px] text-gray-600 dark:text-slate-300">
                        Para provedores como Brevo, a senha correta é uma <span className="font-semibold">SMTP Key</span> (às vezes chamada de “SMTP keys” / “App Password”).
                        Não use a senha do painel do site.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => applySmtpPreset('brevo')}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-white/[0.05] hover:bg-gray-50 dark:hover:bg-white/[0.08]"
                        >
                          Preencher Brevo
                        </button>
                        <button
                          type="button"
                          onClick={() => applySmtpPreset('gmail')}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-white/[0.05] hover:bg-gray-50 dark:hover:bg-white/[0.08]"
                        >
                          Preencher Gmail
                        </button>
                        <button
                          type="button"
                          onClick={() => applySmtpPreset('outlook')}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-white/[0.05] hover:bg-gray-50 dark:hover:bg-white/[0.08]"
                        >
                          Preencher Outlook
                        </button>
                      </div>
                      <ul className="mt-3 text-[12px] text-gray-600 dark:text-slate-300 space-y-1 list-disc list-inside">
                        <li><span className="font-semibold">Brevo:</span> usuário = e-mail da conta, senha = SMTP Key.</li>
                        <li><span className="font-semibold">Gmail/Outlook:</span> precisa “App Password” (com 2FA) e porta 587.</li>
                      </ul>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Host SMTP</label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white w-3.5 h-3.5" />
                                <input 
                                    name="smtpHost" 
                                    value={form.smtpHost || ''} 
                                    onChange={handleChange} 
                                    placeholder="smtp-relay.brevo.com"
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg glass-panel/70 focus:ring-1 focus:ring-indigo-500 outline-none text-gray-900 dark:text-slate-100 placeholder:dark:text-slate-500"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Porta</label>
                            <div className="relative">
                                <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white w-3.5 h-3.5" />
                                <input 
                                    name="smtpPort" 
                                    value={form.smtpPort || ''} 
                                    onChange={handleChange} 
                                    placeholder="587"
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg glass-panel/70 focus:ring-1 focus:ring-indigo-500 outline-none text-gray-900 dark:text-slate-100 placeholder:dark:text-slate-500"
                                />
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">465 = SSL, 587 = STARTTLS (depende do provedor).</p>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Usuário</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white w-3.5 h-3.5" />
                                <input 
                                    name="smtpUser" 
                                    value={form.smtpUser || ''} 
                                    onChange={handleChange} 
                                    placeholder="seuemail@dominio.com"
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg glass-panel/70 focus:ring-1 focus:ring-indigo-500 outline-none text-gray-900 dark:text-slate-100 placeholder:dark:text-slate-500"
                                />
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">Brevo normalmente usa o e-mail da conta como usuário SMTP.</p>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Senha / App Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-white w-3.5 h-3.5" />
                                <input 
                                    name="smtpPass" 
                                    type={showSmtpPass ? 'text' : 'password'}
                                    value={form.smtpPass || ''} 
                                    onChange={handleChange} 
                                    placeholder="Cole aqui sua SMTP Key / App Password"
                                    className="w-full pl-9 pr-24 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg glass-panel/70 focus:ring-1 focus:ring-indigo-500 outline-none text-gray-900 dark:text-slate-100 placeholder:dark:text-slate-500"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowSmtpPass((prev) => !prev)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-md text-[11px] font-semibold border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-200 bg-white/70 dark:bg-white/[0.05]"
                                >
                                    {showSmtpPass ? 'Ocultar' : 'Mostrar'}
                                </button>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1">
                              Usado pelo módulo de Automação de E-mail. Se estiver usando Gmail/Outlook, pode precisar de “App Password”.
                            </p>
                        </div>
                        <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={runSmtpTest}
                            disabled={smtpTestLoading}
                            className="px-4 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-white/[0.05] hover:bg-gray-50 dark:hover:bg-white/[0.08] disabled:opacity-60 flex items-center gap-2"
                          >
                            {smtpTestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                            Testar SMTP agora
                          </button>
                          {smtpTestResult ? (
                            <div
                              className={`px-3 py-2 rounded-lg text-xs font-semibold border ${
                                smtpTestResult.ok
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-100 dark:border-emerald-500/30'
                                  : 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-100 dark:border-rose-500/30'
                              }`}
                            >
                              {smtpTestResult.message}
                            </div>
                          ) : null}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end pt-2">
                    <button 
                        onClick={handleSave} 
                        className="glass-purple px-6 py-3 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 disabled:opacity-50"
                        disabled={isSaving}
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        {isSaving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
