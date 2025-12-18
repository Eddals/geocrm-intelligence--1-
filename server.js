
import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import https from 'https';
import crypto from 'crypto';
import { google } from 'googleapis';

// Simple security middleware (no external deps)
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains'); // 180 days
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  // CSP tuned to current external assets (Tailwind CDN, Google Fonts, Leaflet, aistudiocdn, you.com proxy)
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' https://cdn.tailwindcss.com https://unpkg.com https://aistudiocdn.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    // Allow images used by the frontend (logo, flags, leaflet tiles)
    "img-src 'self' data: blob: https://unpkg.com https://i.imgur.com https://flagcdn.com https://upload.wikimedia.org https://cdn.iconscout.com https://1000logos.net",
    "connect-src 'self' https://api.ydc-index.io https://aistudiocdn.com",
    "frame-ancestors 'self'",
    "object-src 'none'",
  ].join('; '));
  res.setHeader('Cache-Control', 'no-store');
  next();
};

// Very lightweight in-memory rate limiter (per IP per 60s)
const rateLimit = (limit = 100, windowMs = 60_000) => {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const entry = hits.get(ip) || { count: 0, start: now };
    if (now - entry.start > windowMs) {
      entry.count = 0;
      entry.start = now;
    }
    entry.count += 1;
    hits.set(ip, entry);
    if (entry.count > limit) {
      return res.status(429).json({ error: 'Too many requests. Please slow down.' });
    }
    next();
  };
};

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(securityHeaders);

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
    ];
const allowAllOrigins = process.env.CORS_ALLOW_ALL === 'true' || process.env.NODE_ENV !== 'production';
app.use(cors({
  origin: allowAllOrigins ? true : allowedOrigins,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'apikey'],
}));
app.use(rateLimit(300, 60_000));

// --- SMTP EMAIL ENDPOINT ---
const allowedSmtpHosts = (process.env.ALLOWED_SMTP_HOSTS || '')
  .split(',')
  .map(h => h.trim())
  .filter(Boolean);
const enforceEmailRateLimit = rateLimit(30, 60_000);

// --- SMTP VERIFY ENDPOINT (no email sent) ---
app.post("/smtp-verify", enforceEmailRateLimit, async (req, res) => {
  const { host, port, user, pass } = req.body || {};

  if (!host || !port || !user || !pass) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  const numericPort = Number(port);
  if (!Number.isInteger(numericPort) || numericPort <= 0 || numericPort > 65535) {
    return res.status(400).json({ success: false, error: "Invalid SMTP port" });
  }

  if (allowedSmtpHosts.length && !allowedSmtpHosts.includes(host)) {
    return res.status(400).json({ success: false, error: "SMTP host not allowed" });
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: numericPort,
      secure: numericPort === 465,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: process.env.SMTP_ALLOW_SELF_SIGNED === 'true' ? false : true
      },
      connectionTimeout: 10_000,
      socketTimeout: 10_000
    });

    await transporter.verify();
    return res.json({
      success: true,
      host,
      port: numericPort,
      secure: numericPort === 465,
      message: 'Conexão SMTP verificada com sucesso.'
    });
  } catch (e) {
    console.error("SMTP verify error:", e);
    return res.status(400).json({
      success: false,
      error: e?.message || 'SMTP verify failed',
      code: e?.code,
      responseCode: e?.responseCode
    });
  }
});

// --- SIMPLE IN-MEMORY EMAIL SCHEDULER ---
// NOTE: This is a lightweight scheduler (no persistence). For production, move to a DB + worker.
const scheduledEmails = new Map();
const SCHEDULER_TICK_MS = 5_000;
const MAX_ATTEMPTS = 3;

