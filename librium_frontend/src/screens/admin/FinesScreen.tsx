import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Alert } from 'react-native';
import { getFines, payFine } from '../../services/api';
import { Card, Btn, Badge, Empty, Loading, SectionHeader, C } from '../../components/UI';

type Fine = {
  id: number;
  amount: string;
  member_name?: string;
  member: number;
  loan: number;
  reason?: string;
  paid: boolean;
  paid_at?: string;
};

export default function FinesScreen() {
  const [fines, setFines]           = useState<Fine[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await getFines();
      setFines(data.results ?? data);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const handlePay = (id: number, amount: string) => {
    Alert.alert('Mark as Paid', `Mark ₱${amount} fine as paid?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Paid', onPress: async () => {
        try { await payFine(id); load(); }
        catch (e: any) { Alert.alert('Error', JSON.stringify(e.data)); }
      }},
    ]);
  };

  const unpaid = fines.filter(f => !f.paid);
  const paid   = fines.filter(f => f.paid);

  if (loading) return <Loading />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={s.inner}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />}
    >
      <SectionHeader title={`Fines (${fines.length})`} />

      {unpaid.length > 0 && <Text style={s.groupLabel}>UNPAID</Text>}
      {unpaid.map((f) => (
        <Card key={f.id}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.amount}>₱{parseFloat(f.amount).toFixed(2)}</Text>
              <Text style={s.meta}>Member: {f.member_name || f.member}</Text>
              <Text style={s.meta}>Loan: #{f.loan}</Text>
              {f.reason && <Text style={s.meta}>Reason: {f.reason}</Text>}
            </View>
            <Badge label="UNPAID" color={C.danger} />
          </View>
          <Btn label="Mark as Paid" variant="success" onPress={() => handlePay(f.id, f.amount)} style={{ marginTop: 8, paddingVertical: 7 }} />
        </Card>
      ))}

      {paid.length > 0 && <Text style={s.groupLabel}>PAID</Text>}
      {paid.map((f) => (
        <Card key={f.id} style={{ opacity: 0.6 }}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={s.amount}>₱{parseFloat(f.amount).toFixed(2)}</Text>
              <Text style={s.meta}>Member: {f.member_name || f.member}</Text>
              <Text style={s.meta}>Paid: {f.paid_at ? new Date(f.paid_at).toLocaleDateString() : '—'}</Text>
            </View>
            <Badge label="PAID" color={C.success} />
          </View>
        </Card>
      ))}

      {fines.length === 0 && <Empty text="No fines on record." />}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  inner:      { padding: 16, paddingBottom: 40 },
  groupLabel: { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  row:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  amount:     { color: C.danger, fontWeight: '800', fontSize: 18 },
  meta:       { color: C.sub, fontSize: 12, marginTop: 2 },
});