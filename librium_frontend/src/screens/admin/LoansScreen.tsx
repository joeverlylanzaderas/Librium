// admin/LoansScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, Alert, Modal,
} from 'react-native';
import { getLoans, createLoan, verifyReturn } from '../../services/api';
import { Card, Btn, Input, Badge, Empty, Loading, SectionHeader, C } from '../../components/UI';

type Loan = {
  id:                    number;
  book_title?:           string;
  book_author?:          string;
  member_name?:          string;
  member:                number;
  loan_date?:            string;
  due_date?:             string;
  return_date?:          string;
  return_verified_date?: string;
  return_requested_date?:string;
  // FIX: backend returns return_status, not status
  return_status:         string;
  is_overdue:            boolean;
  overdue_days:          number;
};

// FIX: map return_status values to display colors
const returnStatusColor = (s: string) => {
  if (s === 'verified') return C.success;
  if (s === 'pending')  return C.warning;
  if (s === 'rejected') return C.danger;
  if (s === 'disputed') return '#a78bfa';
  return C.primary;   // 'none' = active
};

const returnStatusLabel = (s: string) => {
  if (s === 'none')     return 'Active';
  if (s === 'pending')  return 'Return Pending';
  if (s === 'verified') return 'Returned';
  if (s === 'rejected') return 'Return Rejected';
  if (s === 'disputed') return 'Disputed';
  return s;
};

