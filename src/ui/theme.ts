import { Platform } from 'react-native';

export const COLORS = {
  background: '#0b1220',
  backgroundAlt: '#111a2d',
  surface: '#141f35',
  surfaceMuted: '#192642',
  surfaceStrong: '#1e3155',
  border: '#2a3a5f',
  borderSoft: '#20314f',
  text: '#ecf3ff',
  textMuted: '#98a8c7',
  textSoft: '#6c7d9f',
  accent: '#7bd3b0',
  accentStrong: '#4fb28d',
  danger: '#ff7f96',
  warning: '#f1c977',
  info: '#86b9ff',
  overlay: 'rgba(7, 12, 24, 0.82)',
};

export const SHADOW = Platform.select({
  web: {
    boxShadow: '0px 24px 80px rgba(5, 10, 22, 0.32)',
  },
  default: {
    shadowColor: '#050a16',
    shadowOpacity: 0.28,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
});
