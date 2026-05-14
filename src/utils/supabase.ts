import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://glilovtznlhiskipkrkk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsaWxvdnR6bmxoaXNraXBrcmtrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzOTE0NjksImV4cCI6MjA5Mzk2NzQ2OX0.5JbTDMdq7wRoNPK54DD7j7KwWaZtJjGlWm1aD_xe_co';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
  },
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'Content-Type': 'application/json',
    },
  },
  realtime: {
    timeout: 10000, // 10 секунд таймаут
  },
});

// Проверка соединения с Supabase
export const checkSupabaseConnection = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд таймаут

    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'HEAD',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok || response.status === 404; // 404 — нормально для HEAD
  } catch (e) {
    return false;
  }
};

// Кэш для ускорения повторных запросов
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; // 30 секунд кэш

export const cachedQuery = async <T>(
  key: string,
  queryFn: () => Promise<T>,
  ttl: number = CACHE_TTL
): Promise<T> => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T;
  }

  const data = await queryFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
};

export const clearCache = () => {
  cache.clear();
};