import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, Loader2 } from 'lucide-react';
import { AppSettings } from '../types';
import { supabaseRequest } from '../services/supabaseClient';

interface LoginProps {
  onLogin: (userData?: Partial<AppSettings> & { id?: string }) => void;
  onSwitchToRegister?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, onSwitchToRegister }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
        const data = await supabaseRequest<any[]>('users', { query: `?email=eq.${encodeURIComponent(email)}&password=eq.${encodeURIComponent(password)}` });
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
            userRole: user.user_role
        });
    } catch (err: any) {
        setError('Erro ao autenticar. Verifique sua conexão.');
        setLoading(false);
    }
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
           <h2 className="text-2xl font-bold text-gray-800">Bem-vindo de volta!</h2>
           <p className="text-gray-500 text-sm mt-1 text-center">Acesse o painel de inteligência.</p>
        </div>

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
                        placeholder="seu@email.com"
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
                <button type="button" onClick={onSwitchToRegister} className="text-xs text-gray-500 font-medium hover:underline">
                    Não tem conta? Crie uma agora.
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
