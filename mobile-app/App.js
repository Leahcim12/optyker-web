import 'react-native-url-polyfill/auto';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { WebView } from 'react-native-webview';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

const SUPABASE_URL = 'https://whgziwaegjzqsgcntesr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DndhLvY32YeCmqWMNRi30g_dEDm8upv';
const MOBILE_API = `${SUPABASE_URL}/functions/v1/optyker-mobile-api`;
const SHOP_URL = 'https://otticavisualcare.it';
const BOOKING_URL = 'https://leahcim12.github.io/optyker-web/booking/?source=app';

const C = {
  navy: '#11395d',
  blue: '#1769aa',
  blue2: '#0f5d9b',
  green: '#159455',
  bg: '#f4f7fa',
  card: '#ffffff',
  line: '#dce6ee',
  text: '#19384d',
  muted: '#6d8291',
  soft: '#edf5fb',
  danger: '#b42318',
  warning: '#9a6700',
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

function money(v, currency = 'EUR') {
  try {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(Number(v || 0));
  } catch {
    return `${Number(v || 0).toFixed(2)} ${currency}`;
  }
}

function dateIt(v) {
  if (!v) return '—';
  try {
    return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(v));
  } catch {
    return String(v);
  }
}

function dateTimeIt(v) {
  if (!v) return '';
  try {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
    }).format(new Date(v));
  } catch {
    return String(v);
  }
}

async function api(action, payload = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sessione scaduta');
  const r = await fetch(MOBILE_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ action, payload }),
  });
  const x = await r.json().catch(() => ({ ok: false, error: 'Risposta non valida' }));
  if (!r.ok || x?.ok === false) {
    const map = {
      EMAIL_NOT_LINKED: 'Questa email non è ancora collegata a un cliente o a un operatore Optyker.',
      AUTH_INVALID: 'Sessione scaduta. Accedi di nuovo.',
      AUTH_REQUIRED: 'Accedi per continuare.',
    };
    throw new Error(map[x?.error] || x?.error || 'Operazione non riuscita');
  }
  return x;
}

function Button({ title, onPress, variant = 'primary', disabled = false, compact = false }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        disabled && { opacity: 0.5 },
        pressed && !disabled && { opacity: 0.78 },
      ]}
    >
      <Text style={[styles.buttonText, variant === 'secondary' && styles.buttonSecondaryText]}>{title}</Text>
    </Pressable>
  );
}

function Loading({ label = 'Caricamento…' }) {
  return (
    <View style={styles.centerFill}>
      <ActivityIndicator size="large" color={C.blue} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

function Empty({ title, text }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!text && <Text style={styles.emptyText}>{text}</Text>}
    </View>
  );
}

function AppHeader({ title, subtitle, right }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.brandEyebrow}>OTTICA VISUAL CARE</Text>
        <Text style={styles.headerTitle}>{title}</Text>
        {!!subtitle && <Text style={styles.headerSub}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

function TabBar({ items, active, onChange }) {
  return (
    <View style={styles.tabBar}>
      {items.map((item) => (
        <Pressable key={item.key} onPress={() => onChange(item.key)} style={styles.tabItem}>
          <Text style={[styles.tabIcon, active === item.key && styles.tabIconActive]}>{item.icon}</Text>
          <Text style={[styles.tabLabel, active === item.key && styles.tabLabelActive]} numberOfLines={1}>{item.label}</Text>
          {!!item.badge && <View style={styles.badge}><Text style={styles.badgeText}>{item.badge}</Text></View>}
        </Pressable>
      ))}
    </View>
  );
}

function Section({ title, children, action }) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function Field({ label, value }) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} selectable>{String(value)}</Text>
    </View>
  );
}

function Metric({ label, value, hint }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      {!!hint && <Text style={styles.metricHint}>{hint}</Text>}
    </View>
  );
}

