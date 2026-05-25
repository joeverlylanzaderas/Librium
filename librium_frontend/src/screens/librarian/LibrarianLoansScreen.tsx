
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, TextInput, Modal, ActivityIndicator,
  useWindowDimensions, Platform, ScrollView,
  TouchableWithoutFeedback, KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getLoans, createLoan, deleteLoan, verifyReturn, getBooks, getUsers } from '../../services/api';
import { Empty, Loading } from '../../components/UI';
import { Fonts } from '../../constants/theme';

// ── Types ─────────────────────────────────────────────────────────
type Loan = {
  id:                    number;
  member:                number;
  member_name:           string;
  book:                  number;
  book_title:            string;
  book_category:         string | null;
  loan_date:             string;
  due_date:              string;
  return_date:           string | null;
  return_requested_date: string | null;
  return_verified_date:  string | null;
  return_status:         'none' | 'pending' | 'verified' | 'rejected' | 'disputed';
  is_overdue:            boolean;
  overdue_days:          number;
  verified_by_name:      string | null;
  semester_label:        string | null;
  notes:                 string | null;
  borrow_request_id:     number | null;
};

type BookItem = { id: number; title: string; author_name?: string; available?: boolean; };
type UserItem = { id: number; email: string; full_name?: string; role?: string; };

// ── Palette ───────────────────────────────────────────────────────
const P = {
  espresso: '#1F150C', mahogany: '#412D15', parchment: '#FBF5DD',
  parchmentDark: '#EFE9CE', cream: '#FFFDF1', brass: '#FFC85C',
  tangerine: '#FF9D00', white: '#FFFFFF',
  textMain: '#2D1F10', textMuted: '#706251', textLight: '#A1927F',
  success: '#3D5A45', successBg: '#E6F4EA', successBorder: '#B7DFC4',
  danger:  '#8A2B2B', dangerBg:  '#FCE8E6', dangerBorder: '#F5C2BC',
  amber:   '#B45309', amberBg:   '#FFFBEB', amberBorder: '#FCD34D',
  info:    '#0369A1', infoBg:    '#E0F2FE', infoBorder: '#BAE6FD',
  purple:  '#6D28D9', purpleBg:  '#EDE9FE', purpleBorder: '#DDD6FE',
  border:  '#DCD4C4', surface:   '#F7F2E6',
};

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif' });

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  member:    { label: 'MEMBER',    color: P.info,    bg: P.infoBg    },
  librarian: { label: 'LIBRARIAN', color: P.amber,   bg: P.amberBg   },
  admin:     { label: 'ADMIN',     color: P.danger,  bg: P.dangerBg  },
};

const STATUS_FILTERS = ['all', 'none', 'pending', 'verified', 'rejected', 'disputed'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];
const FILTER_LABELS: Record<string, string> = {
  all: 'All', none: 'Active', pending: 'Pending Return',
  verified: 'Returned', rejected: 'Rejected', disputed: 'Disputed',
};

const RETURN_STATUS_META: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  none:     { color: P.info,    bg: P.infoBg,    icon: 'book-open',    label: 'Active'          },
  pending:  { color: P.amber,   bg: P.amberBg,   icon: 'clock',        label: 'Pending Return'  },
  verified: { color: P.success, bg: P.successBg, icon: 'check-circle', label: 'Returned'        },
  rejected: { color: P.danger,  bg: P.dangerBg,  icon: 'x-circle',     label: 'Return Rejected' },
  disputed: { color: P.purple,  bg: P.purpleBg,  icon: 'alert-circle', label: 'Disputed'        },
};

// ── Picker Modal (ported from admin) ─────────────────────────────
type PickerModalProps<T> = {
  visible: boolean; title: string; data: T[]; query: string;
  onQueryChange: (q: string) => void; keyExtractor: (item: T) => string;
  renderRow: (item: T, onClose: () => void) => React.ReactElement;
  onClose: () => void; emptyText: string;
};

