
import React, { useState, useRef, useEffect } from 'react';
import { AppSettings } from '../types';
import { Camera, Save, KeyRound, Check, Globe, Phone, Linkedin, Instagram, Link, Palette, Server, ShieldCheck, HelpCircle, Mail, User, ChevronDown, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

interface SettingsProps {
  settings: AppSettings;
  updateSettings: (newSettings: AppSettings) => void;
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

const Settings: React.FC<SettingsProps> = ({ settings, updateSettings }) => {
  const [form, setForm] = useState<AppSettings>({
      ...settings,
      brandColor: settings.brandColor || "#9b01ec"
  });
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Sector Dropdown State
  const [isSectorOpen, setIsSectorOpen] = useState(false);
  const sectorRef = useRef<HTMLDivElement>(null);

  // SMTP Test State
  const [passwordMode, setPasswordMode] = useState(false);
  const [smtpHelpMode, setSmtpHelpMode] = useState(false);
  const [isTestingSmtp, setIsTestingSmtp] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<'idle' | 'success' | 'error'>('idle');
  
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (e.target.name === 'userEmail' && emailError) setEmailError('');
    if (e.target.name.startsWith('smtp')) setSmtpStatus('idle'); // Reset status on edit
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

  const testSmtpConnection = () => {
      setIsTestingSmtp(true);
      setSmtpStatus('idle');

      // Simulating an API verification call
      setTimeout(() => {
          setIsTestingSmtp(false);
          // Basic validation simulation
          if (form.smtpHost && form.smtpUser && form.smtpPass && form.smtpPass.length > 5) {
              setSmtpStatus('success');
          } else {
              setSmtpStatus('error');
          }
      }, 1500);
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

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto px-4">
      {/* Header Updated to Match Other Pages */}
      <div className="mb-6 text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Configurações</h2>
        <p className="text-gray-500">Gerencie seu perfil, integrações e preferências do sistema.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 h-full">
            
            {/* LEFT SIDE: PROFILE & BRANDING (Compact Sidebar) */}
            <div className="lg:col-span-4 bg-gray-50/60 border-r border-gray-200 p-6 flex flex-col gap-5 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col items-center text-center pb-4 border-b border-gray-200/60">
                    <div className="relative group cursor-pointer mb-3" onClick={triggerFileUpload}>
                        <img 
                            src={form.userAvatar || "https://picsum.photos/200"} 
                            alt="Avatar" 
                            className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-md group-hover:opacity-90 transition-opacity" 
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 rounded-2xl transition-opacity">
                            <Camera className="w-6 h-6 text-white" />
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 text-lg">{form.userName || 'Seu Nome'}</h3>
                        <p className="text-xs text-gray-500">{form.companySector || 'Setor não definido'}</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nome Completo</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input 
                                name="userName" 
                                value={form.userName} 
                                onChange={handleChange} 
                                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder-gray-400"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Email de Login</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input 
                                name="userEmail" 
                                value={form.userEmail} 
                                onChange={handleChange} 
                                className={`w-full pl-9 pr-3 py-2.5 text-sm border ${emailError ? 'border-red-500' : 'border-gray-200'} rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 outline-none`}
                            />
                        </div>
                    </div>
                    
                    {/* Custom Scrollable Sector Dropdown */}
                    <div className="space-y-1" ref={sectorRef}>
                         <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Setor de Atuação</label>
                         <div className="relative">
                            <button
                                onClick={() => setIsSectorOpen(!isSectorOpen)}
                                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 outline-none flex justify-between items-center text-left"
                            >
                                <span className={form.companySector ? "text-gray-900" : "text-gray-400"}>
                                    {form.companySector || "Selecione o setor..."}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isSectorOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isSectorOpen && (
                                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                                    {SECTORS.map(sector => (
                                        <div
                                            key={sector}
                                            onClick={() => handleSectorSelect(sector)}
                                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 transition-colors ${form.companySector === sector ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-700'}`}
                                        >
                                            {sector}
                                        </div>
                                    ))}
                                </div>
                            )}
                         </div>
                    </div>
                    
                    <div className="space-y-1 pt-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                            <Palette className="w-3 h-3" /> Cor da Marca
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {COLORS.map(color => (
                                <button
                                    key={color}
                                    onClick={() => setForm({ ...form, brandColor: color })}
                                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                                        form.brandColor === color ? 'border-gray-800 scale-110 shadow-sm' : 'border-white ring-1 ring-gray-200'
                                    }`}
                                    style={{ backgroundColor: color }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT SIDE: DETAILS & INTEGRATIONS */}
            <div className="lg:col-span-8 p-6 flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar">
                
                {/* Section: Contacts */}
                <div>
                     <h4 className="font-bold text-gray-700 text-xs uppercase tracking-wide mb-3 flex items-center gap-2 border-b border-gray-100 pb-2">
                        <Link className="w-3.5 h-3.5 text-indigo-600" /> Assinatura & Contato
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Telefone / WhatsApp</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                                <input 
                                    name="contactPhone" 
                                    value={form.contactPhone || ''} 
                                    onChange={handleChange} 
                                    placeholder="(00) 99999-9999"
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Website</label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                                <input 
                                    name="socialWebsite" 
                                    value={form.socialWebsite || ''} 
                                    onChange={handleChange} 
                                    placeholder="www.site.com"
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">LinkedIn</label>
                            <div className="relative">
                                <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                                <input 
                                    name="socialLinkedin" 
                                    value={form.socialLinkedin || ''} 
                                    onChange={handleChange} 
                                    placeholder="linkedin.com/in/..."
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Instagram</label>
                            <div className="relative">
                                <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                                <input 
                                    name="socialInstagram" 
                                    value={form.socialInstagram || ''} 
                                    onChange={handleChange} 
                                    placeholder="@usuario"
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section: Integrations */}
                <div className="flex-1">
                    <h4 className="font-bold text-gray-700 text-xs uppercase tracking-wide mb-3 flex items-center gap-2 border-b border-gray-100 pb-2">
                        <Server className="w-3.5 h-3.5 text-indigo-600" /> Integrações (API & SMTP)
                    </h4>
                    
                    <div className="grid grid-cols-1 gap-4">
                        {/* OpenAI Key */}
                        <div className="space-y-1">
                             <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                OpenAI API Key (GPT-4) <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-normal">Recomendado</span>
                            </label>
                             <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                                <input 
                                    type="password" 
                                    name="openAiKey" 
                                    value={form.openAiKey} 
                                    onChange={handleChange} 
                                    placeholder="sk-proj-..." 
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500 outline-none" 
                                />
                             </div>
                        </div>

                        {/* SMTP Config - Enhanced for Testing */}
                        <div className="bg-indigo-50/50 rounded-lg border border-indigo-100 p-4 relative">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-xs font-bold text-indigo-900 flex items-center gap-2">
                                    Configuração SMTP (Disparo de Email)
                                    {smtpStatus === 'success' && <span className="flex items-center gap-1 text-[9px] text-green-600 bg-green-100 px-1.5 py-0.5 rounded border border-green-200"><CheckCircle2 className="w-3 h-3"/> Verificado</span>}
                                    {smtpStatus === 'error' && <span className="flex items-center gap-1 text-[9px] text-red-600 bg-red-100 px-1.5 py-0.5 rounded border border-red-200"><AlertCircle className="w-3 h-3"/> Falha</span>}
                                </span>
                                <div className="flex gap-2">
                                     <button 
                                        onClick={testSmtpConnection}
                                        disabled={isTestingSmtp}
                                        className="text-[10px] bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-3 py-1 rounded shadow-sm flex items-center gap-1 transition-colors disabled:opacity-70"
                                    >
                                        {isTestingSmtp ? <Loader2 className="w-3 h-3 animate-spin"/> : <RefreshCw className="w-3 h-3"/>}
                                        Testar Conexão
                                    </button>
                                    <button 
                                        onClick={() => setSmtpHelpMode(!smtpHelpMode)}
                                        className="text-[10px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-white px-2 py-1 rounded border border-indigo-100 shadow-sm"
                                    >
                                        <HelpCircle className="w-3 h-3" /> Ajuda
                                    </button>
                                </div>
                            </div>
                            
                            {smtpHelpMode && (
                                <div className="mb-3 bg-white p-2 rounded border border-indigo-100 text-[10px] text-gray-600 animate-in fade-in slide-in-from-top-1">
                                    Use Senha de App do Google (App Password). Host: <code>smtp.gmail.com</code> | Porta: <code>465</code>.
                                </div>
                            )}

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <input 
                                    name="smtpHost" 
                                    value={form.smtpHost || ''} 
                                    onChange={handleChange} 
                                    placeholder="Host (ex: smtp.gmail.com)"
                                    className="col-span-2 lg:col-span-1 px-3 py-2 text-xs border border-indigo-200 rounded bg-white focus:ring-1 focus:ring-indigo-500 outline-none" 
                                />
                                <input 
                                    name="smtpPort" 
                                    value={form.smtpPort || ''} 
                                    onChange={handleChange} 
                                    placeholder="Porta (ex: 465)"
                                    className="col-span-2 lg:col-span-1 px-3 py-2 text-xs border border-indigo-200 rounded bg-white focus:ring-1 focus:ring-indigo-500 outline-none" 
                                />
                                <input 
                                    name="smtpUser" 
                                    value={form.smtpUser || ''} 
                                    onChange={handleChange} 
                                    placeholder="Email Remetente"
                                    className="col-span-2 lg:col-span-1 px-3 py-2 text-xs border border-indigo-200 rounded bg-white focus:ring-1 focus:ring-indigo-500 outline-none" 
                                />
                                <div className="col-span-2 lg:col-span-1 relative">
                                    <input 
                                        type="password" 
                                        name="smtpPass" 
                                        value={form.smtpPass || ''} 
                                        onChange={handleChange} 
                                        placeholder="SMTP Key / App Password"
                                        className={`w-full px-3 py-2 text-xs border rounded bg-white focus:ring-1 focus:ring-indigo-500 outline-none pr-8 ${smtpStatus === 'error' ? 'border-red-300 bg-red-50' : 'border-indigo-200'}`} 
                                    />
                                    <ShieldCheck className={`absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${smtpStatus === 'success' ? 'text-green-500' : 'text-indigo-300'}`} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-100">
                     {!passwordMode ? (
                        <button 
                            onClick={() => setPasswordMode(true)}
                            className="text-xs font-medium text-gray-500 hover:text-indigo-600 flex items-center gap-1 px-2 py-1.5 hover:bg-gray-50 rounded transition-colors"
                        >
                            <KeyRound className="w-3.5 h-3.5" /> Mudar Senha
                        </button>
                    ) : (
                         <div className="flex gap-2 items-center animate-in fade-in">
                            <input type="password" placeholder="Nova Senha" className="px-2 py-1.5 bg-white border border-gray-200 rounded text-xs outline-none focus:border-indigo-500 w-32" />
                            <button type="button" onClick={() => setPasswordMode(false)} className="text-xs text-red-500 hover:text-red-700 font-medium px-1">Cancelar</button>
                         </div>
                    )}

                    <button 
                        onClick={handleSave} 
                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-md shadow-indigo-100 hover:shadow-lg transition-all flex items-center gap-2"
                    >
                        {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                        {saved ? 'Salvo!' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
