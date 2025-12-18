
import { AppSettings } from '../types';

interface EmailPayload {
  host: string;
  port: string;
  user: string;
  pass: string;
  to: string;
  subject: string;
  body: string;
}

export interface EmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ScheduleEmailResponse {
  success: boolean;
  jobId?: string;
  runAt?: string;
  error?: string;
}

export interface ScheduledJob {
  id: string;
  status: 'scheduled' | 'sending' | 'sent' | 'failed' | 'canceled';
  createdAt: string;
  updatedAt: string;
  attempts: number;
  lastError?: string | null;
  messageId?: string | null;
  runAt: string;
  timeZone?: string;
  sendWindow?: string;
}

export interface SmtpVerifyResponse {
  success: boolean;
  message?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  error?: string;
  code?: string;
  responseCode?: number;
}

const resolveBackendBaseUrl = () => {
  const host =
    (typeof window !== 'undefined' && window.location && window.location.hostname) ? window.location.hostname : 'localhost';
  return (import.meta as any)?.env?.VITE_BACKEND_URL || `http://${host}:3001`;
};

export const sendRealEmail = async (settings: AppSettings, to: string, subject: string, body: string): Promise<EmailResponse> => {
  try {
    const payload: EmailPayload = {
      host: settings.smtpHost || '',
      port: settings.smtpPort || '',
      user: settings.smtpUser || '',
      pass: settings.smtpPass || '',
      to,
      subject,
      body
    };

    const baseUrl = resolveBackendBaseUrl();
    if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && baseUrl.startsWith('http://')) {
      return {
        success: false,
        error: `Mixed content: seu site está em HTTPS mas o backend está em HTTP (${baseUrl}). Configure VITE_BACKEND_URL com HTTPS ou rode o front em HTTP.`
      };
    }
    const response = await fetch(`${baseUrl}/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : null;
    if (response.ok) return (data as EmailResponse) || { success: true };
    return {
      success: false,
      error: (data as any)?.error || `Erro HTTP ${response.status}`
    };
  } catch (error: any) {
    console.error("Failed to call backend:", error);
    return {
      success: false,
      error: `Falha ao conectar com o backend de email (${resolveBackendBaseUrl()}). Verifique se o \`server.js\` está rodando na porta 3001 e se o CORS está liberado para o endereço do seu frontend.`
    };
  }
};

export const scheduleEmail = async (
  settings: AppSettings,
  to: string,
  subject: string,
  body: string,
  runAtIso: string,
  opts?: { timeZone?: string; sendWindow?: 'business' | 'any' }
): Promise<ScheduleEmailResponse> => {
  try {
    const payload: any = {
      host: settings.smtpHost || '',
      port: settings.smtpPort || '',
      user: settings.smtpUser || '',
      pass: settings.smtpPass || '',
      to,
      subject,
      body,
      runAt: runAtIso,
      timeZone: opts?.timeZone,
      sendWindow: opts?.sendWindow
    };
    const baseUrl = resolveBackendBaseUrl();
    const response = await fetch(`${baseUrl}/email-schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return { success: false, error: data?.error || `Erro HTTP ${response.status}` };
    }
    return data as ScheduleEmailResponse;
  } catch (error: any) {
    console.error("Failed to call backend:", error);
    return { success: false, error: "Falha ao conectar com o scheduler do backend. Verifique se o `server.js` está rodando." };
  }
};

export const getScheduledEmailJob = async (jobId: string): Promise<{ success: boolean; job?: ScheduledJob; error?: string }> => {
  try {
    const baseUrl = resolveBackendBaseUrl();
    const response = await fetch(`${baseUrl}/email-schedule/${encodeURIComponent(jobId)}`);
    const data = await response.json().catch(() => null);
    if (!response.ok) return { success: false, error: data?.error || `Erro HTTP ${response.status}` };
    return { success: true, job: data?.job as ScheduledJob };
  } catch (error: any) {
    return { success: false, error: "Falha ao consultar job no backend." };
  }
};

export const cancelScheduledEmailJob = async (jobId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const baseUrl = resolveBackendBaseUrl();
    const response = await fetch(`${baseUrl}/email-schedule/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' });
    const data = await response.json().catch(() => null);
    if (!response.ok) return { success: false, error: data?.error || `Erro HTTP ${response.status}` };
    return { success: true };
  } catch (error: any) {
    return { success: false, error: "Falha ao cancelar job no backend." };
  }
};

export const verifySmtp = async (settings: AppSettings): Promise<SmtpVerifyResponse> => {
  try {
    const baseUrl = resolveBackendBaseUrl();
    const response = await fetch(`${baseUrl}/smtp-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: settings.smtpHost || '',
        port: settings.smtpPort || '',
        user: settings.smtpUser || '',
        pass: settings.smtpPass || ''
      })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) return { success: false, error: data?.error || `Erro HTTP ${response.status}`, code: data?.code, responseCode: data?.responseCode };
    return data as SmtpVerifyResponse;
  } catch (error: any) {
    return { success: false, error: `Falha ao conectar com o backend (${resolveBackendBaseUrl()}).` };
  }
};
