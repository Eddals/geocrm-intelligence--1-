
import { Lead, EmailTone, EmailFocus, AppSettings } from '../types';

const PERPLEXITY_API_KEY = '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';

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
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: 'Output strictly valid JSON. Do not include markdown formatting or conversational text. Do not mention AI or artificial intelligence.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      try {
          const errorJson = JSON.parse(errorText);
          throw new Error(`Perplexity API Error: ${errorJson.error?.message || response.statusText}`);
      } catch {
          throw new Error(`Perplexity API Error ${response.status}: ${errorText}`);
      }
    }

    const data = await response.json();
    let content = data.choices[0].message.content;

    // 1. Remove Markdown code blocks
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();

    // 2. Remove backslash-newline sequences (invalid line continuations in JSON)
    content = content.replace(/\\\r?\n/g, '');

    // 3. Extract JSON object if there is surrounding text
    const firstOpen = content.indexOf('{');
    const lastClose = content.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1) {
        content = content.substring(firstOpen, lastClose + 1);
    }

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
