
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getLoans, createLoan, verifyReturn, getBooks, getUsers } from '../../services/api';
import { Card, Empty, Loading } from '../../components/UI';
import SidebarLayout from '../../components/SidebarLayout';
import { Fonts } from '../../constants/theme';

type Loan = {
  id: number;
  book_title?: string;
  book_cover?: string | null;
  book_category?: string | null;
  book_department?: string | null;
  member_name?: string;
  member: number;
  loan_date?: string;
  due_date?: string;
  return_date?: string;
  return_verified_date?: string;
  return_requested_date?: string;
  return_status: string;
  is_overdue: boolean;
  overdue_days: number;
  notes?: string | null;
};

type BookItem = {
  id: number;
  title: string;
  author_name?: string;
  available?: boolean;
};

type UserItem = {
  id: number;
  email: string;
  full_name?: string;
};

const STATUS_MAP: Record<string, { bg: string; text: string; border: string; lbl: string }> = {
  none:     { bg: '#E0F2FE', text: '#0369A1', border: '#BAE6FD', lbl: 'ACTIVE HOLD' },
  pending:  { bg: '#FEF3C7', text: '#D97706', border: '#FCD34D', lbl: 'RETURN PENDING' },
  overdue:  { bg: '#FCE8E6', text: '#C53030', border: '#F5C2BC', lbl: 'OVERDUE' },
  verified: { bg: '#E6F4EA', text: '#137333', border: '#B7DFC4', lbl: 'RETURN VERIFIED' },
  rejected: { bg: '#FFF5F5', text: '#8A2B2B', border: '#FEB2B2', lbl: 'RETURN REJECTED' },
  disputed: { bg: '#EDE9FE', text: '#7C3AED', border: '#DDD6FE', lbl: 'DISPUTED HOLD' },
};

const confirm = (title: string, message: string, onConfirm: () => void) => {
  if (typeof window !== 'undefined') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);
  }
};

// ── Standalone picker modal ────────────────────────────────────────────────
type PickerModalProps<T> = {
  visible: boolean;
  title: string;
  data: T[];
  query: string;
  onQueryChange: (q: string) => void;
  keyExtractor: (item: T) => string;
  renderRow: (item: T, onClose: () => void) => React.ReactElement;
  onClose: () => void;
  emptyText: string;
};

