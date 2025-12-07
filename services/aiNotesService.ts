import { Lead } from '../types';

const PERPLEXITY_API_KEY = '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';

export const searchNotesWithAI = async (
  leads: Lead[],
  searchQuery: string
): Promise<string> => {
  
  const notesData = leads
    .filter(lead => lead.notes && lead.notes.trim())
    .map(lead => ({
      company: lead.company,
      name: lead.name,
      notes: lead.notes
    }));

  const prompt = `
    Pesquise nas seguintes notas e retorne apenas os resultados relevantes para: "${searchQuery}"

    NOTAS:
    ${notesData.map(item => `
    Empresa: ${item.company}
    Contato: ${item.name}
    Notas: ${item.notes}
    ---`).join('\n')}

    INSTRUÇÕES:
    - Retorne apenas informações encontradas nas notas
    - Não mencione que você é uma IA
    - Não adicione explicações sobre o processo
    - Seja direto e objetivo
    - Se não encontrar nada relevante, responda apenas "Nenhum resultado encontrado"
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
          { 
            role: 'system', 
            content: 'Você é um sistema de busca. Retorne apenas resultados das notas fornecidas. Não se identifique como IA.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`Erro na pesquisa: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();

  } catch (error) {
    console.error("Erro na pesquisa das notas:", error);
    return "Erro na pesquisa";
  }
};

export const analyzeNotesWithAI = async (
  leads: Lead[],
  analysisType: 'oportunidades' | 'riscos' | 'tendencias' | 'resumo'
): Promise<string> => {
  
  const notesData = leads
    .filter(lead => lead.notes && lead.notes.trim())
    .map(lead => ({
      company: lead.company,
      name: lead.name,
      notes: lead.notes,
      tags: lead.tags
    }));

  const analysisPrompts = {
    oportunidades: "Identifique oportunidades de negócio nas notas",
    riscos: "Identifique possíveis riscos ou problemas nas notas", 
    tendencias: "Identifique tendências ou padrões nas notas",
    resumo: "Faça um resumo executivo das informações nas notas"
  };

  const prompt = `
    ${analysisPrompts[analysisType]}:

    DADOS:
    ${notesData.map(item => `
    Empresa: ${item.company}
    Contato: ${item.name}
    Tags: ${item.tags?.join(', ') || 'N/A'}
    Notas: ${item.notes}
    ---`).join('\n')}

    INSTRUÇÕES:
    - Analise apenas as informações fornecidas
    - Seja objetivo e direto
    - Não mencione que você é uma IA
    - Organize por empresa quando relevante
    - Se não houver dados suficientes, informe "Dados insuficientes para análise"
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
          { 
            role: 'system', 
            content: 'Você é um analista de dados. Analise apenas as informações fornecidas. Não se identifique como IA.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      })
    });

    if (!response.ok) {
      throw new Error(`Erro na análise: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content.trim();

  } catch (error) {
    console.error("Erro na análise das notas:", error);
    return "Erro na análise";
  }
};