function Goniometer({ axis, international = false, eye }) {
  const raw = Number(String(axis ?? '').replace(',', '.'));
  if (!Number.isFinite(raw)) return <Text style={styles.muted}>Asse non disponibile</Text>;
  const val = Math.max(0, Math.min(180, Math.abs(raw)));
  const draw = international ? 180 - val : val;
  const cx = 90;
  const cy = 76;
  const r = 64;
  const rad = draw * Math.PI / 180;
  const x = cx + 48 * Math.cos(rad);
  const y = cy - 48 * Math.sin(rad);
  const ticks = [0, 45, 90, 135, 180];
  return (
    <View style={styles.gonioWrap}>
      <Svg width="100%" height="105" viewBox="0 0 180 105">
        <Path d="M 26 76 A 64 64 0 0 1 154 76" fill="none" stroke="#657d8f" strokeWidth="1.5" />
        <Line x1="23" y1="76" x2="157" y2="76" stroke="#657d8f" strokeWidth="1.3" />
        {ticks.map((d) => {
          const a = d * Math.PI / 180;
          const tx1 = cx + 64 * Math.cos(a);
          const ty1 = cy - 64 * Math.sin(a);
          const tx2 = cx + 57 * Math.cos(a);
          const ty2 = cy - 57 * Math.sin(a);
          const lx = cx + 48 * Math.cos(a);
          const ly = cy - 48 * Math.sin(a) + 3;
          const lab = international ? 180 - d : d;
          return (
            <React.Fragment key={d}>
              <Line x1={tx1} y1={ty1} x2={tx2} y2={ty2} stroke="#8a9ba8" strokeWidth="1" />
              <SvgText x={lx} y={ly} fontSize="7" fill="#6d8291" textAnchor="middle">{lab}</SvgText>
            </React.Fragment>
          );
        })}
        <Circle cx={cx} cy={cy} r="3.5" fill="#fff" stroke="#657d8f" />
        <Line x1={cx} y1={cy} x2={x} y2={y} stroke={C.blue} strokeWidth="3.5" strokeLinecap="round" />
        <Circle cx={x} cy={y} r="3" fill={C.blue} />
        <SvgText x="90" y="99" fontSize="9" fontWeight="700" fill={C.blue} textAnchor="middle">
          {eye} AX {Math.round(val)}°
        </SvgText>
      </Svg>
    </View>
  );
}

function RxEye({ eye, data, international }) {
  return (
    <View style={styles.rxEye}>
      <Text style={styles.rxEyeTitle}>{eye}</Text>
      <View style={styles.rxGrid}>
        <Field label="SF" value={data?.sf || '—'} />
        <Field label="CIL" value={data?.cil || '—'} />
        <Field label="AX" value={data?.axis ? `${data.axis}°` : '—'} />
        <Field label="ADD" value={data?.add || '—'} />
      </View>
      <Goniometer eye={eye} axis={data?.axis} international={international} />
    </View>
  );
}

function PrescriptionCard({ prescription, compact = false }) {
  const rows = Array.isArray(prescription?.rows) ? prescription.rows : [];
  if (!prescription?.visible || !rows.length) return <Empty title="Nessuna prescrizione disponibile" />;
  return (
    <View>
      {!!prescription.updated_at && <Text style={styles.smallMeta}>Aggiornata il {dateIt(prescription.updated_at)}</Text>}
      {rows.map((row, idx) => (
        <View key={`${row.row || idx}`} style={styles.rxSet}>
          <Text style={styles.rxSetTitle}>Diottrie {row.row || idx + 1}</Text>
          <View style={[styles.rxColumns, compact && { flexDirection: 'column' }]}>
            <RxEye eye="OD" data={row.od} international={false} />
            <RxEye eye="OS" data={row.os} international={String(prescription.axis_mode_os || '').toLowerCase() === 'international'} />
          </View>
        </View>
      ))}
    </View>
  );
}

function OrderCard({ order }) {
  return (
    <View style={styles.listCard}>
      <View style={styles.rowBetween}>
        <Text style={styles.listTitle}>{order.order_name || 'Ordine'}</Text>
        <Text style={styles.price}>{money(order.total, order.currency || 'EUR')}</Text>
      </View>
      <Text style={styles.smallMeta}>{dateIt(order.order_date)} · {order.financial_status || '—'} · {order.fulfillment_status || '—'}</Text>
    </View>
  );
}

function LensCard({ lens, onReorder, busy }) {
  const [qty, setQty] = useState('1');
  return (
    <View style={styles.listCard}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={styles.listTitle}>{lens.brand || 'LAC'}{lens.product_name ? ` · ${lens.product_name}` : ''}</Text>
          <Text style={styles.smallMeta}>{lens.eye || ''}</Text>
        </View>
        <Text style={styles.price}>{money(lens.unit_price, lens.currency || 'EUR')}</Text>
      </View>
      <View style={styles.inlineActions}>
        <TextInput
          value={qty}
          onChangeText={setQty}
          keyboardType="number-pad"
          style={[styles.input, styles.qtyInput]}
          maxLength={2}
        />
        <Button
          compact
          title={busy ? 'Invio…' : 'Richiedi riordino'}
          disabled={busy}
          onPress={() => onReorder(lens.id, Math.max(1, Math.min(12, Number(qty || 1))))}
        />
      </View>
    </View>
  );
}

