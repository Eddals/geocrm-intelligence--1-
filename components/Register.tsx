import React, { useRef, useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { supabaseRequest } from '../services/supabaseClient';
import {
  IdCard,
  Building,
  Briefcase,
  Mail,
  Lock,
  ChevronDown,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Rocket
} from 'lucide-react';

const SECTORS = [
  'Marketing Digital & Agência',
  'Serviços de Limpeza Comercial',
  'Imobiliário & Corretores',
  'Construção Civil & Reformas',
  'Consultoria Jurídica',
  'Desenvolvimento de Software',
  'Vendas B2B Geral',
  'Logística & Transporte',
  'Saúde & Clínicas',
  'Energia Solar',
  'Outro'
];

interface RegisterProps {
  onRegister: (userData?: Partial<AppSettings> & { id?: string }) => void;
  onSwitchToLogin?: () => void;
}

const Register: React.FC<RegisterProps> = ({ onRegister, onSwitchToLogin }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [regName, setRegName] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regSector, setRegSector] = useState(SECTORS[0]);
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPassConfirm, setRegPassConfirm] = useState('');
  const [regSummary, setRegSummary] = useState('');
  const [regRole, setRegRole] = useState('Dono');
  const [regPlan, setRegPlan] = useState<'Start' | 'Pro' | 'Growth' | 'Enterprise'>('Start');
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [isSectorOpen, setIsSectorOpen] = useState(false);
  const [isRoleOpen, setIsRoleOpen] = useState(false);
  const sectorRef = useRef<HTMLDivElement>(null);
  const roleRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  const steps = [
    { id: 1, title: 'Dados pessoais', desc: 'Nome e empresa', icon: IdCard },
    { id: 2, title: 'Plano', desc: 'Escolha seu plano', icon: Sparkles },
    { id: 3, title: 'Acesso', desc: 'Email e senha', icon: Mail },
    { id: 4, title: 'Finalizar', desc: 'Confirmar dados', icon: ShieldCheck }
  ];

  const nextStep = () => setCurrentStep(prev => Math.min(4, prev + 1));
  const prevStep = () => setCurrentStep(prev => Math.max(1, prev - 1));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (sectorRef.current && !sectorRef.current.contains(target)) {
        setIsSectorOpen(false);
      }
      if (roleRef.current && !roleRef.current.contains(target)) {
        setIsRoleOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hashPassword = async (value: string) => {
    if (window.crypto?.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(value);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return value;
  };

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

      const hashedPass = await hashPassword(regPass);

      const payload = {
        name: regName,
        email: regEmail,
        password: hashedPass,
        company_name: regCompany,
        company_sector: regSector,
        business_summary: regSummary,
        user_role: regRole,
        plan: regPlan,
        smtp_host: '',
        smtp_port: '',
        smtp_user: '',
        smtp_pass: ''
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
          userRole: newUser.user_role,
          subscriptionPlan: newUser.plan || regPlan
        });
        setShowSplash(false);
      }, 5000);
    } catch (err: any) {
      setError(err?.message || 'Erro ao registrar. Verifique sua conexão.');
      setLoading(false);
    }
  };

  const renderPlanCard = (
    value: 'Start' | 'Pro' | 'Growth' | 'Enterprise',
    title: string,
    desc: string,
    perks: string[],
    accent: string
  ) => {
    const active = regPlan === value;
    return (
      <button
        type="button"
        onClick={() => setRegPlan(value)}
        className={`group relative overflow-hidden rounded-md border p-3 text-left transition-all duration-200 ${
          active ? 'glass-purple border-transparent shadow-lg shadow-purple-500/30' : 'bg-white/5 border-white/15 hover:border-white/30'
        }`}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className={`absolute w-20 h-20 ${accent} blur-3xl -top-6 -left-6 opacity-80`} />
          <div className="absolute w-24 h-24 bg-purple-500/20 blur-3xl top-4 right-0 opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5" />
        </div>
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/60">{value}</p>
            <h4 className="text-white font-bold text-sm leading-tight">{title}</h4>
            <p className="text-white/80 text-xs mt-1">{desc}</p>
          </div>
          {active && <CheckCircle2 className="w-4 h-4 text-white" />}
        </div>
        <div className="relative mt-2 flex flex-wrap gap-1">
          {perks.map((perk) => (
            <span key={perk} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/15 border border-white/20 text-white/90 backdrop-blur">
              {perk}
            </span>
          ))}
        </div>
      </button>
    );
  };

  return (
    <div className="dark min-h-screen relative overflow-hidden bg-transparent flex items-center justify-center px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_18%,rgba(168,85,247,0.22),transparent_38%),radial-gradient(circle_at_86%_16%,rgba(217,70,239,0.14),transparent_40%),radial-gradient(circle_at_55%_84%,rgba(59,130,246,0.10),transparent_44%)] opacity-95" />
      <div className="pointer-events-none absolute inset-0 opacity-35 bg-[linear-gradient(to_right,rgba(168,85,247,0.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(168,85,247,0.14)_1px,transparent_1px),linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:56px_56px,56px_56px,8px_8px,8px_8px] [mask-image:radial-gradient(circle_at_45%_18%,black_0%,transparent_70%)]" />
      <div className="pointer-events-none absolute -left-40 -top-36 h-96 w-96 rounded-full bg-purple-500/14 blur-3xl" />
      <div className="pointer-events-none absolute -right-36 top-10 h-80 w-80 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="pointer-events-none absolute right-24 bottom-10 h-72 w-72 rounded-full bg-indigo-500/12 blur-3xl" />
      {showSplash && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-xl bg-black/60">
          <img src="https://i.imgur.com/xdP1hfd.png" alt="GeoCRM" className="h-20 w-auto object-contain mb-3 drop-shadow-lg" />
          <p className="text-sm font-semibold text-white/90">Carregando essa experiência glass roxa...</p>
        </div>
      )}

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-96 h-96 bg-purple-500/25 blur-[120px] -top-20 -left-16" />
        <div className="absolute w-80 h-80 bg-fuchsia-500/20 blur-[120px] bottom-0 right-6" />
        <div className="absolute w-72 h-72 bg-blue-500/20 blur-[110px] top-24 right-24" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.04),transparent_30%)]" />
      </div>

      <div className="relative w-full max-w-6xl space-y-4 z-10 mx-auto">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-xs text-white/70 hover:text-white underline underline-offset-4"
          >
            Já tem conta? Login
          </button>
        </div>

        <div className="glass-panel relative overflow-visible rounded-md border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl shadow-purple-900/40">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5" />
            <div className="absolute w-56 h-56 bg-purple-500/20 blur-3xl -top-16 -right-10" />
          </div>

          <div className="relative p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-xs">GeoCRM Intelligence</p>
                <h2 className="text-2xl font-bold text-white">Crie sua conta</h2>
                <p className="text-white/60 text-sm mt-1">Cadastro em etapas rápidas.</p>
              </div>
                <img src="https://i.imgur.com/xdP1hfd.png" alt="GeoCRM Logo" className="h-20 w-auto object-contain drop-shadow" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {steps.map((step, index) => (
                <React.Fragment key={step.id}>
                  <div
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                      currentStep === step.id
                        ? 'glass-purple text-white'
                        : currentStep > step.id
                          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                          : 'bg-white/5 text-white/60 border border-white/15'
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[11px] font-bold">
                      {currentStep > step.id ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <step.icon className="w-3.5 h-3.5" />
                      )}
                    </span>
                    <div>
                      <div className="font-semibold">{step.title}</div>
                      <div className="text-[10px] opacity-80">{step.desc}</div>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`hidden md:block w-8 h-px ${
                        currentStep > step.id ? 'bg-emerald-400' : 'bg-white/20'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {currentStep === 1 && (
                <div className="space-y-4 animate-in slide-in-from-right-5 duration-300">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.1em] text-white/70 font-semibold">Nome completo</label>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-md border border-white/15 bg-white/5 backdrop-blur">
                      <IdCard className="w-4 h-4 text-white/70" />
                      <input
                        required
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="w-full bg-transparent outline-none text-white placeholder:text-white/50"
                        placeholder="Seu nome completo"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.1em] text-white/70 font-semibold">Empresa</label>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-md border border-white/15 bg-white/5 backdrop-blur">
                      <Building className="w-4 h-4 text-white/70" />
                      <input
                        required
                        value={regCompany}
                        onChange={(e) => setRegCompany(e.target.value)}
                        className="w-full bg-transparent outline-none text-white placeholder:text-white/50"
                        placeholder="Sua empresa"
                      />
                    </div>
                  </div>
                  <div className="space-y-2" ref={sectorRef}>
                    <label className="text-xs uppercase tracking-[0.1em] text-white/70 font-semibold">Setor de atuação</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsSectorOpen(!isSectorOpen)}
                        className="w-full px-4 py-3 pl-11 rounded-md border border-white/15 bg-white/5 backdrop-blur text-left text-white flex items-center justify-between"
                      >
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <span className="truncate">{regSector}</span>
                        <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${isSectorOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isSectorOpen && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-[#0f1024] border border-white/10 rounded-md shadow-2xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                          {SECTORS.map((sector) => (
                            <div
                              key={sector}
                              onClick={() => {
                                setRegSector(sector);
                                setIsSectorOpen(false);
                              }}
                              className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                                regSector === sector ? 'bg-purple-500/20 text-white' : 'text-white/80 hover:bg-white/5'
                              }`}
                            >
                              {sector}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2" ref={roleRef}>
                    <label className="text-xs uppercase tracking-[0.1em] text-white/70 font-semibold">Você é?</label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsRoleOpen(!isRoleOpen)}
                        className="w-full px-4 py-3 pl-11 rounded-md border border-white/15 bg-white/5 backdrop-blur text-left text-white flex items-center justify-between"
                      >
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <span className="truncate">{regRole}</span>
                        <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${isRoleOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isRoleOpen && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-[#0f1024] border border-white/10 rounded-md shadow-2xl z-50 max-h-40 overflow-y-auto custom-scrollbar">
                          {['Dono', 'Gerente', 'Administrador', 'Supervisor'].map((role) => (
                            <div
                              key={role}
                              onClick={() => {
                                setRegRole(role);
                                setIsRoleOpen(false);
                              }}
                              className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                                regRole === role ? 'bg-purple-500/20 text-white' : 'text-white/80 hover:bg-white/5'
                              }`}
                            >
                              {role}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={nextStep} className="glass-purple px-6 py-2 rounded-md text-sm font-semibold">Próximo</button>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="space-y-4 animate-in slide-in-from-right-5 duration-300">
                  <div className="space-y-3">
                    <label className="text-xs uppercase tracking-[0.1em] text-white/70 font-semibold">Escolha seu plano</label>
                    <div className="grid grid-cols-2 gap-3">
                      {renderPlanCard('Start', 'Start', 'Para começar rápido', ['50 leads/mês', '1 automação'], 'bg-blue-500/30')}
                      {renderPlanCard('Pro', 'Pro', 'Para squads com IA', ['200 leads/mês', '3 automações'], 'bg-purple-500/40')}
                      {renderPlanCard('Growth', 'Growth', 'Escala com times', ['1000 leads/mês', '10 automações'], 'bg-pink-500/30')}
                      {renderPlanCard('Enterprise', 'Enterprise', 'SSO e suporte dedicado', ['Ilimitado', 'SLA dedicado'], 'bg-emerald-500/30')}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <button type="button" onClick={prevStep} className="px-6 py-2 rounded-md text-sm border border-white/15 bg-white/5 text-white/80">Voltar</button>
                    <button type="button" onClick={nextStep} className="glass-purple px-6 py-2 rounded-md text-sm font-semibold">Próximo</button>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="space-y-4 animate-in slide-in-from-right-5 duration-300">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.1em] text-white/70 font-semibold">Email</label>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-md border border-white/15 bg-white/5 backdrop-blur">
                      <Mail className="w-4 h-4 text-white/70" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full bg-black/10 outline-none text-white placeholder:text-white/50"
                        placeholder="seu@email.com"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.1em] text-white/70 font-semibold">Senha</label>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-md border border-white/15 bg-white/5 backdrop-blur">
                      <Lock className="w-4 h-4 text-white/70" />
                      <input
                        type="password"
                        required
                        value={regPass}
                        onChange={(e) => setRegPass(e.target.value)}
                        className="w-full bg-black/10 outline-none text-white placeholder:text-white/50"
                        placeholder="Criar senha"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.1em] text-white/70 font-semibold">Confirmar Senha</label>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-md border border-white/15 bg-white/5 backdrop-blur">
                      <Lock className="w-4 h-4 text-white/70" />
                      <input
                        type="password"
                        required
                        value={regPassConfirm}
                        onChange={(e) => setRegPassConfirm(e.target.value)}
                        className="w-full bg-black/10 outline-none text-white placeholder:text-white/50"
                        placeholder="Confirmar senha"
                      />
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <button type="button" onClick={prevStep} className="px-6 py-2 rounded-md text-sm border border-white/15 bg-white/5 text-white/80">Voltar</button>
                    <button type="button" onClick={nextStep} className="glass-purple px-6 py-2 rounded-md text-sm font-semibold">Próximo</button>
                  </div>
                </div>
              )}

              {currentStep === 4 && (
                <div className="space-y-4 animate-in slide-in-from-right-5 duration-300">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.1em] text-white/70 font-semibold">Fale sobre seu negócio</label>
                    <textarea
                      value={regSummary}
                      onChange={(e) => setRegSummary(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-3 rounded-md border border-white/15 bg-white/5 backdrop-blur text-white outline-none placeholder:text-white/50 resize-none"
                      placeholder="Seu nicho, ticket médio, diferenciais..."
                    />
                  </div>
                  <div
                    onClick={() => setCaptchaVerified(true)}
                    className={`border rounded-md p-3 flex items-center gap-3 cursor-pointer select-none transition-all ${
                      captchaVerified ? 'bg-emerald-500/10 border-emerald-400/50' : 'bg-white/5 border-white/15 hover:border-white/30'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded border flex items-center justify-center bg-white/10 shadow-sm transition-all ${
                        captchaVerified ? 'border-emerald-400' : 'border-white/20'
                      }`}
                    >
                      {captchaVerified ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                      ) : (
                        <div className="w-3 h-3 rounded-sm border-2 border-white/30" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white font-medium">{captchaVerified ? 'Verificado' : 'Não sou um robô'}</p>
                    </div>
                    <ShieldCheck className="w-5 h-5 text-white/60" />
                  </div>
                  {error && (
                    <p className="text-xs text-red-100 bg-red-500/15 border border-red-400/30 rounded-lg py-2 px-3">{error}</p>
                  )}
                  <div className="flex justify-between">
                    <button type="button" onClick={prevStep} className="px-6 py-2 rounded-md text-sm border border-white/15 bg-white/5 text-white/80">Voltar</button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="glass-purple px-6 py-2 rounded-md text-sm font-semibold flex items-center gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Conta'}
                      {!loading && <Rocket className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
