import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppRuntimeProvider, useBoot } from '@/app-runtime/AppProvider';
import { AppShell } from '@/app-runtime/AppShell';
import { AppText, Card, LoadingState, spacing, useTheme } from '@/design-system';
import { registerServiceWorker } from '@/services/web/pwa';

const BASE = process.env.EXPO_BASE_URL ?? '';
registerServiceWorker();

function BootGate() {
  const boot = useBoot();
  const { colors } = useTheme();
  if (boot.kind !== 'ready') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Card style={styles.card}>
          <AppText variant="display" tone="primary">
            TravelMemo
          </AppText>
          {boot.kind === 'loading' ? <LoadingState label="Đang mở kho dữ liệu trên máy…" /> : null}
          {boot.kind === 'locked' ? (
            <AppText>TravelMemo đang mở ở một tab khác. Hãy dùng tab đó, hoặc đóng nó rồi tải lại trang này, để dữ liệu không bị ghi đè.</AppText>
          ) : null}
          {boot.kind === 'error' ? (
            <>
              <AppText tone="error">Không mở được dữ liệu: {boot.message}</AppText>
              <AppText tone="secondary">
                Dữ liệu cũ không bị xoá. Hãy thử tải lại trang. Nếu đang ở chế độ ẩn danh, trình duyệt có thể chặn lưu trữ.
              </AppText>
            </>
          ) : null}
        </Card>
      </View>
    );
  }
  return (
    <AppRuntimeProvider runtime={boot.runtime}>
      <AppShell>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.primary,
            headerTitleStyle: { color: colors.text },
            contentStyle: { backgroundColor: colors.background },
            headerBackTitle: 'Quay lại',
          }}
        >
          {['index', 'atlas/index', 'passport/index', 'journeys/index', 'library/index'].map((name) => (
            <Stack.Screen key={name} name={name} options={{ headerShown: false, animation: 'none' }} />
          ))}
        </Stack>
      </AppShell>
    </AppRuntimeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Head>
        <title>TravelMemo</title>
        <meta name="description" content="Atlas, hộ chiếu và nhật ký hành trình cá nhân. Dữ liệu chỉ lưu trên máy của bạn." />
        <meta name="theme-color" content="#173B34" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="TravelMemo" />
        <link rel="manifest" href={`${BASE}/manifest.webmanifest`} />
        <link rel="apple-touch-icon" href={`${BASE}/apple-touch-icon.png`} />
      </Head>
      <StatusBar style="auto" />
      <BootGate />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { maxWidth: 480, width: '100%', gap: spacing.md },
});
