const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';

const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

// Minimal REST client using Supabase PostgREST
export const supabaseRequest = async <T = any>(
  table: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    query?: string; // e.g. '?select=*' or filters '?city=eq.Sao%20Paulo'
    body?: any;
  } = {}
): Promise<T> => {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase credentials are missing. Configure VITE_SUPABASE_URL/KEY.');
  }

  const { method = 'GET', query = '?select=*', body } = options;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error ${res.status}: ${text}`);
  }

  return res.json();
};

// Example helpers (not wired automatically)
export const insertLead = (payload: Record<string, any>) =>
  supabaseRequest('leads', { method: 'POST', body: payload, query: '' });

export const fetchLeads = () => supabaseRequest('leads');

export const updateLeadRow = (id: string, payload: Record<string, any>) =>
  supabaseRequest('leads', {
    method: 'PATCH',
    body: payload,
    query: `?id=eq.${id}`
  });
