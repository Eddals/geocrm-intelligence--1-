import React, { useEffect, useState } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  Sparkles,
  IdCard,
  Building2,
  Shield,
  Rocket,
  CheckCircle2
} from 'lucide-react';
import { AppSettings } from '../types';
import { supabaseRequest } from '../services/supabaseClient';

interface LoginProps {
  onLogin: (userData?: Partial<AppSettings> & { id?: string }) => void;
  onSwitchToRegister?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onSwitchToRegister }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [registerStep, setRegisterStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [plan, setPlan] = useState<'Essencial' | 'Pro' | 'Enterprise'>('Pro');
  const [error, setError] = useState('');

  const goToRegisterPage = () => {
    if (onSwitchToRegister) {
      onSwitchToRegister();
      return;
    }
    setMode('register');
  };

  const handleRegisterKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    const target = e.target as HTMLElement;
    const isSubmitButton = target instanceof HTMLButtonElement && target.type === 'submit';

    if (registerStep < 3) {
      e.preventDefault();
      nextStep();
      return;
    }

    if (!isSubmitButton) {
      e.preventDefault();
    }
  };

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

  useEffect(() => {
    if (mode === 'register') {
      setRegisterStep(1);
      setError('');
    }
  }, [mode]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const hashed = await hashPassword(password);
      const data = await supabaseRequest<any[]>('users', {
        query: `?email=eq.${encodeURIComponent(email)}&password=eq.${encodeURIComponent(hashed)}`
      });
      const user = data && data[0];
      if (!user) {
        setError('Credenciais inválidas.');
        setLoading(false);
        return;
      }
      onLogin({
        id: user.id,
        userName: user.name,
        userEmail: user.email,
        companyName: user.company_name,
        companySector: user.company_sector,
        businessSummary: user.business_summary,
        userRole: user.user_role,
        subscriptionPlan: user.plan || 'Start'
      });
    } catch (err: any) {
      setError('Erro ao autenticar. Verifique sua conexão.');
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerStep < 3) {
      setError('');
      nextStep();
      return;
    }
    if (!name || !email || !password || !company) {
      setError('Preencha todos os campos para criar a conta.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const hashed = await hashPassword(password);
      const created = await supabaseRequest<any>('users', {
        method: 'POST',
        query: '',
        body: {
          name,
          email,
          password: hashed,
          company_name: company,
          plan,
          user_role: 'Owner',
          business_summary: '',
          company_sector: ''
        }
      });

      const user = Array.isArray(created) ? created[0] : created;
      if (!user) throw new Error('Não foi possível criar a conta agora.');

      setTimeout(() => {
        onLogin({
          id: user.id,
          userName: user.name,
          userEmail: user.email,
          companyName: user.company_name,
          companySector: user.company_sector,
          businessSummary: user.business_summary,
          userRole: user.user_role,
          subscriptionPlan: user.plan || plan
        });
      }, 650);
    } catch (err: any) {
      setError('Erro ao criar conta. Verifique os dados ou tente novamente.');
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (registerStep === 1 && (!name || !email)) {
      setError('Informe nome e e-mail para avançar.');
      return;
    }
    if (registerStep === 2 && !company) {
      setError('Informe a empresa para avançar.');
      return;
    }
    setError('');
    setRegisterStep((prev) => Math.min(prev + 1, 3));
  };

  const prevStep = () => {
    setError('');
    setRegisterStep((prev) => Math.max(prev - 1, 1));
  };

  const renderPlanCard = (
    title: string,
    price: string,
    perks: string[],
    value: 'Essencial' | 'Pro' | 'Enterprise',
    accent: string
  ) => {
    const active = plan === value;
    return (
      <button
        type="button"
        onClick={() => setPlan(value)}
        className={`group relative overflow-hidden rounded-md border p-4 text-left transition-all duration-200 ${
          active
            ? 'glass-purple border-transparent shadow-lg shadow-purple-500/30'
            : 'bg-white/5 border-white/15 hover:border-white/30'
        }`}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className={`absolute w-32 h-32 ${accent} blur-3xl -top-12 -left-10 opacity-80`} />
          <div className="absolute w-36 h-36 bg-purple-500/25 blur-3xl top-8 right-0 opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5" />
        </div>
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-white/60">{value}</p>
            <h4 className="text-white font-bold text-lg leading-tight">{title}</h4>
            <p className="text-white/80 text-sm mt-1">{price}</p>
          </div>
          {active && <CheckCircle2 className="w-5 h-5 text-white" />}
        </div>
        <div className="relative mt-3 flex flex-wrap gap-2">
          {perks.map((perk) => (
            <span
              key={perk}
              className="text-[11px] px-2 py-1 rounded-full bg-white/15 border border-white/20 text-white/90 backdrop-blur"
            >
              {perk}
            </span>
          ))}
        </div>
      </button>
    );
  };

  const renderRegisterSteps = () => (
    <form onSubmit={handleRegisterSubmit} onKeyDown={handleRegisterKeyDown} className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {[1, 2, 3].map((step) => (
          <div
            key={step}
            className={`h-10 w-10 rounded-full border grid place-items-center text-xs font-extrabold tracking-wide ${
              registerStep >= step
                ? 'glass-purple border-transparent shadow-lg shadow-purple-500/30'
                : 'bg-white/5 border-white/15 text-white/70'
            }`}
          >
            {step}
          </div>
        ))}
        <div className="text-xs text-white/70">
          Onboarding roxo em 3 passos com plano + IA de e-mail.
        </div>
      </div>

      {registerStep === 1 && (
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.1em] text-white/70 font-semibold">Seu nome completo</label>
            <div className="flex items-center gap-3 px-4 py-3 rounded-md border border-white/15 bg-white/5 backdrop-blur">
              <IdCard className="w-4 h-4 text-white/70" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                className="bg-transparent outline-none w-full text-white placeholder:text-white/50"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.1em] text-white/70 font-semibold">E-mail de trabalho</label>
            <div className="flex items-center gap-3 px-4 py-3 rounded-md border border-white/15 bg-white/5 backdrop-blur">
              <Mail className="w-4 h-4 text-white/70" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@empresa.com"
                className="bg-transparent outline-none w-full text-white placeholder:text-white/50"
              />
            </div>
          </div>
        </div>
      )}

      {registerStep === 2 && (
        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.1em] text-white/70 font-semibold">Empresa</label>
            <div className="flex items-center gap-3 px-4 py-3 rounded-md border border-white/15 bg-white/5 backdrop-blur">
              <Building2 className="w-4 h-4 text-white/70" />
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Nome da sua empresa"
                className="bg-transparent outline-none w-full text-white placeholder:text-white/50"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.1em] text-white/70 font-semibold">Senha</label>
            <div className="flex items-center gap-3 px-4 py-3 rounded-md border border-white/15 bg-white/5 backdrop-blur">
              <Lock className="w-4 h-4 text-white/70" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Crie uma senha forte"
                className="bg-transparent outline-none w-full text-white placeholder:text-white/50"
              />
            </div>
          </div>
          <div className="text-[11px] text-white/60">
            Dica: use ao menos 8 caracteres com letras, números e símbolos.
          </div>
        </div>
      )}

      {registerStep === 3 && (
        <div className="space-y-3">
          <p className="text-sm text-white/80">Escolha seu plano para começar:</p>
          <div className="grid grid-cols-1 gap-3">
            {renderPlanCard(
              'Essencial',
              'Para começar: capturas e e-mails IA básicos.',
              ['Kanban simples', 'E-mails IA', 'Verificação'],
              'Essencial',
              'bg-pink-500/40'
            )}
            {renderPlanCard(
              'Pro',
              'Para escalar: sequências, agenda e integrações.',
              ['Sequências', 'Agenda inteligente', 'Dashboards'],
              'Pro',
              'bg-purple-500/50'
            )}
            {renderPlanCard(
              'Enterprise',
              'Sob medida: SSO e suporte dedicado.',
              ['SSO & RBAC', 'SLA dedicado', 'Custom APIs'],
              'Enterprise',
              'bg-blue-500/40'
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-100 bg-red-500/15 border border-red-400/30 rounded-md py-2 px-3">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={prevStep}
          disabled={registerStep === 1 || loading}
          className="px-4 py-3 rounded-md border border-white/15 bg-white/5 text-white/80 disabled:opacity-40"
        >
          Voltar
        </button>
        {registerStep < 3 ? (
          <button type="button" onClick={nextStep} className="glass-purple px-4 py-3 rounded-md text-sm font-semibold flex items-center gap-2">
            Próxima etapa
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button type="submit" disabled={loading} className="glass-purple px-4 py-3 rounded-md text-sm font-semibold flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar conta'}
            {!loading && <Rocket className="w-4 h-4" />}
          </button>
        )}
      </div>
    </form>
  );

  return (
    <div className="dark min-h-screen relative overflow-hidden bg-gradient-to-br from-[#050312] via-[#0b0f2a] to-[#0a001f] flex items-center justify-center px-4 py-10 text-white">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute w-96 h-96 bg-purple-500/25 blur-[120px] -top-20 -left-16" />
        <div className="absolute w-80 h-80 bg-fuchsia-500/20 blur-[120px] bottom-0 right-6" />
        <div className="absolute w-72 h-72 bg-blue-500/20 blur-[110px] top-24 right-24" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.04),transparent_30%)]" />
      </div>

      <div className="relative w-full max-w-6xl space-y-6 z-10">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="text-xs text-white/60 flex items-center gap-2">
            <Shield className="w-4 h-4" /> Segurança + automação de e-mail na mesma energia visual.
          </div>
        </div>

        <div className="grid md:grid-cols-[1.05fr_0.95fr] gap-6 items-start">
          <div className="glass-panel relative overflow-hidden rounded-md border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl shadow-purple-900/40">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5" />
              <div className="absolute w-56 h-56 bg-purple-500/20 blur-3xl -top-16 -right-10" />
            </div>

            <div className="relative p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-xs">GeoCRM Intelligence</p>
                  <h2 className="text-3xl font-bold text-white">Login & Cadastro</h2>
                  <p className="text-white/60 text-sm mt-1">Mesma estética glass roxa das telas de Automação & Email.</p>
                </div>
                <img
                  src="https://i.imgur.com/HkMra5d.png"
                  alt="GeoCRM Logo"
                  className="h-16 w-auto object-contain drop-shadow"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`flex-1 px-4 py-3 rounded-md text-sm font-semibold border transition-all ${
                    mode === 'login'
                      ? 'glass-purple border-transparent shadow-lg shadow-purple-500/30'
                      : 'bg-white/5 border-white/15 text-white/80 hover:border-white/30'
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={goToRegisterPage}
                  className={`flex-1 px-4 py-3 rounded-md text-sm font-semibold border transition-all ${
                    mode === 'register'
                      ? 'glass-purple border-transparent shadow-lg shadow-purple-500/30'
                      : 'bg-white/5 border-white/15 text-white/80 hover:border-white/30'
                  }`}
                >
                  Criar conta
                </button>
              </div>

              {mode === 'login' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-[0.1em] text-white/70 font-semibold">Email</label>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-md border border-white/15 bg-white/5 backdrop-blur">
                      <Mail className="w-4 h-4 text-white/70" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        className="bg-transparent outline-none w-full text-white placeholder:text-white/50"
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
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-transparent outline-none w-full text-white placeholder:text-white/50"
                      />
                    </div>
                  </div>

                  {error && (
                    <p className="text-xs text-red-100 bg-red-500/15 border border-red-400/30 rounded-md py-2 px-3">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                  className="glass-purple w-full justify-center px-4 py-3 rounded-md text-sm font-semibold flex items-center gap-2"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar no sistema'}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>

                  <p className="text-[11px] text-white/60 text-center">
                    Não tem conta?{' '}
                    <button
                      type="button"
                      className="text-white font-semibold hover:underline"
                      onClick={goToRegisterPage}
                    >
                      Crie em etapas rápidas.
                    </button>
                  </p>
                </form>
              ) : (
                renderRegisterSteps()
              )}
            </div>
          </div>

          <div className="glass-panel relative overflow-hidden rounded-md border border-white/10 p-6 bg-white/5 backdrop-blur-2xl shadow-xl shadow-black/30">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute w-56 h-56 bg-purple-500/25 blur-3xl -top-12 -left-6" />
              <div className="absolute w-40 h-40 bg-indigo-500/20 blur-3xl bottom-0 right-0" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-white/5" />
            </div>

            <div className="relative space-y-5">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-white" />
                <div>
                  <p className="text-xs text-white/70">Automação & Email</p>
                  <h3 className="text-xl font-bold text-white">O que você já recebe no painel</h3>
                </div>
              </div>

              <div className="space-y-3 text-sm text-white/80">
                <div className="flex items-start gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 mt-0.5" />
                  <p>Mapa de leads e pipeline visual para acompanhar oportunidades em tempo real.</p>
                </div>
                <div className="flex items-start gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 mt-0.5" />
                  <p>E-mails IA, sequências e follow-ups automáticos prontos para usar.</p>
                </div>
                <div className="flex items-start gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 mt-0.5" />
                  <p>Agenda e automações plugadas em calendários, CRM e webhooks.</p>
                </div>
                <div className="flex items-start gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300 mt-0.5" />
                  <p>Templates prontos para e-mails, fluxos e onboarding do time.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs text-white/70">
                <div className="rounded-md border border-white/10 bg-white/5 p-3">
                  <span className="text-white font-semibold">Playbooks rápidos</span>
                  <p className="mt-1 text-white/70">Checklists, timelines e integrações assistidas.</p>
                </div>
                <div className="rounded-md border border-white/10 bg-white/5 p-3">
                  <span className="text-white font-semibold">Central de arquivos</span>
                  <p className="mt-1 text-white/70">Templates, tutoriais e modelos de e-mail prontos.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
