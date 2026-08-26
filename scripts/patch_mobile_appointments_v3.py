from pathlib import Path

p=Path('mobile-app/App.js')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_MOBILE_APPOINTMENTS_V3'
if MARK in s:
    raise SystemExit(0)

old="const MOBILE_API = `${SUPABASE_URL}/functions/v1/optyker-mobile-api`;\n"
new=old+"const MOBILE_APPOINTMENTS = `${SUPABASE_URL}/functions/v1/optyker-mobile-appointments`;\nconst BOOKING_API = `${SUPABASE_URL}/functions/v1/optyker-appointments-booking`;\nconst OPTYKER_MOBILE_APPOINTMENTS_V3 = true;\n"
if old not in s: raise SystemExit('MOBILE_API anchor not found')
s=s.replace(old,new,1)

anchor="  return x;\n}\n\nfunction Button"
helper=r'''  return x;
}

async function appointmentsApi(action, payload = {}) {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error('Sessione scaduta');
  const r = await fetch(MOBILE_APPOINTMENTS, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ action, payload }),
  });
  const x = await r.json().catch(() => ({ ok: false, error: 'Risposta non valida' }));
  if (!r.ok || x?.ok === false) throw new Error(x?.error || 'Operazione appuntamenti non riuscita');
  return x;
}

function dateYmdRome(v) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(v));
    const o = {};
    parts.forEach((x) => { o[x.type] = x.value; });
    return `${o.year}-${o.month}-${o.day}`;
  } catch { return ''; }
}

function appointmentStatus(v) {
  if (v === 'cancelled') return 'Annullato';
  if (v === 'completed') return 'Completato';
  if (v === 'no_show') return 'Assente';
  return 'Confermato';
}

function Button'''
if anchor not in s: raise SystemExit('api helper anchor not found')
s=s.replace(anchor,helper,1)

# Customer appointment state
old="  const [reorderBusy, setReorderBusy] = useState('');\n"
new=old+"  const [appointments, setAppointments] = useState([]);\n  const [appointmentsLoading, setAppointmentsLoading] = useState(false);\n  const [bookingMode, setBookingMode] = useState('');\n"
if old not in s: raise SystemExit('customer state anchor not found')
s=s.replace(old,new,1)

old="  useEffect(() => { load(); }, []);\n"
new=r'''  async function loadAppointments(silent = false) {
    try {
      if (!silent) setAppointmentsLoading(true);
      const x = await appointmentsApi('history');
      setAppointments(Array.isArray(x.data) ? x.data : []);
    } catch (e) {
      if (!silent) Alert.alert('Appuntamenti', e.message);
    } finally {
      if (!silent) setAppointmentsLoading(false);
    }
  }

  useEffect(() => { load(); loadAppointments(); }, []);
'''
if old not in s: raise SystemExit('customer useEffect anchor not found')
s=s.replace(old,new,1)

old="  const customer = home?.customer || me.customer || {};\n"
new=r'''  const customer = home?.customer || me.customer || {};
  const futureAppointments = appointments
    .filter((a) => a.status !== 'cancelled' && new Date(a.ends_at || a.starts_at).getTime() > Date.now())
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  const appointmentHistory = appointments
    .filter((a) => !futureAppointments.some((f) => f.id === a.id))
    .sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
  const newBookingUrl = `${BOOKING_URL}&first_name=${encodeURIComponent(customer.name || '')}&last_name=${encodeURIComponent(customer.surname || '')}&email=${encodeURIComponent(customer.email || me.email || '')}&phone=${encodeURIComponent(customer.phone || '')}`;
  const moveBookingUrl = (a) => `${BOOKING_URL}&manage_token=${encodeURIComponent(a.manage_token || '')}&action=reschedule`;
'''
if old not in s: raise SystemExit('customer const anchor not found')
s=s.replace(old,new,1)
s=s.replace("    { key: 'booking', label: 'Prenota', icon: '◫' },","    { key: 'booking', label: 'Appuntamenti', icon: '◫' },",1)

