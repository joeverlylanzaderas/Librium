// screens/librarian/LibrarianDashboardScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, useWindowDimensions, Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { getDashboard } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Card, Loading } from '../../components/UI';
import { Fonts } from '../../constants/theme';
import { LibrarianStackParamList } from '../../navigation/AppNavigator';

type Nav = NativeStackNavigationProp<LibrarianStackParamList>;

type Stats = {
  total_books:             number;
  available_books:         number;
  active_loans:            number;
  overdue_loans:           number;
  pending_borrow_requests: number;
  pending_returns:         number;
  unpaid_fines:            number;
  unpaid_fines_total:      number;
  active_reservations:     number;
  total_members:           number;
};

const P = {
  mahogany: '#412D15', espresso: '#1F150C', oxblood: '#541A1A', amber: '#F69D39', brass: '#FFC85C',
  tangerine: '#FF9D00', burntOrange: '#FF7D29', parchment: '#FBF5DD', parchmentDark: '#EFE9CE',
  pureWhite: '#FFFFFF', textMain: '#2D1F10', textMuted: '#706251', success: '#3D5A45', danger: '#8A2B2B',
};

const SERIF = Platform.select({ ios: 'Georgia', android: 'serif' });
const DISPLAY = 'Literata-Bold';

const QUICK_ACTIONS = [
  { label: 'Borrow Requests',      screen: 'LibrarianBorrowRequests', icon: 'clipboard' as const,        color: P.amber   },
  { label: 'Issue Loan',           screen: 'LibrarianLoans',          icon: 'book-open' as const,         color: P.mahogany },
  { label: 'Returns Verification', screen: 'LibrarianLoans',          icon: 'corner-down-left' as const,  color: P.success  },
  { label: 'Fines Tracking',       screen: 'LibrarianFines',          icon: 'dollar-sign' as const,       color: P.danger   },
  { label: 'Books Catalog',        screen: 'LibrarianBooks',          icon: 'layers' as const,            color: '#7C3AED'  },
  { label: 'Members Directory',    screen: 'LibrarianMembers',        icon: 'users' as const,             color: '#0369A1'  },
  { label: 'Reservations Ledger',  screen: 'LibrarianReservations',   icon: 'bookmark' as const,          color: '#BE185D'  },
] as const;