const generateJobId = () => `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60_000);

const getZonedParts = (date, timeZone) => {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short'
  });
  const parts = fmt.formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
    weekday: map.weekday // Mon/Tue...
  };
};

const getTimeZoneOffsetMs = (date, timeZone) => {
  // Convert a date to what its clock time would be in the target timeZone, then diff.
  const parts = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
};

const zonedTimeToUtc = ({ year, month, day, hour, minute, second }, timeZone) => {
  // Approximate conversion using offset at "now"; good enough for scheduling windows.
  const approx = new Date(Date.UTC(year, month - 1, day, hour, minute, second || 0));
  const offset = getTimeZoneOffsetMs(approx, timeZone);
  return new Date(approx.getTime() - offset);
};

const adjustToBusinessWindow = (runAt, timeZone) => {
  const parts = getZonedParts(runAt, timeZone);
  const isWeekend = parts.weekday === 'Sat' || parts.weekday === 'Sun';

  const withinHours = parts.hour >= 9 && (parts.hour < 18 || (parts.hour === 18 && parts.minute === 0));
  if (!isWeekend && withinHours) return runAt;

  // Move to next business day 09:00
  let cursor = runAt;
  for (let i = 0; i < 14; i++) {
    const next = addMinutes(cursor, 60); // advance to avoid infinite loops
    const p = getZonedParts(next, timeZone);
    const weekend = p.weekday === 'Sat' || p.weekday === 'Sun';
    if (!weekend && (p.hour < 9 || p.hour >= 18)) {
      // Set to 09:00 of that day in timezone
      const candidateUtc = zonedTimeToUtc({ year: p.year, month: p.month, day: p.day, hour: 9, minute: 0, second: 0 }, timeZone);
      if (candidateUtc.getTime() >= Date.now()) return candidateUtc;
      cursor = candidateUtc;
      continue;
    }
    if (!weekend && p.hour >= 9 && p.hour < 18) return next;
    cursor = next;
  }
  return runAt;
};

const computeScheduledRunAt = (runAtIso, timeZone, sendWindow) => {
  const parsed = new Date(runAtIso);
  if (Number.isNaN(parsed.getTime())) return null;
  const tz = timeZone || 'America/Sao_Paulo';
  if (sendWindow === 'business') return adjustToBusinessWindow(parsed, tz);
  return parsed;
};

const sendEmailNow = async ({ host, port, user, pass, to, subject, body }) => {
  const numericPort = Number(port);
  if (!Number.isInteger(numericPort) || numericPort <= 0 || numericPort > 65535) {
    throw new Error('Invalid SMTP port');
  }

  const transporter = nodemailer.createTransport({
    host,
    port: numericPort,
    secure: numericPort === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: process.env.SMTP_ALLOW_SELF_SIGNED === 'true' ? false : true },
    connectionTimeout: 10_000,
    socketTimeout: 10_000
  });

  await transporter.verify();
  const info = await transporter.sendMail({ from: user, to, subject, html: body });
  return info;
};

const processScheduledJobs = async () => {
  const now = Date.now();
  const due = [];
  for (const job of scheduledEmails.values()) {
    if (job.status !== 'scheduled') continue;
    if (job.runAtMs <= now) due.push(job);
  }

  for (const job of due) {
    job.status = 'sending';
    job.updatedAt = new Date().toISOString();
    try {
      const info = await sendEmailNow(job.payload);
      job.status = 'sent';
      job.messageId = info?.messageId;
      job.updatedAt = new Date().toISOString();
      console.log(`[scheduler] sent job ${job.id} -> ${job.payload.to} (${job.messageId || 'no-id'})`);
    } catch (e) {
      job.attempts += 1;
      job.lastError = e?.message || String(e);
      job.updatedAt = new Date().toISOString();
      if (job.attempts >= MAX_ATTEMPTS) {
        job.status = 'failed';
        console.warn(`[scheduler] failed job ${job.id} after ${job.attempts} attempts: ${job.lastError}`);
      } else {
        const backoffMinutes = job.attempts === 1 ? 1 : job.attempts === 2 ? 5 : 15;
        job.status = 'scheduled';
        job.runAtMs = Date.now() + backoffMinutes * 60_000;
        job.runAt = new Date(job.runAtMs).toISOString();
        console.warn(`[scheduler] retry job ${job.id} in ${backoffMinutes}min: ${job.lastError}`);
      }
    }
  }
};

setInterval(() => {
  processScheduledJobs().catch((e) => console.error('[scheduler] tick error', e));
}, SCHEDULER_TICK_MS);

app.post("/send-email", enforceEmailRateLimit, async (req, res) => {
  const { host, port, user, pass, to, subject, body } = req.body;

  if (!host || !port || !user || !pass || !to || !subject || !body) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  const numericPort = Number(port);
  if (!Number.isInteger(numericPort) || numericPort <= 0 || numericPort > 65535) {
    return res.status(400).json({ success: false, error: "Invalid SMTP port" });
  }

  if (allowedSmtpHosts.length && !allowedSmtpHosts.includes(host)) {
    return res.status(400).json({ success: false, error: "SMTP host not allowed" });
  }

  const maxBodyLength = 100_000; // prevent massive payloads
  if (String(body).length > maxBodyLength) {
    return res.status(413).json({ success: false, error: "Body too large" });
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: numericPort,
      secure: numericPort === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: process.env.SMTP_ALLOW_SELF_SIGNED === 'true' ? false : true
      },
      connectionTimeout: 10_000,
      socketTimeout: 10_000
    });

    // Verify connection configuration
    await transporter.verify();

    const info = await transporter.sendMail({
      from: user,
      to,
      subject,
      html: body, // We are sending HTML body
    });

    console.log("Message sent: %s", info.messageId);
    return res.json({ success: true, messageId: info.messageId });
  } catch (e) {
    console.error("Error sending email:", e);
    return res.status(500).json({ success: false, error: e.message });
  }
});

// --- SCHEDULE EMAIL ENDPOINTS ---
app.post("/email-schedule", enforceEmailRateLimit, async (req, res) => {
  const { host, port, user, pass, to, subject, body, runAt, timeZone, sendWindow } = req.body || {};
  if (!host || !port || !user || !pass || !to || !subject || !body || !runAt) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }
  const scheduledAt = computeScheduledRunAt(runAt, timeZone, sendWindow);
  if (!scheduledAt) return res.status(400).json({ success: false, error: "Invalid runAt" });

  const id = generateJobId();
  const job = {
    id,
    status: 'scheduled',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
    messageId: null,
    runAt: scheduledAt.toISOString(),
    runAtMs: scheduledAt.getTime(),
    timeZone: timeZone || 'America/Sao_Paulo',
    sendWindow: sendWindow || 'business',
    payload: { host, port, user, pass, to, subject, body }
  };
  scheduledEmails.set(id, job);
  return res.json({ success: true, jobId: id, runAt: job.runAt });
});

app.get("/email-schedule/:id", (req, res) => {
  const job = scheduledEmails.get(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: "Not found" });
  const { payload, ...safe } = job; // don't echo credentials
  return res.json({ success: true, job: safe });
});

app.post("/email-schedule/:id/cancel", (req, res) => {
  const job = scheduledEmails.get(req.params.id);
  if (!job) return res.status(404).json({ success: false, error: "Not found" });
  if (job.status === 'sent') return res.status(400).json({ success: false, error: "Already sent" });
  job.status = 'canceled';
  job.updatedAt = new Date().toISOString();
  return res.json({ success: true });
});

// --- YOU.COM API PROXY ENDPOINT (Fixes CORS & Node Version Compatibility) ---
app.post("/api/you-rag", (req, res) => {
  const { query, apiKey } = req.body;

  if (!query || !apiKey) {
    return res.status(400).json({ error: "Missing query or apiKey" });
  }

  const requestData = JSON.stringify({
    query: query,
    num_web_results: 1,
    use_rag: true
  });

  const options = {
    hostname: 'api.ydc-index.io',
    path: '/rag',
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(requestData)
    }
  };

  const proxyReq = https.request(options, (proxyRes) => {
    let data = '';
    
    proxyRes.on('data', (chunk) => {
      data += chunk;
    });

    proxyRes.on('end', () => {
      if (proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
        try {
          const json = JSON.parse(data);
          res.json(json);
        } catch (e) {
          console.error("You.com JSON Parse Error:", e);
          res.status(500).json({ error: "Failed to parse response from You.com", raw: data });
        }
      } else {
        console.error(`You.com API Error: ${proxyRes.statusCode} - ${data}`);
        res.status(proxyRes.statusCode).json({ error: data || "External API Error" });
      }
    });
  });

  proxyReq.on('error', (e) => {
    console.error("You.com Proxy Request Error:", e);
    res.status(500).json({ error: e.message });
  });

  proxyReq.write(requestData);
  proxyReq.end();
});

// --- SIMPLE LEAD SEARCH MOCK ENDPOINT (tool for chatbot) ---
app.post("/api/search-leads", (req, res) => {
  const { industry = 'Geral', location = 'Brasil', count = 5 } = req.body || {};
  const qty = Math.max(1, Math.min(parseInt(count, 10) || 5, 20));

  const leads = Array.from({ length: qty }).map((_, idx) => ({
    company: `${industry} ${location} ${idx + 1}`,
    name: 'Contato',
    phone: '+55 11 99999-0000',
    email: null,
    city: location,
    address: `${location} - endereço`,
    value: 5000,
    status: 'Novo',
    source: 'Chat IA',
    notes: `Lead gerado pelo assistente para ${industry} em ${location}`,
  }));

  res.json({ leads });
});

// --- GOOGLE CALENDAR (OPTIONAL) ---
// This is a lightweight OAuth connector. It stores tokens only in memory.
// For production: persist tokens securely (DB + encryption) and enforce auth.
const googleCalendarTokens = new Map(); // userId -> tokens
const MAX_GOOGLE_TOKEN_ENTRIES = 1000;

const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

const oauthStateSecret = process.env.CALENDAR_OAUTH_STATE_SECRET || '';
const signState = (userId) => {
  if (!oauthStateSecret) return userId;
  const sig = crypto.createHmac('sha256', oauthStateSecret).update(userId).digest('hex').slice(0, 24);
  return `${userId}.${sig}`;
};
const parseState = (state) => {
  const raw = String(state || '');
  if (!oauthStateSecret) return raw;
  const [userId, sig] = raw.split('.');
  if (!userId || !sig) return '';
  const expected = crypto.createHmac('sha256', oauthStateSecret).update(userId).digest('hex').slice(0, 24);
  if (sig !== expected) return '';
  return userId;
};

const ensureTokenCapacity = () => {
  while (googleCalendarTokens.size > MAX_GOOGLE_TOKEN_ENTRIES) {
    const firstKey = googleCalendarTokens.keys().next().value;
    if (!firstKey) break;
    googleCalendarTokens.delete(firstKey);
  }
};

const isGoogleCalendarConfigured = () =>
  !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);

const makeGoogleClient = () => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
};

app.get('/calendar/google/status', (req, res) => {
  const userId = String(req.query.userId || '');
  if (userId && !isUuid(userId)) {
    return res.status(400).json({ configured: isGoogleCalendarConfigured(), connected: false, message: 'userId inválido.' });
  }
  const configured = isGoogleCalendarConfigured();
  const connected = !!(userId && googleCalendarTokens.get(userId));
  return res.json({
    configured,
    connected,
    message: !configured
      ? 'Defina GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI no backend.'
      : connected
        ? 'Google Calendar conectado (memória).'
        : 'Google Calendar não conectado.'
  });
});

app.get('/calendar/google/auth', (req, res) => {
  const userId = String(req.query.userId || '');
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  if (!isUuid(userId)) return res.status(400).json({ error: 'Invalid userId' });
  if (!isGoogleCalendarConfigured()) {
    return res.status(400).json({ error: 'Google Calendar not configured' });
  }
  const client = makeGoogleClient();
  const scopes = ['https://www.googleapis.com/auth/calendar'];
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
    state: signState(userId)
  });
  return res.json({ authUrl });
});

app.get('/calendar/google/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    const userId = parseState(req.query.state || '');
    if (!code || !userId) return res.status(400).send('Missing code/state');
    if (!isUuid(userId)) return res.status(400).send('Invalid state');
    if (!isGoogleCalendarConfigured()) return res.status(400).send('Google Calendar not configured');
    const client = makeGoogleClient();
    const { tokens } = await client.getToken(code);
    googleCalendarTokens.set(userId, tokens);
    ensureTokenCapacity();
    return res.send(`
      <html>
        <head><meta charset="utf-8" /><title>Google Calendar conectado</title></head>
        <body style="font-family: Inter, Arial, sans-serif; padding: 24px;">
          <h2>Google Calendar conectado!</h2>
          <p>Você pode voltar para o GeoCRM.</p>
          <script>
            try { window.opener && window.opener.postMessage({ type: 'geocrm_google_calendar_connected' }, '*'); } catch (e) {}
            setTimeout(() => { window.close(); }, 900);
          </script>
        </body>
      </html>
    `);
  } catch (e) {
    console.error('[google calendar] callback error', e);
    return res.status(500).send('Erro ao conectar Google Calendar.');
  }
});

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => console.log(`Backend Server running on http://0.0.0.0:${PORT}`));
