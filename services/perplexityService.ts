
import { Lead, EmailTone, EmailFocus, AppSettings, PipelineStage } from '../types';

const PERPLEXITY_API_KEY = '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';
const fetchJsonFromPerplexity = async (messages: any[], temperature = 0.5) => {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'sonar',
      messages,
      temperature
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Perplexity API Error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  let content = data.choices[0].message.content || '';
  content = content.replace(/```json/g, '').replace(/```/g, '').trim();
  const first = content.indexOf('{');
  const last = content.lastIndexOf('}');
  if (first !== -1 && last !== -1) {
    content = content.substring(first, last + 1);
  }
  return content;
};

export const generateEmailWithPerplexity = async (
  lead: Lead,
  tone: EmailTone,
  focus: EmailFocus,
  settings: AppSettings
): Promise<{ subject: string; body: string }> => {
  
  const toneInstructions = {
    formal: "Use a professional, respectful, and direct tone. Focus on business value and ROI.",
    friendly: "Use a warm, casual, and conversational tone. Act like a helpful partner.",
    persuasive: "Use strong sales psychology, focus on pain points and the solution. Be bold.",
    urgent: "Create a sense of scarcity or time-sensitivity. Keep it short and punchy.",
    consultative: "Act as an expert advisor. Ask insightful questions and offer help, not just a sale."
  };

  const focusInstructions = {
      meeting: "GOAL: Persuade the lead to book a short meeting or call. Propose specific times.",
      sales: "GOAL: Pitch the product/service directly. Highlight pricing benefits and drive a purchase or contract.",
      followup: "GOAL: Re-engage a lead who hasn't responded. Be polite but persistent.",
      case_study: "GOAL: Share a success story or case study relevant to their industry to build trust.",
      partnership: "GOAL: Propose a strategic partnership or collaboration, not a direct sale."
  };

  const prompt = `
    TASK: Write the text content for a cold email.
    
    --- SENDER INFO ---
    Name: ${settings.userName}
    Company: ${settings.companyName}
    Sector: ${settings.companySector}
    
    --- RECIPIENT (LEAD) INFO ---
    Company: ${lead.company}
    Contact Name: ${lead.name || "Gestor"}
    Role: ${lead.contactRole || "Responsável"}
    Industry/Context: ${lead.tags?.join(', ') || "General Business"}
    Description/Notes: ${lead.notes || lead.description || "No specific details available, keep it general but relevant to their industry."}
    City: ${lead.city}
    
    --- SETTINGS ---
    Tone: ${toneInstructions[tone]}
    Focus/Objective: ${focusInstructions[focus]}
    Language: Portuguese (Brazil) - PT-BR
    
    --- OUTPUT FORMAT ---
    You must return a STRICTLY VALID JSON object with 'subject' and 'body' keys.
    
    CRITICAL RULES:
    1. 'body': Return ONLY plain text paragraphs separated by \\n (newlines).
    2. DO NOT include any HTML tags in the 'body' (no <div>, <br>, <p>). The system will handle the design.
    3. DO NOT include a signature. The system adds it automatically.
    4. Keep it concise and impactful.
    
    Example JSON structure:
    {
      "subject": "Ideia para a [Company]",
      "body": "Olá [Name],\\n\\nVi que vocês atuam no setor de [Sector] e gostaria de sugerir...\\n\\nPodemos conversar?"
    }
  `;

  try {
    let content = await fetchJsonFromPerplexity([
      { role: 'system', content: 'Output strictly valid JSON. Do not include markdown formatting or conversational text. Do not mention AI or artificial intelligence.' },
      { role: 'user', content: prompt }
    ], 0.5);

    content = content.replace(/\\\r?\n/g, '');

    // 4. Attempt to parse
    try {
        const parsed = JSON.parse(content);
        return parsed;
    } catch (parseError) {
        console.error("JSON Parse Error:", parseError);
        console.error("Raw Content:", content);
        
        // Fallback extraction
        const subjectMatch = content.match(/"subject":\s*"(.*?)"/);
        const bodyMatch = content.match(/"body":\s*"(.*?)"/);
        
        if (subjectMatch && bodyMatch) {
             return {
                 subject: subjectMatch[1],
                 body: bodyMatch[1].replace(/\\"/g, '"')
             };
        }

        throw new Error("Failed to parse the AI generated email. Please try again.");
    }

  } catch (error) {
    console.error("Error generating email with Perplexity:", error);
    throw error;
  }
};

export const generateMeetingInvite = async (
  lead: Lead,
  settings: AppSettings,
  provider: 'google' | 'outlook'
): Promise<{ subject: string; message: string; proposal: string }> => {
  const tone = settings.companySector || lead.tags?.[0] || lead.description || 'B2B';
  const prompt = `
    TAREFA: Crie um convite de reunião em PT-BR para o lead qualificado.
    Ajuste o tom e exemplos para a indústria: ${tone}.

    DADOS DO LEAD:
    - Nome: ${lead.name || 'Contato'}
    - Empresa: ${lead.company}
    - Cargo: ${lead.contactRole || 'Responsável'}
    - Cidade: ${lead.city || 'Cidade não informada'}
    - Notas: ${lead.notes || lead.description || 'Sem notas adicionais'}

    DADOS DO REMETENTE:
    - Nome: ${settings.userName}
    - Empresa: ${settings.companyName}

    SAÍDA JSON ESTRITA COM CAMPOS:
    {
      "subject": "Assunto enxuto para email",
      "message": "Corpo do email curto (3-5 linhas) em texto puro convidando para reunião ${provider === 'google' ? 'Google Meet' : 'Outlook/Teams'}, com CTA e urgência leve.",
      "proposal": "Resumo de valor e agenda sugerida em 2-3 bullets."
    }
    Nao adicione assinatura.
  `;

  let content = await fetchJsonFromPerplexity([
    { role: 'system', content: 'Responda apenas JSON válido. Nao use markdown.' },
    { role: 'user', content: prompt }
  ], 0.45);

  content = content.replace(/\\\r?\n/g, '');
  try {
    return JSON.parse(content);
  } catch (err) {
    const subjectMatch = content.match(/"subject":\s*"(.*?)"/);
    const messageMatch = content.match(/"message":\s*"(.*?)"/);
    const proposalMatch = content.match(/"proposal":\s*"(.*?)"/);
    if (subjectMatch && messageMatch && proposalMatch) {
      return {
        subject: subjectMatch[1],
        message: messageMatch[1].replace(/\\"/g, '"'),
        proposal: proposalMatch[1].replace(/\\"/g, '"')
      };
    }
    throw new Error('Falha ao gerar convite de reunião');
  }
};

export const generateSupportReply = async (message: string, topic: string) => {
  const prompt = `
  Você é um atendente direto e resolutivo da Devtone. Responda em PT-BR, curto, objetivo e sempre proponha próxima ação. Tópico: ${topic}.
  Mensagem do visitante: "${message}"
  Responda em texto puro, sem markdown, sem tags HTML. Traga segurança, clareza e convide para ajudar mais.`;

  const content = await fetchJsonFromPerplexity([
    { role: 'system', content: 'Responda como agente humano direto. Nunca diga que é IA. Texto puro.' },
    { role: 'user', content: prompt }
  ], 0.35);

  return content.trim();
};

export const findNearbyPlacesWithPerplexity = async (
  lat: number,
  lng: number,
  addressName: string,
  industry: string = '',
  limit: number = 5,
  searchText: string = '',
  countryCode: string = '',
  regionCode: string = ''
): Promise<Partial<Lead>[]> => {
  const prompt = `
    Atue como um especialista em vendas B2B e geração de leads.
    
    TAREFA:
    Google Maps Grounding (base real): conecte-se diretamente ao banco de dados do Google Maps em tempo real para buscar empresas REAIS e ATIVAS do nicho "${industry || 'qualquer nicho'}" localizadas em "${addressName}" (coords ${lat},${lng}). Traga dados duros e verificados: Nome da empresa, Endereço, Telefone e confirmação de que o negócio existe fisicamente.
    Inteligência Generativa (cruzamento de dados): com o modelo Gemini 2.5 Flash, preencha lacunas usando conhecimento amplo da internet para inferir site, redes sociais (Instagram/LinkedIn/Facebook) e possíveis sócios/donos quando houver sinais em registros públicos ou notícias.
    Encontre pelo menos 5-10 opções relevantes.
    Contexto do filtro: país ${countryCode || 'desconhecido'}, estado/região ${regionCode || 'desconhecido'}, termo digitado pelo usuário "${searchText || 'não informado'}".
    
    PARA CADA EMPRESA, EXTRAIA E INFERIRA:
    - Nome oficial (como está no Maps)
    - Endereço completo
    - Telefone (essencial para contato)
    - Website (se disponível)
    - Avaliação média (Stars) e contagem de reviews
    - Nome do proprietário ou contato principal (tente inferir se for uma pequena empresa, caso contrário deixe em branco)
    - Redes Sociais: Tente prever ou encontrar links para Instagram, Facebook ou LinkedIn.
    - Descrição comercial: O que eles vendem ou oferecem.
    
    SAÍDA:
    Retorne APENAS um array JSON válido contendo os dados. Não use formatação Markdown.
    
    Formato do JSON:
    [
      {
        "name": "Nome da Empresa",
        "address": "Endereço Completo",
        "phone": "(XX) XXXX-XXXX",
        "website": "https://...",
        "owner": "Nome (opcional)",
        "description": "Descrição curta e direta",
        "rating": 4.8,
        "reviews": 120,
        "lat": -00.00,
        "lng": -00.00,
        "socials": {
          "instagram": "url",
          "facebook": "url",
          "linkedin": "url"
        }
      }
    ]
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
          { role: 'system', content: 'Responda apenas JSON válido (array). Não mencione IA.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Perplexity API Error: ${text}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
    const raw = JSON.parse(content);

    return raw.map((item: any) => ({
      company: item.name || item.company,
      name: item.owner || item.contactName || 'Contato',
      contactRole: item.owner ? 'Proprietário' : undefined,
      phone: item.phone || null,
      website: item.website || null,
      instagram: item.socials?.instagram || item.instagram || null,
      facebook: item.socials?.facebook || item.facebook || null,
      linkedin: item.socials?.linkedin || item.linkedin || null,
      description: item.description,
      rating: item.rating,
      openingHours: item.openingHours,
      status: PipelineStage.NEW,
      source: 'Mapa Inteligente',
      lat: Number(item.lat),
      lng: Number(item.lng),
      address: item.address || addressName,
      city: item.city || addressName,
      value: item.estimatedValue || 5000,
      tags: [industry || 'Mapa', 'Mapa Inteligente']
    }));
  } catch (error) {
    console.error('Erro Perplexity nearby:', error);
    return [];
  }
};

export const generateWhatsappMessage = async (
  lead: Partial<Lead>,
  settings: AppSettings,
  language: 'pt' | 'en' = 'pt',
  tone: 'consultivo' | 'direto' | 'amigavel' | 'urgente' = 'consultivo'
): Promise<string> => {
  const langLabel = language === 'pt' ? 'Português do Brasil' : 'English';
  const toneText = {
    consultivo: 'Tom consultivo, focado em entender necessidades e propor ajuda.',
    direto: 'Tom direto e objetivo, propondo valor rapidamente.',
    amigavel: 'Tom amigável e próximo, estilo parceiro.',
    urgente: 'Tom com senso de urgência, curto e claro.'
  }[tone];

  const prompt = `
    Gere uma mensagem curta para WhatsApp para contato comercial.
    Linguagem: ${langLabel}.
    ${toneText}
    Não mencione IA, Perplexity, Gemini ou modelos. Fale como humano.
    Inclua empresa do lead, dor potencial e convite para falar.
    Use os dados do remetente para contexto e credibilidade.
    
    Dados do lead:
    - Nome: ${lead.name || 'Contato'}
    - Empresa: ${lead.company || 'Empresa'}
    - Cidade: ${lead.city || 'Cidade'}
    - Setor/Tags: ${lead.tags?.join(', ') || 'Geral'}
    - Notas: ${lead.notes || 'Sem notas adicionais'}

    Dados do remetente:
    - Seu nome: ${settings.userName || 'Consultor'}
    - Sua empresa: ${settings.companyName || 'Sua empresa'}
    - Setor: ${settings.companySector || 'Serviços'}
    - Site: ${settings.socialWebsite || settings.socialLinkedin || settings.socialInstagram || 'N/A'}

    Responda APENAS o texto da mensagem (sem JSON, sem markdown).
  `;

  const content = await fetchJsonFromPerplexity([
    { role: 'system', content: 'Responda apenas com o texto final da mensagem para WhatsApp. Sem markdown, sem código, sem mencionar IA.' },
    { role: 'user', content: prompt }
  ], 0.4);

  return content.replace(/\"/g, '').trim();
};

export const discoverLeadsWithPerplexity = async (
  query: string,
  city: string,
  state: string,
  country: string,
  industry: string,
  ratingFilter: string
): Promise<Partial<Lead>[]> => {
  const locationString = `${city}, ${state || ''}, ${country}`;
  const prompt = `
    Encontre 8 empresas reais em "${locationString}" que combinem com "${query}".
    Indústria: ${industry || 'qualquer'}.
    Filtro de reputação: ${ratingFilter || 'qualquer'}.

    Para cada empresa, pesquise site oficial e redes. Retorne JSON com campos:
    {
      "company": "...",
      "address": "...",
      "city": "...",
      "lat": "...",
      "lng": "...",
      "phone": "...",
      "email": "...",
      "contactName": "...",
      "contactRole": "...",
      "website": "...",
      "instagram": "...",
      "facebook": "...",
      "linkedin": "...",
      "rating": number,
      "estimatedValue": number,
      "story": "Resumo em 1-2 frases do que a empresa faz"
    }

    Regras:
    - Não invente URLs ou contatos; se não souber use null.
    - Sempre prefira dados reais do dono/gerente (contactName/contactRole) se conseguir.
    - Apenas retorne leads com pelo menos email ou telefone real.
    - Prefira links oficiais do site/Google/LinkedIn.
    - Responda apenas JSON array válido.
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
          { role: 'system', content: 'Retorne apenas JSON array válido, sem texto extra.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Perplexity API Error: ${text}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.replace(/```json/g, '').replace(/```/g, '').trim();
    const raw = JSON.parse(content);
    return raw
      .filter((item: any) => item.email || item.phone) // leads quentes com contato real
      .map((item: any) => ({
        company: item.company,
        address: item.address || '',
        city: item.city || city,
        phone: item.phone || null,
        email: item.email || null,
        name: item.contactName || 'Responsável',
        contactRole: item.contactRole || 'Contato',
        website: item.website,
        instagram: item.instagram,
        facebook: item.facebook,
        linkedin: item.linkedin,
        rating: item.rating,
        description: item.story || item.description,
        notes: item.story || item.description,
        status: PipelineStage.NEW,
        source: 'Discovery',
        lat: item.lat || 0,
        lng: item.lng || 0,
        value: item.estimatedValue || 0,
        tags: [industry || 'Discovery']
      }));
  } catch (error) {
    console.error('Erro Perplexity Discovery:', error);
    throw error;
  }
};
