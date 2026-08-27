from pathlib import Path

p=Path('mobile-app/App.js')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_MOBILE_STAFF_DASHBOARD_V5'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_MOBILE_APPOINTMENTS_V3' not in s:
    raise SystemExit('Mobile appointments V3 non applicata')

start=s.find('function StaffApp({ me, onLogout }) {')
end=s.find('function Unlinked({ email, onLogout }) {', start)
if start<0 or end<0:
    raise SystemExit('StaffApp non trovato')

block=r'''const OPTYKER_MOBILE_STAFF_DASHBOARD_V5 = true;

function mobileTime(v) {
  if (!v) return '';
  try {
    return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(new Date(v));
  } catch { return ''; }
}

function mobileDay(v) {
  if (!v) return '';
  try {
    return new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date(v));
  } catch { return ''; }
}

function orderCustomer(order) {
  let d = order?.data || {};
  if (typeof d === 'string') {
    try { d = JSON.parse(d); } catch { d = {}; }
  }
  const c = d?.customer || {};
  return order?.client_name
    || d?.customerName
    || [c?.firstName || c?.first_name, c?.lastName || c?.last_name].filter(Boolean).join(' ')
    || d?.email
    || 'Cliente online';
}

function orderState(order) {
  const fin = String(order?.financial_status || '').toUpperCase();
  const ful = String(order?.fulfillment_status || '').toUpperCase();
  if (fin === 'PAID' && ful === 'FULFILLED') return 'Pagato · evaso';
  if (fin === 'PAID') return 'Pagato · da evadere';
  if (fin) return fin;
  return 'Da verificare';
}

function StaffAgenda() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(silent = false) {
    try {
      if (!silent) setLoading(true);
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      const x = await appointmentsApi('list', { from: from.toISOString(), to: to.toISOString() });
      setRows((Array.isArray(x.data) ? x.data : []).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
    } catch (e) {
      Alert.alert('Agenda', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);
  if (loading && !rows.length) return <Loading label="Carico l’agenda…" />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
    >
      <AppHeader title="Agenda" subtitle="Appuntamenti dei prossimi 7 giorni" />
      <Section title="Prossimi appuntamenti">
        {rows.length ? rows.map((a) => (
          <View key={a.id} style={styles.listCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.listTitle}>{mobileDay(a.starts_at)} · {mobileTime(a.starts_at)}</Text>
              <Text style={styles.smallMeta}>{appointmentStatus(a.status)}</Text>
            </View>
            <Text style={[styles.listTitle, { marginTop: 7 }]}>{`${a.last_name || ''} ${a.first_name || ''}`.trim() || 'Cliente'}</Text>
            <Text style={styles.smallMeta}>{[a.service_name, a.operator_username, a.studio_name].filter(Boolean).join(' · ')}</Text>
            {!!a.phone && <Text style={styles.smallMeta}>{a.phone}</Text>}
          </View>
        )) : <Empty title="Nessun appuntamento" text="Non ci sono appuntamenti nei prossimi 7 giorni." />}
      </Section>
    </ScrollView>
  );
}

function StaffOrders() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(silent = false) {
    try {
      if (!silent) setLoading(true);
      const x = await api('staff_orders', { limit: 150 });
      setRows(Array.isArray(x.data) ? x.data : []);
    } catch (e) {
      Alert.alert('Ordini Shopify', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);
  if (loading && !rows.length) return <Loading label="Carico gli ordini Shopify…" />;

  const pending = rows.filter((o) => String(o.management_status || 'new') === 'new');
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.screenContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} />}
    >
      <AppHeader title="Ordini Shopify" subtitle={`${pending.length} da gestire · ${rows.length} visibili`} />
      <Section title="Da gestire">
        {pending.length ? pending.map((o) => (
          <View key={o.id} style={styles.listCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.listTitle}>{o.order_name || 'Ordine Shopify'}</Text>
              <Text style={styles.price}>{money(o.total, o.currency || 'EUR')}</Text>
            </View>
            <Text style={[styles.listTitle, { marginTop: 7, fontSize: 12 }]}>{orderCustomer(o)}</Text>
            <Text style={styles.smallMeta}>{orderState(o)} · {dateTimeIt(o.order_date)}</Text>
          </View>
        )) : <Empty title="Nessun ordine da gestire" />}
      </Section>
      {!!rows.filter((o) => String(o.management_status || '') !== 'new').length && (
        <Section title="Altri ordini">
          {rows.filter((o) => String(o.management_status || '') !== 'new').slice(0, 40).map((o) => (
            <View key={o.id} style={styles.listCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.listTitle}>{o.order_name || 'Ordine'}</Text>
                <Text style={styles.price}>{money(o.total, o.currency || 'EUR')}</Text>
              </View>
              <Text style={styles.smallMeta}>{orderCustomer(o)} · {dateTimeIt(o.order_date)}</Text>
            </View>
          ))}
        </Section>
      )}
    </ScrollView>
  );
}

function StaffApp({ me, onLogout }) {
  const [tab, setTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [shopifyOrders, setShopifyOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const operator = me.operator || {};

  async function loadDashboard(silent = false) {
    try {
      if (!silent) setLoading(true);
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      const [homeX, apptX, orderX] = await Promise.all([
        api('staff_home'),
        appointmentsApi('list', { from: from.toISOString(), to: to.toISOString() }),
        api('staff_orders', { limit: 100 }),
      ]);
      setStats(homeX.data?.stats || null);
      setTodayAppointments((Array.isArray(apptX.data) ? apptX.data : []).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)));
      setShopifyOrders(Array.isArray(orderX.data) ? orderX.data : []);
    } catch (e) {
      Alert.alert('Dashboard', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { loadDashboard(); }, []);

  const newOrders = shopifyOrders.filter((o) => String(o.management_status || 'new') === 'new');
  const items = [
    { key: 'dashboard', label: 'Dashboard', icon: '▦' },
    { key: 'agenda', label: 'Agenda', icon: '◫' },
    { key: 'orders', label: 'Ordini', icon: '▣', badge: newOrders.length || 0 },
    { key: 'clients', label: 'Clienti', icon: '◎' },
    { key: 'chat', label: 'Chat', icon: '◌', badge: stats?.unread_chats || 0 },
    { key: 'profile', label: 'Profilo', icon: '●' },
  ];

  return (
    <SafeAreaView style={styles.app}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={{ flex: 1 }}>
        {tab === 'dashboard' && (
          loading && !stats ? <Loading /> : (
            <ScrollView
              style={styles.screen}
              contentContainerStyle={styles.screenContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDashboard(true); }} />}
            >
              <AppHeader title="Dashboard" subtitle={`Operatore: ${operator.username || me.email}`} />
              <View style={styles.metricGrid}>
                <Metric label="Clienti" value={stats?.clients || 0} />
                <Metric label="Ordini" value={stats?.orders || 0} hint={`${stats?.new_orders || 0} nuovi`} />
                <Metric label="Vendite" value={money(stats?.revenue || 0, stats?.currency || 'EUR')} />
                <Metric label="Riordini" value={stats?.pending_reorders || 0} hint="da gestire" />
                <Metric label="LAC attive" value={stats?.active_lenses || 0} />
                <Metric label="Chat non lette" value={stats?.unread_chats || 0} />
              </View>

              <Section title="Appuntamenti di oggi" action={<Text style={styles.price}>{todayAppointments.length}</Text>}>
                {todayAppointments.length ? todayAppointments.slice(0, 6).map((a) => (
                  <Pressable key={a.id} onPress={() => setTab('agenda')} style={styles.listCard}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.price}>{mobileTime(a.starts_at)}</Text>
                      <Text style={styles.smallMeta}>{appointmentStatus(a.status)}</Text>
                    </View>
                    <Text style={[styles.listTitle, { marginTop: 5 }]}>{`${a.last_name || ''} ${a.first_name || ''}`.trim() || 'Cliente'}</Text>
                    <Text style={styles.smallMeta}>{[a.service_name, a.operator_username, a.studio_name].filter(Boolean).join(' · ')}</Text>
                  </Pressable>
                )) : <Empty title="Nessun appuntamento oggi" />}
                <Button title="Apri agenda" variant="secondary" onPress={() => setTab('agenda')} />
              </Section>

              <Section title="Ordini Shopify" action={<Text style={styles.price}>{newOrders.length}</Text>}>
                {newOrders.length ? newOrders.slice(0, 5).map((o) => (
                  <Pressable key={o.id} onPress={() => setTab('orders')} style={styles.listCard}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.listTitle}>{o.order_name || 'Ordine Shopify'}</Text>
                      <Text style={styles.price}>{money(o.total, o.currency || 'EUR')}</Text>
                    </View>
                    <Text style={[styles.smallMeta, { marginTop: 5 }]}>{orderCustomer(o)}</Text>
                    <Text style={styles.smallMeta}>{orderState(o)} · {dateTimeIt(o.order_date)}</Text>
                  </Pressable>
                )) : <Empty title="Nessun ordine Shopify da gestire" />}
                <Button title="Apri ordini" variant="secondary" onPress={() => setTab('orders')} />
              </Section>

              <Section title="Area operatore">
                <Text style={styles.bodyText}>Con questa email hai accesso alle statistiche, alle anagrafiche, alle prescrizioni e alle schede LAC dei clienti associati a Optyker.</Text>
              </Section>
            </ScrollView>
          )
        )}

        {tab === 'agenda' && <StaffAgenda />}
        {tab === 'orders' && <StaffOrders />}
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

      <TabBar
        items={items}
        active={tab}
        onChange={(k) => {
          setTab(k);
          if (k === 'dashboard') loadDashboard(true);
        }}
      />
    </SafeAreaView>
  );
}

'''

s=s[:start]+block+s[end:]
p.write_text(s,encoding='utf-8')
for req in [MARK,'function StaffAgenda','function StaffOrders',"key: 'agenda'","key: 'orders'","Apri agenda","Apri ordini","staff_orders"]:
    if req not in s:
        raise SystemExit('Dashboard mobile V5 incompleta: '+req)
print('Mobile staff dashboard V5 OK')
