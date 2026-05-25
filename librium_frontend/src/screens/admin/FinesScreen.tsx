import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, Alert, Platform, useWindowDimensions, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getFines, payFine } from '../../services/api';
import { Empty, Loading } from '../../components/UI';

const P = {
  mahogany: '#412D15',
  espresso: '#1F150C',
  amber: '#F69D39',
  brass: '#FFC85C',
  parchment: '#FBF5DD',
  parchmentDark: '#EFE9CE',
  pureWhite: '#FFFFFF',
  textMain: '#2D1F10',
  textMuted: '#706251',
  success: '#3D5A45',
  danger: '#8A2B2B',
};

const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });

type Fine = {
  id: number;
  amount: string;
  member_name?: string;
  member: number;
  loan: number;
  reason?: string;
  paid: boolean;
  paid_at?: string;
};

export default function FinesScreen() {
  const { width } = useWindowDimensions();
  const [fines, setFines] = useState<Fine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await getFines();
      setFines(data.results ?? data);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handlePay = (id: number, amount: string) => {
    const title = 'Mark as Paid';
    const msg = `Mark ₱${parseFloat(amount).toFixed(2)} fine as paid?`;

    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${msg}`)) {
        executePay(id);
      }
    } else {
      Alert.alert(title, msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Paid', onPress: () => executePay(id) },
      ]);
    }
  };

  const executePay = async (id: number) => {
    try {
      await payFine(id);
      load();
    } catch (e: any) {
      const errorMsg = e?.data ? JSON.stringify(e.data) : 'Could not update record.';
      if (Platform.OS === 'web') {
        window.alert(`Error: ${errorMsg}`);
      } else {
        Alert.alert('Error', errorMsg);
      }
    }
  };

  const unpaid = fines.filter(f => !f.paid);
  const paid = fines.filter(f => f.paid);

  if (loading) return <Loading />;

  const isDesktop = width > 768;
  const contentStyle = width > 1200 ? { maxWidth: 1200, alignSelf: 'center' as const, width: '100%' as any } : {};

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.inner, { paddingTop: isDesktop ? 24 : 16 }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor={P.danger}
        />
      }
    >
      <View style={contentStyle}>
        <View style={s.mainTitleWrap}>
          <Text style={s.mainDashboardTitle}>Accounts & Fines</Text>
          <Text style={s.dateText}>Ledger Balances ({fines.length})</Text>
        </View>

        {unpaid.length > 0 && (
          <>
            <Text style={s.sectionLabel}>OUTSTANDING UNPAID BALANCES</Text>
            <View style={s.panel}>
              <View style={[s.panelHeader, { backgroundColor: P.danger }]}>
                <Ionicons name="alert-circle" size={14} color={P.brass} />
                <Text style={s.panelHeaderTxt}>Arrears Register</Text>
              </View>
              {unpaid.map((f, idx) => (
                <View key={f.id} style={[s.actRow, idx !== unpaid.length - 1 && s.actBorder]}>
                  <View style={[s.actIcon, { backgroundColor: P.danger + '15' }]}>
                    <Ionicons name="cash-outline" size={14} color={P.danger} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.amount}>₱{parseFloat(f.amount).toFixed(2)}</Text>
                    <Text style={s.actMeta} numberOfLines={1}>
                      Member: {f.member_name || f.member} · Loan Reference: #{f.loan}
                    </Text>
                    {f.reason && <Text style={[s.actMeta, { fontStyle: 'italic' }]} numberOfLines={1}>Reason: {f.reason}</Text>}
                  </View>
                  <TouchableOpacity style={s.actionBtn} activeOpacity={0.7} onPress={() => handlePay(f.id, f.amount)}>
                    <Text style={s.actionBtnTxt}>Mark Paid</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        )}

        {paid.length > 0 && (
          <>
            <Text style={s.sectionLabel}>SETTLED ACCOUNTS</Text>
            <View style={s.panel}>
              <View style={[s.panelHeader, { backgroundColor: P.espresso }]}>
                <Ionicons name="checkmark-circle" size={14} color={P.brass} />
                <Text style={s.panelHeaderTxt}>Cleared Ledger Entries</Text>
              </View>
              {paid.map((f, idx) => (
                <View key={f.id} style={[s.actRow, idx !== paid.length - 1 && s.actBorder, { opacity: 0.75 }]}>
                  <View style={[s.actIcon, { backgroundColor: P.success + '15' }]}>
                    <Ionicons name="ribbon-outline" size={14} color={P.success} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.amount, { color: P.success }]}>₱{parseFloat(f.amount).toFixed(2)}</Text>
                    <Text style={s.actMeta} numberOfLines={1}>
                      Member: {f.member_name || f.member} · Reference: #{f.id}
                    </Text>
                  </View>
                  <View style={s.statusBadge}>
                    <Text style={s.statusText}>SETTLED: {f.paid_at ? new Date(f.paid_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : '—'}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {fines.length === 0 && <Empty text="No fines on record." />}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FCFAEE' },
  inner: { paddingBottom: 48 },

  mainTitleWrap: { paddingHorizontal: 16, marginBottom: 16 },
  dateText: { fontSize: 13, fontWeight: '600', color: P.textMuted, marginTop: 2 },
  mainDashboardTitle: { fontSize: 28, fontWeight: '700', fontFamily: SERIF_FONT, color: P.espresso },

  sectionLabel: { color: P.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 12, marginBottom: 8, marginHorizontal: 16 },
  panel: { marginHorizontal: 16, backgroundColor: P.pureWhite, borderRadius: 6, borderWidth: 1, borderColor: P.parchmentDark, overflow: 'hidden', marginBottom: 12 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  panelHeaderTxt: { color: P.parchment, fontSize: 13, fontWeight: '600', fontFamily: SERIF_FONT },

  actRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  actBorder: { borderBottomWidth: 1, borderBottomColor: P.brass },
  actIcon: { width: 32, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  amount: { color: P.danger, fontWeight: '800', fontSize: 16, fontFamily: SERIF_FONT },
  actMeta: { color: P.textMuted, fontSize: 12, marginTop: 2 },

  actionBtn: { backgroundColor: P.success, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4 },
  actionBtnTxt: { color: P.pureWhite, fontSize: 11, fontWeight: '700' },
  statusBadge: { backgroundColor: '#EAF2EC', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4 },
  statusText: { fontSize: 10, fontWeight: '700', color: P.success, letterSpacing: 0.3 },
});