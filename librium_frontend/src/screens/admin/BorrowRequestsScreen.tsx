import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Alert } from 'react-native';
import { getBorrowRequests, approveBorrowRequest, rejectBorrowRequest } from '../../services/api';
import { Card, Btn, Badge, Empty, Loading, SectionHeader, C } from '../../components/UI';

const STATUS_COLOR: Record<string, string> = {
  pending:   C.warning,
  approved:  C.success,
  rejected:  C.danger,
  cancelled: C.muted,
};

type BorrowRequest = {
  id: number;
  book_title?: string;
  member_name?: string;
  member: number;
  request_date: string;
  status: string;
  notes?: string;
};

const FILTERS = ['pending', 'approved', 'rejected', 'cancelled'] as const;
type Filter = typeof FILTERS[number];

export default function BorrowRequestsScreen() {
  const [requests, setRequests]     = useState<BorrowRequest[]>([]);
  const [filter, setFilter]         = useState<Filter>('pending');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await getBorrowRequests(filter);
      setRequests(data.results ?? data);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { setLoading(true); load(); }, [filter]);

  const approve = (id: number) => {
    Alert.alert('Approve Request', 'Confirm the book was handed to the member?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve', onPress: async () => {
        try { await approveBorrowRequest(id); load(); }
        catch (e: any) { Alert.alert('Error', JSON.stringify(e.data)); }
      }},
    ]);
  };

  const reject = (id: number) => {
    Alert.alert('Reject Request', 'Reject this borrow request?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
        try { await rejectBorrowRequest(id); load(); }
        catch (e: any) { Alert.alert('Error', JSON.stringify(e.data)); }
      }},
    ]);
  };

  return (
    <View style={s.root}>
      <View style={s.tabs}>
        {FILTERS.map((f) => (
          <Btn
            key={f}
            label={f.charAt(0).toUpperCase() + f.slice(1)}
            variant={filter === f ? 'primary' : 'ghost'}
            onPress={() => setFilter(f)}
            style={s.tab}
          />
        ))}
      </View>

      {loading ? <Loading /> : (
        <ScrollView
          contentContainerStyle={s.inner}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />}
        >
          <SectionHeader title={`${filter.charAt(0).toUpperCase() + filter.slice(1)} (${requests.length})`} />
          {requests.length === 0 && <Empty text={`No ${filter} requests.`} />}
          {requests.map((r) => (
            <Card key={r.id}>
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>{r.book_title}</Text>
                  <Text style={s.meta}>Member: {r.member_name || r.member}</Text>
                  <Text style={s.meta}>Requested: {new Date(r.request_date).toLocaleDateString()}</Text>
                  {r.notes && <Text style={s.meta}>Notes: {r.notes}</Text>}
                </View>
                <Badge label={r.status} color={STATUS_COLOR[r.status] ?? C.muted} />
              </View>
              {r.status === 'pending' && (
                <View style={s.actions}>
                  <Btn label="✓ Approve" variant="success" onPress={() => approve(r.id)} style={s.actionBtn} />
                  <Btn label="✗ Reject"  variant="danger"  onPress={() => reject(r.id)}  style={s.actionBtn} />
                </View>
              )}
            </Card>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  tabs:      { flexDirection: 'row', padding: 10, gap: 6, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  tab:       { flex: 1, paddingVertical: 7, paddingHorizontal: 4 },
  inner:     { padding: 16, paddingBottom: 40 },
  row:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title:     { color: C.text, fontWeight: '700', fontSize: 14 },
  meta:      { color: C.sub, fontSize: 12, marginTop: 2 },
  actions:   { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, paddingVertical: 7 },
});