// admin/DashboardScreen.tsx
import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, TouchableOpacity, useWindowDimensions, Platform
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAutoRefreshOnFocus } from '../../hooks/useAutoRefreshOnFocus';
import { Ionicons } from '@expo/vector-icons';
import { getDashboard } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Loading } from '../../components/UI';
import { AdminStackParamList } from '../../navigation/AppNavigator';

type Props = { navigation: NativeStackNavigationProp<AdminStackParamList, 'Dashboard'>; };
type ActivityEntry = { type: 'loan' | 'return' | 'fine' | 'request'; label: string; member: string; book: string; date: string | null; };
type Stats = {
  total_books?: number; available_books?: number; active_loans?: number; overdue_loans?: number;
  active_reservations?: number; pending_borrow_requests?: number; unpaid_fines_total?: number;
  total_members?: number; pending_returns?: number; recent_activity?: ActivityEntry[];
};

const P = {
  mahogany: '#412D15', espresso: '#1F150C', oxblood: '#541A1A', amber: '#F69D39', brass: '#FFC85C',
  tangerine: '#FF9D00', burntOrange: '#FF7D29', parchment: '#FBF5DD', parchmentDark: '#EFE9CE',
  pureWhite: '#FFFFFF', textMain: '#2D1F10', textMuted: '#706251', success: '#3D5A45', danger: '#8A2B2B',
};

const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });
const DISPLAY_FONT = 'Literata-Bold';

const ACTIVITY_META: Record<string, { icon: string; color: string }> = {
  loan: { icon: 'book-outline', color: P.mahogany }, return: { icon: 'checkmark-circle-outline', color: P.success },
  fine: { icon: 'cash-outline', color: P.danger }, request: { icon: 'hand-left-outline', color: P.burntOrange },
};

function chunk<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size));
  return rows;
}

