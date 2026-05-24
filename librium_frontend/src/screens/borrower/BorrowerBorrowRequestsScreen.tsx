// src/screens/borrower/BorrowerBorrowRequestsScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { getBorrowRequests, cancelBorrowRequest } from '../../services/api';
import { C, Badge, Empty, Loading } from '../../components/UI';

type BorrowRequest = {
  id:             number;
  book_title:     string;
  book_author:    string | null;
  status:         string;
  request_date:   string;
  processed_date: string | null;
  notes:          string | null;
};

const statusColor = (s: string) => {
  if (s === 'pending')  return C.warning;
  if (s === 'approved') return C.success;
  if (s === 'rejected') return C.danger;
  return C.muted;
};

const statusLabel = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function BorrowerBorrowRequestsScreen() {
  const [requests, setRequests]     = useState<BorrowRequest[]>([]);
  const [filter, setFilter]         = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getBorrowRequests();
      setRequests(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCancel = (id: number, title: string) => {
    Alert.alert(
      'Cancel Request',
      `Cancel your borrow request for "${title}"?`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Request', style: 'destructive', onPress: async () => {
            setCancelling(id);
            try {
              await cancelBorrowRequest(id);
              load();
            } catch (e: any) {
              Alert.alert('Error', e?.data?.error ?? 'Could not cancel request.');
            } finally { setCancelling(null); }
          },
        },
      ]
    );
  };

  const filtered = requests.filter((r) => filter === 'all' ? true : r.status === filter);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Filter tabs */}
      <View style={s.filterRow}>
        {(['pending', 'approved', 'rejected', 'all'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.filterTab, filter === f && s.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterTxt, filter === f && s.filterTxtActive]}>
              {statusLabel(f)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? <Loading /> : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={C.primary}
            />
          }
          ListEmptyComponent={<Empty text={`No ${filter} requests.`} />}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={s.bookTitle} numberOfLines={2}>{item.book_title}</Text>
                  {item.book_author && <Text style={s.bookAuthor}>{item.book_author}</Text>}
                  <Text style={s.meta}>Requested: {item.request_date}</Text>
                  {item.processed_date && (
                    <Text style={s.meta}>Processed: {item.processed_date}</Text>
                  )}
                  {item.notes && item.status === 'rejected' && (
                    <Text style={[s.meta, { color: C.danger, marginTop: 4 }]}>
                      Reason: {item.notes}
                    </Text>
                  )}
                </View>
                <Badge label={statusLabel(item.status)} color={statusColor(item.status)} />
              </View>

              {item.status === 'pending' && (
                <TouchableOpacity
                  style={s.cancelBtn}
                  onPress={() => handleCancel(item.id, item.book_title)}
                  disabled={cancelling === item.id}
                >
                  {cancelling === item.id
                    ? <ActivityIndicator size="small" color={C.danger} />
                    : <Text style={s.cancelTxt}>Cancel Request</Text>
                  }
                </TouchableOpacity>
              )}

              {item.status === 'approved' && (
                <View style={s.approvedNote}>
                  <Text style={{ color: C.success, fontSize: 12 }}>
                    ✓ Approved — visit the library desk to collect your book.
                  </Text>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  filterRow:      { flexDirection: 'row', backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: C.border, flexWrap: 'wrap' },
  filterTab:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  filterTabActive:{ backgroundColor: C.primary, borderColor: C.primary },
  filterTxt:      { color: C.sub, fontSize: 12, fontWeight: '600' },
  filterTxtActive:{ color: '#fff' },
  card:           { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  bookTitle:      { color: C.text, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  bookAuthor:     { color: C.sub, fontSize: 12, marginTop: 2 },
  meta:           { color: C.muted, fontSize: 11, marginTop: 3 },
  cancelBtn:      { marginTop: 10, borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: C.danger },
  cancelTxt:      { color: C.danger, fontWeight: '700', fontSize: 13 },
  approvedNote:   { marginTop: 10, backgroundColor: C.success + '18', borderRadius: 8, padding: 8 },
});