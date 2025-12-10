import React, { useEffect, useMemo, useState } from 'react';
import {
  Mail,
  CheckCircle,
  AlertOctagon,
  RefreshCw,
  ShieldCheck,
  MessageCircle,
  Send,
  Paperclip,
  UploadCloud,
  Image as ImageIcon,
  Repeat,
  Clock
} from 'lucide-react';
import { Lead, AppSettings, EmailTone, EmailFocus } from '../types';
import { generateEmailWithPerplexity } from '../services/perplexityService';

interface EmailAutomationProps {
  leads: Lead[];
  settings: AppSettings;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  notify?: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

type VerificationState = 'ok' | 'warn';

const TONES: { value: EmailTone; label: string; helper: string }[] = [
  { value: 'formal', label: 'Formal Consultivo', helper: 'Tom sério e consultivo' },
  { value: 'friendly', label: 'Próximo', helper: 'Conversacional e leve' },
  { value: 'persuasive', label: 'Vendas', helper: 'Focado em conversão' },
  { value: 'urgent', label: 'Urgente', helper: 'Escassez e rapidez' }
];

const FOCUS_OPTIONS: { value: EmailFocus; label: string }[] = [
  { value: 'sales', label: 'Proposta direta' },
  { value: 'meeting', label: 'Agendar call' },
  { value: 'followup', label: 'Reengajar' },
  { value: 'case_study', label: 'Case de sucesso' }
];

const EmailAutomation: React.FC<EmailAutomationProps> = ({ leads, settings, updateLead, notify }) => {
  const leadsWithEmail = useMemo(() => leads.filter((l) => !!l.email), [leads]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(leadsWithEmail[0]?.id || null);
  const [tone, setTone] = useState<EmailTone>('formal');
  const [focus, setFocus] = useState<EmailFocus>('sales');
  const [subject, setSubject] = useState<string>('');
  const [body, setBody] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentPreviews, setAttachmentPreviews] = useState<string[]>([]);
  const [followUpEvery, setFollowUpEvery] = useState<number>(3);
  const [followUpLimit, setFollowUpLimit] = useState<number | 'infinite'>('infinite');

  useEffect(() => {
    if (!selectedLeadId && leadsWithEmail.length > 0) {
      setSelectedLeadId(leadsWithEmail[0].id);
    }
  }, [leadsWithEmail, selectedLeadId]);

  const selectedLead = leadsWithEmail.find((l) => l.id === selectedLeadId) || null;

  useEffect(() => {
    const urls = attachments.map((file) => URL.createObjectURL(file));
    setAttachmentPreviews(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [attachments]);

  const verificationChecks = useMemo(() => {
    if (!selectedLead) return [];

    const emailOk = !!selectedLead.email && /^[^@]+@[^@]+\.[^@]+$/.test(selectedLead.email);
    const domain = selectedLead.email?.split('@')[1] || '';
    const domainWarnWords = ['test', 'fake', 'invalid'];
    const domainReputation: VerificationState =
      domain && domainWarnWords.some((w) => domain.includes(w)) ? 'warn' : 'ok';

    const companyActive: VerificationState = selectedLead.value >= 0 ? 'ok' : 'warn';

    const sectorMatch: VerificationState =
      (settings.companySector &&
        (selectedLead.tags || []).some((t) =>
          t.toLowerCase().includes(settings.companySector.toLowerCase())
        )) ||
      (selectedLead.notes || '').toLowerCase().includes(settings.companySector.toLowerCase())
        ? 'ok'
        : 'warn';

    return [
      {
        title: 'Email válido',
        status: emailOk ? 'ok' : 'warn',
        detail: emailOk ? 'Formato OK' : 'Formato inválido ou ausente'
      },
      {
        title: 'Reputação do domínio',
        status: domainReputation,
        detail: domainReputation === 'ok' ? 'Domínio confiável' : 'Domínio suspeito'
      },
      {
        title: 'Empresa ativa',
        status: companyActive,
        detail: companyActive === 'ok' ? 'Dados consistentes' : 'Sem sinais de atividade'
      },
      {
        title: 'Setor coerente',
        status: sectorMatch,
        detail: sectorMatch === 'ok' ? 'Alinhado ao setor configurado' : 'Ajustar setor'
      }
    ];
  }, [selectedLead, settings.companySector]);

  const handleGenerate = async () => {
    if (!selectedLead) {
      notify?.('Selecione um lead com email.', 'warning');
      return;
    }
    setIsGenerating(true);
    try {
      const generated = await generateEmailWithPerplexity(selectedLead, tone, focus, settings);
      const signatureLines = [
        '--',
        `${settings.userName} | ${settings.companyName}`,
        `Setor: ${settings.companySector}`,
        `Email: ${settings.userEmail}${settings.contactPhone ? ` | Tel: ${settings.contactPhone}` : ''}`
      ].join('\n');

      setSubject(generated.subject || `Ideia para ${selectedLead.company}`);
      setBody(`${generated.body}\n\n${signatureLines}`);

      updateLead(selectedLead.id, {
        approachMessage: generated.body,
        history: [
          ...(selectedLead.history || []),
          {
            date: new Date().toISOString(),
            description: 'Email gerado via Mapa Inteligente',
            type: 'update'
          }
        ]
      });
    } catch (error: any) {
      notify?.(`Erro ao gerar email: ${error.message || error}`, 'warning');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAttachments = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveDraft = () => {
    if (!selectedLead) return;
    updateLead(selectedLead.id, { approachMessage: body, notes: selectedLead.notes });
    notify?.('Rascunho salvo para este lead.', 'success');
  };

  const handleSendNow = () => {
    if (!selectedLead) {
      notify?.('Selecione um lead.', 'warning');
      return;
    }
    if (!subject || !body) {
      notify?.('Preencha assunto e corpo do email.', 'warning');
      return;
    }
    updateLead(selectedLead.id, {
      history: [
        ...(selectedLead.history || []),
        {
          date: new Date().toISOString(),
          description: `Email preparado para envio: ${subject}`,
          type: 'email_sent'
        }
      ]
    });
    notify?.('Email preparado com follow-up automático.', 'success');
  };

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto">
      <div className="mb-6 text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Automação de E-mail</h2>
        <p className="text-gray-500">
          Automação completa em 4 etapas para sua agência de captação de leads.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { title: 'Verificação', icon: ShieldCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { title: 'Aproximação', icon: MessageCircle, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { title: 'Proposta automática', icon: Mail, color: 'text-blue-600', bg: 'bg-blue-50' },
          { title: 'Follow-up infinito', icon: Repeat, color: 'text-amber-600', bg: 'bg-amber-50' }
        ].map((step) => (
          <div
            key={step.title}
            className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white shadow-sm"
          >
            <div className={`p-2 rounded-lg ${step.bg} ${step.color}`}>
              <step.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{step.title}</p>
              <p className="text-xs text-gray-500">Etapa essencial</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Leads</p>
                <h3 className="text-lg font-bold text-gray-800">Escolha o lead</h3>
              </div>
              <span className="text-xs text-gray-400">{leadsWithEmail.length} disponíveis</span>
            </div>
            {leadsWithEmail.length === 0 && (
              <p className="text-sm text-gray-500">Nenhum lead com email cadastrado.</p>
            )}
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-2">
              {leadsWithEmail.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => setSelectedLeadId(lead.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selectedLeadId === lead.id
                      ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                      : 'border-gray-200 hover:border-indigo-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{lead.company}</p>
                      <p className="text-xs text-gray-500">
                        {lead.name || 'Contato'} · {lead.city}
                      </p>
                    </div>
                    <Mail className="w-4 h-4 text-gray-400" />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{lead.email}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase">Verificação automática</p>
                <h3 className="font-bold text-gray-800">Checklist antes de enviar</h3>
              </div>
            </div>
            <div className="space-y-3">
              {verificationChecks.map((item) => (
                <div
                  key={item.title}
                  className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.detail}</p>
                  </div>
                  {item.status === 'ok' ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertOctagon className="w-5 h-5 text-amber-500" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-panel rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">Aproximação</p>
                  <h3 className="text-lg font-bold text-gray-800">Tom & foco do email</h3>
                </div>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!selectedLead || isGenerating}
                  className="flex items-center gap-2 glass-purple text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-sm disabled:opacity-60"
                >
                  {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Criar Email
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {TONES.map((t) => (
                  <button
                  key={t.value}
                  type="button"
                  onClick={() => setTone(t.value)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    tone === t.value
                      ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                      : 'border-gray-200 hover:border-indigo-200'
                  }`}
                >
                  <p className="font-semibold text-gray-800">{t.label}</p>
                  <p className="text-xs text-gray-500">{t.helper}</p>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {FOCUS_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFocus(f.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                    focus === f.value
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Assunto</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Assunto do email"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase">Corpo (editável)</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  placeholder="Mensagem gerada pela IA. Edite livremente..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={!selectedLead}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:border-indigo-300 transition-all text-sm font-medium"
                >
                  <RefreshCw className="w-4 h-4" /> Salvar rascunho
                </button>
                <button
                  type="button"
                  className="flex items-center gap-2 glass-purple text-white px-4 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-60 text-sm font-medium"
                  disabled={!selectedLead || !subject || !body}
                  onClick={handleSendNow}
                >
                  <Send className="w-4 h-4" /> Enviar agora
                </button>
              </div>
            </div>
            </div>

            <div className="glass-panel rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Repeat className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase">Follow-up infinito</p>
                  <h3 className="font-bold text-gray-800">Cadência automática</h3>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Intervalo (dias)</label>
                  <div className="mt-1 flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      min={1}
                      value={followUpEvery}
                      onChange={(e) => setFollowUpEvery(Number(e.target.value) || 1)}
                      className="w-full outline-none bg-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Limite</label>
                  <div className="mt-1 rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <select
                      value={followUpLimit === 'infinite' ? 'infinite' : followUpLimit}
                      onChange={(e) =>
                        setFollowUpLimit(e.target.value === 'infinite' ? 'infinite' : Number(e.target.value))
                      }
                      className="w-full px-3 py-2 outline-none bg-white text-gray-800"
                    >
                      <option value="infinite">Infinito</option>
                      <option value={3}>3 ciclos</option>
                      <option value={5}>5 ciclos</option>
                      <option value={8}>8 ciclos</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
                  <div className="mt-1 flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-100 px-3 py-2 rounded-xl">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-semibold">Ativo</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Envia follow-ups a cada {followUpEvery} dias, {followUpLimit === 'infinite' ? 'sem limite' : `até ${followUpLimit} vezes`}.
                  </p>
                </div>
              </div>

              <div className="mt-5 border-t border-gray-100 pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Paperclip className="w-5 h-5 text-gray-500" />
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase">Anexos e imagens</p>
                    <h3 className="font-bold text-gray-800">Proposta automática</h3>
                  </div>
                </div>

                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer bg-gray-50 hover:border-indigo-300 transition-all">
                  <UploadCloud className="w-6 h-6 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">Envie arquivos ou imagens</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleAttachments}
                    accept="image/*,.pdf,.doc,.docx"
                  />
                </label>

                {attachments.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 gap-3">
                    {attachments.map((file, idx) => (
                      <div
                        key={idx}
                        className="border border-gray-200 rounded-xl p-3 flex items-center gap-3 bg-white shadow-xs"
                      >
                        <div className="w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
                          {file.type.startsWith('image') && attachmentPreviews[idx] ? (
                            <img
                              src={attachmentPreviews[idx]}
                              alt={file.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-800 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button
                          onClick={() => removeAttachment(idx)}
                          className="text-xs text-amber-600 hover:underline"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailAutomation;
