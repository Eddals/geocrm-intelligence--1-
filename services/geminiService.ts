
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Lead, PipelineStage, ChatMessage } from '../types';
import { isValidEmail, isValidPhone, formatPhone } from '../utils/validators';

const getAI = () => {
  const apiKey =
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Configure VITE_GEMINI_API_KEY (or GEMINI_API_KEY).");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to safely parse JSON from AI response
const safeJsonParse = (text: string, isArray: boolean = true): any => {
    let cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
        if (isArray) {
            const firstBracket = cleanText.indexOf('[');
            const lastBracket = cleanText.lastIndexOf(']');
            if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                cleanText = cleanText.substring(firstBracket, lastBracket + 1);
            } else {
                // Fallback: try to find object and wrap in array
                const firstBrace = cleanText.indexOf('{');
                const lastBrace = cleanText.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    cleanText = `[${cleanText.substring(firstBrace, lastBrace + 1)}]`;
                }
            }
        } else {
            const firstBrace = cleanText.indexOf('{');
            const lastBrace = cleanText.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                cleanText = cleanText.substring(firstBrace, lastBrace + 1);
            }
        }
        return JSON.parse(cleanText);
    } catch (e) {
        console.error("JSON Parse Error:", e, "Input:", text);
        return isArray ? [] : {};
    }
};

export const discoverLeads = async (query: string, city: string, state: string, country: string, industry: string, ratingFilter: string): Promise<Partial<Lead>[]> => {
  const ai = getAI();
  const locationString = `${city}, ${state || ''}, ${country === 'BR' ? 'Brasil' : 'USA'}`;

  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        company: { type: Type.STRING },
        contactName: { type: Type.STRING },
        type: { type: Type.STRING },
        address: { type: Type.STRING },
        city: { type: Type.STRING },
        lat: { type: Type.NUMBER },
        lng: { type: Type.NUMBER },
        estimatedValue: { type: Type.NUMBER },
        website: { type: Type.STRING },
        linkedin: { type: Type.STRING },
        instagram: { type: Type.STRING },
        facebook: { type: Type.STRING },
        rating: { type: Type.NUMBER }
      },
      required: ["company", "address", "city", "lat", "lng"]
    }
  };
  
  let ratingContext = "";
  if (ratingFilter === "low") {
      ratingContext = "CRÍTICO: Procure empresas com BAIXO REPERTÓRIO (1 a 2.5 estrelas).";
  } else if (ratingFilter === "medium") {
      ratingContext = "IMPORTANTE: Procure empresas com MÉDIO REPERTÓRIO (3 a 4 estrelas).";
  } else if (ratingFilter === "high") {
      ratingContext = "IMPORTANTE: Procure empresas com ALTO REPERTÓRIO (4.5 a 5 estrelas).";
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Simule uma busca avançada no Google Maps.
      Termo: "${query}"
      Local: "${locationString}"
      ${industry ? `Filtro Indústria: "${industry}"` : ""}
      ${ratingContext}

      Para cada lead, estime o 'estimatedValue' (Potencial de Venda) considerando um ticket médio de mercado B2B genérico.
      
      REGRAS ESTRITAS DE REDES SOCIAIS:
      1. Tente encontrar Website, LinkedIn, Instagram e Facebook REAIS.
      2. Se não encontrar um link oficial, RETORNE NULL.
      3. NÃO TENTE ADIVINHAR LINKS (ex: não invente instagram.com/nome_empresa).
      4. Se o dado não existir, deve vir como null.
      
      Retorne JSON com dados reais de empresas.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    });

    const rawData = safeJsonParse(response.text || "[]", true);
    
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
    console.error("Error discovering leads:", error);
    return [];
  }
};

