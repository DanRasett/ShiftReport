const SUPABASE_URL = 'https://glilovtznlhiskipkrkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsaWxvdnR6bmxoaXNraXBrcmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTE0NjksImV4cCI6MjA5Mzk2NzQ2OX0.5JbTDMdq7wRoNPK54DD7j7KwWaZtJjGlWm1aD_xe_co';

const fetchSupabase = async (path: string, options: RequestInit = {}, retries = 2): Promise<any> => {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options,
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      
      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (e: any) {
      if (i === retries) throw e;
      // Ждём перед повторной попыткой
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
};

export const supabase = {
  select: async (table: string, query = '') => fetchSupabase(`${table}?${query}`),
  insert: async (table: string, data: any) => fetchSupabase(table, {
    method: 'POST',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify(data),
  }),
  upsert: async (table: string, data: any) => fetchSupabase(table, {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify(data),
  }),
  update: async (table: string, query: string, data: any) => fetchSupabase(`${table}?${query}`, {
    method: 'PATCH',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify(data),
  }),
};