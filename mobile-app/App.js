import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

const APP_BASE = 'https://leahcim12.github.io/optyker-web/iphone-app-v13/?app=13&platform=android';
const INTERNAL_HOSTS = new Set([
  'leahcim12.github.io',
  'otticavisualcare.it',
  'www.otticavisualcare.it',
  'whgziwaegjzqsgcntesr.supabase.co',
]);

function isInternalUrl(raw) {
  try {
    const u = new URL(raw);
    return INTERNAL_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

export default function App() {
  const webRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);

  const initialUrl = useMemo(
    () => `${APP_BASE}&fresh=${Date.now()}`,
    []
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webRef.current) {
        webRef.current.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  async function openExternal(url) {
    try {
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
    } catch (_) {}
  }

  if (failed) {
    return (
      <SafeAreaView style={styles.errorScreen}>
        <StatusBar barStyle="dark-content" backgroundColor="#f4f7fa" />
        <View style={styles.errorCard}>
          <Text style={styles.brand}>OTTICA VISUAL CARE</Text>
          <Text style={styles.errorTitle}>Connessione non disponibile</Text>
          <Text style={styles.errorText}>
            Controlla la connessione Internet e riapri l’app.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <WebView
        ref={webRef}
        source={{ uri: initialUrl }}
        style={styles.web}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowFileAccess
        allowContentAccess
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
        cacheEnabled={false}
        cacheMode="LOAD_NO_CACHE"
        pullToRefreshEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#1769aa" />
            <Text style={styles.loadingText}>Ottica Visual Care</Text>
          </View>
        )}
        onNavigationStateChange={(nav) => setCanGoBack(!!nav.canGoBack)}
        onShouldStartLoadWithRequest={(request) => {
          const url = String(request?.url || '');
          if (!url) return false;
          if (
            url.startsWith('about:blank') ||
            url.startsWith('blob:') ||
            url.startsWith('data:')
          ) return true;
          if (isInternalUrl(url)) return true;
          if (
            /^https?:/i.test(url) ||
            /^(tel|mailto|sms|geo|market):/i.test(url)
          ) {
            openExternal(url);
            return false;
          }
          return true;
        }}
        onError={() => setFailed(true)}
        onHttpError={(e) => {
          const status = Number(e?.nativeEvent?.statusCode || 0);
          if (status >= 500) setFailed(true);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  web: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#f4f7fa',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#11395d',
    fontSize: 15,
    fontWeight: '800',
  },
  errorScreen: {
    flex: 1,
    backgroundColor: '#f4f7fa',
    justifyContent: 'center',
    padding: 22,
  },
  errorCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 24,
    borderWidth: 1,
    borderColor: '#dce6ee',
  },
  brand: {
    color: '#1769aa',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  errorTitle: {
    marginTop: 8,
    color: '#11395d',
    fontSize: 22,
    fontWeight: '900',
  },
  errorText: {
    marginTop: 8,
    color: '#6d8291',
    fontSize: 13,
    lineHeight: 19,
  },
});