function ChatView({ role, clientId, initialMessages = [], onBack }) {
  const [messages, setMessages] = useState(initialMessages || []);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(!initialMessages?.length);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  async function load(silent = false) {
    try {
      if (!silent) setLoading(true);
      const x = await api('chat_get', role === 'staff' ? { client_id: clientId } : {});
      setMessages(Array.isArray(x.data) ? x.data : []);
    } catch (e) {
      if (!silent) Alert.alert('Chat', e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function send() {
    const message = text.trim();
    if (!message || sending) return;
    try {
      setSending(true);
      await api('chat_send', role === 'staff' ? { client_id: clientId, message } : { message });
      setText('');
      await load(true);
    } catch (e) {
      Alert.alert('Chat', e.message);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 5000);
    return () => clearInterval(id);
  }, [clientId]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 60);
  }, [messages.length]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
      {!!onBack && (
        <View style={styles.subHeader}>
          <Pressable onPress={onBack}><Text style={styles.back}>‹ Indietro</Text></Pressable>
          <Text style={styles.subHeaderTitle}>Chat cliente</Text>
        </View>
      )}
      {loading ? <Loading /> : (
        <ScrollView ref={scrollRef} style={styles.chatScroll} contentContainerStyle={styles.chatContent}>
          {!messages.length && <Empty title="Nessun messaggio" text="Inizia qui la conversazione." />}
          {messages.map((m) => {
            const mine = role === 'staff' ? m.sender_type === 'staff' : m.sender_type === 'customer';
            return (
              <View key={m.id || `${m.created_at}-${m.message}`} style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={[styles.bubbleSender, mine && { color: '#dfefff' }]}>{m.sender_name || (mine ? 'Tu' : 'Ottica Visual Care')}</Text>
                <Text style={[styles.bubbleText, mine && { color: '#fff' }]}>{m.message}</Text>
                <Text style={[styles.bubbleTime, mine && { color: '#d7eaff' }]}>{dateTimeIt(m.created_at)}</Text>
              </View>
            );
          })}
        </ScrollView>
      )}
      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Scrivi un messaggio…"
          multiline
          style={[styles.input, styles.composerInput]}
        />
        <Button compact title={sending ? '…' : 'Invia'} onPress={send} disabled={sending || !text.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

function AuthScreen({ onSignedIn }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const e = email.trim().toLowerCase();
    if (!e || password.length < 6) {
      Alert.alert('Accesso', 'Inserisci una email valida e una password di almeno 6 caratteri.');
      return;
    }
    try {
      setBusy(true);
      if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({ email: e, password });
        if (error) throw error;
        if (data.session) onSignedIn?.(data.session);
      } else {
        const { data, error } = await supabase.auth.signUp({ email: e, password });
        if (error) throw error;
        if (data.session) {
          onSignedIn?.(data.session);
        } else {
          Alert.alert('Registrazione completata', 'Controlla la tua email per confermare l’account, poi torna nell’app e accedi.');
          setMode('login');
        }
      }
    } catch (e2) {
      Alert.alert(mode === 'login' ? 'Accesso non riuscito' : 'Registrazione non riuscita', e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.authBg}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <ScrollView contentContainerStyle={styles.authWrap} keyboardShouldPersistTaps="handled">
        <View style={styles.logoMark}><Text style={styles.logoMarkText}>OVC</Text></View>
        <Text style={styles.authBrand}>OTTICA VISUAL CARE</Text>
        <Text style={styles.authTitle}>{mode === 'login' ? 'Accedi' : 'Crea il tuo account'}</Text>
        <Text style={styles.authSub}>Appuntamenti, shop, prescrizioni, LAC, ordini e chat in un’unica app.</Text>

        <View style={styles.authCard}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} placeholder="nome@email.it" />
          <Text style={styles.inputLabel}>Password</Text>
          <TextInput secureTextEntry value={password} onChangeText={setPassword} style={styles.input} placeholder="Minimo 6 caratteri" />
          <Button title={busy ? 'Attendi…' : mode === 'login' ? 'Accedi' : 'Registrati'} onPress={submit} disabled={busy} />
          <Pressable onPress={() => setMode(mode === 'login' ? 'register' : 'login')} style={{ padding: 12 }}>
            <Text style={styles.linkText}>{mode === 'login' ? 'Non hai ancora un account? Registrati' : 'Hai già un account? Accedi'}</Text>
          </Pressable>
        </View>
        <Text style={styles.privacyNote}>L’accesso ai dati sanitari è consentito solo all’email associata alla tua anagrafica o a un operatore autorizzato.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function CustomerApp({ me, onLogout }) {
  const [tab, setTab] = useState('home');
  const [home, setHome] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reorderBusy, setReorderBusy] = useState('');

  async function load(silent = false) {
    try {
      if (!silent) setLoading(true);
      const x = await api('customer_home');
      setHome(x.data || null);
    } catch (e) {
      Alert.alert('Dati cliente', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function reorder(lensId, quantity) {
    try {
      setReorderBusy(lensId);
      const x = await api('reorder', { lens_id: lensId, quantity });
      Alert.alert('Riordino inviato', `Richiesta registrata${x?.data?.total ? ` · ${money(x.data.total, x.data.currency || 'EUR')}` : ''}.`);
      await load(true);
    } catch (e) {
      Alert.alert('Riordino', e.message);
    } finally {
      setReorderBusy('');
    }
  }

  const customer = home?.customer || me.customer || {};
  const items = [
    { key: 'home', label: 'Home', icon: '⌂' },
    { key: 'booking', label: 'Prenota', icon: '◫' },
    { key: 'shop', label: 'Shop', icon: '▣' },
    { key: 'reorder', label: 'Riordina', icon: '↻' },
    { key: 'chat', label: 'Chat', icon: '◌', badge: home?.unread_chat || 0 },
    { key: 'profile', label: 'Profilo', icon: '●' },
  ];

  if (loading && !home) return <Loading label="Carico la tua scheda…" />;

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={{ flex: 1 }}>
        {tab === 'home' && (
          <ScrollView
            style={styles.screen}
            contentContainerStyle={styles.screenContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
          >
            <AppHeader title={`Ciao ${customer.name || ''}`.trim()} subtitle="La tua area Ottica Visual Care" />
            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>La tua vista, sempre con te.</Text>
              <Text style={styles.heroText}>Consulta la prescrizione, riordina le tue LAC e scrivici direttamente dall’app.</Text>
            </View>
            <Section title="Prescrizione">
              <PrescriptionCard prescription={home?.prescription} compact />
            </Section>
            <Section title="Ultimi ordini">
              {home?.orders?.length ? home.orders.slice(0, 5).map((o) => <OrderCard key={o.id} order={o} />) : <Empty title="Nessun ordine online" />}
            </Section>
          </ScrollView>
        )}

        {tab === 'booking' && (
          <View style={{ flex: 1 }}>
            <View style={styles.webHeader}><Text style={styles.webHeaderTitle}>Prenota un appuntamento</Text></View>
            <WebView source={{ uri: BOOKING_URL }} startInLoadingState renderLoading={() => <Loading label="Carico gli appuntamenti…" />} />
          </View>
        )}

        {tab === 'shop' && (
          <View style={{ flex: 1 }}>
            <View style={styles.webHeader}><Text style={styles.webHeaderTitle}>Shop Ottica Visual Care</Text></View>
            <WebView source={{ uri: home?.shop_url || SHOP_URL }} startInLoadingState renderLoading={() => <Loading />} />
          </View>
        )}

        {tab === 'reorder' && (
          <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
            <AppHeader title="LAC da riordinare" subtitle="Le lenti associate alla tua scheda" />
            {home?.lenses?.length ? home.lenses.map((l) => <LensCard key={l.id} lens={l} busy={reorderBusy === l.id} onReorder={reorder} />) : <Empty title="Nessuna LAC riordinabile" text="Quando il centro associa una lente alla tua scheda comparirà qui." />}
            {!!home?.reorder_requests?.length && (
              <Section title="Richieste recenti">
                {home.reorder_requests.slice(0, 10).map((r) => (
                  <View key={r.id} style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>{dateIt(r.requested_at)} · q.tà {r.quantity}</Text>
                    <Text style={styles.fieldValue}>{r.status} · {money(r.total, r.currency || 'EUR')}</Text>
                  </View>
                ))}
              </Section>
            )}
          </ScrollView>
        )}

        {tab === 'chat' && <ChatView role="customer" />}

        {tab === 'profile' && (
          <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
            <AppHeader title="Il mio profilo" subtitle={me.email} />
            <Section title="Anagrafica">
              <Field label="Nome" value={`${customer.name || ''} ${customer.surname || ''}`.trim()} />
              <Field label="Data di nascita" value={customer.birth} />
              <Field label="Email" value={customer.email} />
              <Field label="Cellulare" value={customer.phone} />
              <Field label="Telefono" value={customer.home_phone} />
              <Field label="Codice fiscale" value={customer.fiscal} />
              <Field label="Indirizzo" value={`${customer.street || ''} ${customer.street_number || ''}`.trim()} />
              <Field label="Località" value={`${customer.postal_code || ''} ${customer.city || ''} ${customer.province || ''}`.trim()} />
            </Section>
            <Button title="Esci dall’account" variant="secondary" onPress={onLogout} />
          </ScrollView>
        )}
      </View>
      <TabBar items={items} active={tab} onChange={setTab} />
    </SafeAreaView>
  );
}

function SheetCard({ sheet }) {
  const elements = sheet?.data?.elements && typeof sheet.data.elements === 'object' ? sheet.data.elements : {};
  const values = Object.entries(elements)
    .map(([key, item]) => {
      const value = typeof item === 'object' && item !== null ? item.value : item;
      const label = typeof item === 'object' && item !== null ? (item.label || item.title || key) : key;
      return { key, label, value };
    })
    .filter((x) => x.value !== null && x.value !== undefined && String(x.value).trim() !== '' && String(x.value) !== '[object Object]');
  return (
    <View style={styles.sheetCard}>
      <Text style={styles.listTitle}>{sheet.title || sheet.sheet_type || 'Scheda'}</Text>
      <Text style={styles.smallMeta}>{dateIt(sheet.created_at)} · {sheet.operator || '—'}</Text>
      {values.length ? values.map((x) => <Field key={x.key} label={x.label} value={x.value} />) : <Text style={styles.muted}>Nessun campo testuale disponibile.</Text>}
    </View>
  );
}

function StaffClientDetail({ clientId, onBack }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('profile');
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setLoading(true);
      const x = await api('client_detail', { client_id: clientId });
      setData(x.data || null);
    } catch (e) {
      Alert.alert('Cliente', e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [clientId]);
  if (loading || !data) return <Loading label="Carico la scheda cliente…" />;
  const c = data.customer || {};
  const tabs = [
    ['profile', 'Anagrafica'], ['rx', 'Prescrizioni'], ['lac', 'LAC'], ['orders', 'Ordini'], ['chat', 'Chat'],
  ];
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.subHeader}>
        <Pressable onPress={onBack}><Text style={styles.back}>‹ Clienti</Text></Pressable>
        <View style={{ flex: 1 }}><Text style={styles.subHeaderTitle}>{`${c.name || ''} ${c.surname || ''}`.trim()}</Text></View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.segmentScroll} contentContainerStyle={styles.segmentRow}>
        {tabs.map(([k, label]) => <Pressable key={k} onPress={() => setTab(k)} style={[styles.segment, tab === k && styles.segmentActive]}><Text style={[styles.segmentText, tab === k && styles.segmentTextActive]}>{label}</Text></Pressable>)}
      </ScrollView>
      {tab === 'chat' ? <ChatView role="staff" clientId={clientId} initialMessages={data.chat || []} /> : (
        <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
          {tab === 'profile' && (
            <Section title="Anagrafica completa">
              <Field label="Nome e cognome" value={`${c.name || ''} ${c.surname || ''}`.trim()} />
              <Field label="Data di nascita" value={c.birth} />
              <Field label="Cellulare" value={c.phone} />
              <Field label="Telefono" value={c.home_phone} />
              <Field label="Email" value={c.email} />
              <Field label="PEC" value={c.pec} />
              <Field label="Codice fiscale" value={c.fiscal} />
              <Field label="Partita IVA" value={c.vat} />
              <Field label="Indirizzo" value={`${c.street || ''} ${c.street_number || ''}`.trim()} />
              <Field label="CAP / Città / Provincia" value={`${c.postal_code || ''} ${c.city || ''} ${c.province || ''}`.trim()} />
              <Field label="Professione" value={c.profession} />
              <Field label="Hobby" value={c.hobby} />
              <Field label="Provenienza" value={c.referral} />
              <Field label="Note" value={c.notes} />
            </Section>
          )}
          {tab === 'rx' && (
            <>
              <Section title="Prescrizione attuale"><PrescriptionCard prescription={data.prescription} compact /></Section>
              <Section title="Storico prescrizioni">
                {data.prescriptions?.length ? data.prescriptions.map((s) => <SheetCard key={s.id} sheet={s} />) : <Empty title="Nessuna prescrizione salvata" />}
              </Section>
            </>
          )}
          {tab === 'lac' && (
            <>
              <Section title="Lenti associate">
                {data.lenses?.length ? data.lenses.map((l) => (
                  <View key={l.id} style={styles.listCard}>
                    <Text style={styles.listTitle}>{l.brand || 'LAC'} · {l.product_name || l.product_code || ''}</Text>
                    <Text style={styles.smallMeta}>{l.eye || ''} · {money(l.unit_price, l.currency || 'EUR')} · {l.active ? 'Attiva' : 'Non attiva'}</Text>
                  </View>
                )) : <Empty title="Nessuna lente associata" />}
              </Section>
              <Section title="Schede LAC">
                {data.lac_sheets?.length ? data.lac_sheets.map((s) => <SheetCard key={s.id} sheet={s} />) : <Empty title="Nessuna scheda LAC" />}
              </Section>
            </>
          )}
          {tab === 'orders' && (
            <Section title="Ordini cliente">
              {data.orders?.length ? data.orders.map((o) => <OrderCard key={o.id} order={o} />) : <Empty title="Nessun ordine" />}
            </Section>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function StaffClients() {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('');

  async function load() {
    try {
      setLoading(true);
      const x = await api('clients');
      setRows(Array.isArray(x.data) ? x.data : []);
    } catch (e) {
      Alert.alert('Clienti', e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((c) => `${c.name || ''} ${c.surname || ''} ${c.email || ''} ${c.phone || ''} ${c.city || ''}`.toLowerCase().includes(t));
  }, [rows, search]);
  if (selected) return <StaffClientDetail clientId={selected} onBack={() => setSelected('')} />;
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchWrap}>
        <TextInput value={search} onChangeText={setSearch} style={[styles.input, { flex: 1 }]} placeholder="Cerca cliente, email, telefono…" />
      </View>
      {loading ? <Loading /> : (
        <FlatList
          data={filtered}
          keyExtractor={(x) => x.id}
          contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
          ListEmptyComponent={<Empty title="Nessun cliente trovato" />}
          renderItem={({ item }) => (
            <Pressable onPress={() => setSelected(item.id)} style={styles.clientRow}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{String(item.name || item.surname || '?').slice(0, 1).toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.listTitle}>{`${item.name || ''} ${item.surname || ''}`.trim()}</Text>
                <Text style={styles.smallMeta}>{item.email || item.phone || 'Nessun contatto'}{item.city ? ` · ${item.city}` : ''}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function StaffThreads() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState('');
  async function load() {
    try {
      setLoading(true);
      const x = await api('threads');
      setThreads(Array.isArray(x.data) ? x.data : []);
    } catch (e) {
      Alert.alert('Chat', e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);
  if (selected) return <ChatView role="staff" clientId={selected} onBack={() => { setSelected(''); load(); }} />;
  if (loading) return <Loading />;
  return (
    <FlatList
      data={threads}
      keyExtractor={(x) => x.client_id}
      contentContainerStyle={{ padding: 14 }}
      ListEmptyComponent={<Empty title="Nessuna conversazione" />}
      renderItem={({ item }) => (
        <Pressable onPress={() => setSelected(item.client_id)} style={styles.clientRow}>
          <View style={[styles.avatar, { backgroundColor: '#e8f5ee' }]}><Text style={[styles.avatarText, { color: C.green }]}>C</Text></View>
          <View style={{ flex: 1 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.listTitle}>{item.client_name || 'Cliente'}</Text>
              {!!item.unread_count && <View style={styles.badge}><Text style={styles.badgeText}>{item.unread_count}</Text></View>}
            </View>
            <Text style={styles.smallMeta} numberOfLines={1}>{item.last_message || 'Conversazione'}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      )}
    />
  );
}

function StaffApp({ me, onLogout }) {
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const operator = me.operator || {};

  async function loadStats() {
    try {
      setLoading(true);
      const x = await api('staff_home');
      setStats(x.data?.stats || null);
    } catch (e) {
      Alert.alert('Dashboard', e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadStats(); }, []);

  const items = [
    { key: 'dashboard', label: 'Dashboard', icon: '▦' },
    { key: 'clients', label: 'Clienti', icon: '◎' },
    { key: 'chat', label: 'Chat', icon: '◌', badge: stats?.unread_chats || 0 },
    { key: 'profile', label: 'Profilo', icon: '●' },
  ];

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={{ flex: 1 }}>
        {tab === 'dashboard' && (
          loading ? <Loading /> : (
            <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent} refreshControl={<RefreshControl refreshing={loading} onRefresh={loadStats} />}>
              <AppHeader title="Dashboard" subtitle={`Operatore: ${operator.username || me.email}`} />
              <View style={styles.metricGrid}>
                <Metric label="Clienti" value={stats?.clients || 0} />
                <Metric label="Ordini" value={stats?.orders || 0} hint={`${stats?.new_orders || 0} nuovi`} />
                <Metric label="Vendite" value={money(stats?.revenue || 0, stats?.currency || 'EUR')} />
                <Metric label="Riordini" value={stats?.pending_reorders || 0} hint="da gestire" />
                <Metric label="LAC attive" value={stats?.active_lenses || 0} />
                <Metric label="Chat non lette" value={stats?.unread_chats || 0} />
              </View>
              <Section title="Area operatore">
                <Text style={styles.bodyText}>Con questa email hai accesso alle statistiche, alle anagrafiche, alle prescrizioni e alle schede LAC dei clienti associati a Optyker.</Text>
              </Section>
            </ScrollView>
          )
        )}
        {tab === 'clients' && <StaffClients />}
        {tab === 'chat' && <StaffThreads />}
        {tab === 'profile' && (
          <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
            <AppHeader title={operator.username || 'Operatore'} subtitle={me.email} />
            <Section title="Accesso operatore">
              <Field label="Username Optyker" value={operator.username} />
              <Field label="Email" value={me.email} />
              <Field label="Ruolo" value="Staff / operatore" />
            </Section>
            <Button title="Esci dall’account" variant="secondary" onPress={onLogout} />
          </ScrollView>
        )}
      </View>
      <TabBar items={items} active={tab} onChange={(k) => { setTab(k); if (k === 'dashboard') loadStats(); }} />
    </SafeAreaView>
  );
}

function Unlinked({ email, onLogout }) {
  return (
    <SafeAreaView style={styles.app}>
      <View style={styles.centerPage}>
        <View style={styles.logoMark}><Text style={styles.logoMarkText}>OVC</Text></View>
        <Text style={styles.authTitle}>Email non collegata</Text>
        <Text style={styles.authSub}>{email}</Text>
        <Text style={styles.bodyText}>Per proteggere prescrizioni e dati cliente, questa email deve essere presente nell’anagrafica cliente oppure nel profilo di un operatore Optyker.</Text>
        <Button title="Esci" variant="secondary" onPress={onLogout} />
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [me, setMe] = useState(null);
  const [booting, setBooting] = useState(true);

  async function loadMe() {
    try {
      const x = await api('me');
      setMe(x.data || null);
    } catch (e) {
      if (/sessione|auth/i.test(e.message)) await supabase.auth.signOut();
      else Alert.alert('Accesso', e.message);
    } finally {
      setBooting(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
      if (data.session) loadMe();
      else setBooting(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next || null);
      setMe(null);
      if (next) {
        setBooting(true);
        setTimeout(loadMe, 0);
      } else {
        setBooting(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setMe(null);
  }

  if (booting) return <SafeAreaView style={styles.app}><Loading label="Apro OTTICA VISUAL CARE…" /></SafeAreaView>;
  if (!session) return <AuthScreen onSignedIn={() => { setBooting(true); loadMe(); }} />;
  if (!me) return <SafeAreaView style={styles.app}><Loading /></SafeAreaView>;
  if (me.role === 'staff') return <StaffApp me={me} onLogout={logout} />;
  if (me.role === 'customer') return <CustomerApp me={me} onLogout={logout} />;
  return <Unlinked email={me.email} onLogout={logout} />;
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.bg },
  screen: { flex: 1, backgroundColor: C.bg },
  screenContent: { padding: 15, paddingBottom: 34, gap: 12 },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: C.bg },
  centerPage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28 },
  muted: { color: C.muted, fontSize: 13 },
  bodyText: { color: C.text, fontSize: 14, lineHeight: 21 },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: 4, paddingBottom: 4 },
  brandEyebrow: { fontSize: 10, letterSpacing: 1.5, fontWeight: '900', color: C.blue },
  headerTitle: { fontSize: 27, fontWeight: '900', color: C.navy, marginTop: 3 },
  headerSub: { fontSize: 12, color: C.muted, marginTop: 4 },
  heroCard: { backgroundColor: C.navy, borderRadius: 20, padding: 20, gap: 7 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  heroText: { color: '#dfeaf3', fontSize: 13, lineHeight: 19 },
  card: { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 15 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: C.navy, fontSize: 17, fontWeight: '900' },
  button: { minHeight: 46, borderRadius: 12, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 11 },
  buttonCompact: { minHeight: 40, paddingHorizontal: 14, paddingVertical: 8 },
  buttonSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#b9ccda' },
  buttonDanger: { backgroundColor: C.danger },
  buttonText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  buttonSecondaryText: { color: C.navy },
  input: { minHeight: 47, borderWidth: 1, borderColor: '#cbd9e4', borderRadius: 11, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 10, color: C.text, fontSize: 14 },
  inputLabel: { color: C.navy, fontSize: 12, fontWeight: '800', marginBottom: 6, marginTop: 10 },
  authBg: { flex: 1, backgroundColor: C.bg },
  authWrap: { flexGrow: 1, justifyContent: 'center', padding: 24, maxWidth: 520, width: '100%', alignSelf: 'center' },
  logoMark: { width: 72, height: 72, borderRadius: 20, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 },
  logoMarkText: { color: '#fff', fontWeight: '900', fontSize: 22, letterSpacing: 1 },
  authBrand: { textAlign: 'center', color: C.blue, letterSpacing: 1.5, fontSize: 11, fontWeight: '900' },
  authTitle: { textAlign: 'center', color: C.navy, fontSize: 28, fontWeight: '900', marginTop: 8 },
  authSub: { textAlign: 'center', color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 18 },
  authCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 17, gap: 6 },
  linkText: { color: C.blue, textAlign: 'center', fontSize: 12, fontWeight: '800' },
  privacyNote: { textAlign: 'center', color: C.muted, fontSize: 10, lineHeight: 15, padding: 15 },
  tabBar: { minHeight: 66, flexDirection: 'row', borderTopWidth: 1, borderColor: C.line, backgroundColor: '#fff', paddingBottom: Platform.OS === 'ios' ? 8 : 4, paddingTop: 5 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, position: 'relative' },
  tabIcon: { fontSize: 20, color: '#8194a3', fontWeight: '900' },
  tabIconActive: { color: C.blue },
  tabLabel: { fontSize: 9, color: '#7a8d9a', fontWeight: '700' },
  tabLabelActive: { color: C.blue, fontWeight: '900' },
  badge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  empty: { borderWidth: 1, borderColor: '#e2e9ee', borderRadius: 13, backgroundColor: '#fbfcfd', padding: 18, alignItems: 'center', gap: 4 },
  emptyTitle: { color: C.text, fontWeight: '900', fontSize: 13 },
  emptyText: { color: C.muted, textAlign: 'center', fontSize: 11, lineHeight: 16 },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 15, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8eef2' },
  fieldLabel: { color: C.muted, fontSize: 11, fontWeight: '700', flex: 0.45 },
  fieldValue: { color: C.text, fontSize: 12, fontWeight: '700', textAlign: 'right', flex: 0.55 },
  listCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 13, marginBottom: 9 },
  listTitle: { color: C.text, fontWeight: '900', fontSize: 14 },
  smallMeta: { color: C.muted, fontSize: 10, marginTop: 4 },
  price: { color: C.blue, fontSize: 14, fontWeight: '900' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center' },
  inlineActions: { flexDirection: 'row', gap: 9, marginTop: 12, alignItems: 'center' },
  qtyInput: { width: 64, textAlign: 'center' },
  rxSet: { borderWidth: 1, borderColor: '#e0e9f0', borderRadius: 14, overflow: 'hidden', marginTop: 10 },
  rxSetTitle: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: C.soft, color: C.navy, fontSize: 11, fontWeight: '900' },
  rxColumns: { flexDirection: 'row', gap: 8, padding: 8 },
  rxEye: { flex: 1, borderWidth: 1, borderColor: '#e5ecf1', borderRadius: 11, padding: 10, backgroundColor: '#fff' },
  rxEyeTitle: { color: C.blue, fontWeight: '900', fontSize: 14, marginBottom: 4 },
  rxGrid: { gap: 1 },
  gonioWrap: { marginTop: 4, height: 105 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '48%', minHeight: 105, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 14, justifyContent: 'center' },
  metricLabel: { color: C.muted, fontSize: 10, fontWeight: '800' },
  metricValue: { color: C.navy, fontSize: 22, fontWeight: '900', marginTop: 4 },
  metricHint: { color: C.green, fontSize: 9, fontWeight: '800', marginTop: 4 },
  webHeader: { backgroundColor: '#fff', borderBottomWidth: 1, borderColor: C.line, paddingHorizontal: 15, paddingVertical: 12 },
  webHeaderTitle: { color: C.navy, fontSize: 16, fontWeight: '900' },
  chatScroll: { flex: 1, backgroundColor: '#eef3f6' },
  chatContent: { padding: 14, gap: 8, paddingBottom: 20 },
  bubble: { maxWidth: '82%', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1 },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: C.blue, borderColor: C.blue },
  bubbleOther: { alignSelf: 'flex-start', backgroundColor: '#fff', borderColor: '#d8e2e9' },
  bubbleSender: { color: C.muted, fontSize: 9, fontWeight: '900', marginBottom: 3 },
  bubbleText: { color: C.text, fontSize: 14, lineHeight: 19 },
  bubbleTime: { color: C.muted, fontSize: 8, textAlign: 'right', marginTop: 5 },
  composer: { flexDirection: 'row', gap: 8, padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderColor: C.line, alignItems: 'flex-end' },
  composerInput: { flex: 1, minHeight: 42, maxHeight: 110 },
  subHeader: { minHeight: 54, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: C.line, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { color: C.blue, fontWeight: '900', fontSize: 13 },
  subHeaderTitle: { color: C.navy, fontWeight: '900', fontSize: 15 },
  searchWrap: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: C.line, flexDirection: 'row' },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 12, marginBottom: 9 },
  avatar: { width: 42, height: 42, borderRadius: 12, backgroundColor: C.soft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.blue, fontSize: 17, fontWeight: '900' },
  chevron: { color: '#8ea0ad', fontSize: 28, fontWeight: '300' },
  segmentScroll: { flexGrow: 0, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: C.line },
  segmentRow: { paddingHorizontal: 10, paddingVertical: 8, gap: 7 },
  segment: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f1f5f8' },
  segmentActive: { backgroundColor: C.blue },
  segmentText: { color: C.muted, fontSize: 11, fontWeight: '900' },
  segmentTextActive: { color: '#fff' },
  sheetCard: { borderWidth: 1, borderColor: '#e0e8ee', borderRadius: 13, padding: 12, marginBottom: 10, backgroundColor: '#fbfcfd' },
});