function PickerModal<T>({
  visible, title, data, query, onQueryChange,
  keyExtractor, renderRow, onClose, emptyText,
}: PickerModalProps<T>) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={pm.overlay}>
          <TouchableWithoutFeedback>
            <View style={pm.sheet}>
              <View style={pm.header}>
                <Text style={pm.title}>{title}</Text>
                <TouchableOpacity onPress={onClose}>
                  <Feather name="x" size={18} color="#281711" />
                </TouchableOpacity>
              </View>

              <View style={pm.searchRow}>
                <Feather name="search" size={14} color="#A1927F" style={{ marginRight: 8 }} />
                <TextInput
                  style={pm.searchInput}
                  value={query}
                  onChangeText={onQueryChange}
                  placeholder="Type to search..."
                  placeholderTextColor="#A1927F"
                  autoFocus
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => onQueryChange('')}>
                    <Feather name="x-circle" size={14} color="#A1927F" />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={data}
                keyExtractor={keyExtractor}
                style={pm.list}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <Text style={pm.empty}>{emptyText}</Text>
                }
                renderItem={({ item }) => renderRow(item, onClose)}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const pm = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(40,23,17,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet:          { backgroundColor: '#FFFDF1', borderWidth: 1, borderColor: '#412D15', width: '100%', maxWidth: 460, maxHeight: '70%' },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#EBE7DC' },
  title:          { fontFamily: Fonts.baskervilleBold, fontSize: 15, color: '#281711' },
  searchRow:      { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#EBE7DC', paddingHorizontal: 14, paddingVertical: 10 },
  searchInput:    { flex: 1, fontSize: 13, color: '#281711', fontFamily: Fonts.sans },
  list:           { flexGrow: 0 },
  empty:          { padding: 20, textAlign: 'center', color: '#A1927F', fontStyle: 'italic', fontFamily: Fonts.sans, fontSize: 12 },
  item:           { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EAE7DF' },
  itemDisabled:   { backgroundColor: '#F7F4EB' },
  itemRow:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle:      { fontSize: 13, color: '#281711', fontWeight: '600' as const, fontFamily: Fonts.sans },
  itemSub:        { fontSize: 11, color: '#706251', fontFamily: Fonts.sans, marginTop: 2 },
  badgeOk:        { backgroundColor: '#E6F4EA', borderWidth: 1, borderColor: '#B7DFC4', paddingHorizontal: 6, paddingVertical: 2 },
  badgeOkTxt:     { color: '#137333', fontSize: 9, fontWeight: '700' as const, fontFamily: Fonts.sans },
  badgeDanger:    { backgroundColor: '#FCE8E6', borderWidth: 1, borderColor: '#F5C2BC', paddingHorizontal: 6, paddingVertical: 2 },
  badgeDangerTxt: { color: '#C53030', fontSize: 9, fontWeight: '700' as const, fontFamily: Fonts.sans },
});

// ── Main screen ────────────────────────────────────────────────────────────
export default function LoansScreen() {
  const { width } = useWindowDimensions();

  const [loans, setLoans]           = useState<Loan[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [issueModal, setIssueModal] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [filter, setFilter]         = useState<'all' | 'pending' | 'active' | 'overdue' | 'returned'>('all');

  const [booksLookup, setBooksLookup] = useState<BookItem[]>([]);
  const [usersLookup, setUsersLookup] = useState<UserItem[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(false);

  const [form, setForm] = useState({
    memberId: '', memberDisplay: '',
    bookId:   '', bookDisplay:   '',
  });

  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [bookPickerOpen,   setBookPickerOpen]   = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [bookQuery,   setBookQuery]   = useState('');

  // FIX: load() is stable and always fetches fresh data, sets refreshing/loading correctly
  const load = useCallback(async () => {
    try {
      const d = await getLoans();
      // FIX: handle both paginated {results:[]} and plain array responses
      const list: Loan[] = Array.isArray(d) ? d : (d.results ?? []);
      setLoans(list);
    } catch (e) {
      console.warn('Failed to load loans:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadLookups = async () => {
    setLookupsLoading(true);
    try {
      const [booksData, usersData] = await Promise.all([getBooks(), getUsers()]);
      setBooksLookup(Array.isArray(booksData) ? booksData : (booksData.results ?? []));
      setUsersLookup(Array.isArray(usersData) ? usersData : (usersData.results ?? []));
    } catch (e) {
      console.warn('Lookup load failed:', e);
    } finally {
      setLookupsLoading(false);
    }
  };

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (issueModal) loadLookups(); }, [issueModal]);

  const resetForm = () => {
    setForm({ memberId: '', memberDisplay: '', bookId: '', bookDisplay: '' });
    setMemberQuery('');
    setBookQuery('');
  };

  const handleCreate = async () => {
    if (!form.memberId || !form.bookId) {
      Alert.alert('Error', 'Please select both a member and a book.');
      return;
    }
    setSaving(true);
    try {
      await createLoan({ member: parseInt(form.memberId), book: parseInt(form.bookId) });
      // FIX: close modal and reset BEFORE reloading so the list is visibly fresh
      setIssueModal(false);
      resetForm();
      // FIX: await the reload so the list is guaranteed up to date before saving spinner stops
      await load();
    } catch (e: any) {
      const msg =
        e?.data?.book?.[0] ||
        e?.data?.member?.[0] ||
        e?.data?.detail ||
        e?.data?.non_field_errors?.[0] ||
        (e?.data ? JSON.stringify(e.data) : 'Could not issue loan.');
      Alert.alert('Failed', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleAction = (id: number, status: 'verified' | 'rejected', txt: string) => {
    confirm(`${status === 'verified' ? 'Verify' : 'Reject'} Return`, txt, async () => {
      try {
        await verifyReturn(id, status);
        // FIX: await so list is fresh immediately
        await load();
      } catch (e: any) {
        const msg = e?.data?.detail || (e?.data ? JSON.stringify(e.data) : 'Action failed.');
        Alert.alert('Error', msg);
      }
    });
  };

  // FIX: filter logic corrected — 'active' was excluding overdue loans that are still active holds
  const filtered = loans.filter((l) => {
    if (filter === 'pending')  return l.return_status === 'pending';
    if (filter === 'active')   return l.return_status === 'none' && !l.is_overdue;
    if (filter === 'overdue')  return l.is_overdue && l.return_status !== 'verified';
    if (filter === 'returned') return l.return_status === 'verified';
    return true;
  });

  const filteredMembers = usersLookup.filter((u) =>
    u.email?.toLowerCase().includes(memberQuery.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(memberQuery.toLowerCase())
  );

  const filteredBooks = booksLookup.filter((b) =>
    b.title?.toLowerCase().includes(bookQuery.toLowerCase()) ||
    b.author_name?.toLowerCase().includes(bookQuery.toLowerCase())
  );

  const cols  = width > 1200 ? 3 : width > 768 ? 2 : 1;
  const cardW = (width - (width > 768 ? 48 : 32) - 16 * (cols - 1)) / cols;

  if (loading) return <Loading />;

  return (
    <SidebarLayout currentScreen="Loans">
      <View style={s.root}>
        <ScrollView
          contentContainerStyle={[s.inner, { padding: width > 768 ? 24 : 16 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor="#281711"
            />
          }
        >
          {/* Header */}
          <View style={s.headerContainer}>
            <Text style={s.headerTitle}>Book Borrows/Loans ({filtered.length})</Text>
            <TouchableOpacity style={s.addButton} activeOpacity={0.8} onPress={() => setIssueModal(true)}>
              <Feather name="plus" size={16} color="#F4EFE0" />
              <Text style={s.addButtonText}>Issue Loan</Text>
            </TouchableOpacity>
          </View>

          {/* Filters */}
          <View style={s.filterRow}>
            {(['all', 'pending', 'active', 'overdue', 'returned'] as const).map((f) => (
              <TouchableOpacity
                key={f}
                style={[s.filterTab, filter === f && s.filterTabActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[s.filterTxt, filter === f && s.filterTxtActive]}>{f.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {filtered.length === 0 && <Empty text="No entries matching criteria." />}

          {/* Loan cards */}
          <View style={s.gridContainer}>
            {filtered.map((l) => {
              const statusKey = l.return_status === 'none' && l.is_overdue
                ? 'overdue'
                : (STATUS_MAP[l.return_status] ? l.return_status : 'none');
              const t = STATUS_MAP[statusKey];
              return (
                <Card key={l.id} style={StyleSheet.flatten([s.customCard, { width: cardW, opacity: l.return_status === 'verified' ? 0.7 : 1 }])}>
                  <View style={s.cardContent}>
                    <View style={s.cardHeaderLine}>
                      <View style={[s.statusPill, { backgroundColor: t.bg, borderColor: t.border }]}>
                        <Text style={[s.statusText, { color: t.text }]}>{t.lbl}</Text>
                      </View>
                      <Text style={s.ledgerIdText}>ID: #{l.id}</Text>
                    </View>

                    <View style={s.metaContext}>
                      {/* FIX: use book_title (correct field from LoanSerializer) */}
                      <Text style={s.bookTitleText} numberOfLines={2}>
                        {l.book_title ?? 'Untitled Catalog Material'}
                      </Text>
                      {/* FIX: removed book_author (doesn't exist in LoanSerializer);
                               show category/department instead which are the actual fields */}
                      {(l.book_category || l.book_department) && (
                        <Text style={s.bookAuthorText}>
                          {[l.book_category, l.book_department].filter(Boolean).join(' · ')}
                        </Text>
                      )}
                    </View>

                    <View style={s.divider} />

                    <View style={s.metricsGrid}>
                      <View style={s.metricLine}>
                        <Feather name="user" size={12} color="#A1927F" />
                        <Text style={s.metricLabel}>Borrower:</Text>
                        <Text style={s.metricValue} numberOfLines={1}>
                          {l.member_name ?? `ID: ${l.member}`}
                        </Text>
                      </View>
                      {l.loan_date && (
                        <View style={s.metricLine}>
                          <Feather name="calendar" size={12} color="#A1927F" />
                          <Text style={s.metricLabel}>Issued:</Text>
                          <Text style={s.metricValue}>
                            {new Date(l.loan_date).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                      <View style={s.metricLine}>
                        <Feather name="clock" size={12} color={l.is_overdue && l.return_status === 'none' ? '#8A2B2B' : '#A1927F'} />
                        <Text style={[s.metricLabel, l.is_overdue && l.return_status === 'none' && { color: '#8A2B2B' }]}>
                          Due Date:
                        </Text>
                        <Text style={[s.metricValue, l.is_overdue && l.return_status === 'none' && { color: '#8A2B2B', fontWeight: '700' }]}>
                          {l.due_date ? new Date(l.due_date).toLocaleDateString() : '—'}
                        </Text>
                      </View>
                      {l.return_status === 'pending' && l.return_requested_date && (
                        <View style={[s.metricLine, s.highlightLine, { backgroundColor: '#FEF3C7' }]}>
                          <Feather name="bell" size={12} color="#D97706" />
                          <Text style={[s.metricLabel, { color: '#D97706' }]}>Requested:</Text>
                          <Text style={[s.metricValue, { color: '#D97706' }]}>
                            {new Date(l.return_requested_date).toLocaleDateString()}
                          </Text>
                        </View>
                      )}
                      {l.return_status === 'none' && l.is_overdue && (
                        <View style={[s.metricLine, s.highlightLine, { backgroundColor: '#FCE8E6' }]}>
                          <Feather name="alert-triangle" size={12} color="#C53030" />
                          <Text style={[s.metricLabel, { color: '#C53030', fontWeight: '700' }]}>Overdue:</Text>
                          <Text style={[s.metricValue, { color: '#C53030', fontWeight: '700' }]}>
                            {l.overdue_days}d Delayed
                          </Text>
                        </View>
                      )}
                    </View>

                    {l.return_status === 'pending' && (
                      <View style={s.actionRowLayout}>
                        <TouchableOpacity
                          style={[s.actionControlBtn, s.verifyBtn]}
                          onPress={() => handleAction(l.id, 'verified', 'Confirm physical verification of item return?')}
                        >
                          <Feather name="check" size={12} color="#FFF" />
                          <Text style={s.verifyBtnTxt}>Verify</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.actionControlBtn, s.rejectBtn]}
                          onPress={() => handleAction(l.id, 'rejected', 'Reject this item return request?')}
                        >
                          <Feather name="x" size={12} color="#8A2B2B" />
                          <Text style={s.rejectBtnTxt}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* ── Issue Loan modal ───────────────────────────────────────────────── */}
      <Modal
        visible={issueModal}
        animationType="fade"
        transparent
        onRequestClose={() => { setIssueModal(false); resetForm(); }}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={() => { setIssueModal(false); resetForm(); }}>
            <View style={s.modalOverlay}>
              <TouchableWithoutFeedback>
                <View style={s.modalSheet}>
                  <View style={s.modalHeaderStack}>
                    <Text style={s.modalTitleText}>Front Desk Borrow Issuance</Text>
                    <TouchableOpacity onPress={() => { setIssueModal(false); resetForm(); }}>
                      <Feather name="x" size={18} color="#281711" />
                    </TouchableOpacity>
                  </View>

                  {lookupsLoading ? (
                    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                      <ActivityIndicator size="small" color="#281711" />
                      <Text style={[s.fieldLabelText, { marginTop: 8 }]}>Loading operational records...</Text>
                    </View>
                  ) : (
                    <View style={s.formStack}>
                      {/* Member selector */}
                      <View style={s.selectorBlock}>
                        <Text style={s.fieldLabelText}>Member *</Text>
                        <TouchableOpacity
                          style={[s.selectorBtn, form.memberId ? s.selectorBtnSelected : null]}
                          onPress={() => { setMemberQuery(''); setMemberPickerOpen(true); }}
                        >
                          <Text style={[s.selectorTxt, !form.memberId && s.selectorPlaceholder]} numberOfLines={1}>
                            {form.memberId ? form.memberDisplay : 'Tap to search member…'}
                          </Text>
                          {form.memberId
                            ? <Feather name="check-circle" size={14} color="#137333" />
                            : <Feather name="chevron-down" size={14} color="#A1927F" />
                          }
                        </TouchableOpacity>
                      </View>

                      {/* Book selector */}
                      <View style={s.selectorBlock}>
                        <Text style={s.fieldLabelText}>Book *</Text>
                        <TouchableOpacity
                          style={[s.selectorBtn, form.bookId ? s.selectorBtnSelected : null]}
                          onPress={() => { setBookQuery(''); setBookPickerOpen(true); }}
                        >
                          <Text style={[s.selectorTxt, !form.bookId && s.selectorPlaceholder]} numberOfLines={1}>
                            {form.bookId ? form.bookDisplay : 'Tap to search book…'}
                          </Text>
                          {form.bookId
                            ? <Feather name="check-circle" size={14} color="#137333" />
                            : <Feather name="chevron-down" size={14} color="#A1927F" />
                          }
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  <View style={s.modalActionLayout}>
                    <TouchableOpacity
                      style={[s.formControlBtn, s.formCancelBtn]}
                      onPress={() => { setIssueModal(false); resetForm(); }}
                    >
                      <Text style={s.formCancelBtnTxt}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.formControlBtn, s.formSubmitBtn, (!form.bookId || !form.memberId) && { opacity: 0.5 }]}
                      onPress={handleCreate}
                      disabled={saving || !form.bookId || !form.memberId}
                    >
                      {saving
                        ? <ActivityIndicator size="small" color="#F4EFE0" />
                        : (
                          <>
                            <Feather name="book-open" size={13} color="#F4EFE0" />
                            <Text style={s.formSubmitBtnTxt}>Issue Hold Ledger</Text>
                          </>
                        )
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Member picker ──────────────────────────────────────────────────── */}
      <PickerModal
        visible={memberPickerOpen}
        title="Select Member"
        data={filteredMembers}
        query={memberQuery}
        onQueryChange={setMemberQuery}
        keyExtractor={(item) => `user-${item.id}`}
        emptyText="No matching members found"
        onClose={() => setMemberPickerOpen(false)}
        renderRow={(item, onClose) => (
          <TouchableOpacity
            style={pm.item}
            onPress={() => {
              setForm(prev => ({
                ...prev,
                memberId: String(item.id),
                memberDisplay: `${item.full_name ?? ''} (${item.email})`.trim(),
              }));
              onClose();
            }}
          >
            <Text style={pm.itemTitle}>{item.full_name ?? item.email}</Text>
            <Text style={pm.itemSub}>{item.email}</Text>
          </TouchableOpacity>
        )}
      />

      {/* ── Book picker ────────────────────────────────────────────────────── */}
      <PickerModal
        visible={bookPickerOpen}
        title="Select Book"
        data={filteredBooks}
        query={bookQuery}
        onQueryChange={setBookQuery}
        keyExtractor={(item) => `book-${item.id}`}
        emptyText="No matching books found"
        onClose={() => setBookPickerOpen(false)}
        renderRow={(item, onClose) => {
          const unavailable = item.available === false;
          return (
            <TouchableOpacity
              style={[pm.item, unavailable && pm.itemDisabled]}
              onPress={() => {
                if (unavailable) {
                  Alert.alert('Unavailable', 'This book is currently on loan.');
                  return;
                }
                setForm(prev => ({ ...prev, bookId: String(item.id), bookDisplay: item.title }));
                onClose();
              }}
            >
              <View style={pm.itemRow}>
                <Text style={[pm.itemTitle, { flex: 1 }]} numberOfLines={1}>{item.title}</Text>
                <View style={unavailable ? pm.badgeDanger : pm.badgeOk}>
                  <Text style={unavailable ? pm.badgeDangerTxt : pm.badgeOkTxt}>
                    {unavailable ? 'ON LOAN' : 'AVAILABLE'}
                  </Text>
                </View>
              </View>
              {item.author_name && <Text style={pm.itemSub}>by {item.author_name}</Text>}
            </TouchableOpacity>
          );
        }}
      />
    </SidebarLayout>
  );
}

const s = StyleSheet.create({
  root:               { flex: 1, backgroundColor: '#ECE7D1' },
  inner:              { paddingBottom: 60 },
  headerContainer:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderColor: '#E8E4D9', paddingBottom: 16, paddingTop: 4 },
  headerTitle:        { color: '#281711', fontSize: 16, fontWeight: '700', fontFamily: Fonts.baskervilleBold, lineHeight: 22 },
  addButton:          { backgroundColor: '#281711', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  addButtonText:      { fontFamily: Fonts.sans, color: '#F4EFE0', fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  filterRow:          { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 20 },
  filterTab:          { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#DCD4C4', backgroundColor: '#FFFFFF' },
  filterTabActive:    { backgroundColor: '#281711', borderColor: '#281711' },
  filterTxt:          { fontSize: 10, fontWeight: '700', color: '#706251', fontFamily: Fonts.sans },
  filterTxtActive:    { color: '#F4EFE0' },
  gridContainer:      { flexDirection: 'row', flexWrap: 'wrap', gap: 16, width: '100%' },
  customCard:         { backgroundColor: '#FFFDF1', borderWidth: 1, borderColor: '#412D15', borderRadius: 0, minWidth: 290 },
  cardContent:        { padding: 16 },
  cardHeaderLine:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusPill:         { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  statusText:         { fontSize: 9, fontWeight: '700', fontFamily: Fonts.sans },
  ledgerIdText:       { fontSize: 11, fontWeight: '600', color: '#A1927F', fontFamily: Fonts.sans },
  metaContext:        { marginBottom: 8, minHeight: 52 },
  bookTitleText:      { color: '#281711', fontFamily: Fonts.baskervilleBold, fontSize: 15, lineHeight: 20 },
  bookAuthorText:     { color: '#706251', fontFamily: Fonts.sans, fontSize: 11, fontStyle: 'italic' },
  divider:            { height: 1, backgroundColor: '#EBE7DC', marginVertical: 6 },
  metricsGrid:        { gap: 5 },
  metricLine:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  highlightLine:      { paddingHorizontal: 8, paddingVertical: 4, marginTop: 2, borderWidth: 1, borderColor: 'transparent' },
  metricLabel:        { color: '#513E2F', fontSize: 12, fontFamily: Fonts.sans, marginLeft: 6, marginRight: 4 },
  metricValue:        { color: '#281711', fontSize: 12, fontWeight: '600', fontFamily: Fonts.sans, flex: 1, textAlign: 'right' },
  actionRowLayout:    { flexDirection: 'row', gap: 8, marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderColor: '#EBE7DC' },
  actionControlBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderWidth: 1 },
  verifyBtn:          { backgroundColor: '#281711', borderColor: '#281711' },
  verifyBtnTxt:       { color: '#FFF', fontSize: 11, fontWeight: '700', fontFamily: Fonts.sans },
  rejectBtn:          { backgroundColor: '#FFF5F5', borderColor: '#FEB2B2' },
  rejectBtnTxt:       { color: '#8A2B2B', fontSize: 11, fontWeight: '700', fontFamily: Fonts.sans },
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(40,23,17,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalSheet:         { backgroundColor: '#FFFDF1', borderWidth: 1, borderColor: '#412D15', width: '100%', maxWidth: 460, padding: 24 },
  modalHeaderStack:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitleText:     { fontFamily: Fonts.baskervilleBold, fontSize: 16, color: '#281711' },
  formStack:          { gap: 16, marginBottom: 24 },
  fieldLabelText:     { fontFamily: Fonts.sans, fontSize: 11, fontWeight: '700', color: '#513E2F', marginBottom: 6 },
  selectorBlock:      { gap: 4 },
  selectorBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#DCD4C4', paddingHorizontal: 12, paddingVertical: 12 },
  selectorBtnSelected:{ borderColor: '#137333', backgroundColor: '#F0FAF3' },
  selectorTxt:        { flex: 1, fontSize: 13, color: '#281711', fontFamily: Fonts.sans, marginRight: 8 },
  selectorPlaceholder:{ color: '#A1927F' },
  modalActionLayout:  { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  formControlBtn:     { paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6 },
  formCancelBtn:      { backgroundColor: 'transparent', borderColor: '#DCD4C4' },
  formCancelBtnTxt:   { color: '#706251', fontSize: 12, fontWeight: '600', fontFamily: Fonts.sans },
  formSubmitBtn:      { backgroundColor: '#281711', borderColor: '#281711' },
  formSubmitBtnTxt:   { color: '#F4EFE0', fontSize: 12, fontWeight: '700', fontFamily: Fonts.sans },
});