function PickerModal<T>({ visible, title, data, query, onQueryChange, keyExtractor, renderRow, onClose, emptyText }: PickerModalProps<T>) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={pk.overlay}>
          <TouchableWithoutFeedback>
            <View style={pk.sheet}>
              <View style={pk.header}>
                <Text style={pk.title}>{title}</Text>
                <TouchableOpacity onPress={onClose}><Feather name="x" size={18} color={P.textMain} /></TouchableOpacity>
              </View>
              <View style={pk.searchRow}>
                <Feather name="search" size={14} color={P.textLight} style={{ marginRight: 8 }} />
                <TextInput style={pk.searchInput} value={query} onChangeText={onQueryChange}
                  placeholder="Type to search…" placeholderTextColor={P.textLight} autoFocus />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => onQueryChange('')}>
                    <Feather name="x-circle" size={14} color={P.textLight} />
                  </TouchableOpacity>
                )}
              </View>
              <FlatList
                data={data} keyExtractor={keyExtractor} style={pk.list}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={<Text style={pk.empty}>{emptyText}</Text>}
                renderItem={({ item }) => renderRow(item, onClose)}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const pk = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(31,21,12,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet:      { backgroundColor: P.cream, borderWidth: 1, borderColor: P.mahogany, width: '100%', maxWidth: 460, maxHeight: '72%' },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
                backgroundColor: P.espresso, paddingHorizontal: 16, paddingVertical: 14 },
  title:      { fontFamily: SERIF, fontSize: 15, color: P.brass, fontWeight: '700' },
  searchRow:  { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: P.border,
                paddingHorizontal: 14, paddingVertical: 10, backgroundColor: P.surface },
  searchInput:{ flex: 1, fontSize: 13, color: P.textMain, fontFamily: Fonts.sans },
  list:       { flexGrow: 0 },
  empty:      { padding: 20, textAlign: 'center', color: P.textLight, fontStyle: 'italic', fontSize: 12 },
  item:       { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderColor: P.parchmentDark },
  itemDisabled:{ backgroundColor: P.surface },
  itemRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle:  { fontSize: 13, color: P.textMain, fontWeight: '600', fontFamily: Fonts.sans },
  itemSub:    { fontSize: 11, color: P.textMuted, fontFamily: Fonts.sans, marginTop: 2 },
  roleBadge:  { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  roleTxt:    { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  avail:      { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  availTxt:   { fontSize: 9, fontWeight: '800' },
});

// ── Issue Loan Modal ──────────────────────────────────────────────
function IssueLoanModal({ visible, onClose, onIssued }: { visible: boolean; onClose: () => void; onIssued: () => void }) {
  const [booksLookup, setBooksLookup] = useState<BookItem[]>([]);
  const [usersLookup, setUsersLookup] = useState<UserItem[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ memberId: '', memberDisplay: '', bookId: '', bookDisplay: '' });
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [bookPickerOpen, setBookPickerOpen]     = useState(false);
  const [memberQuery, setMemberQuery] = useState('');
  const [bookQuery, setBookQuery]     = useState('');

  const reset = () => { setForm({ memberId: '', memberDisplay: '', bookId: '', bookDisplay: '' }); setMemberQuery(''); setBookQuery(''); };

  useEffect(() => {
    if (!visible) return;
    setLookupsLoading(true);
    Promise.all([getBooks(), getUsers()])
      .then(([b, u]) => {
        setBooksLookup(Array.isArray(b) ? b : (b.results ?? []));
        setUsersLookup(Array.isArray(u) ? u : (u.results ?? []));
      })
      .catch((e) => console.warn('Lookup failed:', e))
      .finally(() => setLookupsLoading(false));
  }, [visible]);

  const filteredMembers = useMemo(() => {
    const q = memberQuery.toLowerCase();
    return usersLookup.filter((u) =>
      u.email?.toLowerCase().includes(q) || u.full_name?.toLowerCase().includes(q)
    );
  }, [usersLookup, memberQuery]);

  const filteredBooks = useMemo(() => {
    const q = bookQuery.toLowerCase();
    return booksLookup.filter((b) =>
      b.title?.toLowerCase().includes(q) || b.author_name?.toLowerCase().includes(q)
    );
  }, [booksLookup, bookQuery]);

  const handleSubmit = async () => {
    if (!form.memberId || !form.bookId) { Alert.alert('Required', 'Select both a member and a book.'); return; }
    setSaving(true);
    try {
      await createLoan({ member: Number(form.memberId), book: Number(form.bookId) });
      Alert.alert('Success', 'Loan issued successfully.');
      reset(); onIssued(); onClose();
    } catch (e: any) {
      const msg = e?.data?.book?.[0] ?? e?.data?.member?.[0] ?? e?.data?.detail ?? e?.data?.non_field_errors?.[0] ?? 'Could not issue loan.';
      Alert.alert('Error', msg);
    } finally { setSaving(false); }
  };

  return (
    <>
      <Modal visible={visible} animationType="fade" transparent onRequestClose={() => { onClose(); reset(); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={() => { onClose(); reset(); }}>
            <View style={il.overlay}>
              <TouchableWithoutFeedback>
                <View style={il.sheet}>
                  {/* Header */}
                  <View style={il.header}>
                    <Feather name="book-open" size={15} color={P.brass} />
                    <Text style={il.title}>Front Desk Borrow Issuance</Text>
                    <TouchableOpacity onPress={() => { onClose(); reset(); }}>
                      <Feather name="x" size={17} color={P.parchmentDark} />
                    </TouchableOpacity>
                  </View>

                  {lookupsLoading ? (
                    <View style={il.loadingWrap}>
                      <ActivityIndicator size="small" color={P.mahogany} />
                      <Text style={il.loadingTxt}>Loading records…</Text>
                    </View>
                  ) : (
                    <View style={il.form}>
                      {/* Member selector */}
                      <View>
                        <Text style={il.label}>Member *</Text>
                        <TouchableOpacity
                          style={[il.selector, form.memberId && il.selectorSelected]}
                          onPress={() => { setMemberQuery(''); setMemberPickerOpen(true); }}
                        >
                          <Text style={[il.selectorTxt, !form.memberId && il.placeholder]} numberOfLines={1}>
                            {form.memberId ? form.memberDisplay : 'Tap to search member…'}
                          </Text>
                          {form.memberId
                            ? <Feather name="check-circle" size={14} color={P.success} />
                            : <Feather name="chevron-down" size={14} color={P.textLight} />}
                        </TouchableOpacity>
                      </View>

                      {/* Book selector */}
                      <View>
                        <Text style={il.label}>Book *</Text>
                        <TouchableOpacity
                          style={[il.selector, form.bookId && il.selectorSelected]}
                          onPress={() => { setBookQuery(''); setBookPickerOpen(true); }}
                        >
                          <Text style={[il.selectorTxt, !form.bookId && il.placeholder]} numberOfLines={1}>
                            {form.bookId ? form.bookDisplay : 'Tap to search book…'}
                          </Text>
                          {form.bookId
                            ? <Feather name="check-circle" size={14} color={P.success} />
                            : <Feather name="chevron-down" size={14} color={P.textLight} />}
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Actions */}
                  <View style={il.actions}>
                    <TouchableOpacity style={[il.btn, il.btnCancel]} onPress={() => { onClose(); reset(); }}>
                      <Text style={il.cancelTxt}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[il.btn, il.btnSubmit, (!form.memberId || !form.bookId) && { opacity: 0.45 }]}
                      onPress={handleSubmit} disabled={saving || !form.memberId || !form.bookId}
                    >
                      {saving
                        ? <ActivityIndicator size="small" color={P.parchment} />
                        : <><Feather name="book-open" size={13} color={P.parchment} /><Text style={il.submitTxt}>Issue Loan</Text></>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </Modal>

      {/* Member Picker */}
      <PickerModal
        visible={memberPickerOpen} title="Select Member"
        data={filteredMembers} query={memberQuery} onQueryChange={setMemberQuery}
        keyExtractor={(u) => `u-${u.id}`} emptyText="No matching members found."
        onClose={() => setMemberPickerOpen(false)}
        renderRow={(item, close) => {
          const role = ROLE_META[item.role ?? 'member'] ?? ROLE_META.member;
          return (
            <TouchableOpacity style={pk.item} onPress={() => {
              setForm((p) => ({ ...p, memberId: String(item.id), memberDisplay: `${item.full_name ?? item.email} (${item.email})` }));
              close();
            }}>
              <View style={pk.itemRow}>
                <Text style={[pk.itemTitle, { flex: 1 }]} numberOfLines={1}>{item.full_name ?? item.email}</Text>
                <View style={[pk.roleBadge, { backgroundColor: role.bg }]}>
                  <Text style={[pk.roleTxt, { color: role.color }]}>{role.label}</Text>
                </View>
              </View>
              <Text style={pk.itemSub}>{item.email}</Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Book Picker */}
      <PickerModal
        visible={bookPickerOpen} title="Select Book"
        data={filteredBooks} query={bookQuery} onQueryChange={setBookQuery}
        keyExtractor={(b) => `b-${b.id}`} emptyText="No matching books found."
        onClose={() => setBookPickerOpen(false)}
        renderRow={(item, close) => {
          const unavailable = item.available === false;
          return (
            <TouchableOpacity style={[pk.item, unavailable && pk.itemDisabled]} onPress={() => {
              if (unavailable) { Alert.alert('Unavailable', 'This book is currently on loan.'); return; }
              setForm((p) => ({ ...p, bookId: String(item.id), bookDisplay: item.title }));
              close();
            }}>
              <View style={pk.itemRow}>
                <Text style={[pk.itemTitle, { flex: 1 }]} numberOfLines={1}>{item.title}</Text>
                <View style={[pk.avail, { backgroundColor: unavailable ? P.dangerBg : P.successBg }]}>
                  <Text style={[pk.availTxt, { color: unavailable ? P.danger : P.success }]}>
                    {unavailable ? 'ON LOAN' : 'AVAILABLE'}
                  </Text>
                </View>
              </View>
              {item.author_name && <Text style={pk.itemSub}>by {item.author_name}</Text>}
            </TouchableOpacity>
          );
        }}
      />
    </>
  );
}

const il = StyleSheet.create({
  overlay:         { flex: 1, backgroundColor: 'rgba(31,21,12,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet:           { backgroundColor: P.cream, borderWidth: 1, borderColor: P.mahogany, width: '100%', maxWidth: 460, overflow: 'hidden' },
  header:          { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: P.espresso, paddingHorizontal: 18, paddingVertical: 14 },
  title:           { flex: 1, fontFamily: SERIF, fontSize: 15, color: P.brass, fontWeight: '700' },
  loadingWrap:     { alignItems: 'center', paddingVertical: 40, gap: 10 },
  loadingTxt:      { color: P.textMuted, fontSize: 12, fontFamily: Fonts.sans },
  form:            { padding: 20, gap: 16 },
  label:           { fontFamily: Fonts.sans, fontSize: 11, fontWeight: '700', color: P.textMuted, marginBottom: 6, letterSpacing: 0.5 },
  selector:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: P.white, borderWidth: 1, borderColor: P.border, paddingHorizontal: 12, paddingVertical: 12 },
  selectorSelected:{ borderColor: P.success, backgroundColor: '#F0FAF3' },
  selectorTxt:     { flex: 1, fontSize: 13, color: P.textMain, fontFamily: Fonts.sans, marginRight: 8 },
  placeholder:     { color: P.textLight },
  actions:         { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 18, paddingTop: 4 },
  btn:             { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1 },
  btnCancel:       { borderColor: P.border, backgroundColor: 'transparent' },
  btnSubmit:       { backgroundColor: P.espresso, borderColor: P.espresso },
  cancelTxt:       { color: P.textMuted, fontSize: 12, fontWeight: '600', fontFamily: Fonts.sans },
  submitTxt:       { color: P.parchment, fontSize: 12, fontWeight: '700', fontFamily: Fonts.sans },
});

// ── Verify/Reject/Dispute Modal ───────────────────────────────────
function VerifyModal({ visible, action, onClose, onConfirm, acting }: {
  visible: boolean; action: 'verified' | 'rejected' | 'disputed' | null;
  onClose: () => void; onConfirm: (notes: string) => void; acting: boolean;
}) {
  const [notes, setNotes] = useState('');
  const meta = {
    verified: { title: 'Verify Return',  sub: 'Confirm the book has been physically received.', icon: 'check-circle', color: P.success, bg: P.success },
    rejected: { title: 'Reject Return',  sub: 'The return request will be sent back to the member.', icon: 'x-circle', color: P.danger, bg: P.danger },
    disputed: { title: 'Mark Disputed',  sub: 'Flag this return for further investigation.', icon: 'alert-circle', color: P.purple, bg: P.purple },
  }[action ?? 'verified'];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={vm.overlay}>
        <View style={vm.sheet}>
          <View style={vm.header}>
            <Feather name={meta?.icon as any} size={15} color={meta?.color} />
            <Text style={vm.title}>{meta?.title}</Text>
          </View>
          <View style={vm.body}>
            <Text style={vm.sub}>{meta?.sub}</Text>
            <Text style={vm.label}>Notes (optional)</Text>
            <TextInput style={vm.input} placeholder="Additional notes for the member…"
              placeholderTextColor={P.textLight} value={notes} onChangeText={setNotes}
              multiline textAlignVertical="top" />
            <View style={vm.btnRow}>
              <TouchableOpacity style={[vm.btn, vm.btnCancel]} onPress={() => { setNotes(''); onClose(); }}>
                <Text style={vm.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[vm.btn, { backgroundColor: meta?.bg ?? P.espresso, borderColor: meta?.bg ?? P.espresso }]}
                onPress={() => { onConfirm(notes); setNotes(''); }} disabled={acting}>
                {acting
                  ? <ActivityIndicator size="small" color={P.white} />
                  : <Text style={vm.confirmTxt}>{meta?.title}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const vm = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(31,21,12,0.55)', justifyContent: 'center', padding: 24 },
  sheet:     { backgroundColor: P.white, borderRadius: 2, overflow: 'hidden', borderWidth: 1, borderColor: P.border },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: P.espresso, paddingHorizontal: 18, paddingVertical: 14 },
  title:     { color: P.brass, fontSize: 15, fontWeight: '700', fontFamily: SERIF },
  body:      { padding: 18 },
  sub:       { color: P.textMuted, fontSize: 12, marginBottom: 14 },
  label:     { color: P.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 6, fontFamily: Fonts.sans },
  input:     { backgroundColor: P.surface, color: P.textMain, borderWidth: 1, borderColor: P.border, padding: 10, fontSize: 13, minHeight: 70 },
  btnRow:    { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn:       { flex: 1, paddingVertical: 11, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderWidth: 1 },
  btnCancel: { backgroundColor: P.surface, borderColor: P.border },
  cancelTxt: { color: P.textMuted, fontWeight: '700', fontSize: 13 },
  confirmTxt:{ color: P.white, fontWeight: '700', fontSize: 13 },
});

// ── Table Header ──────────────────────────────────────────────────
function TableHeader({ isWide }: { isWide: boolean }) {
  return (
    <View style={tb.headerRow}>
      <Text style={[tb.hCell, { flex: 0.35 }]}>#</Text>
      <Text style={[tb.hCell, { flex: 1.8 }]}>MEMBER</Text>
      <Text style={[tb.hCell, { flex: 2.2 }]}>BOOK</Text>
      {isWide && <Text style={[tb.hCell, { flex: 1.1 }]}>LOAN DATE</Text>}
      {isWide && <Text style={[tb.hCell, { flex: 1.1 }]}>DUE DATE</Text>}
      <Text style={[tb.hCell, { flex: 1.2 }]}>STATUS</Text>
      <Text style={[tb.hCell, { flex: 2, textAlign: 'right' }]}>ACTIONS</Text>
    </View>
  );
}

// ── Table Row ─────────────────────────────────────────────────────
function TableRow({ item, isWide, isEven, acting, onVerify, onReject, onDispute, onDelete }: {
  item: Loan; isWide: boolean; isEven: boolean; acting: number | null;
  onVerify: () => void; onReject: () => void; onDispute: () => void; onDelete: () => void;
}) {
  const meta = RETURN_STATUS_META[item.return_status] ?? RETURN_STATUS_META.none;
  const isActing = acting === item.id;
  const dueBad = item.is_overdue && item.return_status !== 'verified';

  return (
    <View style={[tb.row, isEven && tb.rowEven, dueBad && tb.rowOverdue]}>
      <Text style={[tb.mono, { flex: 0.35 }]}>#{item.id}</Text>
      <View style={{ flex: 1.8 }}>
        <Text style={tb.bold} numberOfLines={1}>{item.member_name}</Text>
      </View>
      <View style={{ flex: 2.2 }}>
        <Text style={tb.sub} numberOfLines={1}>{item.book_title}</Text>
        {dueBad && <Text style={tb.overdueTag}>{item.overdue_days}d overdue</Text>}
        {item.return_status === 'pending' && item.return_requested_date && (
          <Text style={tb.pendingTag}>req: {item.return_requested_date}</Text>
        )}
      </View>
      {isWide && <Text style={[tb.mono, { flex: 1.1 }]}>{item.loan_date}</Text>}
      {isWide && <Text style={[tb.mono, { flex: 1.1, color: dueBad ? P.danger : P.textMuted }]}>{item.due_date}</Text>}
      <View style={{ flex: 1.2 }}>
        <View style={[tb.pill, { backgroundColor: meta.bg }]}>
          <Feather name={meta.icon as any} size={9} color={meta.color} />
          <Text style={[tb.pillTxt, { color: meta.color }]} numberOfLines={1}>{meta.label}</Text>
        </View>
      </View>
      <View style={[tb.actionsCell, { flex: 2 }]}>
        {isActing ? <ActivityIndicator size="small" color={P.mahogany} /> :
          item.return_status === 'pending' ? (
            <>
              <TouchableOpacity style={[tb.btn, tb.btnApprove]} onPress={onVerify}>
                <Feather name="check" size={10} color={P.success} />
                <Text style={[tb.btnTxt, { color: P.success }]}>Verify</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[tb.btn, tb.btnReject]} onPress={onReject}>
                <Feather name="x" size={10} color={P.danger} />
                <Text style={[tb.btnTxt, { color: P.danger }]}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[tb.btn, tb.btnDispute]} onPress={onDispute}>
                <Feather name="alert-circle" size={10} color={P.purple} />
              </TouchableOpacity>
            </>
          ) : item.return_status === 'none' || item.return_status === 'rejected' ? (
            <TouchableOpacity style={[tb.btn, tb.btnGhost]} onPress={onDelete}>
              <Feather name="trash-2" size={10} color={P.textMuted} />
              <Text style={[tb.btnTxt, { color: P.textMuted }]}>Delete</Text>
            </TouchableOpacity>
          ) : (
            <Text style={tb.mono}>{item.return_verified_date ?? item.return_date ?? '—'}</Text>
          )
        }
      </View>
    </View>
  );
}

const tb = StyleSheet.create({
  headerRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: P.espresso,
                paddingHorizontal: 14, paddingVertical: 10, marginTop: 4,
                borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  hCell:      { color: P.brass, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 11,
                borderBottomWidth: 1, borderColor: P.parchmentDark, backgroundColor: P.white },
  rowEven:    { backgroundColor: P.surface },
  rowOverdue: { borderLeftWidth: 3, borderLeftColor: P.danger },
  bold:       { fontWeight: '700', fontSize: 13, color: P.textMain },
  sub:        { fontSize: 12, color: P.textMuted },
  mono:       { fontFamily: SERIF, fontSize: 11, color: P.textMuted },
  overdueTag: { fontSize: 9, color: P.danger, fontWeight: '800', marginTop: 2 },
  pendingTag: { fontSize: 9, color: P.amber, fontWeight: '700', marginTop: 2 },
  pill:       { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6,
                paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' },
  pillTxt:    { fontSize: 9, fontWeight: '800' },
  actionsCell:{ flexDirection: 'row', gap: 5, justifyContent: 'flex-end', alignItems: 'center' },
  btn:        { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7,
                paddingVertical: 4, borderRadius: 4, borderWidth: 1 },
  btnApprove: { backgroundColor: P.successBg, borderColor: P.success },
  btnReject:  { backgroundColor: P.dangerBg,  borderColor: P.danger  },
  btnDispute: { backgroundColor: P.purpleBg,  borderColor: P.purple  },
  btnGhost:   { backgroundColor: P.surface,   borderColor: P.border  },
  btnTxt:     { fontSize: 10, fontWeight: '700' },
});

// ── Main Screen ───────────────────────────────────────────────────
export default function LibrarianLoansScreen() {
  const { width } = useWindowDimensions();
  const isWide = width > 640;

  const [loans, setLoans]           = useState<Loan[]>([]);
  const [filter, setFilter]         = useState<StatusFilter>('all');
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing]         = useState<number | null>(null);
  const [issueModal, setIssueModal] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<Loan | null>(null);
  const [verifyAction, setVerifyAction] = useState<'verified' | 'rejected' | 'disputed' | null>(null);
  const [verifyModal, setVerifyModal]   = useState(false);
  const [verifyActing, setVerifyActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getLoans();
      const arr: Loan[] = Array.isArray(data) ? data : (data.results ?? []);
      const sorted = [...arr].sort((a, b) => {
        if (a.return_status === 'pending' && b.return_status !== 'pending') return -1;
        if (b.return_status === 'pending' && a.return_status !== 'pending') return 1;
        return new Date(b.loan_date).getTime() - new Date(a.loan_date).getTime();
      });
      setLoans(sorted);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const filtered = useMemo(() => {
    let r = loans;
    if (filter !== 'all') r = r.filter((l) => l.return_status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((l) => l.member_name.toLowerCase().includes(q) || l.book_title.toLowerCase().includes(q));
    }
    return r;
  }, [loans, filter, search]);

  const pendingCount = useMemo(() => loans.filter((l) => l.return_status === 'pending').length, [loans]);
  const overdueCount = useMemo(() => loans.filter((l) => l.is_overdue && l.return_status !== 'verified').length, [loans]);

  const openVerify = (loan: Loan, action: 'verified' | 'rejected' | 'disputed') => {
    setVerifyTarget(loan); setVerifyAction(action); setVerifyModal(true);
  };

  const handleVerifyConfirm = async (notes: string) => {
    if (!verifyTarget || !verifyAction) return;
    setVerifyActing(true);
    try {
      await verifyReturn(verifyTarget.id, verifyAction, notes);
      setVerifyModal(false); setVerifyTarget(null); setVerifyAction(null);
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.data?.error ?? e?.data?.detail ?? 'Action failed.');
    } finally { setVerifyActing(false); }
  };

  const handleDelete = (loan: Loan) => {
    Alert.alert('Delete Loan', `Delete loan #${loan.id} for "${loan.book_title}"?\n\nThe book will become available again.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
          setActing(loan.id);
          try { await deleteLoan(loan.id); load(); }
          catch (e: any) { Alert.alert('Error', e?.data?.detail ?? 'Could not delete loan.'); }
          finally { setActing(null); }
      }},
    ]);
  };

  return (
    <View style={s.root}>
      {/* Toolbar */}
      <View style={s.toolbar}>
        {(pendingCount > 0 || overdueCount > 0) && (
          <View style={s.summaryRow}>
            {pendingCount > 0 && (
              <TouchableOpacity style={[s.badge, { backgroundColor: P.amberBg, borderColor: P.amberBorder }]} onPress={() => setFilter('pending')}>
                <Feather name="clock" size={11} color={P.amber} />
                <Text style={[s.badgeTxt, { color: P.amber }]}>{pendingCount} pending return{pendingCount > 1 ? 's' : ''}</Text>
              </TouchableOpacity>
            )}
            {overdueCount > 0 && (
              <TouchableOpacity style={[s.badge, { backgroundColor: P.dangerBg, borderColor: P.dangerBorder }]} onPress={() => setFilter('none')}>
                <Feather name="alert-triangle" size={11} color={P.danger} />
                <Text style={[s.badgeTxt, { color: P.danger }]}>{overdueCount} overdue</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        <View style={s.searchRow}>
          <View style={s.searchWrap}>
            <Feather name="search" size={13} color={P.textMuted} style={{ marginRight: 7 }} />
            <TextInput style={s.searchInput} placeholder="Search member or book…"
              placeholderTextColor={P.textMuted} value={search} onChangeText={setSearch}
              returnKeyType="search" clearButtonMode="while-editing" />
            {search.length > 0 && Platform.OS !== 'ios' && (
              <TouchableOpacity onPress={() => setSearch('')}><Feather name="x" size={13} color={P.textMuted} /></TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={s.issueBtn} onPress={() => setIssueModal(true)}>
            <Feather name="plus" size={13} color={P.white} />
            <Text style={s.issueBtnTxt}>Issue Loan</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={s.chips}>
            {STATUS_FILTERS.map((f) => (
              <TouchableOpacity key={f} style={[s.chip, filter === f && s.chipActive]} onPress={() => setFilter(f)}>
                <Text style={[s.chipTxt, filter === f && s.chipTxtActive]}>
                  {FILTER_LABELS[f]}{f === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {!loading && (
        <View style={s.countBar}>
          <Text style={s.countTxt}>{filtered.length} {filtered.length === 1 ? 'record' : 'records'}{search ? ` for "${search}"` : ''}</Text>
        </View>
      )}

      {loading ? <Loading /> : (
        <FlatList
          data={filtered}
          keyExtractor={(i) => String(i.id)}
          refreshControl={<RefreshControl refreshing={refreshing} tintColor={P.tangerine} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListHeaderComponent={filtered.length > 0 ? <View style={{ marginHorizontal: 12 }}><TableHeader isWide={isWide} /></View> : null}
          renderItem={({ item, index }) => (
            <View style={{ marginHorizontal: 12 }}>
              <TableRow item={item} isWide={isWide} isEven={index % 2 === 0} acting={acting}
                onVerify={() => openVerify(item, 'verified')}
                onReject={() => openVerify(item, 'rejected')}
                onDispute={() => openVerify(item, 'disputed')}
                onDelete={() => handleDelete(item)}
              />
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: 4 }}
          ListEmptyComponent={<Empty text={search ? `No results for "${search}"` : `No ${FILTER_LABELS[filter].toLowerCase()} loans.`} />}
        />
      )}

      <IssueLoanModal visible={issueModal} onClose={() => setIssueModal(false)} onIssued={load} />
      <VerifyModal
        visible={verifyModal} action={verifyAction}
        onClose={() => { setVerifyModal(false); setVerifyTarget(null); setVerifyAction(null); }}
        onConfirm={handleVerifyConfirm} acting={verifyActing}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: P.parchment },
  toolbar:     { backgroundColor: P.white, borderBottomWidth: 1, borderColor: P.border, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, gap: 8 },
  summaryRow:  { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  badgeTxt:    { fontSize: 11, fontWeight: '700' },
  searchRow:   { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchWrap:  { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: P.surface, borderWidth: 1, borderColor: P.border, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 7 },
  searchInput: { flex: 1, color: P.textMain, fontSize: 13, padding: 0 },
  issueBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: P.espresso, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6 },
  issueBtnTxt: { color: P.brass, fontSize: 12, fontWeight: '700' },
  chips:       { flexDirection: 'row', gap: 6, paddingBottom: 2 },
  chip:        { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: P.border, backgroundColor: P.parchment },
  chipActive:  { backgroundColor: P.espresso, borderColor: P.espresso },
  chipTxt:     { color: P.textMuted, fontSize: 11, fontWeight: '700' },
  chipTxtActive:{ color: P.brass },
  countBar:    { paddingHorizontal: 16, paddingVertical: 6 },
  countTxt:    { fontSize: 11, color: P.textMuted, fontWeight: '600' },
});

