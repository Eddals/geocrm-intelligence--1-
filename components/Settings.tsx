
import React, { useState, useRef, useEffect } from 'react';
import { AppSettings } from '../types';
import { Camera, Save, Check, Loader2, Globe, Phone, Linkedin, Instagram, Link, Palette, Mail, User, ChevronDown, Building } from 'lucide-react';

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
