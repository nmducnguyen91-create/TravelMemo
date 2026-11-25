import { useEffect, useState } from 'react';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { openDatabase } from '@/database/open-database';
import { palette, radius, spacing } from '@/design-system/tokens';

type DbState = { kind: 'loading' } | { kind: 'ready'; version: number } | { kind: 'error'; message: string };

/** S00-06 smoke screen: proves the app boots and the local database migrates. Replaced by tabs in S01-03. */
export default function SmokeScreen() {
  const colors = palette[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const [state, setState] = useState<DbState>({ kind: 'loading' });

  useEffect(() => {
    openDatabase()
      .then(({ migration }) => setState({ kind: 'ready', version: migration.toVersion }))
      .catch((error: unknown) => setState({ kind: 'error', message: error instanceof Error ? error.message : String(error) }));
  }, []);

  const status =
    state.kind === 'loading'
      ? 'Đang mở cơ sở dữ liệu…'
      : state.kind === 'ready'
        ? `Cơ sở dữ liệu sẵn sàng · schema v${state.version}`
        : `Lỗi cơ sở dữ liệu: ${state.message}`;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.primary }]}>
          TravelMemo
        </Text>
        <Text style={[styles.subtitle, { color: colors.secondary }]}>My Atlas. My Passport. My Life.</Text>
        <Text
          accessibilityLiveRegion="polite"
          style={[styles.status, { color: state.kind === 'error' ? colors.error : colors.text }]}
        >
          {status}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: spacing[4] },
  card: { borderWidth: 1, borderRadius: radius[2], padding: spacing[5], gap: spacing[2] },
  title: { fontSize: 32, fontWeight: '700' },
  subtitle: { fontSize: 16 },
  status: { fontSize: 16, marginTop: spacing[3] },
});
