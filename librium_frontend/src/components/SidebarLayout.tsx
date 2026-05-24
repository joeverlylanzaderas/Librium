// components/SidebarLayout.tsx
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  useWindowDimensions, 
  Platform, 
  ScrollView 
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

const DISPLAY_FONT = 'LibreBaskerville-Bold';
const P = {
  espresso:      '#1F150C',
  mahogany:      '#412D15',
  parchment:     '#FBF5DD',
  parchmentDark: '#EFE9CE',
  brass:         '#FFC85C',
  amber:         '#F69D39',
  textMain:      '#2D1F10',
  textMuted:     '#706251',
};

const BORROWER_MENU = [
  { type: 'item', name: 'Dashboard',    screen: 'BorrowerHome',         icon: 'grid-outline' },
  { type: 'item', name: 'My Loans',     screen: 'BorrowerLoans',        icon: 'book-outline' },
  { type: 'item', name: 'Requests',     screen: 'BorrowerRequests',     icon: 'time-outline' },
  { type: 'item', name: 'Reservations', screen: 'BorrowerReservations', icon: 'bookmark-outline' },
  { type: 'item', name: 'Fines',        screen: 'BorrowerFines',        icon: 'cash-outline' },
  { type: 'item', name: 'Profile',      screen: 'BorrowerProfile',      icon: 'person-outline' },
];

const LIBRARIAN_MENU = [
  { type: 'item', name: 'Dashboard',    screen: 'LibrarianDashboard',      icon: 'grid-outline' },
  
  { type: 'header', name: 'Operations' },
  { type: 'item', name: 'Requests',     screen: 'LibrarianBorrowRequests', icon: 'time-outline' },
  { type: 'item', name: 'Loans',        screen: 'LibrarianLoans',          icon: 'journal-outline' },
  { type: 'item', name: 'Reservations', screen: 'LibrarianReservations',   icon: 'bookmark-outline' },
  { type: 'item', name: 'Fines',        screen: 'LibrarianFines',          icon: 'cash-outline' },
  
  { type: 'header', name: 'Management' },
  { type: 'item', name: 'Books',        screen: 'LibrarianBooks',          icon: 'book-outline' },
  { type: 'item', name: 'Members',      screen: 'LibrarianMembers',        icon: 'person-outline' },
];

const ADMIN_MENU = [
  { type: 'item',   name: 'Dashboard',    screen: 'Dashboard',    icon: 'grid-outline' },
  
  { type: 'header', name: 'User' },
  { type: 'item',   name: 'Users',        screen: 'Members',      icon: 'person-outline' },
  
  { type: 'header', name: 'Library' },
  { type: 'item',   name: 'Books',        screen: 'Books',        icon: 'book-outline' },
  { type: 'item',   name: 'Authors',      screen: 'Authors',      icon: 'create-outline' },
  { type: 'item',   name: 'Categories',   screen: 'Categories',   icon: 'pricetag-outline' },
  { type: 'item',   name: 'Departments',  screen: 'Departments',  icon: 'business-outline' },
  { type: 'item',   name: 'Semesters',    screen: 'Semesters',    icon: 'calendar-outline' },
  { type: 'item',   name: 'Loans',        screen: 'Loans',        icon: 'journal-outline' },
  { type: 'item',   name: 'Reservations', screen: 'Reservations', icon: 'bookmark-outline' },
  { type: 'item',   name: 'Fines',        screen: 'Fines',        icon: 'cash-outline' },
];

interface SidebarLayoutProps {
  children: React.ReactNode;
  currentScreen?: string;
}

