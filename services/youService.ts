
import { Lead, PipelineStage } from '../types';
import { isValidEmail, isValidPhone, formatPhone } from '../utils/validators';

const YOU_API_KEY = 'ydc-sk-ab48fa1c76eb2fad-xA2PySHYGkVQHLPx2JYMxiV1h9uTTIU3-dac6a59c';

export const extractAndQualifyWithYou = async (url: string): Promise<Partial<Lead>> => {
  if (!YOU_API_KEY) throw new Error("You.com API Key is missing");

  // Ensure URL has protocol
  const safeUrl = url.startsWith('http') ? url : `https://${url}`;

  const prompt = `
    TASK: Analyze the website ${safeUrl} deeply.
    
    1. EXTRACTION: Extract the Company Name, Business Description (in Portuguese), Email, Phone, Address, City, and Social Media Links (Instagram, LinkedIn, Facebook).
    
    2. QUALIFICATION (Crucial): Analyze the site content to answer:
       - Is the company currently active?
       - Does the site look professional and updated?
       - Do they appear to have purchasing power (B2B potential)?
       - What specific niche do they belong to?
    
    3. OUTPUT: Return a STRICT JSON object (no markdown) with this structure:
    {
      "company": "string",
      "description": "string (summary in PT-BR)",
      "email": "string or null",
      "phone": "string or null",
      "address": "string or null",
      "city": "string or null",
      "website": "${safeUrl}",
      "linkedin": "string or null",
      "instagram": "string or null",
      "facebook": "string or null",
      "qualification_notes": "string (A short analysis in PT-BR answering the qualification questions)",
      "estimated_value": number (estimate based on company size/professionalism, default 5000),
      "tags": ["string", "string"]
    }
  `;

  try {
    // UPDATED: Use 127.0.0.1 to avoid localhost IPv6 resolution issues
    const response = await fetch('http://127.0.0.1:3001/api/you-rag', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: prompt,
        apiKey: YOU_API_KEY
      })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Proxy Error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    
    // The RAG response is usually in 'answer'
    let content = data.answer;

    if (!content) {
        if (data.error) throw new Error(data.error);
        throw new Error("No analysis returned from service");
    }

    // Clean JSON markdown if present
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();

    // Find JSON braces
    const firstOpen = content.indexOf('{');
    const lastClose = content.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) {
        content = content.substring(firstOpen, lastClose + 1);
    }

    let parsedData;
    try {
        parsedData = JSON.parse(content);
    } catch (e) {
        console.error("JSON Parse Error from You.com:", content);
        throw new Error("Failed to parse qualification data. The AI response was not valid JSON.");
    }

    // Validators
    const validEmail = isValidEmail(parsedData.email) ? parsedData.email : null;
    const validPhone = isValidPhone(parsedData.phone) ? formatPhone(parsedData.phone) : null;

    // Combine description with qualification notes for the final Lead Notes
    const combinedNotes = `[Análise IA You.com]\n${parsedData.qualification_notes || 'Sem notas de qualificação'}\n\n[Sobre]\n${parsedData.description || 'Sem descrição'}`;

    return {
        company: parsedData.company || "Empresa Desconhecida",
        name: parsedData.company, // Default to company name if contact unknown
        email: validEmail,
        phone: validPhone,
        address: parsedData.address,
        city: parsedData.city || "Desconhecido",
        website: parsedData.website,
        linkedin: parsedData.linkedin,
        instagram: parsedData.instagram,
        facebook: parsedData.facebook,
        notes: combinedNotes,
        value: parsedData.estimated_value || 0,
        tags: parsedData.tags || ['Web Scraper'],
        source: 'Manual', // Technically sourced via tool, but manual entry flow
        status: PipelineStage.NEW,
        enriched: true
    };

  } catch (error: any) {
    console.error("You.com Service Error:", error);
    if (error.message.includes('Failed to fetch')) {
        throw new Error("Erro de conexão: Verifique se o backend está rodando ('node server.js') na porta 3001.");
    }
    throw error;
  }
};
