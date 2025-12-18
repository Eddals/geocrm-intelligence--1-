import React, { useState, useRef, useEffect, FormEvent, ChangeEvent } from "react";
import { 
  X, 
  Send, 
  ChevronRight, 
  HelpCircle, 
  CreditCard, 
  Loader2,
  CheckCircle2,
  MessageSquare,
  LogOut,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  Frown,
  Meh,
  Smile,
  User,
  Mail,
  ArrowLeft,
  Shield,
  Zap,
  Users,
  Lock,
  Rocket
} from "lucide-react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { generateSupportReply } from "../services/perplexityService";
import { Lead } from "../types";

let supabaseSingleton: SupabaseClient | null = null;
const getSupabaseClient = (url: string, key: string) => {
  if (!url || !key) return null;
  if (supabaseSingleton) return supabaseSingleton;
  supabaseSingleton = createClient(url, key);
  return supabaseSingleton;
};

const AGENT = {
  name: "Devtone Suporte",
  avatar: "https://i.imgur.com/Tl19ANB.png"
};

// Prefer env, fallback to provided key to evitar erro no browser.
const GENAI_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_GENAI_KEY) ||
  (typeof process !== 'undefined' && (process.env as any)?.API_KEY) ||
  "AIzaSyDGs4JcS5xzhKY--a_-Jnmamg2p4UNujp4";

const SYSTEM_INSTRUCTION = `
Você é um agente de suporte da empresa Devtone Leads. Seu nome é Devtone Suporte.
Seu tom de voz é: direto, resolutivo, amigável, em PT-BR.

DIRETRIZES DE RESPOSTA (IMPORTANTE):
1. SEJA BREVE E CONCISO. Use no máximo 2 ou 3 frases curtas por parágrafo. Vá direto ao ponto.
2. NUNCA use aspas ou blocos de código para texto normal.
3. USE **NEGRIRO** (com dois asteriscos) para destacar:
   - Nomes de botões (ex: **Salvar**, **Configurações**)
   - Atalhos ou termos técnicos importantes.
4. Explique o "o quê" e o "como" na mesma frase para economizar tempo.

ANÁLISE DE IMAGEM (SCREENSHOTS):
O usuário pode enviar imagens.
- Se for um **erro técnico** ou **interface do sistema**, analise o erro e dê a solução baseada no Guia abaixo.
- **SEGURANÇA**: Se a imagem for INAPROPRIADA (nudez, violência, conteúdo ofensivo) ou NÃO relacionada a software/trabalho, responda EXATAMENTE: "Desculpe, não posso processar essa imagem. Por favor, envie apenas screenshots relacionados ao suporte da Devtone Leads." e ignore o conteúdo da imagem.

SOBRE A DEVTONE LEADS:
- Visão: Soluções para agências, e-commerces e B2B. Resolvemos dores de falta de leads qualificados e processos manuais.
- Diferenciais: IA, automação, mapas de leads visualizáveis, integrações robustas.

GUIA DE RESOLUÇÃO DE PROBLEMAS (TROUBLESHOOTING TÉCNICO):

1. DASHBOARD:
   - Problema: Números incorretos ou cards não carregam.
   - Solução: Cheque se há filtros aplicados. O painel mostra leads do mês, valor de pipeline e top cidades.
   - Ação: Oriente atualizar a página (**F5**) ou revisar se o limite do plano foi atingido.

2. PIPELINE (KANBAN):
   - Problema: Mover leads ou editar dados.
   - Solução: O sistema usa drag-and-drop. Verifique limites de WIP na coluna. Para editar, clique no card.
   - Ação: Se faltar email/telefone, sugira usar o botão **Enriquecer** antes de mover o lead.

3. DISCOVERY / MAPA (CAPTAÇÃO):
   - Problema: Busca não retorna resultados.
   - Solução: **País**, **Estado** e **Cidade** são obrigatórios (ou filtros amplos demais).
   - Ação: Sugira ajustar filtros de **Rating** e **Indústria**. Se der erro, verifique as Chaves de API em **Configurações** ou o limite do plano.

4. CALENDÁRIO / AGENDAMENTO:
   - Problema: Não consegue agendar slot.
   - Solução: O lead precisa estar salvo no CRM antes.
   - Ação: Oriente escolher **Tipo de Agenda** e um horário livre. Confirme fuso **GMT-3** e integração Google/Outlook.

5. AUTOMAÇÃO DE E-MAIL:
   - Problema: E-mail não gera ou não envia.
   - Solução: Lead precisa de e-mail válido.
   - Ação: Selecione o lead, escolha **Tom/Foco**, clique em **Gerar** e revise. Para convites, selecione o provider (**Meet**/**Outlook**) antes.

6. LEAD MAP (VISUALIZAÇÃO GEOGRÁFICA):
   - Problema: Mapa vazio.
   - Solução: Leads precisam de Latitude/Longitude.
   - Ação: Use filtros de **Status/Valor**. Se não aparecerem, importe via **Discovery** ou corrija dados.

7. SETTINGS / CONFIGURAÇÕES:
   - Problema: Integrações ou Plano.
   - Solução: Chaves de API (**OpenAI**, **Google**) devem ser inseridas e salvas.
   - Ação: Vá em **Integrações**, cole a chave e clique em **SALVAR**. Para LGPD, cite botão de remover dados.

8. LOGIN / REGISTRO:
   - Problema: Acesso negado.
   - Ação: Confira email/senha. Use **Reset de Senha** se falhar. Se cadastro falhar, desative AdBlock.

PLANOS:
- **Essencial**: Para times iniciando.
- **Pro**: Operações em escala.
- **Enterprise**: Grandes equipes.

Se não souber: Peça desculpas brevemente e sugira suporte@devtone.com.
`;

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string;
  isTyping?: boolean;
}

