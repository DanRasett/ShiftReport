export const appConfig = {
  // Keep these references static: Expo inlines EXPO_PUBLIC_* variables during bundling.
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '',
} as const;

export const isSupabaseConfigured = Boolean(
  appConfig.supabaseUrl && appConfig.supabaseAnonKey,
);

export const getSupabaseConfigurationError = (): Error =>
  new Error(
    'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
  );
