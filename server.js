
import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import https from 'https';

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// --- SMTP EMAIL ENDPOINT ---
app.post("/send-email", async (req, res) => {
  const { host, port, user, pass, to, subject, body } = req.body;

  if (!host || !port || !user || !pass || !to || !subject || !body) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: parseInt(port) === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false // Helps with some self-signed cert issues
      }
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
  console.log("Received /api/you-rag request");
  const { query, apiKey } = req.body;
  console.log("API Key received:", apiKey ? `${apiKey.substring(0, 20)}...` : 'MISSING');

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

const PORT = 3001;
app.listen(PORT, '127.0.0.1', () => console.log(`Backend Server running on http://127.0.0.1:${PORT}`));
