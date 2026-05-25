// src/screens/borrower/BorrowerFinesScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { getFines, payFine } from '../../services/api';
import { C, Badge, Empty, Loading } from '../../components/UI';

type Fine = {
  id:          number;
  book_title:  string;
  amount:      string;
  paid:        boolean;
  paid_date:   string | null;
  issued_date: string;
};

export default function BorrowerFinesScreen() {
  const [fines, setFines]           = useState<Fine[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paying, setPaying]         = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getFines();
      setFines(data);
    } catch (e) { }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handlePay = (id: number, amount: string, title: string) => {
    Alert.alert(
      'Pay Fine',
      `Pay ₱${parseFloat(amount).toFixed(2)} fine for "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pay', onPress: async () => {
            setPaying(id);
            try {
              await payFine(id);
              Alert.alert('Paid', 'Your fine has been marked as paid.');
              load();
            } catch (e: any) {
              Alert.alert('Error', e?.data?.error ?? 'Could not process payment.');
            } finally { setPaying(null); }
          },
        },
      ]
    );
  };

  const unpaidTotal = fines
    .filter((f) => !f.paid)
    .reduce((sum, f) => sum + parseFloat(f.amount), 0);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Total banner */}
      {unpaidTotal > 0 && (
        <View style={s.banner}>
          <View>
            <Text style={s.bannerLabel}>Total Outstanding</Text>
            <Text style={s.bannerAmount}>₱{unpaidTotal.toFixed(2)}</Text>
          </View>
          <Text style={{ color: C.danger + 'aa', fontSize: 28 }}>⚠️</Text>
        </View>
      )}

      {fines.length > 0 && unpaidTotal === 0 && (
        <View style={[s.banner, { backgroundColor: C.success + '18', borderBottomColor: C.success + '44' }]}>
          <Text style={{ color: C.success, fontSize: 13, fontWeight: '600' }}>
            ✓ All fines paid — good standing!
          </Text>
        </View>
      )}

      {loading ? <Loading /> : (
        <FlatList
          data={fines}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={C.primary}
            />
          }
          ListEmptyComponent={<Empty text="No fines on your account." />}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={s.bookTitle} numberOfLines={2}>{item.book_title}</Text>
                  <Text style={s.meta}>Issued: {item.issued_date}</Text>
                  {item.paid && item.paid_date && (
                    <Text style={[s.meta, { color: C.success }]}>Paid: {item.paid_date}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={[s.amount, { color: item.paid ? C.success : C.danger }]}>
                    ₱{parseFloat(item.amount).toFixed(2)}
                  </Text>
                  <Badge
                    label={item.paid ? 'Paid' : 'Unpaid'}
                    color={item.paid ? C.success : C.danger}
                  />
                </View>
              </View>
              {!item.paid && (
                <TouchableOpacity
                  style={s.payBtn}
                  onPress={() => handlePay(item.id, item.amount, item.book_title)}
                  disabled={paying === item.id}
                >
                  {paying === item.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.payTxt}>Pay Fine</Text>
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

const s = StyleSheet.create({
  banner:      { backgroundColor: C.danger + '18', borderBottomWidth: 1, borderBottomColor: C.danger + '44', padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bannerLabel: { color: C.sub, fontSize: 12, marginBottom: 2 },
  bannerAmount:{ color: C.danger, fontSize: 22, fontWeight: '800' },
  card:        { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  bookTitle:   { color: C.text, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  meta:        { color: C.muted, fontSize: 11, marginTop: 3 },
  amount:      { fontSize: 16, fontWeight: '800' },
  payBtn:      { marginTop: 10, backgroundColor: C.success, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  payTxt:      { color: '#fff', fontWeight: '700', fontSize: 13 },
});