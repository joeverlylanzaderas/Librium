// src/screens/borrower/BorrowerReservationsScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { getReservations, cancelReservation } from '../../services/api';
import { C, Badge, Empty, Loading } from '../../components/UI';
import { useAutoRefreshOnFocus } from '../../hooks/useAutoRefreshOnFocus';

type Reservation = {
  id:             number;
  book_title:     string;
  book_author:    string | null;
  status:         string;
  reserved_date:  string;
  notified_date:  string | null;
  queue_position: number;
};

const statusColor = (s: string) => {
  if (s === 'waiting')   return C.warning;
  if (s === 'ready')     return C.success;
  if (s === 'fulfilled') return C.primary;
  if (s === 'expired')   return C.muted;
  if (s === 'cancelled') return C.muted;
  return C.muted;
};

export default function BorrowerReservationsScreen() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [cancelling, setCancelling]     = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getReservations();
      setReservations(data);
    } catch (e) { }
    finally { setLoading(false); setRefreshing(false); }
  }, []);
  useAutoRefreshOnFocus(load);

  const handleCancel = (id: number, title: string) => {
    Alert.alert(
      'Cancel Reservation',
      `Cancel your reservation for "${title}"?\n\nYou will lose your place in the queue.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel Reservation', style: 'destructive', onPress: async () => {
            setCancelling(id);
            try {
              await cancelReservation(id);
              load();
            } catch (e: any) {
              Alert.alert('Error', e?.data?.error ?? 'Could not cancel reservation.');
            } finally { setCancelling(null); }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {loading ? <Loading /> : (
        <FlatList
          data={reservations}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: 14, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={C.primary}
            />
          }
          ListEmptyComponent={<Empty text="You have no active reservations." />}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={s.bookTitle} numberOfLines={2}>{item.book_title}</Text>
                  {item.book_author && <Text style={s.bookAuthor}>{item.book_author}</Text>}
                  <Text style={s.meta}>Reserved: {item.reserved_date}</Text>
                  <Text style={s.meta}>Queue position: #{item.queue_position}</Text>
                  {item.notified_date && (
                    <Text style={[s.meta, { color: C.success, fontWeight: '600' }]}>
                      ✓ Ready since {item.notified_date} — visit the library desk to borrow.
                    </Text>
                  )}
                </View>
                <Badge
                  label={item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  color={statusColor(item.status)}
                />
              </View>

              {item.status === 'ready' && (
                <View style={s.readyNote}>
                  <Text style={{ color: C.success, fontSize: 12, fontWeight: '600' }}>
                    📚 Your book is ready! Please visit the library within 3 days to collect it.
                  </Text>
                </View>
              )}

              {(item.status === 'waiting' || item.status === 'ready') && (
                <TouchableOpacity
                  style={s.cancelBtn}
                  onPress={() => handleCancel(item.id, item.book_title)}
                  disabled={cancelling === item.id}
                >
                  {cancelling === item.id
                    ? <ActivityIndicator size="small" color={C.danger} />
                    : <Text style={s.cancelTxt}>Cancel Reservation</Text>
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
  card:        { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  bookTitle:   { color: C.text, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  bookAuthor:  { color: C.sub, fontSize: 12, marginTop: 2 },
  meta:        { color: C.muted, fontSize: 11, marginTop: 3 },
  readyNote:   { marginTop: 10, backgroundColor: C.success + '18', borderRadius: 8, padding: 8 },
  cancelBtn:   { marginTop: 10, borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderWidth: 1, borderColor: C.danger },
  cancelTxt:   { color: C.danger, fontWeight: '700', fontSize: 13 },
});