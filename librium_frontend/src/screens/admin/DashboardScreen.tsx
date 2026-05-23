// admin/DashboardScreen.tsx
import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  RefreshControl, TouchableOpacity, useWindowDimensions, Platform
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getDashboard } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Loading } from '../../components/UI';
import { AdminStackParamList } from '../../navigation/AppNavigator';
import SidebarLayout from '../../components/SidebarLayout';

type Props = {
  navigation: NativeStackNavigationProp<AdminStackParamList, 'Dashboard'>;
};

type ActivityEntry = {
  type:   'loan' | 'return' | 'fine' | 'request';
  label:  string;
  member: string;
  book:   string;
  date:   string | null;
};

type Stats = {
  total_books?:             number;
  available_books?:         number;
  active_loans?:            number;
  overdue_loans?:           number;
  active_reservations?:     number;
  pending_borrow_requests?: number;
  unpaid_fines_total?:      number;
  total_members?:           number;
  pending_returns?:         number;
  recent_activity?:         ActivityEntry[];
};

// ── Classic Library Palette ────────────────────────────────────
const P = {
  mahogany:     '#412D15',
  espresso:     '#1F150C',
  oxblood:      '#541A1A',
  amber:        '#F69D39',
  brass:        '#FFC85C',
  tangerine:    '#FF9D00',
  burntOrange:  '#FF7D29',
  parchment:    '#FBF5DD',
  parchmentDark:'#EFE9CE',
  pureWhite:    '#FFFFFF',
  textMain:     '#2D1F10',
  textMuted:    '#706251',
  success:      '#3D5A45', 
  danger:       '#8A2B2B', 
};

const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif' });

const ACTIVITY_META: Record<string, { icon: string; color: string }> = {
  loan:    { icon: 'book-outline',              color: P.mahogany },
  return:  { icon: 'checkmark-circle-outline', color: P.success },
  fine:    { icon: 'cash-outline',             color: P.danger   },
  request: { icon: 'hand-left-outline',        color: P.burntOrange },
};

function chunk<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size));
  return rows;
}