export const findNearbyPlaces = async (lat: number, lng: number, addressName: string, industry: string = '', limit: number = 5): Promise<Partial<Lead>[]> => {
    const ai = getAI();
    
    const industryContext = industry ? `Filtre SOMENTE por estabelecimentos do setor: "${industry}".` : "Busque comércios variados.";

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `ATUE COMO UM INVESTIGADOR DE DADOS CORPORATIVOS.
            Local Central: ${addressName} (Lat: ${lat}, Lng: ${lng}).
            Objetivo: Encontrar ${limit} empresas REAIS próximas e extrair dados de contato VERDADEIROS.
            ${industryContext}

            Use a ferramenta de Busca do Google para encontrar o Google Business Profile, Site Oficial ou Redes Sociais de cada local.

            INSTRUÇÕES DE EXTRAÇÃO (PRIORIDADE MÁXIMA EM DADOS REAIS):
            1. Nome da Empresa: Nome exato no Google Maps.
            2. Endereço: Endereço completo.
            3. Telefone: Busque o telefone comercial REAL listado no Google ou Site. Se não encontrar no Google, retorne null. NÃO INVENTE DADOS.
            4. Nome do Dono/Contato: PESQUISE PROFUNDAMENTE por "Owner", "CEO", "Fundador" ou "Gerente Geral" associado a esta empresa. Tente trazer um nome real de pessoa.
            5. Horário e Descrição: Extraia se disponível.
            
            IMPORTANTE: Retorne APENAS um array JSON válido (sem markdown). 
            Exemplo: [{"company": "Nome", "contactName": "João Silva", "lat": 0, "lng": 0, "phone": "+55...", "openingHours": "...", "description": "..."}]`,
            config: {
                tools: [{ googleSearch: {} }],
            }
        });

        // Use safe parsing
        const rawData = safeJsonParse(response.text || "[]", true);
        
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

    } catch(e) {
        console.error("Error finding nearby places", e);
        return [];
    }
}

