import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, spacing, touchTarget, useTheme } from '../design-system';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const TABS: readonly { href: '/' | '/atlas' | '/passport' | '/journeys' | '/library' | '/settings'; label: string; icon: IconName; match: RegExp }[] = [
  { href: '/', label: 'Home', icon: 'home-outline', match: /^\/$/ },
  { href: '/atlas', label: 'Atlas', icon: 'earth-outline', match: /^\/atlas/ },
  { href: '/passport', label: 'Passport', icon: 'book-outline', match: /^\/(passport|stamp)/ },
  { href: '/journeys', label: 'Journeys', icon: 'map-outline', match: /^\/(journeys|journey|visit)/ },
  { href: '/library', label: 'Library', icon: 'images-outline', match: /^\/(library|journal|photo|ai)/ },
  { href: '/settings', label: 'Settings', icon: 'settings-outline', match: /^\/settings/ },
];

export const WIDE_BREAKPOINT = 900;

export function useIsWide(): boolean {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}

/** Responsive navigation: sidebar on desktop/tablet landscape, bottom tab bar on phones. */
export function AppShell({ children }: { readonly children: ReactNode }) {
  const wide = useIsWide();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const items = TABS.map((t) => {
    const active = t.match.test(path);
    return (
        <Pressable
          key={t.href}
          onPress={() => router.navigate(t.href)}
          accessibilityRole="tab"
          accessibilityState={{ selected: active }}
          accessibilityLabel={t.label}
          style={({ pressed }) => [
            wide ? styles.sideItem : styles.bottomItem,
            active && wide && { backgroundColor: colors.unvisited },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name={active ? (t.icon.replace('-outline', '') as IconName) : t.icon} size={wide ? 22 : 24} color={active ? colors.primary : colors.secondary} />
          <AppText variant={wide ? 'heading' : 'caption'} tone={active ? 'primary' : 'secondary'} style={!wide && styles.bottomLabel}>
            {t.label}
          </AppText>
        </Pressable>
    );
  });

  if (wide) {
    return (
      <View style={[styles.row, { backgroundColor: colors.background }]}>
        <View accessibilityRole="tablist" style={[styles.sidebar, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
          <View style={styles.brand}>
            <AppText variant="title" tone="primary">
              TravelMemo
            </AppText>
            <AppText variant="caption" tone="secondary">
              My Atlas. My Passport. My Life.
            </AppText>
          </View>
          {items}
        </View>
        <View style={styles.main}>{children}</View>
      </View>
    );
  }
  return (
    <View style={[styles.col, { backgroundColor: colors.background }]}>
      <View style={styles.main}>{children}</View>
      <View
        accessibilityRole="tablist"
        style={[styles.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, spacing.xs) }]}
      >
        {items}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  col: { flex: 1 },
  main: { flex: 1, minWidth: 0 },
  sidebar: { width: 240, paddingVertical: spacing.xl, paddingHorizontal: spacing.md, gap: spacing.xs, borderRightWidth: StyleSheet.hairlineWidth },
  brand: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: 2 },
  sideItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: touchTarget, paddingHorizontal: spacing.md, borderRadius: 12 },
  bottomBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.xs },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: touchTarget + 6, gap: 2 },
  bottomLabel: { fontSize: 11 },
});
