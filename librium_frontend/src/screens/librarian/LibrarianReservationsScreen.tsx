
import { getReservations } from '../../services/api';
import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, StyleSheet,
    RefreshControl, Alert, TextInput, Modal, ActivityIndicator,
  } from 'react-native';
import { C, Badge, Empty, Loading } from '../../components/UI';

type Reservation = {
  id:             number;
  member_name:    string;
  book_title:     string;
  book_author:    string | null;
  status:         string;
  reserved_date:  string;
  notified_date:  string | null;
  queue_position: number;
};

const resStatusColor = (s: string) => {
  if (s === 'waiting')   return '#f59e0b';
  if (s === 'ready')     return C.success;
  if (s === 'fulfilled') return C.primary;
  return C.muted;
};

export default function LibrarianReservationsScreen() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filter, setFilter]   = useState<string>('waiting');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getReservations();
      setReservations(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = reservations.filter((r) =>
    filter === 'all' ? true : r.status === filter
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={sr.filterRow}>
        {(['waiting', 'ready', 'all'] as const).map((f) => (
          <TouchableOpacity key={f} style={[sr.filterTab, filter === f && sr.filterTabActive]} onPress={() => setFilter(f)}>
            <Text style={[sr.filterTxt, filter === f && sr.filterTxtActive]}>
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
          ListEmptyComponent={<Empty text={`No ${filter} reservations.`} />}
          renderItem={({ item }) => (
            <View style={sr.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text style={sr.member}>{item.member_name}</Text>
                  <Text style={sr.book} numberOfLines={1}>{item.book_title}</Text>
                  {item.book_author && <Text style={sr.meta}>{item.book_author}</Text>}
                  <Text style={sr.meta}>Reserved: {item.reserved_date}  ·  Queue #{item.queue_position}</Text>
                  {item.notified_date && (
                    <Text style={[sr.meta, { color: C.success }]}>Notified: {item.notified_date}</Text>
                  )}
                </View>
                <Badge label={item.status.charAt(0).toUpperCase() + item.status.slice(1)} color={resStatusColor(item.status)} />
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const sr = StyleSheet.create({
  filterRow:      { flexDirection: 'row', backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  filterTab:      { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  filterTabActive:{ backgroundColor: C.primary, borderColor: C.primary },
  filterTxt:      { color: C.sub, fontSize: 12, fontWeight: '600' },
  filterTxtActive:{ color: '#fff' },
  card:           { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  member:         { color: C.text, fontSize: 14, fontWeight: '700' },
  book:           { color: C.sub, fontSize: 13, marginTop: 2 },
  meta:           { color: C.muted, fontSize: 11, marginTop: 3 },
});
