
import { Lead, PipelineStage } from '../types';
import { isValidEmail, isValidPhone, formatPhone } from '../utils/validators';

const PERPLEXITY_API_KEY = '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';

export const extractAndQualifyWithPerplexity = async (url: string): Promise<Partial<Lead>> => {
  if (!PERPLEXITY_API_KEY) throw new Error("Perplexity API Key is missing");

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
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant that outputs strictly valid JSON. Do not include markdown formatting or conversational text.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let content = data.choices[0].message.content;

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
        console.error("JSON Parse Error from Perplexity:", content);
        throw new Error("Failed to parse qualification data. The AI response was not valid JSON.");
    }

    // Validators
    const validEmail = isValidEmail(parsedData.email) ? parsedData.email : null;
    const validPhone = isValidPhone(parsedData.phone) ? formatPhone(parsedData.phone) : null;

    // Combine description with qualification notes for the final Lead Notes
    const combinedNotes = `[Análise Mapa Inteligente]\n${parsedData.qualification_notes || 'Sem notas de qualificação'}\n\n[Sobre]\n${parsedData.description || 'Sem descrição'}`;

    return {
        company: parsedData.company || "Empresa Desconhecida",
        name: parsedData.company,
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
        source: 'Manual',
        status: PipelineStage.NEW,
        enriched: true
    };

  } catch (error: any) {
    console.error("Perplexity Service Error:", error);
    throw error;
  }
};