function StatCard({
  label, value, icon, accent = P.mahogany, onPress, cardBg = P.parchmentDark, accentText = '#000', labelColor = '#000', showBottomTag = false, tagText = ''
}: {
  label: string; value?: number | string; icon: string; accent?: string; onPress?: () => void; cardBg?: string;
  accentText?: string; labelColor?: string; showBottomTag?: boolean; tagText?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <TouchableOpacity
      style={[s.statCard, { backgroundColor: cardBg }, hovered && s.statCardHover]}
      onPress={onPress} activeOpacity={onPress ? 0.72 : 1} disabled={!onPress}
      {...(Platform.OS === 'web' && onPress ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } : {})}
    >
      <View style={s.statRow}>
        <View style={{ flex: 1 }}>
          <Text style={[s.statCardHeaderLabel, { color: labelColor }]}>{label}</Text>
          <Text style={[s.statVal, { color: accentText }]}>{value ?? '0'}</Text>
        </View>
        <View style={[s.statIconWrap, { backgroundColor: 'rgba(0,0,0,0.05)' }]}>
          <Ionicons name={icon as any} size={18} color={accentText === '#fff' ? P.brass : P.mahogany} />
        </View>
      </View>
      {showBottomTag && (
        <View style={[s.statBottomTag, { backgroundColor: accent }]}>
          <Text style={s.statBottomTagText}>{tagText}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function QuickTile({ label, icon, count, onPress }: { label: string; icon: string; count?: number; onPress: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <TouchableOpacity
      style={[s.tile, hovered && s.tileHover]} onPress={onPress} activeOpacity={0.75}
      {...(Platform.OS === 'web' ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } : {})}
    >
      {!!count && (
        <View style={s.tileBadge}>
          <Text style={s.tileBadgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
      <View style={s.tileIconCircle}>
        <Ionicons name={icon as any} size={18} color={P.mahogany} />
      </View>
      <Text style={s.tileLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActivityRow({ item, last }: { item: ActivityEntry; last: boolean }) {
  const meta = ACTIVITY_META[item.type] ?? ACTIVITY_META.loan;
  const dateStr = item.date ? new Date(item.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }) : '—';
  return (
    <View style={[s.actRow, !last && s.actBorder]}>
      <View style={[s.actIcon, { backgroundColor: meta.color + '15' }]}>
        <Ionicons name={meta.icon as any} size={14} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.actLabel}>{item.label}</Text>
        <Text style={s.actMeta} numberOfLines={1}>{item.member} · {item.book}</Text>
      </View>
      <Text style={s.actDate}>{dateStr}</Text>
    </View>
  );
}

function LedgerStatRow({ label, value, icon, color, last, onPress }: {
  label: string; value: string | number; icon: string; color: string; last?: boolean; onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <TouchableOpacity
      style={[s.ledgerRow, hovered && s.ledgerHover, !last && s.ledgerBorder]} onPress={onPress} activeOpacity={0.7}
      {...(Platform.OS === 'web' ? { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) } : {})}
    >
      <View style={s.ledgerLeft}>
        <Ionicons name={icon as any} size={16} color={color} style={s.ledgerIcon} />
        <Text style={s.ledgerLabel}>{label}</Text>
      </View>
      <View style={s.ledgerRight}>
        <Text style={[s.ledgerValue, { color }]}>{value}</Text>
        <Ionicons name="chevron-forward" size={14} color={P.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

export default function DashboardScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setStats(await getDashboard()); } catch (e) {  } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useAutoRefreshOnFocus(load);
  if (loading) return <Loading />;

  const nav = (screen: keyof AdminStackParamList) => () => navigation.navigate(screen);
  const isDesktop = width > 768;
  const tileCols = width >= 1024 ? 5 : width >= 640 ? 5 : 4;

  const quickLinks = [
    { label: 'Books',           screen: 'Books',          icon: 'book-outline',      count: undefined },
    { label: 'Borrow Requests', screen: 'BorrowRequests', icon: 'hand-left-outline', count: stats?.pending_borrow_requests },
    { label: 'Loans',           screen: 'Loans',          icon: 'receipt-outline',   count: stats?.overdue_loans },
    { label: 'Reservations',    screen: 'Reservations',   icon: 'bookmark-outline',  count: stats?.active_reservations },
    { label: 'Fines',           screen: 'Fines',          icon: 'cash-outline',      count: undefined },
    { label: 'Members',         screen: 'Members',        icon: 'people-outline',    count: undefined },
    { label: 'Authors',         screen: 'Authors',        icon: 'person-outline',    count: undefined },
    { label: 'Categories',      screen: 'Categories',     icon: 'pricetag-outline',  count: undefined },
    { label: 'Departments',     screen: 'Departments',    icon: 'business-outline',  count: undefined },
    { label: 'Semesters',       screen: 'Semesters',      icon: 'calendar-outline',  count: undefined },
  ];

  const activity   = stats?.recent_activity ?? [];
  const tileRows   = chunk(quickLinks, tileCols);
  const contentStyle = width > 1200 ? { maxWidth: 1200, alignSelf: 'center' as const, width: '100%' as any } : {};
  const unpaidFinesDisplay = stats?.unpaid_fines_total !== undefined ? `₱${Number(stats.unpaid_fines_total).toLocaleString('en-PH')}` : '₱0';
  const formattedDate = new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <ScrollView
      style={s.root} contentContainerStyle={[s.inner, { paddingTop: isDesktop ? 24 : 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={P.tangerine} />}
    >
      <View style={contentStyle}>
        <View style={s.mainTitleWrap}>
          <Text style={s.welcomeText}>Hello, {user?.full_name || 'Administrator'}</Text>
          <Text style={s.dateText}>{formattedDate}</Text>
          <Text style={s.mainDashboardTitle}>Library Dashboard</Text>
        </View>

        {/* ── Top stat cards — Balanced 4-card matrix layout ── */}
        <View style={s.cardFlexContainer}>
          <StatCard
            label="Active Loans"    value={stats?.active_loans}
            icon="swap-horizontal"  accent={P.brass}        cardBg="#FCFAEE"
            accentText="#000"       labelColor={P.textMain}
            showBottomTag tagText="ACTIVE LOANS"
            onPress={nav('Loans')}
          />
          <StatCard
            label="Total Books"     value={stats?.total_books}
            icon="book"             accent={P.tangerine}    cardBg="#1F150C"
            accentText="#fff"       labelColor={P.parchmentDark}
            showBottomTag tagText="ALL BOOKS"
            onPress={nav('Books')}
          />
          <StatCard
            label="Borrow Requests" value={stats?.pending_borrow_requests}
            icon="hand-left"        accent={P.burntOrange}  cardBg="#FCFAEE"
            accentText="#000"       labelColor={P.textMain}
            showBottomTag tagText="BORROW REQUESTS"
            onPress={nav('BorrowRequests')}
          />
          <StatCard
            label="Pending Returns" value={stats?.pending_returns}
            icon="return-down-back" accent={P.amber}        cardBg="#1F150C"
            accentText="#fff"       labelColor={P.parchmentDark}
            showBottomTag tagText="PENDING RETURNS"
            onPress={nav('Loans')}
          />
        </View>

        <Text style={s.sectionLabel}>QUICK ACTIONS</Text>
        <View style={s.panel}>
          <View style={s.panelHeader}>
            <Ionicons name="compass" size={14} color={P.brass} />
            <Text style={s.panelHeaderTxt}>Management Desks</Text>
          </View>
          <View style={s.gridInPanel}>
            {tileRows.map((row, ri) => (
              <View key={ri} style={[s.gridRow, { gap: 8 }]}>
                {row.map(({ label, screen, icon, count }) => (
                  <QuickTile key={screen} label={label} icon={icon} count={count} onPress={nav(screen as keyof AdminStackParamList)} />
                ))}
              </View>
            ))}
          </View>
        </View>

        <Text style={s.sectionLabel}>RECENT ACTIVITIES</Text>
        <View style={s.panel}>
          <View style={s.panelHeader}>
            <Ionicons name="journal" size={14} color={P.brass} />
            <Text style={s.panelHeaderTxt}>Recents</Text>
          </View>
          {activity.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={s.emptyTxt}>0</Text>
              <Text style={s.emptySubTxt}>No recent activity</Text>
            </View>
          ) : (
            activity.map((item, idx) => <ActivityRow key={idx} item={item} last={idx === activity.length - 1} />)
          )}
        </View>

        <Text style={s.sectionLabel}>MORE QUICK ACTIONS</Text>
        <View style={s.panel}>
          <View style={s.panelHeader}>
            <Ionicons name="analytics" size={14} color={P.brass} />
            <Text style={s.panelHeaderTxt}>Secondary Quick Actions</Text>
          </View>
          <View style={s.ledgerContainer}>
            <LedgerStatRow label="Available Books"              value={stats?.available_books ?? 0}   icon="checkmark-circle-outline" color={P.success}   onPress={nav('Books')} />
            <LedgerStatRow label="Active Priority Reservations" value={stats?.active_reservations ?? 0} icon="bookmark-outline"        color={P.mahogany}  onPress={nav('Reservations')} />
            <LedgerStatRow label="Unpaid Account Fines"         value={unpaidFinesDisplay}            icon="cash-outline"             color={P.danger}    onPress={nav('Fines')} />
            <LedgerStatRow label="Overdue Library Loans"        value={stats?.overdue_loans ?? 0}     icon="alert-circle-outline"     color={P.danger}    onPress={nav('Loans')} />
            <LedgerStatRow label="Registered Borrowers"         value={stats?.total_members ?? 0}     icon="people-outline"           color={P.textMuted} last onPress={nav('Members')} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FCFAEE' },
  inner: { paddingBottom: 48 },
  mainTitleWrap: { paddingHorizontal: 16, marginBottom: 16 },
  welcomeText: { fontSize: 14, fontWeight: '600', color: P.textMuted },
  dateText: { fontSize: 11, fontWeight: '500', color: P.textMuted, opacity: 0.8, marginBottom: 6, marginTop: 1 },
  mainDashboardTitle: { fontSize: 28, fontFamily: DISPLAY_FONT, color: P.espresso },
  cardFlexContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12, marginBottom: 16 },
  statCard: { flex: 1, minWidth: 160, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: 'rgba(41,29,21,0.15)', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' },
  statCardHover: { transform: [{ translateY: -4 }], shadowColor: '#2D1F10', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4 },
  statRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  statCardHeaderLabel: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize', opacity: 0.8 },
  statVal: { fontSize: 36, fontWeight: '700', fontFamily: SERIF_FONT, marginTop: 4 },
  statIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  statBottomTag: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 4, alignItems: 'center' },
  statBottomTagText: { fontSize: 10, fontWeight: '700', color: '#1F150C', letterSpacing: 0.5 },
  sectionLabel: { color: P.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 24, marginBottom: 8, marginHorizontal: 16 },
  gridRow: { flexDirection: 'row', gap: 10 },
  gridInPanel: { padding: 12, gap: 8 },
  panel: { marginHorizontal: 16, backgroundColor: P.pureWhite, borderRadius: 6, borderWidth: 1, borderColor: P.parchmentDark, overflow: 'hidden', marginBottom: 12 },
  panelHeader: { backgroundColor: P.espresso, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  panelHeaderTxt: { color: P.parchment, fontSize: 13, fontWeight: '600', fontFamily: SERIF_FONT },
  tile: { flex: 1, alignItems: 'center', paddingVertical: 14, backgroundColor: P.parchment, borderRadius: 6, borderWidth: 1, borderColor: P.parchmentDark, position: 'relative' },
  tileHover: { backgroundColor: P.parchmentDark, borderColor: P.mahogany },
  tileIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: P.pureWhite, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  tileLabel: { color: P.textMain, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  tileBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: P.danger, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  tileBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
  actRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  actBorder: { borderBottomWidth: 1, borderBottomColor: P.brass },
  actIcon: { width: 30, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  actLabel: { color: P.textMain, fontSize: 13, fontWeight: '600' },
  actMeta: { color: P.textMuted, fontSize: 12, marginTop: 2 },
  actDate: { color: P.textMuted, fontSize: 11, fontFamily: SERIF_FONT },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyTxt: { color: P.espresso, fontSize: 32, fontWeight: '700', fontFamily: SERIF_FONT },
  emptySubTxt: { color: P.textMuted, fontSize: 12, marginTop: 2 },
  ledgerContainer: { paddingVertical: 4 },
  ledgerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  ledgerHover: { backgroundColor: '#FBF5DD' },
  ledgerBorder: { borderBottomWidth: 1, borderBottomColor: P.brass },
  ledgerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ledgerIcon: { width: 20, textAlign: 'center' },
  ledgerLabel: { color: P.textMain, fontSize: 13, fontWeight: '600' },
  ledgerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ledgerValue: { fontSize: 15, fontWeight: '700', fontFamily: SERIF_FONT },
});