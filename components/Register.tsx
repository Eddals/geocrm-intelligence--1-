import React, { useRef, useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { supabaseRequest } from '../services/supabaseClient';
import { User, Building, Briefcase, Mail, Lock, ChevronDown, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';

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

interface RegisterProps {
    onRegister: (userData?: Partial<AppSettings> & { id?: string }) => void;
    onSwitchToLogin?: () => void;
}

const Register: React.FC<RegisterProps> = ({ onRegister, onSwitchToLogin }) => {
    const [regName, setRegName] = useState('');
    const [regCompany, setRegCompany] = useState('');
    const [regSector, setRegSector] = useState(SECTORS[0]);
    const [regEmail, setRegEmail] = useState('');
    const [regPass, setRegPass] = useState('');
    const [regPassConfirm, setRegPassConfirm] = useState('');
    const [regSummary, setRegSummary] = useState('');
    const [regRole, setRegRole] = useState('Dono');
    const [captchaVerified, setCaptchaVerified] = useState(false);
    const [isSectorOpen, setIsSectorOpen] = useState(false);
    const [isRoleOpen, setIsRoleOpen] = useState(false);
    const sectorRef = useRef<HTMLDivElement>(null);
    const roleRef = useRef<HTMLDivElement>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSplash, setShowSplash] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sectorRef.current && !sectorRef.current.contains(event.target as Node)) {
                setIsSectorOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleRegisterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!captchaVerified) {
            setError('Por favor, complete a verificação do Captcha.');
            return;
        }
        if (!regPass || regPass !== regPassConfirm) {
            setError('As senhas não conferem.');
            return;
        }

        setLoading(true);
        try {
            const existing = await supabaseRequest<any[]>('users', { query: `?email=eq.${encodeURIComponent(regEmail)}` });
            if (existing && existing.length > 0) {
                setError('Este email já está cadastrado.');
                setLoading(false);
                return;
            }

            const payload = {
                name: regName,
                email: regEmail,
                password: regPass,
                company_name: regCompany,
                company_sector: regSector,
                business_summary: regSummary,
                user_role: regRole
            };

            const created = await supabaseRequest<any[]>('users', { method: 'POST', body: payload, query: '' });
            const newUser = created && created[0] ? created[0] : payload;

            setShowSplash(true);
            setTimeout(() => {
              onRegister({
                  id: newUser.id,
                  userName: newUser.name,
                  userEmail: newUser.email,
                  companyName: newUser.company_name,
                  companySector: newUser.company_sector,
                  businessSummary: newUser.business_summary,
                  userRole: newUser.user_role
              });
              setShowSplash(false);
            }, 5000);
        } catch (err: any) {
            setError(err?.message || 'Erro ao registrar. Verifique sua conexão.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4 relative overflow-hidden">
          {showSplash && (
            <div className="absolute inset-0 bg-white z-50 flex flex-col items-center justify-center animate-fade-in">
                <img 
                  src="https://i.imgur.com/HkMra5d.png" 
                  alt="DevtoneLeads" 
                  className="h-20 w-auto object-contain mb-3 animate-bounce"
                />
                <p className="text-sm font-semibold text-gray-700">Carregando essa experiência incrível...</p>
            </div>
          )}
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-500 border border-gray-100 transition-all">
            <div className="p-8 flex flex-col items-center">
                <img 
                  src="https://i.imgur.com/HkMra5d.png" 
                  alt="DevtoneLeads" 
                  className="h-16 w-auto object-contain mb-3"
                />
                <button
                  onClick={onSwitchToLogin}
                  className="text-xs text-gray-500 font-medium hover:underline"
                >
                </button>
            </div>

            <div className="px-8 pb-4">
               <h2 className="text-2xl font-bold text-gray-800 text-center">Crie sua conta</h2>
               <p className="text-gray-500 text-sm mt-1 text-center">Comece a gerenciar leads com IA.</p>
            </div>

            <form onSubmit={handleRegisterSubmit} className="px-8 pb-8 space-y-4 animate-in slide-in-from-right-10 duration-300">
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Nome</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                required value={regName} onChange={e => setRegName(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#9b01ec] focus:border-transparent outline-none transition-all text-sm text-gray-900"
                                placeholder="Seu Nome"
                            />
                        </div>
                    </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Empresa</label>
                        <div className="relative">
                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                required value={regCompany} onChange={e => setRegCompany(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#9b01ec] focus:border-transparent outline-none transition-all text-sm text-gray-900"
                                placeholder="Sua Empresa"
                            />
                        </div>
                    </div>
                 </div>

                 {/* Custom Sector Dropdown */}
                 <div className="space-y-1" ref={sectorRef}>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Setor de Atuação</label>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsSectorOpen(!isSectorOpen)}
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#9b01ec] focus:border-transparent outline-none transition-all text-sm text-gray-900 flex justify-between items-center text-left"
                        >
                            <div className="flex items-center gap-0">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <span className="truncate">{regSector}</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isSectorOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isSectorOpen && (
                            <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
                                {SECTORS.map(sector => (
                                    <div
                                        key={sector}
                                        onClick={() => { setRegSector(sector); setIsSectorOpen(false); }}
                                        className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-indigo-50 transition-colors ${regSector === sector ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-700'}`}
                                    >
                                        {sector}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="email" required value={regEmail} onChange={e => setRegEmail(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#9b01ec] focus:border-transparent outline-none transition-all text-sm text-gray-900"
                            placeholder="seu@email.com"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Senha</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="password" required value={regPass} onChange={e => setRegPass(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#9b01ec] focus:border-transparent outline-none transition-all text-sm text-gray-900"
                                placeholder="Criar senha"
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Confirmar Senha</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input 
                                type="password" required value={regPassConfirm} onChange={e => setRegPassConfirm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#9b01ec] focus:border-transparent outline-none transition-all text-sm text-gray-900"
                                placeholder="Confirmar senha"
                            />
                        </div>
                    </div>
                </div>
                <div className="space-y-1" ref={roleRef}>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Você é?</label>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsRoleOpen(!isRoleOpen)}
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#9b01ec] focus:border-transparent outline-none transition-all text-sm text-gray-900 flex justify-between items-center text-left"
                        >
                            <div className="flex items-center gap-0">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <span className="truncate">{regRole}</span>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isRoleOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isRoleOpen && (
                            <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto">
                                {['Dono', 'Gerente', 'Administrador', 'Supervisor'].map(role => (
                                    <div
                                        key={role}
                                        onClick={() => { setRegRole(role); setIsRoleOpen(false); }}
                                        className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-indigo-50 transition-colors ${regRole === role ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-700'}`}
                                    >
                                        {role}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Fale sobre seu negócio</label>
                    <textarea
                        value={regSummary}
                        onChange={e => setRegSummary(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#9b01ec] focus:border-transparent outline-none transition-all text-sm text-gray-900 resize-none"
                        placeholder="Seu nicho, ticket médio, diferenciais..."
                    />
                </div>

                {/* Captcha simples */}
                <div 
                    onClick={() => setCaptchaVerified(true)}
                    className={`border rounded-lg p-3 flex items-center gap-4 cursor-pointer select-none transition-all ${captchaVerified ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                >
                    <div className={`w-7 h-7 rounded border flex items-center justify-center bg-white shadow-sm transition-all ${captchaVerified ? 'border-green-500' : 'border-gray-300'}`}>
                        {captchaVerified ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <div className="w-4 h-4 rounded-sm border-2 border-gray-200"></div>}
                    </div>
                    <div className="flex-1">
                        <p className="text-sm text-gray-700 font-medium">
                            {captchaVerified ? 'Verificado' : 'Não sou um robô'}
                        </p>
                        {captchaVerified && <p className="text-[10px] text-green-600">Acesso Humano Confirmado</p>}
                    </div>
                    <div className="flex flex-col items-center">
                        <ShieldCheck className="w-8 h-8 text-gray-300" />
                        <span className="text-[8px] text-gray-400">reCAPTCHA</span>
                    </div>
                </div>

                {error && <p className="text-xs text-red-500 text-center bg-red-50 py-1 rounded">{error}</p>}

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-gray-900 hover:bg-black text-white py-3 rounded-lg font-bold text-sm shadow-lg shadow-gray-200 transition-all flex items-center justify-center gap-2"
                >
                     {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Registrar Conta'}
                </button>

                <div className="text-center pt-1">
                    <button type="button" onClick={onSwitchToLogin} className="text-xs text-gray-500 font-medium hover:underline">
                        Já tem conta? Fazer Login.
                    </button>
                </div>
            </form>
          </div>
        </div>
    );
};

export default Register;
