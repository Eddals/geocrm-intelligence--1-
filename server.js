
import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import https from 'https';

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
    "img-src 'self' data: blob: https://unpkg.com",
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
  : ['http://localhost:3000', 'http://localhost:5173'];
app.use(cors({
  origin: allowedOrigins,
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

const PORT = 3001;
app.listen(PORT, '127.0.0.1', () => console.log(`Backend Server running on http://127.0.0.1:${PORT}`));
