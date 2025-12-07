
import { Lead, PipelineStage } from '../types';
import { isValidEmail, isValidPhone, formatPhone } from '../utils/validators';

export const enrichLeadWithOpenAI = async (lead: Lead, apiKey: string, userSector: string = 'Geral'): Promise<Partial<Lead>> => {
  if (!apiKey) throw new Error("OpenAI API Key is missing");

  const prompt = `
    Atue como um especialista em vendas B2B. Analise o lead:
    Empresa: ${lead.company}
    Cidade: ${lead.city}
    
    CONTEXTO: Eu (o usuário) vendo serviços/produtos no setor de: "${userSector}".
    
    TAREFA:
    1. "estimatedValue": Calcule quanto (em Dólar $) eu poderia ganhar fechando um contrato com este lead, considerando os preços médios do setor "${userSector}".
    2. "approachMessage": Crie uma mensagem de abordagem vendendo serviços de "${userSector}" para este lead.
    3. Encontre Email, Cargo, Site, LinkedIn.
    4. "leadPriority": Classifique (High/Medium/Low) baseado no fit com o setor "${userSector}".

    Retorne JSON puro: { email, contactRole, approachMessage, leadPriority, tags, website, linkedin, estimatedValue }
  `;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [{ role: "system", content: "Output raw JSON. Do not mention AI or artificial intelligence." }, { role: "user", content: prompt }],
        temperature: 0.7
      })
    });

    if (!response.ok) throw new Error("OpenAI Error");
    const data = await response.json();
    const content = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(content);

    return {
      email: isValidEmail(parsed.email) ? parsed.email : null,
      contactRole: parsed.contactRole,
      approachMessage: parsed.approachMessage,
      leadPriority: parsed.leadPriority,
      tags: [...(lead.tags || []), ...(parsed.tags || [])],
      website: parsed.website,
      linkedin: parsed.linkedin,
      value: parsed.estimatedValue || lead.value
    };

  } catch (error) {
    console.error("Erro no enriquecimento OpenAI:", error);
    throw error;
  }
};

export const discoverLeadsWithOpenAI = async (query: string, city: string, state: string, country: string, industry: string, ratingFilter: string, apiKey: string): Promise<Partial<Lead>[]> => {
    if (!apiKey) throw new Error("OpenAI API Key is missing");
    const locationString = `${city}, ${state || ''}, ${country === 'BR' ? 'Brasil' : 'USA'}`;
    const ratingContext = ratingFilter === "low" ? "Find LOW REPUTATION businesses." : "";

    const prompt = `
        Search Google Maps for 5 REAL B2B leads.
        Query: "${query}"
        Location: "${locationString}"
        Industry: "${industry}"
        ${ratingContext}
        
        STRICT RULES:
        1. Only return REAL websites and social links. If not found, return NULL.
        2. Do NOT guess URLs.
        
        Return JSON array. Include 'estimatedValue', 'website', 'linkedin', 'instagram', 'facebook'.
    `;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: "gpt-4",
                messages: [{ role: "system", content: "Output raw JSON array. Do not mention AI or artificial intelligence." }, { role: "user", content: prompt }]
            })
        });

        const data = await response.json();
        const content = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const rawData = JSON.parse(content);

        return rawData.map((item: any) => ({
            name: item.contactName || "Gerente",
            company: item.company,
            address: item.address,
            city: item.city,
            lat: item.lat,
            lng: item.lng,
            value: item.estimatedValue || 5000,
            tags: [item.type, industry || "Discovery"],
            status: PipelineStage.NEW,
            source: 'Google Maps' as const,
            enriched: false,
            website: item.website,
            linkedin: item.linkedin,
            instagram: item.instagram,
            facebook: item.facebook,
            rating: item.rating
        }));
    } catch (error) {
        return [];
    }
};

