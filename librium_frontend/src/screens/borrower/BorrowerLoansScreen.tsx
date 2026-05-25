// src/screens/borrower/BorrowerLoansScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ActivityIndicator, TextInput, Modal,
  useWindowDimensions, Platform, KeyboardAvoidingView, ScrollView
} from 'react-native';
import { getLoans, requestReturn } from '../../services/api';
import { useAlert } from '../../components/AlertProvider';
import { useAutoRefreshOnFocus } from '../../hooks/useAutoRefreshOnFocus';
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

  // Return request modal states
  const [returnModal, setReturnModal] = useState(false);
  const [returnLoan, setReturnLoan]   = useState<Loan | null>(null);
  const [returnNotes, setReturnNotes] = useState('');

  // Get dynamic layout context dimensions
  const { width } = useWindowDimensions();
  const isWebOrTablet = width > 768; // Standard responsive web break-point

  const load = useCallback(async () => {
    try {
      const data = await getLoans();
      setLoans(data);
    } catch (e) { }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useAutoRefreshOnFocus(load);

  const openReturnModal = (loan: Loan) => {
    setReturnLoan(loan);
    setReturnNotes('');
    setReturnModal(true);
  };

  const { showAlert } = useAlert();

  const handleRequestReturn = async () => {
    if (!returnLoan) return;
    setActing(returnLoan.id);
    try {
      await requestReturn(returnLoan.id, returnNotes);
      setReturnModal(false);
      showAlert('Return Requested', 'Your return request has been submitted. A librarian will verify the physical return.');
      load();
    } catch (e: any) {
      const errMsg = e?.data?.error ?? 'Could not submit return request.';
      showAlert('Error', errMsg);
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
          contentContainerStyle={[s.listContainer, isWebOrTablet && s.listContainerWeb]}
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

              {/* Action buttons */}
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

      {/* Fully Responsive Overlay Modal */}
      <Modal 
        visible={returnModal} 
        animationType={isWebOrTablet ? "fade" : "slide"} 
        transparent 
        onRequestClose={() => setReturnModal(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={s.modalOverlay}
        >
          <ScrollView 
            contentContainerStyle={[
              s.modalScrollContainer, 
              isWebOrTablet ? s.modalScrollCenter : s.modalScrollBottom
            ]}
            bounces={false}
          >
            <View style={[s.modalSheet, isWebOrTablet && s.modalSheetWeb]}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Request Return</Text>
                {isWebOrTablet && (
                  <TouchableOpacity onPress={() => setReturnModal(false)} style={s.closeX}>
                    <Text style={{ color: C.muted, fontSize: 18, fontWeight: '600' }}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
              
              <Text style={s.modalSub} numberOfLines={2}>{returnLoan?.book_title}</Text>
              
              <Text style={s.modalNote}>
                Submitting this request notifies the librarian that you are ready to return the book.
                Please bring the physical book to the library service desk.
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
              
              <View style={s.modalActionRow}>
                <TouchableOpacity
                  style={[s.modalBtn, s.cancelBtn]}
                  onPress={() => setReturnModal(false)}
                >
                  <Text style={{ color: C.sub, fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.modalBtn, s.submitBtn]}
                  onPress={handleRequestReturn}
                  disabled={!!acting}
                >
                  {acting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Submit</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
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
  listContainer:  { padding: 14, paddingBottom: 32 },
  listContainerWeb: { maxWidth: 800, width: '100%', alignSelf: 'center' },
  card:           { backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  cardOverdue:    { borderColor: C.danger + '88' },
  bookTitle:      { color: C.text, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  bookAuthor:     { color: C.sub, fontSize: 12, marginTop: 2 },
  meta:           { color: C.muted, fontSize: 11, marginTop: 3 },
  returnBtn:      { marginTop: 10, backgroundColor: C.primary, borderRadius: 8, paddingVertical: 9, alignItems: 'center' },
  returnTxt:      { color: '#fff', fontWeight: '700', fontSize: 13 },
  pendingNote:    { marginTop: 10, backgroundColor: C.warning + '18', borderRadius: 8, padding: 8 },
  
  // Adaptive Overlay Architectures
  modalOverlay:        { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  modalScrollContainer: { flexGrow: 1, width: '100%' },
  modalScrollBottom:   { justifyContent: 'flex-end' },
  modalScrollCenter:   { justifyContent: 'center', alignItems: 'center', padding: 20 },
  
  modalSheet: { 
    backgroundColor: C.surface, 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20, 
    padding: 20,
    width: '100%',
    ...Platform.select({
      web: { outlineStyle: 'none' } as any
    })
  },
  modalSheetWeb: { 
    maxWidth: 500, 
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  closeX:         { padding: 4, marginRight: -4 },
  modalTitle:     { color: C.text, fontSize: 17, fontWeight: '800' },
  modalSub:       { color: C.sub, fontSize: 13, marginBottom: 10 },
  modalNote:      { color: C.muted, fontSize: 12, lineHeight: 18, marginBottom: 14, backgroundColor: C.card, padding: 10, borderRadius: 8 },
  inputLabel:     { color: C.sub, fontSize: 12, marginBottom: 5, fontWeight: '500' },
  textArea:       { backgroundColor: C.card, color: C.text, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, fontSize: 13, minHeight: 80, textAlignVertical: 'top' },
  modalActionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  modalBtn:       { borderRadius: 8, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  cancelBtn:      { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, flex: 1 },
  submitBtn:      { backgroundColor: C.primary, flex: 1 }
});