export default function LoansScreen() {
  const [loans, setLoans]           = useState<Loan[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal]           = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState({ member: '', book: '' });

  const load = async () => {
    try {
      const data = await getLoans();
      setLoans(data.results ?? data);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.member || !form.book) {
      return Alert.alert('Error', 'Member ID and Book ID are required.');
    }
    setSaving(true);
    try {
      await createLoan({ member: parseInt(form.member), book: parseInt(form.book) });
      setModal(false);
      setForm({ member: '', book: '' });
      load();
    } catch (e: any) {
      Alert.alert('Error', e?.data ? JSON.stringify(e.data) : 'Could not issue loan.');
    } finally { setSaving(false); }
  };

  const handleVerifyReturn = (id: number) => {
    Alert.alert(
      'Verify Return',
      'Confirm the book was physically returned?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify', onPress: async () => {
            try {
              await verifyReturn(id, 'verified');
              load();
            } catch (e: any) {
              Alert.alert('Error', e?.data ? JSON.stringify(e.data) : 'Could not verify return.');
            }
          },
        },
      ]
    );
  };

  const handleRejectReturn = (id: number) => {
    Alert.alert(
      'Reject Return',
      'Reject this return request? The member will need to re-submit.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject', style: 'destructive', onPress: async () => {
            try {
              await verifyReturn(id, 'rejected');
              load();
            } catch (e: any) {
              Alert.alert('Error', e?.data ? JSON.stringify(e.data) : 'Could not reject return.');
            }
          },
        },
      ]
    );
  };

  if (loading) return <Loading />;

  // FIX: filter by return_status, not status
  const active   = loans.filter((l) => l.return_status === 'none');
  const pending  = loans.filter((l) => l.return_status === 'pending');
  const overdue  = loans.filter((l) => l.return_status === 'none' && l.is_overdue);
  const returned = loans.filter((l) => l.return_status === 'verified');

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={s.inner}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={C.primary}
          />
        }
      >
        <SectionHeader
          title={`Loans (${loans.length})`}
          action="+ Issue Loan"
          onAction={() => setModal(true)}
        />

        {/* ── Pending returns — action needed ── */}
        {pending.length > 0 && (
          <Text style={s.groupLabel}>PENDING RETURNS ({pending.length})</Text>
        )}
        {pending.map((l) => (
          <Card key={l.id}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{l.book_title ?? '—'}</Text>
                <Text style={s.meta}>Member: {l.member_name ?? l.member}</Text>
                <Text style={s.meta}>Due: {l.due_date ?? '—'}</Text>
                {l.return_requested_date && (
                  <Text style={[s.meta, { color: C.warning }]}>
                    Return requested: {l.return_requested_date}
                  </Text>
                )}
                {l.is_overdue && (
                  <Text style={[s.meta, { color: C.danger }]}>
                    ⚠️ {l.overdue_days} day{l.overdue_days !== 1 ? 's' : ''} overdue
                  </Text>
                )}
              </View>
              <Badge label="Return Pending" color={C.warning} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Btn
                label="✓ Verify"
                variant="success"
                onPress={() => handleVerifyReturn(l.id)}
                style={{ flex: 1, paddingVertical: 7 }}
              />
              <Btn
                label="✕ Reject"
                variant="danger"
                onPress={() => handleRejectReturn(l.id)}
                style={{ flex: 1, paddingVertical: 7 }}
              />
            </View>
          </Card>
        ))}

        {/* ── Active loans ── */}
        {active.length > 0 && (
          <Text style={s.groupLabel}>ACTIVE ({active.length})</Text>
        )}
        {active.map((l) => (
          <Card key={l.id}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{l.book_title ?? '—'}</Text>
                <Text style={s.meta}>Member: {l.member_name ?? l.member}</Text>
                <Text style={[s.meta, l.is_overdue && { color: C.danger, fontWeight: '700' }]}>
                  Due: {l.due_date ?? '—'}
                  {l.is_overdue ? `  ·  ${l.overdue_days}d overdue` : ''}
                </Text>
              </View>
              <Badge
                label={l.is_overdue ? 'Overdue' : 'Active'}
                color={l.is_overdue ? C.danger : C.primary}
              />
            </View>
          </Card>
        ))}

        {/* ── Returned ── */}
        {returned.length > 0 && (
          <Text style={s.groupLabel}>RETURNED ({returned.length})</Text>
        )}
        {returned.map((l) => (
          <Card key={l.id} style={{ opacity: 0.7 }}>
            <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{l.book_title ?? '—'}</Text>
                <Text style={s.meta}>Member: {l.member_name ?? l.member}</Text>
                <Text style={s.meta}>
                  Returned: {l.return_verified_date ?? '—'}
                </Text>
              </View>
              <Badge label="Returned" color={C.success} />
            </View>
          </Card>
        ))}

        {loans.length === 0 && <Empty text="No loans yet." />}
      </ScrollView>

      {/* Issue direct loan modal */}
      <Modal visible={modal} animationType="slide" transparent onRequestClose={() => setModal(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Issue Walk-in Loan</Text>
            <Text style={s.sheetSub}>For members present at the desk without a borrow request.</Text>
            <Input
              label="Member ID *"
              value={form.member}
              onChangeText={(v) => setForm({ ...form, member: v })}
              keyboardType="numeric"
              placeholder="User ID"
            />
            <Input
              label="Book ID *"
              value={form.book}
              onChangeText={(v) => setForm({ ...form, book: v })}
              keyboardType="numeric"
              placeholder="Book ID"
            />
            <View style={s.modalBtns}>
              <Btn label="Cancel" variant="ghost" onPress={() => setModal(false)} style={{ flex: 1 }} />
              <Btn label="Issue Loan" onPress={handleCreate} loading={saving} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: C.bg },
  inner:      { padding: 16, paddingBottom: 40 },
  groupLabel: { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 6, marginTop: 10 },
  row:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title:      { color: C.text, fontWeight: '700', fontSize: 14 },
  meta:       { color: C.sub, fontSize: 12, marginTop: 2 },
  overlay:    { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: C.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, borderWidth: 1, borderColor: C.border },
  sheetTitle: { color: C.text, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  sheetSub:   { color: C.muted, fontSize: 12, marginBottom: 14 },
  modalBtns:  { flexDirection: 'row', gap: 10, marginTop: 6 },
});