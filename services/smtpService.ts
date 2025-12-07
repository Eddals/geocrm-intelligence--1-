
import { AppSettings } from '../types';

export interface SmtpLog {
  timestamp: string;
  message: string;
  type: 'command' | 'response' | 'error' | 'info' | 'success';
}

export const sendEmailViaSMTP = async (
  settings: AppSettings,
  to: string,
  subject: string,
  body: string,
  onLog: (log: SmtpLog) => void
): Promise<boolean> => {
  
  // Helper to create standardized logs
  const log = (
    msg: string,
    type: 'command' | 'response' | 'error' | 'info' | 'success' = 'info'
  ) => {
    onLog({
      timestamp: new Date().toLocaleTimeString('pt-BR', {
        hour12: false,
        fractionalSecondDigits: 3,
      } as any),
      message: msg,
      type,
    });
  };

  // Helper for realistic network delay simulation
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    // 1. Validation
    if (!settings.smtpHost || !settings.smtpPort || !settings.smtpUser || !settings.smtpPass) {
      throw new Error("Configurações SMTP incompletas. Verifique Host, Porta, Usuário e Senha.");
    }

    // 2. Connection Phase
    log(`CONNECTING TO ${settings.smtpHost}:${settings.smtpPort}...`, 'info');
    await delay(600);
    log(`CONNECTED to ${settings.smtpHost} (TLS/SSL Encrypted).`, 'success');
    await delay(300);

    // 3. Handshake (EHLO)
    log(`EHLO ${window.location.hostname || 'geocrm-client'}`, 'command');
    await delay(200);

    log(`250-${settings.smtpHost} Hello Client`, 'response');
    log(`250-SIZE 35882577`, 'response');
    log(`250-8BITMIME`, 'response');
    log(`250-AUTH LOGIN PLAIN XOAUTH2`, 'response');
    log(`250 STARTTLS`, 'response');
    await delay(300);

    // 4. Authentication Phase
    log(`AUTH LOGIN`, 'command');
    await delay(250);

    log(`334 VXNlcm5hbWU6`, 'response'); // Server asks for Username (Base64)
    log(`(sending username: ${settings.smtpUser})`, 'command');
    await delay(400);

    log(`334 UGFzc3dvcmQ6`, 'response'); // Server asks for Password (Base64)
    log(`(sending password: ************)`, 'command');
    await delay(500);

    // Simulation: Fail if password is too short (just for demo purposes)
    if (settings.smtpPass.length < 5) {
      throw new Error("535 5.7.8 Authentication failed: Bad credentials.");
    }

    log(`235 2.7.0 Authentication successful`, 'success');
    await delay(300);

    // 5. Envelope Phase
    log(`MAIL FROM:<${settings.smtpUser}>`, 'command');
    await delay(200);
    log(`250 2.1.0 OK <${settings.smtpUser}> Sender accepted`, 'response');

    log(`RCPT TO:<${to}>`, 'command');
    await delay(200);
    log(`250 2.1.5 OK <${to}> Recipient accepted`, 'response');

    // 6. Data Transmission
    log(`DATA`, 'command');
    await delay(200);
    
    log(`354 Enter mail, end with "." on a line by itself`, 'response');
    
    log(`Subject: ${subject}`, 'info');
    log(`To: ${to}`, 'info');
    log(`MIME-Version: 1.0`, 'info');
    log(`Content-Type: text/html; charset=UTF-8`, 'info');
    log(`(Transmitting ${body.length} bytes of payload...)`, 'info');
    await delay(800); // Simulate upload time

    log(`.`, 'command'); // End of data marker
    await delay(400);

    log(`250 2.0.0 OK: Message 123456789 accepted for delivery`, 'success');

    // 7. Termination
    log(`QUIT`, 'command');
    await delay(200);

    log(`221 2.0.0 ${settings.smtpHost} closing connection`, 'response');

    // 8. Disclaimer / Final Status
    log(`---------------------------------------------`, 'info');
    log(`[SIMULATION] Email processado pelo CRM com sucesso.`, 'success');
    log(`Nota: Navegadores bloqueiam conexões TCP diretas (SMTP).`, 'info');
    log(`O CRM registrou o envio no histórico do lead.`, 'info');

    return true;

  } catch (error: any) {
    // Error Logging
    log(error.message || "Connection Timeout / Error", 'error');
    if (error.message.includes('535')) {
        log(`Dica: Verifique se a 'Senha de App' está correta nas Configurações.`, 'info');
    }
    return false;
  }
};
    