start=s.find("        {tab === 'booking' && (")
end=s.find("\n\n        {tab === 'shop' && (",start)
if start<0 or end<0: raise SystemExit('booking block not found')
customer_block=r'''        {tab === 'booking' && (
          bookingMode ? (
            <View style={{ flex: 1 }}>
              <View style={styles.webHeader}>
                <Pressable onPress={() => { setBookingMode(''); loadAppointments(true); }}>
                  <Text style={styles.back}>‹ I miei appuntamenti</Text>
                </Pressable>
              </View>
              <WebView
                source={{ uri: bookingMode }}
                startInLoadingState
                renderLoading={() => <Loading label="Carico gli appuntamenti…" />}
                onMessage={(event) => {
                  try {
                    const message = JSON.parse(event?.nativeEvent?.data || '{}');
                    const url = String(message?.url || '');
                    const allowed = /^https:\/\/(calendar\.google\.com\/|whgziwaegjzqsgcntesr\.supabase\.co\/functions\/v1\/optyker-calendar-ics(?:\?|$))/i.test(url);
                    if (message?.type === 'openExternal' && allowed) Linking.openURL(url);
                    if (message?.type === 'appointmentChanged') {
                      loadAppointments(true);
                      setBookingMode('');
                    }
                  } catch (_) {}
                }}
              />
            </View>
          ) : (
            <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
              <AppHeader title="I miei appuntamenti" subtitle="Visualizza, sposta o aggiungi una nuova prenotazione" />
              {appointmentsLoading ? <Loading label="Carico gli appuntamenti…" /> : (
                <>
                  <Section title="Prossimi appuntamenti">
                    {futureAppointments.length ? futureAppointments.map((a) => (
                      <View key={a.id} style={styles.listCard}>
                        <View style={styles.rowBetween}>
                          <Text style={styles.listTitle}>{a.service_name || 'Appuntamento'}</Text>
                          <Text style={[styles.price, { fontSize: 11 }]}>{appointmentStatus(a.status)}</Text>
                        </View>
                        <Field label="Data e ora" value={dateTimeIt(a.starts_at)} />
                        <Field label="Fine" value={dateTimeIt(a.ends_at)} />
                        <Field label="Studio" value={a.studio_name} />
                        <Field label="Operatore" value={a.operator_username} />
                        <View style={styles.inlineActions}>
                          <View style={{ flex: 1 }}><Button compact title="Sposta" onPress={() => setBookingMode(moveBookingUrl(a))} /></View>
                          <View style={{ flex: 1 }}><Button compact variant="secondary" title="Aggiungi un altro" onPress={() => setBookingMode(newBookingUrl)} /></View>
                        </View>
                      </View>
                    )) : <Empty title="Nessun appuntamento futuro" text="Puoi prenotarne uno quando vuoi." />}
                    {!futureAppointments.length && <View style={{ marginTop: 10 }}><Button title="Prenota un appuntamento" onPress={() => setBookingMode(newBookingUrl)} /></View>}
                  </Section>
                  {!!appointmentHistory.length && (
                    <Section title="Storico appuntamenti">
                      {appointmentHistory.slice(0, 20).map((a) => (
                        <View key={a.id} style={styles.listCard}>
                          <View style={styles.rowBetween}>
                            <Text style={styles.listTitle}>{a.service_name || 'Appuntamento'}</Text>
                            <Text style={styles.smallMeta}>{appointmentStatus(a.status)}</Text>
                          </View>
                          <Text style={styles.smallMeta}>{dateTimeIt(a.starts_at)}{a.studio_name ? ` · ${a.studio_name}` : ''}</Text>
                        </View>
                      ))}
                    </Section>
                  )}
                  {!!futureAppointments.length && <Button variant="secondary" title="Aggiungi un altro appuntamento" onPress={() => setBookingMode(newBookingUrl)} />}
                </>
              )}
            </ScrollView>
          )
        )}'''
s=s[:start]+customer_block+s[end:]

