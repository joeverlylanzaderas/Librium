import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert,
} from 'react-native';
import { getBorrowRequests, normalizePaginated } from '../../services/api';
import { C, Badge, Empty, Loading } from '../../components/UI';

type BorrowRequest = {
  id:             number;
  member_name:    string;
  book_title:     string;
  status:         string;
  status_display: string;
  request_date:   string;
  notes:          string | null;
  loan_id:        number | null;
};

const STATUS_FILTERS = ['all', 'pending', 'approved', 'rejected', 'cancelled'] as const;

const statusColor = (s: string) => {
  if (s === 'pending')   return '#f59e0b';
  if (s === 'approved')  return C.success;
  if (s === 'rejected')  return C.danger;
  if (s === 'cancelled') return C.muted;
  return C.muted;
};

export default function BorrowerBorrowRequestsScreen() {
  const [requests, setRequests]   = useState<BorrowRequest[]>([]);
  const [filter, setFilter]       = useState<string>('pending');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getBorrowRequests(filter === 'all' ? '' : filter);
      setRequests(normalizePaginated(data));
    } catch (e) {
      
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { setLoading(true); load(); }, [filter]);

  const renderItem = ({ item }: { item: BorrowRequest }) => (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.bookTitle} numberOfLines={1}>{item.book_title}</Text>
          <Text style={s.date}>Requested: {item.request_date}</Text>
          {item.notes ? <Text style={s.notes}>Note: {item.notes}</Text> : null}
        </View>
        <Badge label={item.status_display} color={statusColor(item.status)} />
      </View>

      {item.status === 'approved' && item.loan_id && (
        <Text style={s.loanRef}>Loan #{item.loan_id} created</Text>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Filter tabs */}
      <View style={s.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[s.filterTab, filter === f && s.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterTxt, filter === f && s.filterTxtActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading
        ? <Loading />
        : <FlatList
            data={requests}
            keyExtractor={(i) => String(i.id)}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />}
            ListEmptyComponent={<Empty text={`No ${filter === 'all' ? '' : filter} requests.`} />}
          />
      }
    </View>
  );
}

const s = StyleSheet.create({
  filterRow:      { flexDirection: 'row', backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  filterTab:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  filterTabActive:{ backgroundColor: C.primary, borderColor: C.primary },
  filterTxt:      { color: C.sub, fontSize: 12, fontWeight: '600' },
  filterTxtActive:{ color: '#fff' },
  card:           { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  cardTop:        { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  memberName:     { color: C.text, fontSize: 14, fontWeight: '700' },
  bookTitle:      { color: C.sub, fontSize: 13, marginTop: 2 },
  date:           { color: C.muted, fontSize: 11, marginTop: 4 },
  notes:          { color: C.muted, fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  loanRef:        { color: C.success, fontSize: 11, marginTop: 8, fontWeight: '600' },
});