import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, TextInput, Modal, ActivityIndicator, Platform,
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
  const [requests, setRequests]     = useState<BorrowRequest[]>([]);
  const [filter, setFilter]         = useState<string>('pending');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing]         = useState<number | null>(null);

  // Approve modal — replaces Alert.alert (broken on Expo web)
  const [approveModal, setApproveModal] = useState(false);
  const [approveTarget, setApproveTarget] = useState<BorrowRequest | null>(null);

  // Reject modal
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectId, setRejectId]       = useState<number | null>(null);
  const [rejectNote, setRejectNote]   = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getBorrowRequests(filter === 'all' ? undefined : filter);
      setRequests(data);
    } catch (e) {
      
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Open the approve confirmation modal
  const handleApprove = (item: BorrowRequest) => {
    setApproveTarget(item);
    setApproveModal(true);
  };

  // Actually fire the approve API call
  const handleApproveConfirm = async () => {
    if (!approveTarget) return;
    setActing(approveTarget.id);
    setApproveModal(false);
    try {
      await approveBorrowRequest(approveTarget.id);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.data?.error ?? e?.data?.detail ?? 'Could not approve request.');
    } finally {
      setActing(null);
      setApproveTarget(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectId) return;
    setActing(rejectId);
    try {
      await rejectBorrowRequest(rejectId, rejectNote);
      setRejectModal(false);
      setRejectNote('');
      setRejectId(null);
      await load();
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
            onPress={() => handleApprove(item)}
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

      {/* ── Approve confirmation modal ── */}
      <Modal visible={approveModal} transparent animationType="fade">
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Approve Request</Text>
            <Text style={s.modalSub}>
              Approve borrow request from{' '}
              <Text style={{ fontWeight: '700', color: '#1F150C' }}>{approveTarget?.member_name}</Text>
              {' '}for{' '}
              <Text style={{ fontWeight: '700', color: '#1F150C' }}>"{approveTarget?.book_title}"</Text>?
              {'\n\n'}This will create a loan and mark the book as unavailable.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[s.modalBtn, { flex: 1, backgroundColor: C.card }]}
                onPress={() => { setApproveModal(false); setApproveTarget(null); }}
              >
                <Text style={{ color: C.sub, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { flex: 1, backgroundColor: C.success }]}
                onPress={handleApproveConfirm}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>✓ Approve</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Reject modal ── */}
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
  filterRow:       { flexDirection: 'row', backgroundColor: '#1F150C', paddingHorizontal: 16, paddingVertical: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#412D15' },
  filterTab:       { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: '#EFE9CE', backgroundColor: '#FBF5DD' },
  filterTabActive: { backgroundColor: '#412D15', borderColor: '#FFC85C' },
  filterTxt:       { color: '#2D1F10', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  filterTxtActive: { color: '#FBF5DD' },
  card:            { backgroundColor: '#FFFDF9', borderRadius: 8, borderWidth: 1, borderColor: '#EFE9CE', padding: 16, marginBottom: 16, shadowColor: '#1F150C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  cardTop:         { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  memberName:      { color: '#1F150C', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  bookTitle:       { color: '#2D1F10', fontWeight: '600', fontSize: 14, lineHeight: 20, marginBottom: 6 },
  date:            { color: '#706251', fontSize: 12, fontWeight: '500', marginTop: 3 },
  notes:           { backgroundColor: 'rgba(239, 233, 206, 0.3)', borderRadius: 4, padding: 8, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#706251', color: '#706251', fontSize: 12, fontStyle: 'italic' },
  actions:         { flexDirection: 'row', gap: 10, marginTop: 16, borderTopWidth: 1, borderTopColor: '#EFE9CE', paddingTop: 12 },
  actionBtn:       { flex: 1, borderWidth: 1, borderRadius: 6, paddingVertical: 8, alignItems: 'center', height: 38, justifyContent: 'center' },
  actionTxt:       { fontSize: 13, fontWeight: '700' },
  loanRef:         { color: C.success, fontSize: 12, marginTop: 8, fontWeight: '600' },
  overlay:         { flex: 1, backgroundColor: 'rgba(31, 21, 12, 0.6)', justifyContent: 'center', padding: 24 },
  modal:           { backgroundColor: '#FFFDF9', borderRadius: 8, padding: 20, borderWidth: 1, borderColor: '#EFE9CE', shadowColor: '#1F150C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 5 },
  modalTitle:      { color: '#1F150C', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalSub:        { color: '#706251', fontSize: 13, marginBottom: 12, lineHeight: 20 },
  modalInput:      { backgroundColor: '#FFFDF9', color: '#1F150C', borderWidth: 1, borderColor: '#EFE9CE', borderRadius: 6, padding: 10, fontSize: 13, textAlignVertical: 'top', minHeight: 80 },
  modalBtn:        { borderRadius: 6, paddingVertical: 10, alignItems: 'center', height: 40, justifyContent: 'center' },
});