# Insert native staff appointment editor before StaffClientDetail
anchor="function StaffClientDetail({ clientId, onBack }) {"
editor=r'''function StaffAppointmentEditor({ appointment, onBack, onSaved }) {
  const [boot, setBoot] = useState(null);
  const [serviceId, setServiceId] = useState(appointment.service_id || '');
  const [date, setDate] = useState(dateYmdRome(appointment.starts_at));
  const [operator, setOperator] = useState(appointment.operator_username || '');
  const [first, setFirst] = useState(appointment.first_name || '');
  const [last, setLast] = useState(appointment.last_name || '');
  const [email, setEmail] = useState(appointment.email || '');
  const [phone, setPhone] = useState(appointment.phone || '');
  const [notes, setNotes] = useState(appointment.notes || '');
  const [slots, setSlots] = useState([]);
  const [selectedTime, setSelectedTime] = useState(appointment.starts_at || '');
  const [selected, setSelected] = useState(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadBoot() {
    try {
      const x = await appointmentsApi('bootstrap');
      setBoot(x);
    } catch (e) { Alert.alert('Appuntamento', e.message); }
  }

  async function loadSlots() {
    if (!serviceId || !date || !operator) return;
    try {
      setLoadingSlots(true);
      const q = `?api=slots&service_id=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}&operator=${encodeURIComponent(operator)}&ignore_appointment_id=${encodeURIComponent(appointment.id)}`;
      const r = await fetch(BOOKING_API + q);
      const x = await r.json();
      if (!r.ok || x?.ok === false) throw new Error(x?.error || 'Disponibilità non disponibile');
      const arr = Array.isArray(x.data) ? x.data : [];
      setSlots(arr);
      const current = arr.find((s) => String(s.starts_at) === String(appointment.starts_at) && String(s.studio_id || '') === String(appointment.studio_id || ''));
      if (current) { setSelectedTime(current.starts_at); setSelected(current); }
      else { setSelectedTime(''); setSelected(null); }
    } catch (e) { Alert.alert('Disponibilità', e.message); }
    finally { setLoadingSlots(false); }
  }

  useEffect(() => { loadBoot(); }, []);
  useEffect(() => { if (boot) loadSlots(); }, [boot, serviceId, date, operator]);

  const timeGroups = useMemo(() => {
    const m = new Map();
    slots.forEach((s) => { const k = String(s.starts_at || ''); if (k) { if (!m.has(k)) m.set(k, []); m.get(k).push(s); } });
    return [...m.entries()].sort((a, b) => new Date(a[0]) - new Date(b[0]));
  }, [slots]);
  const studioRows = selectedTime ? slots.filter((s) => String(s.starts_at) === String(selectedTime)) : [];
  const studioOptions = useMemo(() => {
    const m = new Map();
    studioRows.forEach((s) => { const k = String(s.studio_id || 'none'); if (!m.has(k)) m.set(k, s); });
    return [...m.values()];
  }, [selectedTime, slots]);
  const selectedService = boot?.services?.find((s) => String(s.id) === String(serviceId));

  function chooseTime(t) {
    setSelectedTime(t);
    const rows = slots.filter((s) => String(s.starts_at) === String(t));
    if (selectedService?.requires_studio === false) setSelected(rows[0] || null);
    else setSelected(null);
  }

  async function save() {
    if (!first.trim() || !last.trim() || !email.trim() || !phone.trim()) { Alert.alert('Appuntamento', 'Nome, cognome, email e telefono sono obbligatori.'); return; }
    if (!selected) { Alert.alert('Appuntamento', 'Seleziona una fascia oraria e lo studio disponibile.'); return; }
    try {
      setSaving(true);
      await appointmentsApi('update', {
        id: appointment.id,
        service_id: serviceId,
        starts_at: selected.starts_at,
        studio_id: selected.studio_id || null,
        operator_username: selected.operator_username || operator,
        first_name: first.trim(), last_name: last.trim(), email: email.trim(), phone: phone.trim(), notes,
      });
      Alert.alert('Appuntamento', 'Modifiche salvate.');
      onSaved?.();
    } catch (e) { Alert.alert('Appuntamento', e.message); }
    finally { setSaving(false); }
  }

  if (!boot) return <Loading label="Carico l’appuntamento…" />;
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.subHeader}>
        <Pressable onPress={onBack}><Text style={styles.back}>‹ Visite</Text></Pressable>
        <Text style={styles.subHeaderTitle}>Modifica appuntamento</Text>
      </View>
      <ScrollView style={styles.screen} contentContainerStyle={styles.screenContent}>
        <Section title="Dati visita">
          <Field label="ID" value={appointment.id} />
          <Field label="Stato" value={appointmentStatus(appointment.status)} />
          <Field label="Creato il" value={dateTimeIt(appointment.created_at)} />
          <Field label="Origine" value={appointment.source} />
          <Text style={styles.inputLabel}>Servizio</Text>
          <View style={styles.inlineActions}>
            {(boot.services || []).map((s) => <Pressable key={s.id} onPress={() => setServiceId(s.id)} style={[styles.segment, serviceId === s.id && styles.segmentActive]}><Text style={[styles.segmentText, serviceId === s.id && styles.segmentTextActive]}>{s.name}</Text></Pressable>)}
          </View>
          <Text style={styles.inputLabel}>Data</Text><TextInput value={date} onChangeText={setDate} style={styles.input} placeholder="AAAA-MM-GG" />
          <Text style={styles.inputLabel}>Operatore</Text>
          <View style={styles.inlineActions}>{(boot.operators || []).map((o) => <Pressable key={o.username} onPress={() => setOperator(o.username)} style={[styles.segment, operator === o.username && styles.segmentActive]}><Text style={[styles.segmentText, operator === o.username && styles.segmentTextActive]}>{o.username}</Text></Pressable>)}</View>
          <Text style={styles.inputLabel}>Nome</Text><TextInput value={first} onChangeText={setFirst} style={styles.input} />
          <Text style={styles.inputLabel}>Cognome</Text><TextInput value={last} onChangeText={setLast} style={styles.input} />
          <Text style={styles.inputLabel}>Email</Text><TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" style={styles.input} />
          <Text style={styles.inputLabel}>Telefono</Text><TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={styles.input} />
          <Text style={styles.inputLabel}>Note</Text><TextInput value={notes} onChangeText={setNotes} multiline style={[styles.input, { minHeight: 80 }]} />
        </Section>
        <Section title="Fascia oraria">
          {loadingSlots ? <Loading label="Verifico disponibilità…" /> : timeGroups.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              {timeGroups.map(([t]) => <Pressable key={t} onPress={() => chooseTime(t)} style={[styles.segment, selectedTime === t && styles.segmentActive]}><Text style={[styles.segmentText, selectedTime === t && styles.segmentTextActive]}>{new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',hour:'2-digit',minute:'2-digit'}).format(new Date(t))}</Text></Pressable>)}
            </View>
          ) : <Empty title="Nessun orario disponibile" />}
          {selectedTime && selectedService?.requires_studio !== false && (
            <>
              <Text style={styles.inputLabel}>Studio disponibile</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                {studioOptions.map((s) => <Pressable key={`${s.studio_id}-${s.operator_username}`} onPress={() => setSelected(s)} style={[styles.segment, selected?.studio_id === s.studio_id && styles.segmentActive]}><Text style={[styles.segmentText, selected?.studio_id === s.studio_id && styles.segmentTextActive]}>{s.studio_name || 'Studio'}</Text></Pressable>)}
              </View>
            </>
          )}
        </Section>
        <Button title={saving ? 'Salvataggio…' : 'Salva modifiche'} onPress={save} disabled={saving || !selected} />
      </ScrollView>
    </View>
  );
}

function StaffClientDetail({ clientId, onBack }) {'''
if anchor not in s: raise SystemExit('StaffClientDetail anchor not found')
s=s.replace(anchor,editor,1)

