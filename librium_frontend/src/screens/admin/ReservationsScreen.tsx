import React, { useEffect, useState } from 'react';
import { Text, ScrollView, StyleSheet, RefreshControl, View } from 'react-native';
import { getReservations } from '../../services/api';
import { Card, Badge, Empty, Loading, SectionHeader, C } from '../../components/UI';

const STATUS_COLOR: Record<string, string> = {
  pending:   C.warning,
  fulfilled: C.success,
  cancelled: C.muted,
  expired:   C.danger,
};

type Reservation = {
  id: number;
  book_title?: string;
  member_name?: string;
  member: number;
  reservation_date: string;
  expiry_date?: string;
  status: string;
};

export default function ReservationsScreen() {
  const [items, setItems]           = useState<Reservation[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await getReservations();
      setItems(data.results ?? data);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <Loading />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={s.inner}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />}
    >
      <SectionHeader title={`Reservations (${items.length})`} />
      {items.length === 0 && <Empty text="No reservations." />}
      {items.map((r) => (
        <Card key={r.id}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{r.book_title}</Text>
              <Text style={s.meta}>Member: {r.member_name || r.member}</Text>
              <Text style={s.meta}>Reserved: {new Date(r.reservation_date).toLocaleDateString()}</Text>
              {r.expiry_date && <Text style={s.meta}>Expires: {new Date(r.expiry_date).toLocaleDateString()}</Text>}
            </View>
            <Badge label={r.status} color={STATUS_COLOR[r.status] ?? C.muted} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  inner: { padding: 16, paddingBottom: 40 },
  row:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { color: C.text, fontWeight: '700', fontSize: 14 },
  meta:  { color: C.sub, fontSize: 12, marginTop: 2 },
});