function StatCard({
  label, value, icon, accent = P.mahogany, onPress, cardBg = P.parchmentDark, accentText = '#000', labelColor = '#000', showBottomTag = false, tagText = ''
}: {
  label: string; value?: number | string; icon: string;
  accent?: string; onPress?: () => void; cardBg?: string; accentText?: string; labelColor?: string; showBottomTag?: boolean; tagText?: string;
}) {
  return (
    <TouchableOpacity
      style={[s.statCard, { backgroundColor: cardBg }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.72 : 1}
      disabled={!onPress}
    >
      <View style={s.statRow}>
        <View style={{ flex: 1 }}>
          <Text style={[s.statCardHeaderLabel, { color: labelColor }]}>{label}</Text>
          <Text style={[s.statVal, { color: accentText }]}>
            {value !== undefined && value !== null ? value : '0'}
          </Text>
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

function QuickTile({ label, icon, onPress }: {
  label: string; icon: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={s.tile} onPress={onPress} activeOpacity={0.75}>
      <View style={s.tileIconCircle}>
        <Ionicons name={icon as any} size={18} color={P.mahogany} />
      </View>
      <Text style={s.tileLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function ActivityRow({ item, last }: { item: ActivityEntry; last: boolean }) {
  const meta    = ACTIVITY_META[item.type] ?? ACTIVITY_META.loan;
  const dateStr = item.date
    ? new Date(item.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
    : '—';
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

/* ── Inline Row Component for Secondary Statistics Ledger ── */
function LedgerStatRow({ label, value, icon, color, last, onPress }: {
  label: string; value: string | number; icon: string; color: string; last?: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[s.ledgerRow, !last && s.ledgerBorder]} onPress={onPress} activeOpacity={0.7}>
      <View style={s.ledgerLeft}>
        <Ionicons name={icon as any} size={16} color={color} style={s.ledgerIcon} />
        <Text style={s.ledgerLabel}>{label}</Text>
      </View>
      <View style={s.ledgerRight}>
        <Text style={[s.ledgerValue, { color: color }]}>{value}</Text>
        <Ionicons name="chevron-forward" size={14} color={P.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

export default function DashboardScreen({ navigation }: Props) {
  const { signOut }                 = useAuth();
  const { width }                   = useWindowDimensions();
  const [stats, setStats]           = useState<Stats | null>(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { setStats(await getDashboard()); }
    catch (e) { console.warn('Dashboard error', e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));
  if (loading) return <Loading />;

  const nav = (screen: keyof AdminStackParamList) => () => navigation.navigate(screen);

  const isDesktop = width > 768;
  const tileCols = width >= 1024 ? 5 : width >= 640 ? 5 : 4;

  const activity   = stats?.recent_activity ?? [];
  const tileRows   = chunk([...quickLinks], tileCols);

  const maxContent = 1200;
  const contentStyle = width > maxContent
    ? { maxWidth: maxContent, alignSelf: 'center' as const, width: '100%' as any }
    : {};

  // Formatted display values for our secondary ledger block
  const unpaidFinesDisplay = stats?.unpaid_fines_total !== undefined 
    ? `₱${Number(stats.unpaid_fines_total).toLocaleString('en-PH')}` 
    : '₱0';

  return (
    <SidebarLayout>
      <ScrollView
        style={s.root}
        contentContainerStyle={s.inner}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={P.tangerine}
          />
        }
      >
        {!isDesktop && (
          <View style={s.headerOuter}>
            <View style={[s.header, contentStyle]}>
              <View style={s.headerLeft}>
                <View style={s.logoWrap}>
                  <Ionicons name="library" size={18} color={P.brass} />
                </View>
                <View>
                  <Text style={s.appName}>Librium</Text>
                </View>
              </View>
              <TouchableOpacity style={s.logoutBtn} onPress={signOut}>
                <Ionicons name="log-out-outline" size={14} color={P.brass} />
                <Text style={s.logoutTxt}>Leave</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={[contentStyle, { paddingTop: isDesktop ? 24 : 0 }]}>
          <View style={s.mainTitleWrap}>
            <Text style={s.mainDashboardTitle}>Library Dashboard</Text>
          </View>

          {/* ── Visual Aligned Stat Grid ── */}
          <View style={s.cardFlexContainer}>
            <StatCard
              label="Active Loans"
              value={stats?.active_loans}
              icon="swap-horizontal"
              accent={P.brass}
              cardBg="transparent"
              accentText="#000"
              labelColor={P.textMain}
              showBottomTag={true}
              tagText="#FFC85C"
              onPress={nav('Loans')}
            />
            <StatCard
              label="Total Books"
              value={stats?.total_books}
              icon="book"
              accent={P.tangerine}
              cardBg="#1F150C"
              accentText="#fff"
              labelColor={P.parchmentDark}
              showBottomTag={true}
              tagText="#FF9D00"
              onPress={nav('Books')}
            />
            <StatCard
              label="Pending Requests"
              value={stats?.pending_borrow_requests}
              icon="hand-left"
              accent={P.burntOrange}
              cardBg="transparent"
              accentText="#000"
              labelColor={P.textMain}
              showBottomTag={true}
              tagText="#FF7D29"
              onPress={nav('BorrowRequests')}
            />
          </View>

          {/* ── Quick Actions ── */}
          <Text style={s.sectionLabel}>ARCHIVE ACTIONS</Text>
          <View style={s.panel}>
            <View style={s.panelHeader}>
              <Ionicons name="compass" size={14} color={P.brass} />
              <Text style={s.panelHeaderTxt}>Management Desks</Text>
            </View>
            <View style={s.gridInPanel}>
              {tileRows.map((row, ri) => (
                <View key={ri} style={[s.gridRow, { gap: 8 }]}>
                  {row.map(({ label, screen, icon }) => (
                    <QuickTile
                      key={screen}
                      label={label}
                      icon={icon}
                      onPress={nav(screen as keyof AdminStackParamList)}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>

          {/* ── Transaction Table ── */}
          <Text style={s.sectionLabel}>CIRCULATION LEDGER</Text>
          <View style={s.panel}>
            <View style={s.panelHeader}>
              <Ionicons name="journal" size={14} color={P.brass} />
              <Text style={s.panelHeaderTxt}>Loads</Text>
            </View>
            {activity.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={s.emptyTxt}>0</Text>
                <Text style={s.emptySubTxt}>No Loans</Text>
              </View>
            ) : (
              activity.map((item, idx) => (
                <ActivityRow key={idx} item={item} last={idx === activity.length - 1} />
              ))
            )}
          </View>

          {/* ── Secondary Archive Inventory & Ledger Statistics ── */}
          <Text style={s.sectionLabel}>INVENTORY & ACCOUNTS BALANCE</Text>
          <View style={s.panel}>
            <View style={s.panelHeader}>
              <Ionicons name="analytics" size={14} color={P.brass} />
              <Text style={s.panelHeaderTxt}>Secondary Indexes</Text>
            </View>
            <View style={s.ledgerContainer}>
              <LedgerStatRow 
                label="Available Books" 
                value={stats?.available_books ?? 0} 
                icon="checkmark-circle-outline" 
                color={P.success} 
                onPress={nav('Books')} 
              />
              <LedgerStatRow 
                label="Overdue Item Loans" 
                value={stats?.overdue_loans ?? 0} 
                icon="alert-circle-outline" 
                color={P.danger} 
                onPress={nav('Loans')} 
              />
              <LedgerStatRow 
                label="Pending Active Returns" 
                value={stats?.pending_returns ?? 0} 
                icon="return-down-back-outline" 
                color={P.amber} 
                onPress={nav('Loans')} 
              />
              <LedgerStatRow 
                label="Active Priority Reservations" 
                value={stats?.active_reservations ?? 0} 
                icon="bookmark-outline" 
                color={P.mahogany} 
                onPress={nav('Reservations')} 
              />
              <LedgerStatRow 
                label="Unpaid Account Fines" 
                value={unpaidFinesDisplay} 
                icon="cash-outline" 
                color={P.danger} 
                onPress={nav('Fines')} 
              />
              <LedgerStatRow 
                label="Registered Matrix Members" 
                value={stats?.total_members ?? 0} 
                icon="people-outline" 
                color={P.textMuted} 
                last={true}
                onPress={nav('Members')} 
              />
            </View>
          </View>

        </View>
      </ScrollView>
    </SidebarLayout>
  );
}

const quickLinks = [
  { label: 'Books',           screen: 'Books',          icon: 'book-outline'      },
  { label: 'Borrow Requests', screen: 'BorrowRequests', icon: 'hand-left-outline' },
  { label: 'Loans',           screen: 'Loans',          icon: 'receipt-outline'   },
  { label: 'Reservations',    screen: 'Reservations',   icon: 'bookmark-outline'  },
  { label: 'Fines',           screen: 'Fines',          icon: 'cash-outline'      },
  { label: 'Members',         screen: 'Members',        icon: 'people-outline'    },
  { label: 'Authors',         screen: 'Authors',        icon: 'person-outline'    },
  { label: 'Categories',      screen: 'Categories',     icon: 'pricetag-outline'  },
  { label: 'Departments',     screen: 'Departments',    icon: 'business-outline'  },
  { label: 'Semesters',       screen: 'Semesters',      icon: 'calendar-outline'  },
];

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: P.parchment },
  inner: { paddingBottom: 48 },

  headerOuter: { backgroundColor: P.espresso, borderBottomWidth: 1, borderBottomColor: P.mahogany },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 14 },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoWrap:    { width: 32, height: 32, borderRadius: 4, backgroundColor: P.mahogany, alignItems: 'center', justifyContent: 'center' },
  appName:     { color: P.parchment, fontSize: 18, fontWeight: '700', fontFamily: SERIF_FONT },
  logoutBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: P.mahogany, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4 },
  logoutTxt:   { color: P.brass, fontSize: 11, fontWeight: '600' },

  mainTitleWrap: { paddingHorizontal: 16, marginTop: 20, marginBottom: 16 },
  mainDashboardTitle: { fontSize: 28, fontWeight: '700', fontFamily: SERIF_FONT, color: P.espresso },

  cardFlexContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12, marginBottom: 16 },
  statCard:     { flex: 1, minWidth: 200, borderRadius: 8, padding: 16, borderWidth: 1, borderColor: 'rgba(41,29,21,0.15)', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' },
  statRow:      { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 },
  statCardHeaderLabel: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize', opacity: 0.8 },
  statVal:      { fontSize: 36, fontWeight: '700', fontFamily: SERIF_FONT, marginTop: 4 },
  statIconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  statBottomTag: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingVertical: 4, alignItems: 'center' },
  statBottomTagText: { fontSize: 10, fontWeight: '700', color: '#1F150C', letterSpacing: 0.5 },

  sectionLabel: { color: P.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginTop: 24, marginBottom: 8, marginHorizontal: 16 },
  gridRow:     { flexDirection: 'row', gap: 10 },
  gridInPanel: { padding: 12, gap: 8 },

  panel:          { marginHorizontal: 16, backgroundColor: P.pureWhite, borderRadius: 6, borderWidth: 1, borderColor: P.parchmentDark, overflow: 'hidden', marginBottom: 12 },
  panelHeader:    { backgroundColor: P.espresso, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  panelHeaderTxt: { color: P.parchment, fontSize: 13, fontWeight: '600', fontFamily: SERIF_FONT },

  tile:           { flex: 1, alignItems: 'center', paddingVertical: 14, backgroundColor: P.parchment, borderRadius: 6, borderWidth: 1, borderColor: P.parchmentDark },
  tileIconCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: P.pureWhite, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  tileLabel:      { color: P.textMain, fontSize: 11, fontWeight: '600', textAlign: 'center' },

  actRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  actBorder: { borderBottomWidth: 1, borderBottomColor: P.parchment },
  actIcon:   { width: 30, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  actLabel:  { color: P.textMain, fontSize: 13, fontWeight: '600' },
  actMeta:   { color: P.textMuted, fontSize: 12, marginTop: 2 },
  actDate:   { color: P.textMuted, fontSize: 11, fontFamily: SERIF_FONT },

  emptyState:{ alignItems: 'center', paddingVertical: 40 },
  emptyTxt:  { color: P.espresso, fontSize: 32, fontWeight: '700', fontFamily: SERIF_FONT },
  emptySubTxt: { color: P.textMuted, fontSize: 12, marginTop: 2 },

  // Ledger item custom styles
  ledgerContainer: { paddingVertical: 4 },
  ledgerRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  ledgerBorder:    { borderBottomWidth: 1, borderBottomColor: P.parchment },
  ledgerLeft:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ledgerIcon:      { width: 20, textAlign: 'center' },
  ledgerLabel:     { color: P.textMain, fontSize: 13, fontWeight: '600' },
  ledgerRight:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ledgerValue:     { fontSize: 15, fontWeight: '700', fontFamily: SERIF_FONT },
});