type ChatState = 'form' | 'connecting' | 'chatting' | 'feedback' | 'faq' | 'pricing';

const DevtoneChatbox: React.FC<{ apiEndpoint?: string }> = ({ 
  apiEndpoint = "https://api.seusite.com/devtone-leads" 
}) => {
  const supabaseUrl =
    (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_URL || import.meta.env?.NEXT_PUBLIC_SUPABASE_URL)) ||
    (typeof process !== 'undefined' && ((process.env as any)?.VITE_SUPABASE_URL || (process.env as any)?.NEXT_PUBLIC_SUPABASE_URL)) ||
    '';
  const supabaseKey =
    (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_SUPABASE_ANON_KEY || import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY)) ||
    (typeof process !== 'undefined' && ((process.env as any)?.VITE_SUPABASE_ANON_KEY || (process.env as any)?.NEXT_PUBLIC_SUPABASE_ANON_KEY)) ||
    '';
  const supabaseRef = useRef<SupabaseClient | null>(getSupabaseClient(supabaseUrl, supabaseKey));

  const [isOpen, setIsOpen] = useState(true);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [tipoProblema, setTipoProblema] = useState("");
  const [aceitouCookies, setAceitouCookies] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [chatState, setChatState] = useState<ChatState>('form');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [sessionDbId, setSessionDbId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatState]);

  const formatMessage = (text: string) => {
    return text.split('\n').map((line, i, arr) => (
      <React.Fragment key={i}>
        {line.split(/(\*\*.*?\*\*)/).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={j} className="font-bold text-white drop-shadow-sm">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <span key={j}>{part}</span>;
        })}
        {i < arr.length - 1 && <br />}
      </React.Fragment>
    ));
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setAttachment(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!nome || !email || !tipoProblema || !aceitouCookies) {
      setFormError("Por favor, preencha todos os campos e aceite os termos.");
      return;
    }

    setChatState('connecting');

    try {
      console.log("Saving lead:", { nome, email, tipoProblema });
      await new Promise((resolve) => setTimeout(resolve, 3000));

       // Persist session (lead) on Supabase when available
      if (supabaseRef.current) {
        const { data, error } = await supabaseRef.current
          .from('chat_sessions')
          .insert({
            lead_name: nome,
            lead_email: email,
            lead_tipo_problema: tipoProblema,
            accepted_cookies: aceitouCookies,
            state: 'chatting'
          })
          .select('id')
          .single();
        if (!error && data?.id) setSessionDbId(data.id);
        if (error) console.error('Supabase session error', error);
      }

      const ai = new GoogleGenAI({ apiKey: GENAI_KEY });
      chatSessionRef.current = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction:
            SYSTEM_INSTRUCTION + `\n\nO nome do usuário é ${nome}. O problema descrito foi: ${tipoProblema}.`
        }
      });

      const initialMsgs: Message[] = [
        {
          id: 'init-1',
          role: 'user',
          text: `Olá, meu nome é ${nome.split(' ')[0]}. Gostaria de ajuda com: ${tipoProblema}`
        },
        {
          id: 'init-2',
          role: 'model',
          text: `Olá **${nome.split(' ')[0]}**! Aqui é **${AGENT.name}**. \n\nComo posso te ajudar especificamente com **${tipoProblema}** hoje?`
        }
      ];
      setMessages(initialMsgs);
      initialMsgs.forEach((msg) => persistMessage(msg));

      setChatState('chatting');
    } catch (err) {
      console.error(err);
      setChatState('form');
      setFormError("Erro ao conectar. Tente novamente.");
    }
  };

  const persistMessage = async (msg: Message) => {
    if (!supabaseRef.current || !sessionDbId) return;
    const { error } = await supabaseRef.current.from('chat_messages').insert({
      session_id: sessionDbId,
      role: msg.role,
      text: msg.text,
      image_url: msg.image || null,
      is_typing: msg.isTyping || false
    });
    if (error) console.error('Supabase message error', error);
  };

  const handleSendMessage = async (e?: FormEvent) => {
    e?.preventDefault();
    if ((!inputValue.trim() && !attachment) || !chatSessionRef.current) return;

    const userText = inputValue;
    const currentAttachment = attachment;
    setInputValue("");
    setAttachment(null);

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
      image: currentAttachment || undefined
    };
    setMessages((prev) => [...prev, newMessage]);
    persistMessage(newMessage);

    const typingId = 'typing-' + Date.now();
    setMessages((prev) => [...prev, { id: typingId, role: 'model', text: '', isTyping: true }]);

    try {
      let result;

      if (currentAttachment) {
        const base64Data = currentAttachment.split(',')[1];
        const mimeType = currentAttachment.split(';')[0].split(':')[1];
        result = await chatSessionRef.current.sendMessage({
          message: {
            parts: [
              { text: userText || "Analise esta imagem." },
              { inlineData: { mimeType, data: base64Data } }
            ]
          }
        });
      } else {
        result = await chatSessionRef.current.sendMessage({ message: userText });
      }

      const responseText = result.text;
      setMessages((prev) =>
        prev.map((msg) => (msg.id === typingId ? { ...msg, text: responseText, isTyping: false } : msg))
      );
      persistMessage({ id: typingId, role: 'model', text: responseText });
    } catch (error) {
      console.error("AI Error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === typingId
            ? { ...msg, text: "Desculpe, tive um problema de conexão. Poderia repetir?", isTyping: false }
            : msg
        )
      );
    }
  };

  const handleExitChat = () => {
    setChatState('feedback');
    setShowExitConfirmation(false);
  };

  const handleFeedbackSubmit = (rating: 'bad' | 'neutral' | 'good') => {
    console.log("User rating:", rating);
    setTimeout(() => {
      setChatState('form');
      setMessages([]);
      setNome("");
      setEmail("");
      setTipoProblema("");
      setAceitouCookies(false);
      setAttachment(null);
    }, 1500);
  };

  const renderFAQ = () => (
    <div className="flex flex-col h-full animate-fade-in-up">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setChatState('form')}
          className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold">Perguntas Frequentes</h3>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
        <div className="help-card p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2 text-violet-300 font-semibold">
            <Zap className="w-4 h-4" /> Integrações
          </div>
          <p className="text-sm text-white/80">Funciona com Google/Outlook, CRM interno e webhooks para automação total.</p>
        </div>

        <div className="help-card p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2 text-violet-300 font-semibold">
            <Lock className="w-4 h-4" /> Segurança
          </div>
          <p className="text-sm text-white/80">Dados criptografados em trânsito e em repouso; acesso com controles rígidos por perfil.</p>
        </div>

        <div className="help-card p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2 text-violet-300 font-semibold">
            <Users className="w-4 h-4" /> Suporte
          </div>
          <p className="text-sm text-white/80">Atendimento humano + IA 24/7, com SLA de resposta em minutos.</p>
        </div>

        <div className="help-card p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2 text-violet-300 font-semibold">
            <Rocket className="w-4 h-4" /> Implantação
          </div>
          <p className="text-sm text-white/80">Onboarding guiado, migração assistida e templates prontos para começar rápido.</p>
        </div>

        <div className="help-card p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2 text-violet-300 font-semibold">
            <Shield className="w-4 h-4" /> IA e Privacidade
          </div>
          <p className="text-sm text-white/80">IA treinada para não expor dados sensíveis; seguimos todas as normas da LGPD.</p>
        </div>
      </div>
    </div>
  );

  const renderPricing = () => (
    <div className="flex flex-col h-full animate-fade-in-up">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setChatState('form')}
          className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h3 className="text-lg font-bold">Planos e Preços</h3>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
        <div className="help-card p-4 rounded-xl border-l-4 border-l-blue-400">
          <div className="flex justify-between items-start mb-1">
            <h4 className="font-bold text-white">Essencial</h4>
          </div>
          <p className="text-xs text-white/70 mb-2">Para times iniciando automações.</p>
          <ul className="text-sm space-y-1 list-disc list-inside text-white/90">
            <li>Captura de leads</li>
            <li>Verificação básica</li>
            <li>E-mails IA</li>
          </ul>
        </div>

        <div className="help-card p-4 rounded-xl border-l-4 border-l-violet-400 bg-white/15">
          <div className="flex justify-between items-start mb-1">
            <h4 className="font-bold text-white">Pro</h4>
            <span className="text-[10px] bg-violet-500 px-2 py-0.5 rounded text-white font-bold">POPULAR</span>
          </div>
          <p className="text-xs text-white/70 mb-2">Para operações em escala.</p>
          <ul className="text-sm space-y-1 list-disc list-inside text-white/90">
            <li>Agenda inteligente</li>
            <li>Sequências de e-mail</li>
            <li>Integrações avançadas</li>
            <li>Dashboards</li>
          </ul>
        </div>

        <div className="help-card p-4 rounded-xl border-l-4 border-l-orange-400">
          <div className="flex justify-between items-start mb-1">
            <h4 className="font-bold text-white">Enterprise</h4>
          </div>
          <p className="text-xs text-white/70 mb-2">Para grandes equipes.</p>
          <ul className="text-sm space-y-1 list-disc list-inside text-white/90">
            <li>SSO & Limites ampliados</li>
            <li>Suporte dedicado</li>
            <li>Customizações</li>
          </ul>
        </div>

        <div className="help-card p-4 rounded-xl border-l-4 border-l-green-400">
          <div className="flex justify-between items-start mb-1">
            <h4 className="font-bold text-white">Teste / POC</h4>
          </div>
          <p className="text-xs text-white/70 mb-2">Valide com seus leads reais.</p>
          <p className="text-sm text-white/90">Período de avaliação guiada para validar nossa solução.</p>
        </div>
      </div>
    </div>
  );

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full bg-[linear-gradient(135deg,#8b5cf6,#7c3aed,#5b21b6)] border border-white/20 pl-2 pr-6 py-2 text-white shadow-[0_12px_30px_rgba(0,0,0,0.35)] transition-all hover:-translate-y-1 hover:shadow-2xl active:scale-95 animate-scale-in group"
      >
        <div className="relative">
          <img
            src={AGENT.avatar}
            alt="Dev AI"
            className="h-10 w-10 rounded-full border-2 border-white/30 object-cover bg-black/20"
          />
          <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-400 border-2 border-violet-600"></div>
        </div>
        <div className="flex flex-col items-start">
          <span className="text-xs font-medium text-white/80">Fale conosco</span>
          <span className="font-bold text-sm leading-none">Time Devtone</span>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex w-[380px] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-2xl animate-fade-in-up font-sans chat-dark h-[600px] max-h-[80vh]">
      <style>{`
        .chat-dark {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed, #5b21b6);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.15);
          box-shadow: 0 20px 50px rgba(0,0,0,0.35);
        }
        .chat-header {
          background: linear-gradient(135deg, #8b5cf6, #6d28d9);
          color: #fff;
          border-bottom: 1px solid rgba(255,255,255,0.2);
        }
        .chat-input {
          background: rgba(6, 5, 15, 0.2);
          border: 1px solid rgba(255,255,255,0.12);
          color: #e8e8ff;
          backdrop-filter: blur(10px);
        }
        .chat-input::placeholder { color: rgba(255,255,255,0.65); }
        .chat-input:focus {
           background: rgba(6, 5, 15, 0.32);
           border-color: rgba(255,255,255,0.28);
           outline: none;
        }
        .chat-btn {
          background: rgba(255,255,255,0.14);
          border: 1px solid rgba(255,255,255,0.2);
          color: #fff;
          cursor: pointer;
        }
        .chat-btn:hover { background: rgba(255,255,255,0.2); }
        .msg-user {
          background: rgba(255,255,255,0.15);
          color: #fff;
          border: 1px solid rgba(255,255,255,0.15);
        }
        .msg-ai {
          background: rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.9);
          border: 1px solid rgba(255,255,255,0.1);
        }
        .help-card {
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.2);
          color: #fff;
          transition: background 0.2s;
        }
        .help-card:hover { background: rgba(255,255,255,0.2); }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.4); }
        .snake-border {
          position: relative;
          overflow: hidden;
          border-radius: 9999px;
          color: white;
          z-index: 1;
        }
        .snake-border::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 400%;
          height: 400%;
          background: conic-gradient(transparent 90%, #ffffff 100%);
          transform: translate(-50%, -50%);
          animation: snakeRotate 4s linear infinite;
          z-index: -2;
        }
        .snake-border::after {
          content: '';
          position: absolute;
          inset: 2px;
          border-radius: 9999px;
          background: linear-gradient(135deg, #7c3aed, #5b21b6);
          z-index: -1;
        }
        @keyframes snakeRotate {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
      `}</style>

      <div className="relative chat-header p-6 pb-4 shrink-0">
        <button
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white transition-colors z-10"
          aria-label="Minimizar chat"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative hover:scale-105 transition-transform">
              <img
                src={AGENT.avatar}
                className="w-12 h-12 rounded-full border-2 border-white/20 shadow-md object-cover bg-black/20"
                alt={AGENT.name}
              />
              <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-400 border-2 border-violet-600"></div>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold">{AGENT.name}</span>
              <span className="text-xs text-white/60">Suporte Inteligente</span>
            </div>
          </div>

          <h2 className="text-2xl font-bold leading-tight mb-2">
            {chatState === 'chatting' ? "Chat Devtone" : "Estamos aqui para ajudar! 👋"}
          </h2>
          <p className="text-white/80 text-sm font-medium">
            {chatState === 'chatting'
              ? "Pergunte sobre planos, integrações ou suporte."
              : chatState === 'faq' || chatState === 'pricing'
                ? "Confira nossas informações detalhadas."
                : `Nosso agente ${AGENT.name} está disponível agora.`}
          </p>
        </div>
      </div>

      {chatState === 'chatting' ? (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end pl-8' : 'justify-start pr-4'} animate-fade-in-up`}
              >
                {msg.role === 'model' && (
                  <img
                    src={AGENT.avatar}
                    alt="Dev AI"
                    className="w-8 h-8 rounded-full border border-white/20 shadow-sm object-cover shrink-0 bg-black/20"
                  />
                )}

                {msg.isTyping ? (
                  <div className="bg-white/[0.1] border border-white/[0.1] p-4 rounded-2xl rounded-tl-none shadow-sm w-fit">
                    <div className="flex gap-1.5 h-full items-center">
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce"></div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {msg.image && (
                      <div
                        className={`p-1 rounded-2xl overflow-hidden border backdrop-blur-md ${
                          msg.role === 'user'
                            ? 'bg-white/[0.15] border-white/[0.15] rounded-tr-none'
                            : 'bg-white/[0.1] border-white/[0.1] rounded-tl-none'
                        }`}
                      >
                        <img src={msg.image} alt="Enviado" className="max-w-[150px] rounded-xl" />
                      </div>
                    )}
                    {msg.text && (
                      <div
                        className={`p-3.5 rounded-2xl text-sm shadow-sm leading-relaxed backdrop-blur-md ${
                          msg.role === 'user' ? 'msg-user rounded-tr-none' : 'msg-ai rounded-tl-none'
                        }`}
                      >
                        <p>{formatMessage(msg.text)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="shrink-0 p-4 bg-white/5 border-t border-white/10 backdrop-blur-lg z-20">
            {attachment && (
              <div className="flex items-center gap-2 mb-3 bg-white/10 p-2 rounded-lg border border-white/10 w-fit backdrop-blur-md animate-fade-in-up">
                <img src={attachment} className="h-12 w-12 rounded object-cover" alt="Preview" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-white/60 tracking-wider">Anexo</span>
                  <button
                    onClick={() => setAttachment(null)}
                    className="text-[11px] text-red-300 hover:text-red-100 flex items-center gap-1 mt-0.5"
                  >
                    <Trash2 className="w-3 h-3" /> Remover
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="chat-btn p-2.5 rounded-full text-white/80"
                title="Enviar imagem"
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />

              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Digite sua mensagem..."
                className="chat-input flex-1 rounded-full py-3 px-5 text-sm"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() && !attachment}
                className="chat-btn p-3 rounded-full text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="text-center mt-3 h-8 flex items-center justify-center">
              {!showExitConfirmation ? (
                <button
                  onClick={() => setShowExitConfirmation(true)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-200 hover:text-white border border-red-500/20 transition-all"
                >
                  <LogOut className="w-3 h-3" />
                  Sair do chat
                </button>
              ) : (
                <div className="flex items-center gap-3 animate-scale-in">
                  <span className="text-[11px] text-white/70 font-medium">Tem certeza?</span>
                  <button
                    onClick={handleExitChat}
                    className="px-3 py-1 rounded-full text-[10px] bg-red-500 hover:bg-red-600 text-white font-bold transition-all shadow-lg shadow-red-500/20"
                  >
                    Sim
                  </button>
                  <button
                    onClick={() => setShowExitConfirmation(false)}
                    className="px-3 py-1 rounded-full text-[10px] bg-white/10 hover:bg-white/20 text-white transition-all"
                  >
                    Não
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto relative custom-scrollbar">
          {chatState === 'form' && (
            <div className="p-6">
              <form onSubmit={handleSubmit} className="flex flex-col gap-3 animate-fade-in-up">
                <div className="group relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/80 z-10" />
                  <input
                    type="text"
                    placeholder="Digite seu nome completo"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="chat-input w-full rounded-xl pl-11 pr-4 py-3 text-sm"
                  />
                </div>

                <div className="group relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/80 z-10" />
                  <input
                    type="email"
                    placeholder="Digite seu e-mail"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="chat-input w-full rounded-xl pl-11 pr-4 py-3 text-sm"
                  />
                </div>

                <div className="group relative">
                  <MessageSquare className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/80 z-10" />
                  <input
                    type="text"
                    placeholder="Qual é o seu problema?"
                    value={tipoProblema}
                    onChange={(e) => setTipoProblema(e.target.value)}
                    className="chat-input w-full rounded-xl pl-11 pr-4 py-3 text-sm"
                  />
                </div>

                <label className="mt-1 flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={aceitouCookies}
                      onChange={(e) => setAceitouCookies(e.target.checked)}
                      className="peer h-4 w-4 appearance-none rounded border border-white/30 bg-white/10 checked:border-white checked:bg-white transition-all"
                    />
                    <CheckCircle2 className="pointer-events-none absolute h-4 w-4 text-violet-600 opacity-0 peer-checked:opacity-100 transition-opacity" />
                  </div>
                  <span className="text-xs text-white/70 select-none group-hover:text-white transition-colors leading-tight">
                    Concordo com a política de privacidade e cookies do site.
                  </span>
                </label>

                {formError && (
                  <div className="mt-2 rounded-lg bg-red-500/20 border border-red-500/30 p-3 text-xs font-medium backdrop-blur-md text-white/90">
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  className="snake-border mt-2 flex items-center justify-center gap-2 w-full rounded-full px-6 py-3.5 text-sm font-bold text-white disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  Começar conversa
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}

          {chatState === 'connecting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 animate-fade-in-up">
              <img src={AGENT.avatar} className="w-24 h-24 mb-6 object-contain animate-bounce" alt="Carregando" />
              <p className="text-lg text-white/90 text-center leading-relaxed">
                <strong>Carregando o chat incrível!</strong> 😄
              </p>
            </div>
          )}

          {chatState === 'faq' && (
            <div className="h-full p-6">
              {renderFAQ()}
            </div>
          )}

          {chatState === 'pricing' && (
            <div className="h-full p-6">
              {renderPricing()}
            </div>
          )}

          {chatState === 'feedback' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center animate-fade-in-up">
              <div className="bg-white/10 border border-white/20 p-6 rounded-2xl backdrop-blur-xl shadow-2xl">
                <h3 className="text-xl font-bold mb-2">Como foi o atendimento?</h3>
                <p className="text-sm text-white/70 mb-6">Ajude-nos a melhorar nosso suporte.</p>

                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => handleFeedbackSubmit('bad')}
                    className="group flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/10 transition-all"
                  >
                    <div className="text-3xl grayscale group-hover:grayscale-0 transition-all transform group-hover:scale-125">😡</div>
                    <span className="text-xs text-white/50 group-hover:text-white">Ruim</span>
                  </button>
                  <button
                    onClick={() => handleFeedbackSubmit('neutral')}
                    className="group flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/10 transition-all"
                  >
                    <div className="text-3xl grayscale group-hover:grayscale-0 transition-all transform group-hover:scale-125">😐</div>
                    <span className="text-xs text-white/50 group-hover:text-white">Médio</span>
                  </button>
                  <button
                    onClick={() => handleFeedbackSubmit('good')}
                    className="group flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/10 transition-all"
                  >
                    <div className="text-3xl grayscale group-hover:grayscale-0 transition-all transform group-hover:scale-125">😍</div>
                    <span className="text-xs text-white/50 group-hover:text-white">Ótimo</span>
                  </button>
                </div>
              </div>
              <p className="mt-8 text-xs text-white/40">Obrigado por usar Devtone Leads</p>
            </div>
          )}
        </div>
      )}

      {chatState === 'form' && (
        <>
          <div className="p-5 border-t border-white/15 bg-white/5 shrink-0">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-white/60">
              <HelpCircle className="h-3 w-3" />
              Centro de Ajuda
            </div>

            <div className="space-y-2">
              <button
                onClick={() => setChatState('faq')}
                className="help-card group flex w-full items-center justify-between rounded-xl p-3 text-left text-sm font-medium shadow-sm"
              >
                <span>Perguntas frequentes</span>
                <ChevronRight className="h-4 w-4 text-white/60 transition-transform group-hover:translate-x-1 group-hover:text-white" />
              </button>

              <button
                onClick={() => setChatState('pricing')}
                className="help-card group flex w-full items-center justify-between rounded-xl p-3 text-left text-sm font-medium shadow-sm"
              >
                <span className="flex items-center gap-2">
                  <CreditCard className="h-3.5 w-3.5 text-white/60 group-hover:text-white" />
                  Planos & preços
                </span>
                <ChevronRight className="h-4 w-4 text-white/60 transition-transform group-hover:translate-x-1 group-hover:text-white" />
              </button>
            </div>
          </div>
          <div className="bg-black/20 py-3 text-center text-[10px] text-white/40 border-t border-white/5 shrink-0">
            Powered by <strong className="font-semibold text-white/70">Devtone Leads</strong>
          </div>
        </>
      )}
    </div>
  );
};

export default DevtoneChatbox;
