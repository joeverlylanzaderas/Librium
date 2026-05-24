// src/screens/borrower/BorrowerLoansScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ActivityIndicator, TextInput, Modal,
} from 'react-native';
import { getLoans, requestReturn } from '../../services/api';
import { C, Badge, Empty, Loading } from '../../components/UI';

type Loan = {
  id:                   number;
  book_title:           string;
  book_author:          string | null;
  loan_date:            string;
  due_date:             string | null;
  return_date:          string | null;
  return_requested_date: string | null;
  return_verified_date: string | null;
  return_status:        string;
  is_overdue:           boolean;
  overdue_days:         number;
  notes:                string | null;
};

const returnStatusColor = (s: string) => {
  if (s === 'verified')  return C.success;
  if (s === 'pending')   return C.warning;
  if (s === 'rejected')  return C.danger;
  if (s === 'disputed')  return '#a78bfa';
  return C.primary;
};

const returnStatusLabel = (s: string) => {
  if (s === 'none')     return 'Active';
  if (s === 'pending')  return 'Return Pending';
  if (s === 'verified') return 'Returned';
  if (s === 'rejected') return 'Return Rejected';
  if (s === 'disputed') return 'Disputed';
  return s;
};

export default function BorrowerLoansScreen() {
  const [loans, setLoans]           = useState<Loan[]>([]);
  const [filter, setFilter]         = useState<'active' | 'returned' | 'all'>('active');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing]         = useState<number | null>(null);

  // return request modal
  const [returnModal, setReturnModal] = useState(false);
  const [returnLoan, setReturnLoan]   = useState<Loan | null>(null);
  const [returnNotes, setReturnNotes] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await getLoans();
      setLoans(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openReturnModal = (loan: Loan) => {
    setReturnLoan(loan);
    setReturnNotes('');
    setReturnModal(true);
  };

  const handleRequestReturn = async () => {
    if (!returnLoan) return;
    setActing(returnLoan.id);
    try {
      await requestReturn(returnLoan.id, returnNotes);
      setReturnModal(false);
      Alert.alert('Return Requested', 'Your return request has been submitted. A librarian will verify the physical return.');
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.data?.error ?? 'Could not submit return request.');
    } finally { setActing(null); }
  };

  const filtered = loans.filter((l) => {
    if (filter === 'active')   return l.return_status !== 'verified';
    if (filter === 'returned') return l.return_status === 'verified';
    return true;
  });

  const overdueCount = loans.filter((l) => l.is_overdue).length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Overdue banner */}
      {overdueCount > 0 && (
        <View style={s.overdueBanner}>
          <Text style={s.overdueText}>
            ⚠️  {overdueCount} overdue loan{overdueCount > 1 ? 's' : ''} — please return as soon as possible.
          </Text>
        </View>
      )}

      {/* Filter tabs */}
      <View style={s.filterRow}>
        {(['active', 'returned', 'all'] as const).map((f) => (
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
          ListEmptyComponent={<Empty text={`No ${filter} loans.`} />}
          renderItem={({ item }) => (
            <View style={[s.card, item.is_overdue && s.cardOverdue]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={s.bookTitle} numberOfLines={2}>{item.book_title}</Text>
                  {item.book_author && <Text style={s.bookAuthor}>{item.book_author}</Text>}
                  <Text style={s.meta}>Borrowed: {item.loan_date}</Text>
                  {item.due_date && (
                    <Text style={[s.meta, item.is_overdue && { color: C.danger, fontWeight: '700' }]}>
                      Due: {item.due_date}
                      {item.is_overdue ? `  ·  ${item.overdue_days} days overdue` : ''}
                    </Text>
                  )}
                  {item.return_verified_date && (
                    <Text style={[s.meta, { color: C.success }]}>Returned: {item.return_verified_date}</Text>
                  )}
                  {item.return_status === 'rejected' && item.notes && (
                    <Text style={[s.meta, { color: C.danger }]}>Reason: {item.notes}</Text>
                  )}
                </View>
                <Badge
                  label={returnStatusLabel(item.return_status)}
                  color={returnStatusColor(item.return_status)}
                />
              </View>

              {/* Action button */}
              {item.return_status === 'none' && (
                <TouchableOpacity
                  style={s.returnBtn}
                  onPress={() => openReturnModal(item)}
                  disabled={acting === item.id}
                >
                  <Text style={s.returnTxt}>📦  Request Return</Text>
                </TouchableOpacity>
              )}
              {item.return_status === 'pending' && (
                <View style={s.pendingNote}>
                  <Text style={{ color: C.warning, fontSize: 12 }}>
                    ⏳ Return request submitted — awaiting librarian confirmation.
                  </Text>
                </View>
              )}
              {item.return_status === 'rejected' && (
                <TouchableOpacity
                  style={s.returnBtn}
                  onPress={() => openReturnModal(item)}
                >
                  <Text style={s.returnTxt}>📦  Re-submit Return Request</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}

      {/* Return request modal */}
      <Modal visible={returnModal} animationType="slide" transparent onRequestClose={() => setReturnModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Request Return</Text>
            <Text style={s.modalSub} numberOfLines={2}>{returnLoan?.book_title}</Text>
            <Text style={s.modalNote}>
              Submitting this request notifies the librarian that you are ready to return the book.
              Please bring the book to the library desk.
            </Text>
            <Text style={s.inputLabel}>Notes (optional)</Text>
            <TextInput
              style={s.textArea}
              placeholder="Any notes for the librarian..."
              placeholderTextColor={C.muted}
              value={returnNotes}
              onChangeText={setReturnNotes}
              multiline
              numberOfLines={3}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, flex: 1 }]}
                onPress={() => setReturnModal(false)}
              >
                <Text style={{ color: C.sub, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: C.primary, flex: 1 }]}
                onPress={handleRequestReturn}
                disabled={!!acting}
              >
                {acting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: '#fff', fontWeight: '700' }}>Submit</Text>
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
  overdueBanner:  { backgroundColor: C.danger + '22', borderBottomWidth: 1, borderBottomColor: C.danger + '55', padding: 12 },
  overdueText:    { color: C.danger, fontSize: 13, fontWeight: '600' },
  filterRow:      { flexDirection: 'row', backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 8, gap: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  filterTab:      { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  filterTabActive:{ backgroundColor: C.primary, borderColor: C.primary },
  filterTxt:      { color: C.sub, fontSize: 12, fontWeight: '600' },
  filterTxtActive:{ color: '#fff' },
  card:           { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  cardOverdue:    { borderColor: C.danger + '88' },
  bookTitle:      { color: C.text, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  bookAuthor:     { color: C.sub, fontSize: 12, marginTop: 2 },
  meta:           { color: C.muted, fontSize: 11, marginTop: 3 },
  returnBtn:      { marginTop: 10, backgroundColor: C.primary, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  returnTxt:      { color: '#fff', fontWeight: '700', fontSize: 13 },
  pendingNote:    { marginTop: 10, backgroundColor: C.warning + '18', borderRadius: 8, padding: 8 },
  modalOverlay:   { flex: 1, backgroundColor: '#000000aa', justifyContent: 'flex-end' },
  modalSheet:     { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitle:     { color: C.text, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  modalSub:       { color: C.sub, fontSize: 13, marginBottom: 10 },
  modalNote:      { color: C.muted, fontSize: 12, lineHeight: 18, marginBottom: 14, backgroundColor: C.card, padding: 10, borderRadius: 8 },
  inputLabel:     { color: C.sub, fontSize: 12, marginBottom: 5, fontWeight: '500' },
  textArea:       { backgroundColor: C.card, color: C.text, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, fontSize: 13, minHeight: 80, textAlignVertical: 'top' },
  modalBtn:       { borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
});