export const extractDataFromUrl = async (url: string): Promise<Partial<Lead>> => {
    const ai = getAI();
    const responseSchema = {
        type: Type.OBJECT,
        properties: {
            company: { type: Type.STRING },
            name: { type: Type.STRING },
            email: { type: Type.STRING },
            phone: { type: Type.STRING },
            address: { type: Type.STRING },
            city: { type: Type.STRING },
            contactRole: { type: Type.STRING },
            notes: { type: Type.STRING },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            website: { type: Type.STRING },
            linkedin: { type: Type.STRING },
            instagram: { type: Type.STRING },
            facebook: { type: Type.STRING }
        },
        required: ["company"]
    };

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `ATUE COMO UM AUDITOR DE DADOS RIGOROSO (Web Scraper Simulator).
            URL ALVO: ${url}. 
            
            SUA MISSÃO: Validar a existência de dados de contato e redes sociais.
            
            REGRAS DE OURO (Se violar, a extração falha):
            1. NÃO ALUCINE: Se você não tem certeza absoluta de que um link de rede social pertence a esta empresa, RETORNE NULL.
            2. NÃO CONSTRUA LINKS: É estritamente proibido "adivinhar" links (ex: instagram.com/nome_empresa). O link deve ser REAL e conhecido.
            3. TELEFONE E EMAIL: Só retorne se forem dados corporativos válidos associados a este domínio.
            4. IDIOMA: O campo 'notes' (Resumo do Negócio) DEVE SER TRADUZIDO PARA O PORTUGUÊS (PT-BR), mesmo que o site esteja em inglês ou espanhol. Faça um resumo executivo profissional em Português.
            
            EXTRAÇÃO:
            - Notes: Resumo do que a empresa faz (EM PORTUGUÊS).
            - Redes Sociais: Apenas links oficiais. Se não houver, null.
            
            Retorne JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            }
        });

        const data = safeJsonParse(response.text || "{}", false);

        const validEmail = isValidEmail(data.email) ? data.email : null;
        const validPhone = isValidPhone(data.phone) ? formatPhone(data.phone) : null;

        const cleanSocial = (link: string | null) => {
            if (!link) return null;
            if (link.includes('example.com') || link.includes('nome_empresa')) return null; 
            return link;
        };

        return {
            ...data,
            email: validEmail,
            phone: validPhone,
            instagram: cleanSocial(data.instagram),
            facebook: cleanSocial(data.facebook),
            linkedin: cleanSocial(data.linkedin),
            website: cleanSocial(data.website) || url,
            source: 'Manual',
            status: PipelineStage.NEW,
            value: 0,
            enriched: true
        };
    } catch (error) {
        console.error("Error scraping url:", error);
        throw error;
    }
};

export const enrichLeadData = async (company: string, city: string, userSector: string = 'Geral'): Promise<Partial<Lead>> => {
    const ai = getAI();
    
    const prompt = `
    Analise a empresa "${company}" em "${city}".
    Eu vendo serviços de "${userSector}".
    
    1. Estime o valor potencial de venda (estimatedValue).
    2. Crie uma mensagem de abordagem (approachMessage) curta.
    3. Tente encontrar email, telefone, cargo do contato, site e linkedin.
    4. Defina prioridade (High, Medium, Low).
    
    Retorne JSON: { email, phone, contactRole, approachMessage, leadPriority, tags, website, linkedin, estimatedValue }
    `;

    const maxRetries = 2;
    const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: prompt,
                config: { responseMimeType: "application/json" }
            });
            
            const parsed = safeJsonParse(response.text || "{}", false);
            return {
                email: isValidEmail(parsed.email) ? parsed.email : null,
                contactRole: parsed.contactRole,
                approachMessage: parsed.approachMessage,
                leadPriority: parsed.leadPriority,
                tags: parsed.tags || [],
                website: parsed.website,
                linkedin: parsed.linkedin,
                value: parsed.estimatedValue || 0
            };
        } catch (e: any) {
            const overloaded = e?.message?.includes('overloaded') || e?.status === 'UNAVAILABLE' || e?.code === 503;
            if (overloaded && attempt < maxRetries) {
                await wait(600 * (attempt + 1)); // backoff
                continue;
            }
            console.error("Error enriching lead:", e);
            break;
        }
    }
    return {};
};

export const rankLeadsForEmailCampaign = async (leads: Lead[]): Promise<{id: string, reason: string}[]> => {
    const ai = getAI();
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
        const response = await ai.models.generateContent({
             model: "gemini-2.5-flash",
             contents: prompt,
             config: { responseMimeType: "application/json" }
        });
        return safeJsonParse(response.text || "[]", true);
    } catch(e) {
        return [];
    }
};

// --- Chat Assistant (DevtoneLead IA) ---
const jsonPartFrom = (text: string) => {
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        return text.substring(firstBracket, lastBracket + 1);
    }
    return '';
};

// TTS removed with chatbox removal

export const sendMessageToGemini = async (
  userText: string,
  history: ChatMessage[],
  onAddLeads?: (leads: Partial<Lead>[]) => void
): Promise<string> => {
  const ai = getAI();
  const needsTool = /lead|leads|adicionar|buscar|encontrar|procurar/i.test(userText);
  const nicheMatch = userText.match(/(construção|construction|limpeza|cleaning|agência|agencia|agency|estética|clinicas|clínicas|marketing|dentista|dentists|saúde|health|technology|tech|software)/i);
  const locMatch = userText.match(/em\s+([A-Za-z\s]+)/i);

  const generateLeadsWithGemini = async (location: string, niche: string, quantity: number = 5): Promise<Partial<Lead>[]> => {
    const prompt = `
      Gere ${quantity} leads B2B reais e verossímeis no nicho "${niche}" em "${location}".
      Retorne APENAS JSON (array) com campos:
      [
        {
          "company": "Nome da empresa",
          "name": "Contato",
          "phone": "+55 ... ou +1 ...",
          "email": "email válido ou null",
          "city": "Cidade/Estado",
          "address": "Endereço",
          "value": 5000,
          "status": "Novo",
          "source": "Chat IA"
        }
      ]
      Não mencione IA; não invente links; se não souber, use null.
    `;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      const raw = safeJsonParse(response.text || "[]", true);
      return (raw || []).map((l: any) => ({
        company: l.company || l.nome || 'Empresa',
        name: l.name || l.contato || 'Contato',
        phone: l.phone || l.telefone || null,
        email: l.email || null,
        city: l.city || location,
        address: l.address || '',
        value: Number(l.value) || 5000,
        status: l.status || PipelineStage.NEW,
        source: l.source || 'Chat IA',
      }));
    } catch (e) {
      console.error('Gemini lead generation error', e);
      return [];
    }
  };

  const fallbackLeads = (location: string, niche: string, quantity: number) =>
    Array.from({ length: quantity }).map((_, idx) => ({
      company: `${niche} ${location} ${idx + 1}`,
      name: 'Contato',
      phone: null,
      email: null,
      city: location,
      address: '',
      value: 5000,
      status: PipelineStage.NEW,
      source: 'Chat IA'
    }));

  const callTool = async () => {
    try {
      const body = {
        industry: nicheMatch?.[0] || 'Geral',
        location: locMatch?.[1]?.trim() || 'Brasil',
        count: userText.match(/(\d+)/)?.[1] || 5
      };
      let leads = await generateLeadsWithGemini(body.location, body.industry, Number(body.count) || 5);
      if (!leads || leads.length === 0) {
        leads = fallbackLeads(body.location, body.industry, Number(body.count) || 5);
      }
      if (Array.isArray(leads) && leads.length > 0 && onAddLeads) {
        await Promise.resolve(onAddLeads(leads));
      }
      const preview = leads.slice(0, 3).map((l: any) => l.company || l.nome || 'Lead').join(', ');
      return `Adicionei ${leads.length} lead(s) de ${body.industry} em ${body.location}. Exemplos: ${preview || 'sem exemplos'}.`;
    } catch (e) {
      console.error('Tool search-leads error', e);
      return 'Não consegui buscar leads agora.';
    }
  };
  const systemInstruction = `Você é o assistente IA avançado do Devtone Leads. 
Sua missão é ajudar usuários a captar leads qualificados nos EUA e Brasil (foco em construção, limpeza, agências).

FERRAMENTAS:
Você tem acesso à ferramenta 'search_leads'. SE O USUÁRIO PEDIR PARA ADICIONAR, BUSCAR OU ENCONTRAR LEADS de um lugar ou tipo específico, VOCÊ DEVE USAR ESSA FERRAMENTA IMEDIATAMENTE.

COMPORTAMENTO:
1. Se usar a ferramenta, aguarde a confirmação e depois diga ao usuário que os leads foram adicionados.
2. Ao confirmar, liste brevemente as categorias ou empresas encontradas para mostrar valor.
3. Seja proativo, profissional e entusiasta sobre o crescimento do negócio do usuário.
4. Responda sempre em Português.
Formato: responda de forma direta e curta. Não mencione ferramentas ou código. Se devolver leads, apenas confirme e cite 2-3 exemplos.`;

  const compiledHistory = history.map(h => `${h.role === 'user' ? 'Usuário' : 'IA'}: ${h.text}`).join('\n');

  const prompt = `
${systemInstruction}

Histórico:
${compiledHistory}

Usuário agora: "${userText}"
Se gerar leads, devolva também um array JSON válido como:
[{"company":"Nome","name":"Contato","phone":"+55...","email":"...","city":"...","address":"...","value":5000,"status":"Novo","source":"Chat IA"}]
`;

  try {
    if (needsTool) {
      return await callTool();
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });

    const text = response.text || "Não consegui responder agora. Tente novamente.";

    // Tentar extrair leads de um array JSON na resposta
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        const jsonPart = text.substring(firstBracket, lastBracket + 1);
        try {
            const leads = JSON.parse(jsonPart);
            if (Array.isArray(leads) && leads.length > 0 && onAddLeads) {
                const normalized = leads.map((l: any) => ({
                    company: l.company || l.nome || 'Empresa',
                    name: l.name || l.contato || 'Contato',
                    phone: l.phone || l.telefone || null,
                    email: l.email || null,
                    city: l.city || '',
                    address: l.address || '',
                    value: l.value || 0,
                    status: l.status || PipelineStage.NEW,
                    source: l.source || 'Chat IA',
                    notes: l.notes,
                    website: l.website,
                    instagram: l.instagram,
                    facebook: l.facebook,
                    linkedin: l.linkedin
                }));
                onAddLeads(normalized);
            }
        } catch (e) {
            console.warn('Falha ao parsear leads retornados pelo chat', e);
        }
    }

    return text.replace(jsonPartFrom(text), '').trim() || text;
  } catch (e) {
    console.error('Erro no chat Gemini', e);
    return "Não consegui responder agora. Tente novamente em instantes.";
  }
};
