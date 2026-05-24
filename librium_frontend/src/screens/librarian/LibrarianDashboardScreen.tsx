// screens/librarian/LibrarianDashboardScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, RefreshControl, useWindowDimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { getDashboard } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Card, Loading } from '../../components/UI';
import SidebarLayout from '../../components/SidebarLayout';
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

const QUICK_ACTIONS = [
  { label: 'Borrow Requests', screen: 'LibrarianBorrowRequests', icon: 'clipboard' as const, color: '#D97706', bg: '#FEF3C7' },
  { label: 'Issue Loan',      screen: 'LibrarianLoans',          icon: 'book-open' as const, color: '#281711', bg: '#EFECE6' },
  { label: 'Returns Verification', screen: 'LibrarianLoans',     icon: 'corner-down-left' as const, color: '#137333', bg: '#E6F4EA' },
  { label: 'Fines Tracking',  screen: 'LibrarianFines',          icon: 'dollar-sign' as const, color: '#A83232', bg: '#FCE8E6' },
  { label: 'Books Catalog',   screen: 'LibrarianBooks',          icon: 'layers' as const, color: '#7C3AED', bg: '#EDE9FE' },
  { label: 'Members Directory', screen: 'LibrarianMembers',        icon: 'users' as const, color: '#0369A1', bg: '#E0F2FE' },
  { label: 'Reservations Ledger', screen: 'LibrarianReservations', icon: 'bookmark' as const, color: '#BE185D', bg: '#FCE7F3' },
] as const;

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

  const statCards = [
    { label: 'Total Volumes', value: stats?.total_books, icon: 'book' as const, color: '#7C3AED', border: '#DDD6FE' },
    { label: 'Available Stacks', value: stats?.available_books, icon: 'check-circle' as const, color: '#137333', border: '#B7DFC4' },
    { label: 'Active Circulation', value: stats?.active_loans, icon: 'activity' as const, color: '#281711', border: '#DCD4C4' },
    { label: 'Overdue Excursions', value: stats?.overdue_loans, icon: 'alert-triangle' as const, color: '#A83232', border: '#F5C2BC' },
    { label: 'Pending Requests', value: stats?.pending_borrow_requests, icon: 'git-pull-request' as const, color: '#D97706', border: '#FCD34D' },
    { label: 'Pending Returns', value: stats?.pending_returns, icon: 'refresh-cw' as const, color: '#C2410C', border: '#FFD8A8' },
    { label: 'Unresolved Fines', value: stats?.unpaid_fines, icon: 'frown' as const, color: '#B45309', border: '#FDE68A' },
    { label: 'Active Reservations', value: stats?.active_reservations, icon: 'tag' as const, color: '#0369A1', border: '#BAE6FD' },
  ];

  // Grid sizing helpers
  const statCols = width > 1024 ? 4 : width > 600 ? 2 : 1;
  const actionCols = width > 1024 ? 4 : width > 768 ? 3 : width > 480 ? 2 : 1;
  const gap = 14;

  return (
    <SidebarLayout currentScreen="Dashboard">
      <View style={s.root}>
        <ScrollView
          contentContainerStyle={[s.inner, { padding: width > 768 ? 24 : 16 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#281711" />
          }
        >
          {/* ── Document Structural Header ── */}
          <View style={s.headerContainer}>
            <View>
              <Text style={s.greetingText}>SYSTEM WORKSPACE ARCHIVE</Text>
              <Text style={s.nameTitle}>Salutations, {user?.full_name ?? user?.email}</Text>
            </View>
            <View style={s.badgeContainer}>
              <Feather name="shield" size={12} color="#706251" style={{ marginRight: 5 }} />
              <Text style={s.badgeText}>LIBRARIAN CONSOLE</Text>
            </View>
          </View>

          {/* ── Urgent System Alerts Banner Matrix ── */}
          {((stats?.overdue_loans ?? 0) > 0 || (stats?.pending_borrow_requests ?? 0) > 0) && (
            <View style={s.alertSectionStack}>
              {(stats?.overdue_loans ?? 0) > 0 && (
                <TouchableOpacity style={[s.alertBanner, s.dangerAlert]} activeOpacity={0.8} onPress={() => navigation.navigate('LibrarianLoans')}>
                  <View style={s.alertIconContext}>
                    <Feather name="alert-circle" size={14} color="#A83232" />
                    <Text style={s.dangerAlertTxt}>
                      Attention Required: {stats?.overdue_loans} volumes logged as overdue. Review outstanding obligations.
                    </Text>
                  </View>
                  <Feather name="arrow-right" size={13} color="#A83232" />
                </TouchableOpacity>
              )}

              {(stats?.pending_borrow_requests ?? 0) > 0 && (
                <TouchableOpacity style={[s.alertBanner, s.warningAlert]} activeOpacity={0.8} onPress={() => navigation.navigate('LibrarianBorrowRequests')}>
                  <View style={s.alertIconContext}>
                    <Feather name="file-text" size={14} color="#B45309" />
                    <Text style={s.warningAlertTxt}>
                      Pending Verification: {stats?.pending_borrow_requests} borrow workflows awaiting programmatic authorization.
                    </Text>
                  </View>
                  <Feather name="arrow-right" size={13} color="#B45309" />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* ── Metric Registry Grid Section ── */}
          <Text style={s.sectionTitle}>ARCHIVAL DATA REGISTRY</Text>
          <View style={s.gridContainer}>
            {statCards.map((card) => {
              const cardW = `calc(${100 / statCols}% - ${(gap * (statCols - 1)) / statCols}px)` as any;
              return (
                <Card key={card.label} style={{ ...s.statCard, width: cardW }}>
                  <View style={s.statCardHeader}>
                    <Text style={s.statLabel}>{card.label.toUpperCase()}</Text>
                    <View style={[s.iconBox, { borderColor: card.border }]}>
                      <Feather name={card.icon} size={12} color={card.color} />
                    </View>
                  </View>
                  <Text style={[s.statValue, { color: card.color }]}>{card.value ?? 0}</Text>
                </Card>
              );
            })}
          </View>

          {/* ── System Core Action Routing Array ── */}
          <Text style={[s.sectionTitle, { marginTop: 28 }]}>ADMINISTRATIVE QUICK ACTIONS</Text>
          <View style={s.gridContainer}>
            {QUICK_ACTIONS.map((a) => {
              const actionW = `calc(${100 / actionCols}% - ${(gap * (actionCols - 1)) / actionCols}px)` as any;
              return (
                <TouchableOpacity
                  key={a.label}
                  style={[s.actionBtn, { width: actionW }]}
                  onPress={() => navigation.navigate(a.screen as any)}
                  activeOpacity={0.7}
                >
                  <View style={[s.actionIconBlock, { backgroundColor: a.bg }]}>
                    <Feather name={a.icon} size={16} color={a.color} />
                  </View>
                  <View style={s.actionTextFrame}>
                    <Text style={s.actionLabel}>{a.label}</Text>
                    <Text style={s.actionSubLabel}>Launch Registry →</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

        </ScrollView>
      </View>
    </SidebarLayout>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#ECE7D1' },
  inner: { paddingBottom: 60 },

  // Header Typography Formats
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderColor: '#DCD4C4',
    paddingBottom: 20,
  },
  greetingText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#706251',
  },
  nameTitle: {
    color: '#281711',
    fontSize: 22,
    fontFamily: Fonts.baskervilleBold,
    marginTop: 4,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F1EA',
    borderWidth: 1,
    borderColor: '#DCD4C4',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '700',
    color: '#513E2F',
    letterSpacing: 0.5,
  },

  // Alert Arrays 
  alertSectionStack: {
    gap: 10,
    marginBottom: 24,
  },
  alertBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
  },
  alertIconContext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  dangerAlert: {
    backgroundColor: '#FCE8E6',
    borderColor: '#F5C2BC',
  },
  dangerAlertTxt: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#A83232',
    fontWeight: '600',
    flex: 1,
  },
  warningAlert: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  warningAlertTxt: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#B45309',
    fontWeight: '600',
    flex: 1,
  },

  // Matrix Layout Grid Controls
  sectionTitle: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#513E2F',
    marginBottom: 12,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    width: '100%',
  },

  // Stat Card Structural Blueprint
  statCard: {
    backgroundColor: '#FFFDF1',
    borderWidth: 1,
    borderColor: '#412D15',
    borderRadius: 0,
    padding: 16,
    minWidth: 220,
    flexGrow: 1,
  },
  statCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#706251',
  },
  iconBox: {
    borderWidth: 1,
    padding: 4,
    backgroundColor: '#FFFFFF',
  },
  statValue: {
    fontFamily: Fonts.baskervilleBold,
    fontSize: 28,
    fontWeight: '700',
  },

  // Operational System Triggers Button Block
  actionBtn: {
    backgroundColor: '#FFFDF1',
    borderWidth: 1,
    borderColor: '#412D15',
    borderRadius: 0,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 240,
    flexGrow: 1,
  },
  actionIconBlock: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: '#412D15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextFrame: {
    flex: 1,
  },
  actionLabel: {
    fontFamily: Fonts.baskervilleBold,
    fontSize: 14,
    color: '#281711',
    fontWeight: '600',
  },
  actionSubLabel: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: '#A1927F',
    marginTop: 2,
    fontWeight: '500',
  },
});