# Staff client detail state + load appointments
old="  const [loading, setLoading] = useState(true);\n"
# target first occurrence after StaffClientDetail specifically
idx=s.find("function StaffClientDetail({ clientId, onBack }) {")
pos=s.find(old,idx)
if pos<0: raise SystemExit('staff loading state not found')
s=s[:pos]+old+"  const [editingAppointment, setEditingAppointment] = useState(null);\n"+s[pos+len(old):]

old="      const x = await api('client_detail', { client_id: clientId });\n      setData(x.data || null);"
new=r'''      const [x, ax] = await Promise.all([
        api('client_detail', { client_id: clientId }),
        appointmentsApi('list', { from: '2015-01-01T00:00:00Z', to: '2038-01-01T00:00:00Z' }),
      ]);
      const base = x.data || null;
      const all = Array.isArray(ax.data) ? ax.data : [];
      const email = String(base?.customer?.email || '').trim().toLowerCase();
      const visits = all.filter((a) => String(a.client_id || '') === String(clientId) || (email && String(a.email || '').trim().toLowerCase() === email));
      setData(base ? { ...base, appointments: visits.sort((a,b) => new Date(b.starts_at) - new Date(a.starts_at)) } : null);'''
# replace occurrence after StaffClientDetail
pos=s.find(old,idx)
if pos<0: raise SystemExit('staff load detail anchor not found')
s=s[:pos]+new+s[pos+len(old):]

