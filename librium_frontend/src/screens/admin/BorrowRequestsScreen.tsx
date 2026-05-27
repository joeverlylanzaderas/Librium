// screens/admin/BorrowRequestsScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  RefreshControl, 
  Alert, 
  TouchableOpacity, 
  useWindowDimensions, 
  Platform 
} from 'react-native';
import { useAlert } from '../../components/AlertProvider';
import { getBorrowRequests, approveBorrowRequest, rejectBorrowRequest, normalizePaginated } from '../../services/api';
import { Card, Btn, Badge, Empty, Loading, C } from '../../components/UI';
import SidebarLayout from '../../components/SidebarLayout';

const DISPLAY_FONT = 'LibreBaskerville-Bold';

const STATUS_COLOR: Record<string, string> = {
  pending:   C.warning,
  approved:  C.success,
  rejected:  C.danger,
  cancelled: C.muted,
};

type BorrowRequest = {
  id: number;
  book_title?: string;
  member_name?: string;
  member: number;
  request_date: string;
  status: string;
  notes?: string;
};

const FILTERS = ['pending', 'approved', 'rejected', 'cancelled'] as const;
type Filter = typeof FILTERS[number];

export default function BorrowRequestsScreen() {
  const [requests, setRequests]     = useState<BorrowRequest[]>([]);
  const [filter, setFilter]         = useState<Filter>('pending');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { width } = useWindowDimensions();
  const { showConfirm } = useAlert();

  const isDesktop = width > 768;

  const load = async () => {
    try {
      const data = await getBorrowRequests(filter);
      setRequests(normalizePaginated(data));
    } catch (e) { 
      
    } finally { 
      setLoading(false); 
      setRefreshing(false); 
    }
  };

  useEffect(() => { 
    setLoading(true); 
    load(); 
  }, [filter]);

  const approve = (id: number) => {
    showConfirm('Approve Request', 'Confirm the book was handed to the member?', async () => {
      try { 
        await approveBorrowRequest(id); 
        load(); 
      } catch (e: any) { 
        Alert.alert('Error', JSON.stringify(e.data || e.message)); 
      }
    }, { confirmText: 'Approve', cancelText: 'Cancel' });
  };

  const reject = (id: number) => {
    showConfirm('Reject Request', 'Reject this borrow request?', async () => {
      try { 
        await rejectBorrowRequest(id); 
        load(); 
      } catch (e: any) { 
        Alert.alert('Error', JSON.stringify(e.data || e.message)); 
      }
    }, { confirmText: 'Reject', cancelText: 'Cancel' });
  };

  return (
      <View style={s.root}>
        <View style={s.tabsContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.tabsScroll}
          >
            {FILTERS.map((f) => {
              const isActive = filter === f;
              return (
                <TouchableOpacity
                  key={f}
                  activeOpacity={0.7}
                  onPress={() => setFilter(f)}
                  style={[
                    s.toggleContainer,
                    isActive ? s.toggleActive : s.toggleInactive
                  ]}
                >
                  <Text style={[
                    s.toggleText,
                    { color: isActive ? '#FBF5DD' : '#2D1F10' }
                  ]}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {loading ? <Loading /> : (
          <ScrollView
            contentContainerStyle={[s.inner, isDesktop && s.innerDesktop]}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={() => { setRefreshing(true); load(); }} 
                tintColor={C.primary} 
              />
            }
          >
            {/* Custom section header utilizing LibreBaskerville display typography directly */}
            <View style={s.sectionHeaderWrap}>
              <Text style={s.sectionHeaderTitle}>
                {`${filter.charAt(0).toUpperCase() + filter.slice(1)} Requests`}
              </Text>
              <View style={s.countBadge}>
                <Text style={s.countBadgeText}>{requests.length}</Text>
              </View>
            </View>
            
            {requests.length === 0 && <Empty text={`No ${filter} requests.`} />}
            
            <View style={[s.grid, isDesktop && s.gridDesktop]}>
              {requests.map((r) => (
                <View key={r.id} style={[s.cardWrapper, isDesktop && s.cardWrapperDesktop]}>
                  <Card style={s.customCard}>
                    <View style={s.row}>
                      <View style={s.cardInfoBody}>
                        <Text style={s.title}>{r.book_title}</Text>
                        <Text style={s.meta}>Member: <Text style={s.highlight}>{r.member_name || r.member}</Text></Text>
                        <Text style={s.meta}>Requested: {new Date(r.request_date).toLocaleDateString()}</Text>
                        {r.notes && (
                          <View style={s.notesContainer}>
                            <Text style={s.notesText}>Notes: {r.notes}</Text>
                          </View>
                        )}
                      </View>
                      <Badge label={r.status.toUpperCase()} color={STATUS_COLOR[r.status] ?? C.muted} />
                    </View>
                    
                    {r.status === 'pending' && (
                      <View style={s.actions}>
                        <Btn 
                          label="Approve" 
                          variant="success" 
                          onPress={() => approve(r.id)} 
                          style={s.actionBtn} 
                        />
                        <Btn 
                          label="Reject"  
                          variant="danger"  
                          onPress={() => reject(r.id)}  
                          style={s.actionBtn} 
                        />
                      </View>
                    )}
                  </Card>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
  );
}

const s = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: '#FBF5DD' 
  },
  tabsContainer: {
    backgroundColor: '#1F150C',
    borderBottomWidth: 1,
    borderBottomColor: '#412D15',
  },
  tabsScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 4,
    borderWidth: 1,
  },
  toggleActive: {
    backgroundColor: '#412D15',
    borderColor: '#FFC85C',
  },
  toggleInactive: {
    backgroundColor: '#FBF5DD',
    borderColor: '#EFE9CE',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  inner: { 
    padding: 16, 
    paddingBottom: 40 
  },
  innerDesktop: {
    padding: 24,
  },
  sectionHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE9CE',
  },
  sectionHeaderTitle: {
    fontFamily: DISPLAY_FONT,
    fontSize: 20,
    color: '#1F150C',
  },
  countBadge: {
    backgroundColor: '#412D15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  countBadgeText: {
    color: '#FBF5DD',
    fontSize: 12,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  gridDesktop: {
    marginHorizontal: -12,
  },
  cardWrapper: {
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  cardWrapperDesktop: {
    width: '50%',
    paddingHorizontal: 12,
    marginBottom: 24,
  },
  customCard: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    borderColor: '#EFE9CE',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#1F150C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  row: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    gap: 12 
  },
  cardInfoBody: { 
    flex: 1 
  },
  title: { 
    color: '#1F150C', 
    fontWeight: '700', 
    fontSize: 15,
    marginBottom: 6,
    lineHeight: 20
  },
  meta: { 
    color: '#706251', 
    fontSize: 12, 
    marginTop: 3,
    fontWeight: '500'
  },
  highlight: {
    color: '#2D1F10',
    fontWeight: '600'
  },
  notesContainer: {
    backgroundColor: 'rgba(239, 233, 206, 0.3)',
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#706251',
  },
  notesText: {
    color: '#706251',
    fontSize: 12,
    fontStyle: 'italic',
  },
  actions: { 
    flexDirection: 'row', 
    gap: 10, 
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#EFE9CE',
    paddingTop: 12
  },
  actionBtn: { 
    flex: 1, 
    height: 38,
    borderRadius: 6
  },
});