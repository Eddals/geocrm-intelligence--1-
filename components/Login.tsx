
import React, { useState, useRef, useEffect } from 'react';
import { Lock, Mail, ArrowRight, User, Building, Briefcase, CheckCircle2, Loader2, ShieldCheck, ChevronDown } from 'lucide-react';
import { AppSettings } from '../types';

interface LoginProps {
  onLogin: (userData?: Partial<AppSettings>) => void;
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

const SimpleCaptcha: React.FC<{ onVerify: (verified: boolean) => void }> = ({ onVerify }) => {
    const [status, setStatus] = useState<'idle' | 'verifying' | 'verified'>('idle');

    const handleVerify = () => {
        if (status === 'verified') return;
        setStatus('verifying');
        setTimeout(() => {
            setStatus('verified');
            onVerify(true);
        }, 1500); // 1.5s simulation
    };

    return (
        <div 
            onClick={handleVerify}
            className={`
                border rounded-lg p-3 flex items-center gap-4 cursor-pointer select-none transition-all
                ${status === 'verified' ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}
            `}
        >
            <div className={`
                w-7 h-7 rounded border flex items-center justify-center bg-white shadow-sm transition-all
                ${status === 'verified' ? 'border-green-500' : 'border-gray-300'}
            `}>
                {status === 'idle' && <div className="w-4 h-4 rounded-sm border-2 border-gray-200"></div>}
                {status === 'verifying' && <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />}
                {status === 'verified' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
            </div>
            
            <div className="flex-1">
                <p className="text-sm text-gray-700 font-medium">
                    {status === 'verified' ? 'Verificado' : 'Não sou um robô'}
                </p>
                {status === 'verified' && <p className="text-[10px] text-green-600">Acesso Humano Confirmado</p>}
            </div>
            
            <div className="flex flex-col items-center">
                <ShieldCheck className="w-8 h-8 text-gray-300" />
                <span className="text-[8px] text-gray-400">reCAPTCHA</span>
            </div>
        </div>
    );
};

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // Login Form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Register Form
  const [regName, setRegName] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regSector, setRegSector] = useState(SECTORS[0]);
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [captchaVerified, setCaptchaVerified] = useState(false);

  // Dropdown State
  const [isSectorOpen, setIsSectorOpen] = useState(false);
  const sectorRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState('');

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

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
        // Simple "DB" check from localStorage
        const users = JSON.parse(localStorage.getItem('geocrm_users') || '[]');
        const user = users.find((u: any) => u.email === email && u.password === password);

        // Allow admin backdoor or registered user
        if ((email === 'admin@geocrm.com' && password.length > 0) || user) {
            onLogin(user ? {
                userName: user.name,
                userEmail: user.email,
                companyName: user.company,
                companySector: user.sector
            } : undefined);
        } else {
            setError('Credenciais inválidas.');
            setLoading(false);
        }
    }, 1000);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      setError('');

      if (!captchaVerified) {
          setError('Por favor, complete a verificação do Captcha.');
          return;
      }

      setLoading(true);
      setTimeout(() => {
          const users = JSON.parse(localStorage.getItem('geocrm_users') || '[]');
          
          if (users.some((u: any) => u.email === regEmail)) {
              setError('Este email já está cadastrado.');
              setLoading(false);
              return;
          }

          const newUser = {
              name: regName,
              email: regEmail,
              password: regPass,
              company: regCompany,
              sector: regSector
          };

          users.push(newUser);
          localStorage.setItem('geocrm_users', JSON.stringify(users));

          // Auto login after register
          onLogin({
              userName: newUser.name,
              userEmail: newUser.email,
              companyName: newUser.company,
              companySector: newUser.sector
          });
      }, 1500);
  };

  const handleSectorSelect = (sector: string) => {
    setRegSector(sector);
    setIsSectorOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-500 border border-gray-100 transition-all">
        
        <div className="p-8 pb-4 flex flex-col items-center">
           <img 
             src="https://i.imgur.com/HkMra5d.png" 
             alt="GeoCRM Logo" 
             className="h-16 w-auto object-contain mb-3 hover:scale-105 transition-transform"
           />
           <h2 className="text-2xl font-bold text-gray-800">
               {isLogin ? 'Bem-vindo de volta!' : 'Crie sua conta'}
           </h2>
           <p className="text-gray-500 text-sm mt-1 text-center">
               {isLogin ? 'Acesse o painel de inteligência.' : 'Comece a gerenciar leads com IA.'}
           </p>
        </div>

        {isLogin ? (
            // LOGIN FORM
            <form onSubmit={handleLoginSubmit} className="px-8 pb-8 space-y-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#9b01ec] focus:border-transparent outline-none transition-all text-sm text-gray-900"
                            placeholder="admin@geocrm.com"
                        />
                    </div>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Senha</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input 
                            type="password" 
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#9b01ec] focus:border-transparent outline-none transition-all text-sm text-gray-900"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                {error && <p className="text-xs text-red-500 text-center bg-red-50 py-1 rounded">{error}</p>}

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-black hover:bg-gray-800 text-white py-3 rounded-lg font-bold text-sm shadow-lg shadow-gray-200 transition-all flex items-center justify-center gap-2 group mt-2"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Entrar no Sistema'}
                    {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
                </button>
                
                <div className="text-center pt-2">
                    <button type="button" onClick={() => { setIsLogin(false); setError(''); }} className="text-xs text-gray-500 font-medium hover:underline">
                        Não tem conta? Crie uma agora.
                    </button>
                </div>
            </form>
        ) : (
            // REGISTER FORM
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
                                        onClick={() => handleSectorSelect(sector)}
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

                {/* Custom Captcha */}
                <div className="pt-2">
                    <SimpleCaptcha onVerify={setCaptchaVerified} />
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
                    <button type="button" onClick={() => { setIsLogin(true); setError(''); }} className="text-xs text-gray-500 font-medium hover:underline">
                        Já tem conta? Fazer Login.
                    </button>
                </div>
            </form>
        )}
        
        <div className="bg-gray-50 p-3 text-center border-t border-gray-100">
            <p className="text-[10px] text-gray-400">
                Protegido por GeoCRM Intelligence © 2024
            </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