# Insert cancel helper before useEffect within StaffClientDetail
anchor="  useEffect(() => { load(); }, [clientId]);\n"
insert=r'''  function cancelAppointment(a) {
    Alert.alert('Annulla appuntamento', `Annullare ${a.service_name || 'questo appuntamento'} del ${dateTimeIt(a.starts_at)}?`, [
      { text: 'No', style: 'cancel' },
      { text: 'Annulla appuntamento', style: 'destructive', onPress: async () => {
        try { await appointmentsApi('status', { id: a.id, status: 'cancelled' }); await load(); }
        catch (e) { Alert.alert('Appuntamento', e.message); }
      }},
    ]);
  }

  useEffect(() => { load(); }, [clientId]);
  if (editingAppointment) return <StaffAppointmentEditor appointment={editingAppointment} onBack={() => setEditingAppointment(null)} onSaved={() => { setEditingAppointment(null); load(); }} />;
'''
pos=s.find(anchor,idx)
if pos<0: raise SystemExit('staff useEffect anchor not found')
s=s[:pos]+insert+s[pos+len(anchor):]

# add visits tab
old="    ['profile', 'Anagrafica'], ['rx', 'Prescrizioni'], ['lac', 'LAC'], ['orders', 'Ordini'], ['chat', 'Chat'],\n"
new="    ['profile', 'Anagrafica'], ['rx', 'Prescrizioni'], ['lac', 'LAC'], ['visits', 'Visite'], ['orders', 'Ordini'], ['chat', 'Chat'],\n"
pos=s.find(old,idx)
if pos<0: raise SystemExit('staff tabs anchor not found')
s=s[:pos]+new+s[pos+len(old):]

# insert visits UI before orders block
anchor="          {tab === 'orders' && (\n"
visits=r'''          {tab === 'visits' && (
            <Section title="Visite e appuntamenti">
              {data.appointments?.length ? data.appointments.map((a) => (
                <View key={a.id} style={styles.listCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.listTitle}>{a.service_name || 'Appuntamento'}</Text>
                    <Text style={styles.smallMeta}>{appointmentStatus(a.status)}</Text>
                  </View>
                  <Field label="Data e ora" value={dateTimeIt(a.starts_at)} />
                  <Field label="Fine" value={dateTimeIt(a.ends_at)} />
                  <Field label="Studio" value={a.studio_name} />
                  <Field label="Operatore" value={a.operator_username} />
                  <Field label="Nome e cognome" value={`${a.first_name || ''} ${a.last_name || ''}`.trim()} />
                  <Field label="Email" value={a.email} />
                  <Field label="Telefono" value={a.phone} />
                  <Field label="Note" value={a.notes} />
                  <Field label="Origine" value={a.source} />
                  <Field label="Creato da" value={a.created_by} />
                  <Field label="Creato il" value={dateTimeIt(a.created_at)} />
                  <Field label="Ultima modifica" value={dateTimeIt(a.updated_at)} />
                  <View style={styles.inlineActions}>
                    <View style={{ flex: 1 }}><Button compact title="Modifica" onPress={() => setEditingAppointment(a)} disabled={a.status === 'cancelled'} /></View>
                    <View style={{ flex: 1 }}><Button compact variant="danger" title="Annulla" onPress={() => cancelAppointment(a)} disabled={a.status === 'cancelled'} /></View>
                  </View>
                </View>
              )) : <Empty title="Nessuna visita registrata" />}
            </Section>
          )}
'''
pos=s.find(anchor,idx)
if pos<0: raise SystemExit('orders block anchor not found')
s=s[:pos]+visits+s[pos:]

p.write_text(s,encoding='utf-8')
print('Mobile appointments V3 patch OK')
