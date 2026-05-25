import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { getBorrowRequests, approveBorrowRequest, rejectBorrowRequest } from '../../services/api';
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

export default function LibrarianBorrowRequestsScreen() {
  const [requests, setRequests]   = useState<BorrowRequest[]>([]);
  const [filter, setFilter]       = useState<string>('pending');
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing]       = useState<number | null>(null);

  // Reject modal
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectId, setRejectId]       = useState<number | null>(null);
  const [rejectNote, setRejectNote]   = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getBorrowRequests(filter === 'all' ? undefined : filter);
      setRequests(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const handleApprove = (id: number, memberName: string, bookTitle: string) => {
    Alert.alert(
      'Approve Request',
      `Approve borrow request from ${memberName} for "${bookTitle}"?\n\nThis will create a loan and mark the book as unavailable.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve', style: 'default',
          onPress: async () => {
            setActing(id);
            try {
              await approveBorrowRequest(id);
              load();
            } catch (e: any) {
              Alert.alert('Error', e?.data?.error ?? 'Could not approve request.');
            } finally {
              setActing(null);
            }
          },
        },
      ]
    );
  };

  const handleRejectConfirm = async () => {
    if (!rejectId) return;
    setActing(rejectId);
    try {
      await rejectBorrowRequest(rejectId, rejectNote);
      setRejectModal(false);
      setRejectNote('');
      setRejectId(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.data?.error ?? 'Could not reject request.');
    } finally {
      setActing(null);
    }
  };

  const renderItem = ({ item }: { item: BorrowRequest }) => (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={s.memberName}>{item.member_name}</Text>
          <Text style={s.bookTitle} numberOfLines={1}>{item.book_title}</Text>
          <Text style={s.date}>Requested: {item.request_date}</Text>
          {item.notes ? <Text style={s.notes}>Note: {item.notes}</Text> : null}
        </View>
        <Badge label={item.status_display} color={statusColor(item.status)} />
      </View>

      {item.status === 'pending' && (
        <View style={s.actions}>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: C.success + '22', borderColor: C.success }]}
            onPress={() => handleApprove(item.id, item.member_name, item.book_title)}
            disabled={acting === item.id}
          >
            {acting === item.id
              ? <ActivityIndicator size="small" color={C.success} />
              : <Text style={[s.actionTxt, { color: C.success }]}>✓ Approve</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: C.danger + '22', borderColor: C.danger }]}
            onPress={() => { setRejectId(item.id); setRejectModal(true); }}
            disabled={acting === item.id}
          >
            <Text style={[s.actionTxt, { color: C.danger }]}>✕ Reject</Text>
          </TouchableOpacity>
        </View>
      )}

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

      {/* Reject modal */}
      <Modal visible={rejectModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Reject Request</Text>
            <Text style={s.modalSub}>Optional: provide a reason for the member.</Text>
            <TextInput
              style={s.modalInput}
              placeholder="Reason (optional)"
              placeholderTextColor={C.muted}
              value={rejectNote}
              onChangeText={setRejectNote}
              multiline
              numberOfLines={3}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={[s.modalBtn, { flex: 1, backgroundColor: C.card }]}
                onPress={() => { setRejectModal(false); setRejectNote(''); setRejectId(null); }}>
                <Text style={{ color: C.sub, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { flex: 1, backgroundColor: C.danger }]}
                onPress={handleRejectConfirm} disabled={!!acting}>
                {acting
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: '#fff', fontWeight: '600' }}>Reject</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  actions:        { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn:      { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  actionTxt:      { fontSize: 13, fontWeight: '700' },
  loanRef:        { color: C.success, fontSize: 11, marginTop: 8, fontWeight: '600' },
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modal:          { backgroundColor: C.surface, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: C.border },
  modalTitle:     { color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  modalSub:       { color: C.sub, fontSize: 13, marginBottom: 12 },
  modalInput:     { backgroundColor: C.card, color: C.text, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, fontSize: 13, textAlignVertical: 'top' },
  modalBtn:       { borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
});