export default function SidebarLayout({ children, currentScreen }: SidebarLayoutProps) {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { width } = useWindowDimensions();
  const { user, signOut } = useAuth();
  
  const isDesktop = width > 768; 
  const [isCollapsed, setIsCollapsed] = useState(!isDesktop);

  const getMenuItems = () => {
    switch (user?.role) {
      case 'admin': return ADMIN_MENU;
      case 'librarian': return LIBRARIAN_MENU;
      default: return BORROWER_MENU;
    }
  };

  const menuItems = getMenuItems();

  const getCurrentPageTitle = () => {
    if (currentScreen) return currentScreen;
    const allItems = [...BORROWER_MENU, ...LIBRARIAN_MENU, ...ADMIN_MENU];
    const currentItem = allItems.find(item => item.screen === route.name);
    return currentItem?.name || route.name || 'Dashboard';
  };

  const handleNavigation = (screenName: string) => {
    navigation.navigate(screenName);
    if (!isDesktop) setIsCollapsed(true);
  };

  const handleBrandingPress = () => {
    const target = user?.role === 'admin' ? 'Dashboard' : user?.role === 'librarian' ? 'LibrarianDashboard' : 'BorrowerHome';
    handleNavigation(target);
  };

  const handleProfilePress = () => {
    navigation.navigate(user?.role === 'admin' ? 'Profile' : user?.role === 'librarian' ? 'LibrarianDashboard' : 'BorrowerProfile');
  };

  const renderSidebar = () => {
    if (!isDesktop && isCollapsed) return null;
    const showFullUI = !isCollapsed || !isDesktop;

    return (
      <View style={[
        s.sidebar, 
        isDesktop ? (isCollapsed ? s.sidebarCollapsed : s.sidebarExpanded) : s.sidebarFloatingMobile
      ]}>
        
        <TouchableOpacity 
          style={s.brandingContainer} 
          onPress={handleBrandingPress}
          activeOpacity={0.7}
        >
          <View style={s.brandingLogoWrap}>
            <Ionicons name="library" size={22} color={P.parchment} />
          </View>
          {showFullUI && <Text style={s.brandingLogoText}>Librium</Text>}
        </TouchableOpacity>

        <View style={s.brandingSeparator} />

        {isDesktop && (
          <TouchableOpacity 
            style={s.toggleBtn} 
            onPress={() => setIsCollapsed(!isCollapsed)}
            activeOpacity={0.65}
          >
            <Ionicons 
              name={isCollapsed ? "chevron-forward-outline" : "chevron-back-outline"} 
              size={16} 
              color={P.parchmentDark} 
            />
            {!isCollapsed && <Text style={s.toggleText}>Collapse Menu</Text>}
          </TouchableOpacity>
        )}

        <ScrollView 
          style={s.menuList} 
          contentContainerStyle={s.menuListContent}
          showsVerticalScrollIndicator={false}
        >
          {menuItems.map((item, index) => {
            if (item.type === 'header') {
              if (!showFullUI) return <View key={`hr-${index}`} style={s.menuHeaderDivider} />;
              return (
                <Text key={`sub-${index}`} style={s.menuSectionHeader}>
                  {item.name}
                </Text>
              );
            }

            const isActive = route.name === item.screen || currentScreen === item.name;

            return (
              <TouchableOpacity
                key={item.screen}
                style={[s.menuItem, isActive ? s.menuItemActive : s.menuItemHoverable]}
                onPress={() => item.screen && handleNavigation(item.screen)}
                activeOpacity={0.65}
              >
                <Ionicons 
                  name={item.icon as any} 
                  size={20} 
                  color={isActive ? P.espresso : P.parchmentDark} 
                  style={s.menuIconFix}
                />
                {showFullUI && (
                  <Text 
                    style={[s.menuLabel, isActive && s.menuLabelActive]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={s.container}>
      <View style={s.topBar}>
        <View style={s.topBarLeft}>
          {!isDesktop && (
            <TouchableOpacity 
              style={s.hamburgerBtn} 
              onPress={() => setIsCollapsed(!isCollapsed)}
              activeOpacity={0.65}
            >
              <Ionicons name={isCollapsed ? "menu-outline" : "close-outline"} size={28} color={P.parchment} />
            </TouchableOpacity>
          )}
          <Text style={[s.topBarTitle, { fontSize: isDesktop ? 22 : 17 }]} numberOfLines={1}>
            {getCurrentPageTitle()}
          </Text>
        </View>

        <View style={s.topBarRight}>
          <TouchableOpacity 
            style={s.userInfoBlock} 
            onPress={handleProfilePress}
            activeOpacity={0.7}
          >
            <View style={s.avatarContainer}>
              <Ionicons name="person-outline" size={16} color={P.espresso} />
            </View>
            {isDesktop && (
              <Text style={s.userFullNameText} numberOfLines={1}>
                {user?.full_name || 'Guest User'}
              </Text>
            )}
            <View style={[s.roleBadge, user?.role === 'admin' ? s.roleAdmin : s.roleBorrower]}>
              <Text style={s.roleText}>{user?.role?.toUpperCase() || 'USER'}</Text>
            </View>
          </TouchableOpacity>

          <View style={s.topBarDivider} />

          <TouchableOpacity style={s.logoutBtn} onPress={signOut} activeOpacity={0.65}>
            <Ionicons name="log-out-outline" size={20} color={P.brass} />
            {isDesktop && <Text style={s.logoutText}>Logout</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.workspace}>
        {renderSidebar()}

        {!isDesktop && !isCollapsed && (
          <TouchableOpacity 
            style={s.backdrop} 
            activeOpacity={1} 
            onPress={() => setIsCollapsed(true)} 
          />
        )}

        <View style={s.mainContent}>
          {children}
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.parchment },
  workspace: { flex: 1, flexDirection: 'row', position: 'relative' },
  
  topBar: {
    height: 70,
    backgroundColor: P.espresso,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: P.mahogany,
    zIndex: 110,
  },
  topBarLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginRight: 8,
  },
  hamburgerBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 4,
  },
  topBarTitle: {
    fontFamily: DISPLAY_FONT,
    color: P.parchment,
    flex: 1,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userInfoBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: P.parchmentDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userFullNameText: {
    color: P.parchmentDark,
    fontSize: 14,
    fontWeight: '600',
    maxWidth: 140,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  roleAdmin: { backgroundColor: P.brass },
  roleBorrower: { backgroundColor: 'rgba(255,255,255,0.2)' },
  roleText: {
    fontSize: 9,
    fontWeight: '800',
    color: P.espresso,
    letterSpacing: 0.6,
  },
  topBarDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  logoutText: {
    color: P.brass,
    fontSize: 14,
    fontWeight: '600',
  },

  sidebar: {
    backgroundColor: P.espresso,
    borderRightWidth: 1,
    borderRightColor: P.mahogany,
    zIndex: 100,
  },
  brandingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 24,
    marginBottom: 12,
    ...Platform.select({ web: { cursor: 'pointer' }, default: {} })
  },
  brandingLogoWrap: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  brandingLogoText: {
    fontSize: 22,
    fontFamily: DISPLAY_FONT,
    color: P.parchment,
  },
  brandingSeparator: {
    height: 1,
    backgroundColor: P.mahogany,
    marginHorizontal: 12,
    marginBottom: 10,
  },
  sidebarExpanded: { width: 270 },
  sidebarCollapsed: { width: 78, alignItems: 'center' },
  
  sidebarFloatingMobile: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 270,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 99,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    marginBottom: 10,
    width: '100%',
  },
  toggleText: { color: P.parchmentDark, fontSize: 12, fontWeight: '600' },
  
  menuList: Platform.select({
    web: {
      flex: 1,
      width: '100%',
      /* @ts-ignore */
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    },
    default: { flex: 1, width: '100%' }
  }),
  menuListContent: { 
    paddingHorizontal: 12, 
    paddingBottom: 24, 
    gap: 3 
  },
  
  menuSectionHeader: {
    color: P.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    marginTop: 14,
    marginBottom: 4,
  },
  menuHeaderDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 10,
    width: '50%',
    alignSelf: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10, 
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 14,
    width: '100%',
    ...Platform.select({
      web: {
        transitionProperty: 'background-color',
        transitionDuration: '200ms',
      }
    })
  },
  menuItemActive: { 
    backgroundColor: P.parchment,
  },
  menuItemHoverable: Platform.select({
    web: {
      cursor: 'pointer',
      ':hover': {
        backgroundColor: 'rgba(251, 245, 221, 0.08)',
      }
    },
    default: {}
  }),
  menuIconFix: {
    width: 24,
    textAlign: 'center',
  },
  menuLabel: { color: P.parchmentDark, fontSize: 14, fontWeight: '500', flex: 1 },
  menuLabelActive: { color: P.espresso, fontWeight: '700' },
  
  mainContent: { flex: 1, backgroundColor: P.parchment },
});