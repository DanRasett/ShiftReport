import React from 'react';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { COLORS, SHADOW } from './theme';

interface LayoutInfo {
  width: number;
  isTablet: boolean;
  isDesktop: boolean;
  sidePadding: number;
  contentMaxWidth: number;
}

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

interface HeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
}

export function useResponsiveLayout(): LayoutInfo {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1180;
  const isTablet = width >= 760;

  return {
    width,
    isTablet,
    isDesktop,
    sidePadding: isDesktop ? 32 : isTablet ? 24 : 16,
    contentMaxWidth: isDesktop ? 1400 : isTablet ? 1040 : 720,
  };
}

export function ScreenLayout({ children, scroll = true, style, contentStyle }: ScreenProps) {
  const layout = useResponsiveLayout();

  const content = (
    <View style={[styles.outer, { paddingHorizontal: layout.sidePadding }, style]}>
      <View style={[styles.inner, { maxWidth: layout.contentMaxWidth }, contentStyle]}>
        {children}
      </View>
    </View>
  );

  if (!scroll) {
    return <View style={styles.root}>{content}</View>;
  }

  return (
    <View style={styles.root}>
      <View style={[styles.glow, styles.glowLeft]} />
      <View style={[styles.glow, styles.glowRight]} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {content}
      </ScrollView>
    </View>
  );
}

export function ScreenHeader({ title, subtitle, right }: HeaderProps) {
  const { isDesktop } = useResponsiveLayout();

  return (
    <View style={[styles.header, isDesktop && styles.headerDesktop]}>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.headerRight}>{right}</View> : null}
    </View>
  );
}

export function SectionTitle({ eyebrow, title, subtitle, style }: SectionTitleProps) {
  return (
    <View style={style}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function SurfaceCard({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function MetricPill({
  label,
  value,
  accent = false,
  style,
}: {
  label: string;
  value: string;
  accent?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.pill, accent && styles.pillAccent, style]}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={[styles.pillValue, accent && styles.pillValueAccent]}>{value}</Text>
    </View>
  );
}

export const sharedInputStyles = StyleSheet.create({
  input: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: COLORS.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
});

export const sharedTextStyles = StyleSheet.create({
  label: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginBottom: 8,
  } as TextStyle,
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingVertical: 24,
  },
  outer: {
    width: '100%',
  },
  inner: {
    width: '100%',
    alignSelf: 'center',
  },
  glow: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.55,
  },
  glowLeft: {
    width: 320,
    height: 320,
    backgroundColor: 'rgba(123, 211, 176, 0.10)',
    top: -110,
    left: -70,
  },
  glowRight: {
    width: 360,
    height: 360,
    backgroundColor: 'rgba(134, 185, 255, 0.12)',
    top: 120,
    right: -120,
  },
  header: {
    marginBottom: 18,
    gap: 14,
  },
  headerDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerText: {
    flexShrink: 1,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    color: COLORS.textMuted,
    fontSize: 15,
    marginTop: 6,
    lineHeight: 22,
  },
  headerRight: {
    minWidth: 180,
  },
  eyebrow: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    overflow: 'hidden',
    ...SHADOW,
  },
  pill: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  pillAccent: {
    backgroundColor: 'rgba(79, 178, 141, 0.12)',
    borderColor: 'rgba(123, 211, 176, 0.28)',
  },
  pillLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: 5,
  },
  pillValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  pillValueAccent: {
    color: COLORS.accent,
  },
});
