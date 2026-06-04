const SUPABASE_URL = 'https://glilovtznlhiskipkrkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsaWxvdnR6bmxoaXNraXBrcmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTE0NjksImV4cCI6MjA5Mzk2NzQ2OX0.5JbTDMdq7wRoNPK54DD7j7KwWaZtJjGlWm1aD_xe_co';

// Локальный кэш в памяти
const memoryCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL = 60000; // 1 минута

const fetchWithRetry = async (url: string, options: RequestInit = {}, retries = 3): Promise<Response> => {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeout);
      return res;
    } catch (e: any) {
      if (i === retries) throw e;
      // Ждём с экспоненциальной задержкой
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries exceeded');
};

export const supabase = {
  select: async (table: string, query = ''): Promise<any> => {
    const cacheKey = `${table}:${query}`;
    const cached = memoryCache[cacheKey];

    // Возвращаем кэш если свежий
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/${table}?${query}`);
      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      // Кэшируем
      if (data) {
        memoryCache[cacheKey] = { data, timestamp: Date.now() };
      }

      return data;
    } catch (e: any) {
      console.log('Supabase select error:', e.message);
      // Возвращаем устаревший кэш если есть
      if (cached) return cached.data;
      return [];
    }
  },

  insert: async (table: string, data: any): Promise<any> => {
    try {
      const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify(data),
      });

      // Очищаем кэш таблицы
      Object.keys(memoryCache).forEach(key => {
        if (key.startsWith(`${table}:`)) delete memoryCache[key];
      });

      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (e: any) {
      console.log('Supabase insert error:', e.message);
      return null;
    }
  },

  upsert: async (table: string, data: any): Promise<any> => {
    try {
      const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify(data),
      });

      Object.keys(memoryCache).forEach(key => {
        if (key.startsWith(`${table}:`)) delete memoryCache[key];
      });

      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (e: any) {
      console.log('Supabase upsert error:', e.message);
      return null;
    }
  },

  update: async (table: string, query: string, data: any): Promise<any> => {
    try {
      const res = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify(data),
      });

      Object.keys(memoryCache).forEach(key => {
        if (key.startsWith(`${table}:`)) delete memoryCache[key];
      });

      const text = await res.text();
      return text ? JSON.parse(text) : null;
    } catch (e: any) {
      console.log('Supabase update error:', e.message);
      return null;
    }
  },

  clearCache: () => {
    Object.keys(memoryCache).forEach(key => delete memoryCache[key]);
  },
};