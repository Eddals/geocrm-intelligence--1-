
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

    const response = await fetch("http://localhost:3001/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return data as EmailResponse;
  } catch (error: any) {
    console.error("Failed to call backend:", error);
    return {
      success: false,
      error: "Falha ao conectar com o servidor local (localhost:3001). Certifique-se que o server.js está rodando."
    };
  }
};