export const findNearbyPlacesWithOpenAI = async (lat: number, lng: number, addressName: string, apiKey: string, industry: string = '', limit: number = 5): Promise<Partial<Lead>[]> => {
    if (!apiKey) throw new Error("OpenAI API Key is missing");
    
    const prompt = `
    ACT AS A DATA SCRAPER.
    Find ${limit} REAL businesses near ${lat},${lng} (${addressName}). 
    Industry Filter: "${industry}".
    
    STRICT DATA REQUIREMENTS:
    1. Phone Numbers: MUST BE REAL. Retrieve the official phone number from Google Maps or their website. Do NOT use fake "555" numbers. If unknown, return null.
    2. Owner/Contact Name: Search for the specific name of the Owner, Founder, CEO. Avoid generic "Manager" if possible.
    
    Return JSON array with fields: company, contactName, phone, website, instagram, facebook, openingHours, description, lat, lng, estimatedValue.
    `;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: "gpt-4",
                messages: [{ role: "system", content: "Output raw JSON array. Do not mention AI or artificial intelligence." }, { role: "user", content: prompt }]
            })
        });

        const data = await response.json();
        const content = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const rawData = JSON.parse(content);

        return rawData.map((item: any) => ({
             company: item.company,
             name: item.contactName || "Gerente",
             phone: isValidPhone(item.phone) ? item.phone : item.phone,
             website: item.website,
             instagram: item.instagram,
             facebook: item.facebook,
             openingHours: item.openingHours,
             description: item.description,
             status: PipelineStage.NEW,
             source: 'Google Maps',
             lat: item.lat,
             lng: item.lng,
             address: item.address || addressName,
             city: addressName.split(',')[1]?.trim() || addressName,
             value: item.estimatedValue || 5000,
             tags: [item.type, "Map Search", industry || "General"]
        }));
    } catch (e) {
        return [];
    }
}

export const extractDataFromUrlWithOpenAI = async (url: string, apiKey: string): Promise<Partial<Lead>> => {
    if (!apiKey) throw new Error("OpenAI API Key is missing");
    const prompt = `Simulate STRICT Humanized Scraping for ${url}. 
    
    1. DATA VALIDATION: Only return Social Links (Instagram, Facebook) if they ACTUALLY exist for this entity. DO NOT GUESS URLs. If not found, return null.
    2. TRANSLATION: Translate the 'notes' (Business Summary) to PORTUGUESE (PT-BR), regardless of the site's original language.
    3. Extract Address/City.
    4. Extract Contact info (Email regex, Phone regex).
    
    Return JSON.`;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: "gpt-4",
                messages: [{ role: "system", content: "Output valid JSON. Do not mention AI or artificial intelligence." }, { role: "user", content: prompt }]
            })
        });

        const data = await response.json();
        const content = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedData = JSON.parse(content);

        const validEmail = isValidEmail(parsedData.email) ? parsedData.email : null;
        const validPhone = isValidPhone(parsedData.phone) ? formatPhone(parsedData.phone) : null;

        return {
            ...parsedData,
            email: validEmail,
            phone: validPhone,
            source: 'Manual',
            status: PipelineStage.NEW,
            value: 0,
            enriched: true
        };
    } catch (error) {
        throw error;
    }
};

export const rankLeadsForEmailCampaign = async (leads: Lead[], apiKey: string): Promise<{id: string, reason: string}[]> => {
    if (!apiKey) throw new Error("OpenAI API Key is missing");
    if (leads.length === 0) return [];

    const leadsData = leads.slice(0, 20).map(l => ({
        id: l.id,
        company: l.company,
        value: l.value,
        sector: l.tags?.[0] || 'Unknown'
    }));

    const prompt = `
    Analyze these leads and select the top 5 with best potential for an email campaign.
    Leads: ${JSON.stringify(leadsData)}
    
    Return JSON array: [{ "id": "lead_id", "reason": "short reason" }]
    `;

    try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: "gpt-4",
                messages: [{ role: "system", content: "Output raw JSON. Do not mention AI or artificial intelligence." }, { role: "user", content: prompt }]
            })
        });

        const data = await response.json();
        const content = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(content);
    } catch (e) {
        console.error(e);
        return [];
    }
};
