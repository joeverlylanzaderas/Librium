// ─────────────────────────────────────────────────────────────
//  LibrarianFinesScreen.tsx
// ─────────────────────────────────────────────────────────────
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { getFines, payFine } from '../../services/api';
import { C, Badge, Empty, Loading } from '../../components/UI';

type Fine = {
  id:            number;
  member_name:   string;
  book_title:    string;
  amount:        string;
  paid:          boolean;
  paid_date:     string | null;
  issued_date:   string;
  issued_by_name: string | null;
};

export default function LibrarianFinesScreen() {
  const [fines, setFines]         = useState<Fine[]>([]);
  const [filter, setFilter]       = useState<'unpaid' | 'paid' | 'all'>('unpaid');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing]       = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getFines();
      setFines(data);
    } catch (e) { }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePay = (id: number, memberName: string, amount: string) => {
    Alert.alert(
      'Mark as Paid',
      `Mark ₱${amount} fine for ${memberName} as paid?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm', onPress: async () => {
            setActing(id);
            try {
              await payFine(id);
              load();
            } catch (e: any) {
              Alert.alert('Error', e?.data?.error ?? 'Could not mark as paid.');
            } finally { setActing(null); }
          },
        },
      ]
    );
  };

  const filtered = fines.filter((f) => {
    if (filter === 'unpaid') return !f.paid;
    if (filter === 'paid')   return f.paid;
    return true;
  });

  const totalUnpaid = fines
    .filter((f) => !f.paid)
    .reduce((sum, f) => sum + parseFloat(f.amount), 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Summary */}
      <View style={sf.summary}>
        <Text style={sf.summaryLabel}>Total Unpaid</Text>
        <Text style={sf.summaryValue}>₱{totalUnpaid.toFixed(2)}</Text>
      </View>

      {/* Filter tabs */}
      <View style={sf.filterRow}>
        {(['unpaid', 'paid', 'all'] as const).map((f) => (
          <TouchableOpacity key={f} style={[sf.filterTab, filter === f && sf.filterTabActive]} onPress={() => setFilter(f)}>
            <Text style={[sf.filterTxt, filter === f && sf.filterTxtActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <Loading /> : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />}
          ListEmptyComponent={<Empty text={`No ${filter} fines.`} />}
          renderItem={({ item }) => (
            <View style={sf.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={sf.member}>{item.member_name}</Text>
                  <Text style={sf.book} numberOfLines={1}>{item.book_title}</Text>
                  <Text style={sf.meta}>Issued: {item.issued_date}{item.issued_by_name ? `  ·  by ${item.issued_by_name}` : ''}</Text>
                  {item.paid && item.paid_date && (
                    <Text style={[sf.meta, { color: C.success }]}>Paid: {item.paid_date}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={[sf.amount, { color: item.paid ? C.success : C.danger }]}>
                    ₱{parseFloat(item.amount).toFixed(2)}
                  </Text>
                  <Badge label={item.paid ? 'Paid' : 'Unpaid'} color={item.paid ? C.success : C.danger} />
                </View>
              </View>
              {!item.paid && (
                <TouchableOpacity
                  style={sf.payBtn}
                  onPress={() => handlePay(item.id, item.member_name, item.amount)}
                  disabled={acting === item.id}
                >
                  {acting === item.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={sf.payTxt}>Mark as Paid</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const sf = StyleSheet.create({
  summary:        { backgroundColor: C.danger + '18', borderBottomWidth: 1, borderBottomColor: C.danger + '44', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel:   { color: C.sub, fontSize: 13 },
  summaryValue:   { color: C.danger, fontSize: 20, fontWeight: '800' },
  filterRow:      { flexDirection: 'row', backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  filterTab:      { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  filterTabActive:{ backgroundColor: C.primary, borderColor: C.primary },
  filterTxt:      { color: C.sub, fontSize: 12, fontWeight: '600' },
  filterTxtActive:{ color: '#fff' },
  card:           { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  member:         { color: C.text, fontSize: 14, fontWeight: '700' },
  book:           { color: C.sub, fontSize: 12, marginTop: 2 },
  meta:           { color: C.muted, fontSize: 11, marginTop: 3 },
  amount:         { fontSize: 16, fontWeight: '800' },
  payBtn:         { marginTop: 10, backgroundColor: C.success, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  payTxt:         { color: '#fff', fontWeight: '700', fontSize: 13 },
});