function QuickTile({ label, icon, color, count, onPress }: {
  label: string; icon: any; color: string; count?: number; onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <TouchableOpacity
      style={[s.tile, hovered && s.tileHover]} onPress={onPress} activeOpacity={0.75}
      {...(Platform.OS === 'web' ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } : {})}
    >
      {!!count && (
        <View style={s.tileBadge}><Text style={s.tileBadgeText}>{count > 99 ? '99+' : count}</Text></View>
      )}
      <View style={s.tileIconCircle}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text style={s.tileLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function LedgerRow({ label, value, icon, color, last, onPress }: {
  label: string; value: string | number; icon: any; color: string; last?: boolean; onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <TouchableOpacity
      style={[s.ledgerRow, hovered && s.ledgerHover, !last && s.ledgerBorder]} onPress={onPress} activeOpacity={0.7}
      {...(Platform.OS === 'web' ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } : {})}
    >
      <View style={s.ledgerLeft}>
        <Feather name={icon} size={15} color={color} style={{ width: 20 }} />
        <Text style={s.ledgerLabel}>{label}</Text>
      </View>
      <View style={s.ledgerRight}>
        <Text style={[s.ledgerValue, { color }]}>{value}</Text>
        <Feather name="chevron-right" size={13} color={P.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

export default function LibrarianDashboardScreen() {
  const { width } = useWindowDimensions();
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getDashboard();
      setStats(data);
    } catch (e) {
      console.error('Operational metrics architecture failure:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading />;

  const isDesktop = width > 768;
  const tileCols  = width >= 640 ? 4 : 4; // always 4-col grid for 7 actions (last row partial)
  const pad = isDesktop ? 16 : 16;
  const contentStyle = width > 1200 ? { maxWidth: 1200, alignSelf: 'center' as const, width: '100%' as any } : {};
  const formattedDate = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={[s.inner, { paddingTop: isDesktop ? 24 : 16 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={P.tangerine} />
      }
    >
      <View style={contentStyle}>

        {/* ── Header ── */}
        <View style={s.headerWrap}>
          <Text style={s.welcomeText}>Hello, {user?.full_name ?? user?.email}</Text>
          <Text style={s.dateText}>{formattedDate}</Text>
          <Text style={s.dashTitle}>Librarian Dashboard</Text>
        </View>

        {/* ── Hero Stat Cards ── */}
        <View style={s.heroRow}>
          <TouchableOpacity style={[s.heroCard, { backgroundColor: '#FCFAEE' }]} onPress={() => navigation.navigate('LibrarianLoans')} activeOpacity={0.8}>
            <View style={s.heroInner}>
              <View style={{ flex: 1 }}>
                <Text style={[s.heroCardLabel, { color: P.textMain }]}>Active Loans</Text>
                <Text style={[s.heroVal, { color: P.espresso }]}>{stats?.active_loans ?? 0}</Text>
              </View>
              <View style={s.heroIconWrap}><Feather name="activity" size={18} color={P.mahogany} /></View>
            </View>
            <View style={[s.heroTag, { backgroundColor: P.brass }]}>
              <Text style={s.heroTagText}>CIRCULATION</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[s.heroCard, { backgroundColor: P.espresso }]} onPress={() => navigation.navigate('LibrarianBooks')} activeOpacity={0.8}>
            <View style={s.heroInner}>
              <View style={{ flex: 1 }}>
                <Text style={[s.heroCardLabel, { color: P.parchmentDark }]}>Total Books</Text>
                <Text style={[s.heroVal, { color: P.pureWhite }]}>{stats?.total_books ?? 0}</Text>
              </View>
              <View style={s.heroIconWrap}><Feather name="book" size={18} color={P.brass} /></View>
            </View>
            <View style={[s.heroTag, { backgroundColor: P.tangerine }]}>
              <Text style={s.heroTagText}>ALL VOLUMES</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[s.heroCard, { backgroundColor: '#FCFAEE' }]} onPress={() => navigation.navigate('LibrarianBorrowRequests')} activeOpacity={0.8}>
            <View style={s.heroInner}>
              <View style={{ flex: 1 }}>
                <Text style={[s.heroCardLabel, { color: P.textMain }]}>Pending Requests</Text>
                <Text style={[s.heroVal, { color: P.espresso }]}>{stats?.pending_borrow_requests ?? 0}</Text>
              </View>
              <View style={s.heroIconWrap}><Feather name="clipboard" size={18} color={P.mahogany} /></View>
            </View>
            <View style={[s.heroTag, { backgroundColor: P.burntOrange }]}>
              <Text style={s.heroTagText}>BORROW REQUESTS</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Alerts ── */}
        {((stats?.overdue_loans ?? 0) > 0 || (stats?.pending_borrow_requests ?? 0) > 0) && (
          <View style={{ paddingHorizontal: pad, gap: 8, marginBottom: 8 }}>
            {(stats?.overdue_loans ?? 0) > 0 && (
              <TouchableOpacity style={[s.alert, s.alertDanger]} onPress={() => navigation.navigate('LibrarianLoans')} activeOpacity={0.8}>
                <Feather name="alert-circle" size={13} color={P.danger} />
                <Text style={[s.alertText, { color: P.danger }]} numberOfLines={1}>
                  {stats?.overdue_loans} overdue volumes need review
                </Text>
                <Feather name="chevron-right" size={13} color={P.danger} />
              </TouchableOpacity>
            )}
            {(stats?.pending_borrow_requests ?? 0) > 0 && (
              <TouchableOpacity style={[s.alert, s.alertWarn]} onPress={() => navigation.navigate('LibrarianBorrowRequests')} activeOpacity={0.8}>
                <Feather name="file-text" size={13} color="#B45309" />
                <Text style={[s.alertText, { color: '#B45309' }]} numberOfLines={1}>
                  {stats?.pending_borrow_requests} borrow requests awaiting approval
                </Text>
                <Feather name="chevron-right" size={13} color="#B45309" />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Quick Actions ── */}
        <Text style={s.sectionLabel}>QUICK ACTIONS</Text>
        <View style={s.panel}>
          <View style={s.panelHeader}>
            <Feather name="zap" size={13} color={P.brass} />
            <Text style={s.panelHeaderTxt}>Management Desks</Text>
          </View>
          <View style={s.tileGrid}>
            {QUICK_ACTIONS.map((a) => (
              <QuickTile
                key={a.label} label={a.label} icon={a.icon} color={a.color}
                count={a.screen === 'LibrarianBorrowRequests' ? stats?.pending_borrow_requests : a.screen === 'LibrarianLoans' ? (stats?.overdue_loans || undefined) : undefined}
                onPress={() => navigation.navigate(a.screen as any)}
              />
            ))}
          </View>
        </View>

        {/* ── Secondary Stats Ledger ── */}
        <Text style={s.sectionLabel}>OVERVIEW</Text>
        <View style={s.panel}>
          <View style={s.panelHeader}>
            <Feather name="bar-chart-2" size={13} color={P.brass} />
            <Text style={s.panelHeaderTxt}>Metrics</Text>
          </View>
          <View style={{ paddingVertical: 4 }}>
            <LedgerRow label="Available Books"       value={stats?.available_books ?? 0}   icon="check-circle"    color={P.success}    onPress={() => navigation.navigate('LibrarianBooks')} />
            <LedgerRow label="Overdue Loans"         value={stats?.overdue_loans ?? 0}      icon="alert-triangle"  color={P.danger}     onPress={() => navigation.navigate('LibrarianLoans')} />
            <LedgerRow label="Pending Returns"       value={stats?.pending_returns ?? 0}    icon="refresh-cw"      color={P.amber}      onPress={() => navigation.navigate('LibrarianLoans')} />
            <LedgerRow label="Active Reservations"   value={stats?.active_reservations ?? 0} icon="bookmark"       color={P.mahogany}   onPress={() => navigation.navigate('LibrarianReservations')} />
            <LedgerRow label="Unresolved Fines"      value={stats?.unpaid_fines ?? 0}       icon="dollar-sign"     color={P.danger}     onPress={() => navigation.navigate('LibrarianFines')} />
            <LedgerRow label="Total Members"         value={stats?.total_members ?? 0}      icon="users"           color={P.textMuted}  last onPress={() => navigation.navigate('LibrarianMembers')} />
          </View>
        </View>

      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#FCFAEE' },
  inner: { paddingBottom: 60 },

  headerWrap:  { paddingHorizontal: 16, marginBottom: 16 },
  welcomeText: { fontSize: 14, fontWeight: '600', color: P.textMuted },
  dateText:    { fontSize: 11, color: P.textMuted, opacity: 0.8, marginTop: 1, marginBottom: 6 },
  dashTitle:   { fontSize: 28, fontFamily: DISPLAY, color: P.espresso },

  // Hero cards
  heroRow:      { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12, marginBottom: 16 },
  heroCard:     { flex: 1, minWidth: 180, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(41,29,21,0.15)', overflow: 'hidden', justifyContent: 'space-between' },
  heroInner:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 16, marginBottom: 16 },
  heroCardLabel:{ fontSize: 12, fontWeight: '600', opacity: 0.8 },
  heroVal:      { fontSize: 36, fontWeight: '700', fontFamily: SERIF, marginTop: 4 },
  heroIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  heroTag:      { paddingVertical: 5, alignItems: 'center' },
  heroTagText:  { fontSize: 10, fontWeight: '700', color: P.espresso, letterSpacing: 0.5 },

  // Alerts
  alert:       { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderWidth: 1, borderRadius: 4 },
  alertDanger: { backgroundColor: '#FDF0EF', borderColor: '#F5C2BC' },
  alertWarn:   { backgroundColor: '#FFFBEB', borderColor: '#FCD34D' },
  alertText:   { fontFamily: Fonts.sans, fontSize: 12, fontWeight: '600', flex: 1 },

  sectionLabel: { color: P.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 20, marginBottom: 8, marginHorizontal: 16 },

  // Panel
  panel:         { marginHorizontal: 16, backgroundColor: P.pureWhite, borderRadius: 6, borderWidth: 1, borderColor: P.parchmentDark, overflow: 'hidden', marginBottom: 12 },
  panelHeader:   { backgroundColor: P.espresso, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  panelHeaderTxt:{ color: P.parchment, fontSize: 13, fontWeight: '600', fontFamily: SERIF },

  // Tiles
  tileGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 },
  tile:           { width: '22%', flexGrow: 1, alignItems: 'center', paddingVertical: 14, backgroundColor: P.parchment, borderRadius: 6, borderWidth: 1, borderColor: P.parchmentDark, position: 'relative' },
  tileHover:      { backgroundColor: P.parchmentDark, borderColor: P.mahogany },
  tileIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: P.pureWhite, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  tileLabel:      { color: P.textMain, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  tileBadge:      { position: 'absolute', top: 6, right: 6, backgroundColor: P.danger, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  tileBadgeText:  { color: '#FFF', fontSize: 9, fontWeight: '800' },

  // Ledger rows
  ledgerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  ledgerHover: { backgroundColor: P.parchment },
  ledgerBorder:{ borderBottomWidth: 1, borderBottomColor: P.brass },
  ledgerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ledgerLabel: { color: P.textMain, fontSize: 13, fontWeight: '600' },
  ledgerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ledgerValue: { fontSize: 15, fontWeight: '700', fontFamily: SERIF },
});