// src/navigation/AppNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { C } from '../components/UI';
import SidebarLayout from '../components/SidebarLayout';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';

import AdminDashboardScreen      from '../screens/admin/DashboardScreen';
import AdminBooksScreen          from '../screens/admin/BooksScreen';
import AdminBorrowRequestsScreen from '../screens/admin/BorrowRequestsScreen';
import AdminLoansScreen          from '../screens/admin/LoansScreen';
import AdminMembersScreen        from '../screens/admin/MembersScreen';
import AdminFinesScreen          from '../screens/admin/FinesScreen';
import AdminReservationsScreen   from '../screens/admin/ReservationsScreen';
import AdminProfileScreen        from '../screens/admin/ProfileScreen';
import { AuthorsScreen, CategoriesScreen, DepartmentsScreen, SemestersScreen } from '../screens/admin/CatalogScreens';

import LibrarianDashboardScreen      from '../screens/librarian/LibrarianDashboardScreen';
import LibrarianBorrowRequestsScreen from '../screens/librarian/LibrarianBorrowRequestsScreen';
import LibrarianLoansScreen          from '../screens/librarian/LibrarianLoansScreen';
import LibrarianReservationsScreen   from '../screens/librarian/LibrarianReservationsScreen';
import LibrarianFinesScreen          from '../screens/librarian/LibrarianFinesScreen';
import LibrarianBooksScreen          from '../screens/librarian/LibrarianBooksScreen';
import LibrarianProfileScreen        from '../screens/librarian/LibrarianProfileScreen';
import LibrarianMembersScreen        from '../screens/librarian/LibrarianMembersScreen';

import BorrowerHomeScreen           from '../screens/borrower/BorrowerHomeScreen';
import BorrowerLoansScreen          from '../screens/borrower/BorrowerLoansScreen';
import BorrowerReservationsScreen   from '../screens/borrower/BorrowerReservationsScreen';
import BorrowerBorrowRequestsScreen from '../screens/borrower/BorrowerBorrowRequestsScreen';
import BorrowerFinesScreen          from '../screens/borrower/BorrowerFinesScreen';
import BorrowerProfileScreen        from '../screens/borrower/BorrowerProfileScreen';
import BorrowerBookmarkScreen       from '../screens/borrower/BorrowerBookmarksScreen';


export type AdminStackParamList = { Dashboard: undefined; Books: undefined; BorrowRequests: undefined; Loans: undefined; Members: undefined; Fines: undefined; Reservations: undefined; Profile: undefined; Authors: undefined; Categories: undefined; Departments: undefined; Semesters: undefined; };
export type LibrarianStackParamList = { LibrarianDashboard: undefined; LibrarianBorrowRequests: undefined; LibrarianLoans: undefined; LibrarianReservations: undefined; LibrarianFines: undefined; LibrarianBooks: undefined; LibrarianMembers: undefined; LibrarianProfile: undefined; };
export type BorrowerStackParamList = { BorrowerHome: undefined; BorrowerBookmarks: undefined; BorrowerLoans: undefined; BorrowerReservations: undefined; BorrowerRequests: undefined; BorrowerFines: undefined; BorrowerProfile: undefined; };
export type AuthStackParamList = { Login: { uid?: string; token?: string; activated?: boolean } | undefined; Register: undefined; };

const RootStack = createNativeStackNavigator();
const AuthNav = createNativeStackNavigator<AuthStackParamList>();
const AdminNav = createNativeStackNavigator();
const LibrarianNav = createNativeStackNavigator();
const BorrowerNav = createNativeStackNavigator();

const screenOpts = {
  headerStyle: { backgroundColor: C.surface },
  headerTintColor: C.text,
  headerTitleStyle: { fontWeight: '700' as const, fontSize: 15 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: C.bg },
};

function AuthStack() {
  return (
    <AuthNav.Navigator id="AuthStack" screenOptions={{ headerShown: false }}>
      <AuthNav.Screen name="Login" component={LoginScreen} options={{ title: 'Librium | Login' }} />
      <AuthNav.Screen name="Register" component={RegisterScreen} options={{ title: 'Librium | Register' }} />
    </AuthNav.Navigator>
  );
}

function AdminStack() {
  return (
    <AdminNav.Navigator id="AdminStack" screenOptions={screenOpts}>
      <AdminNav.Screen name="Dashboard" component={AdminDashboardScreen} options={{ title: 'Admin Dashboard', headerShown: false }} />
      <AdminNav.Screen name="Books" component={AdminBooksScreen} options={{ title: 'Books', headerShown: false }} />
      <AdminNav.Screen name="BorrowRequests" component={AdminBorrowRequestsScreen} options={{ title: 'Borrow Requests', headerShown: false }} />
      <AdminNav.Screen name="Loans" component={AdminLoansScreen} options={{ title: 'Loans', headerShown: false }} />
      <AdminNav.Screen name="Members" component={AdminMembersScreen} options={{ title: 'Members', headerShown: false }} />
      <AdminNav.Screen name="Fines" component={AdminFinesScreen} options={{ title: 'Fines', headerShown: false }} />
      <AdminNav.Screen name="Reservations" component={AdminReservationsScreen} options={{ title: 'Reservations', headerShown: false }} />
      <AdminNav.Screen name="Profile" component={AdminProfileScreen} options={{ title: 'Profile', headerShown: false }} />
      <AdminNav.Screen name="Authors" component={AuthorsScreen} options={{ title: 'Authors', headerShown: false }} />
      <AdminNav.Screen name="Categories" component={CategoriesScreen} options={{ title: 'Categories', headerShown: false }} />
      <AdminNav.Screen name="Departments" component={DepartmentsScreen} options={{ title: 'Departments', headerShown: false }} />
      <AdminNav.Screen name="Semesters" component={SemestersScreen} options={{ title: 'Semesters', headerShown: false }} />
    </AdminNav.Navigator>
  );
}

function LibrarianStack() {
  return (
    <LibrarianNav.Navigator id="LibrarianStack" screenOptions={screenOpts}>
      <LibrarianNav.Screen name="LibrarianDashboard" component={LibrarianDashboardScreen} options={{ title: 'Librarian Dashboard', headerShown: false }} />
      <LibrarianNav.Screen name="LibrarianBorrowRequests" component={LibrarianBorrowRequestsScreen} options={{ title: 'Borrow Requests', headerShown: false }} />
      <LibrarianNav.Screen name="LibrarianLoans" component={LibrarianLoansScreen} options={{ title: 'Loans', headerShown: false }} />
      <LibrarianNav.Screen name="LibrarianReservations" component={LibrarianReservationsScreen} options={{ title: 'Reservations', headerShown: false }} />
      <LibrarianNav.Screen name="LibrarianFines" component={LibrarianFinesScreen} options={{ title: 'Fines', headerShown: false }} />
      <LibrarianNav.Screen name="LibrarianBooks" component={LibrarianBooksScreen} options={{ title: 'Books', headerShown: false }} />
      <LibrarianNav.Screen name="LibrarianMembers" component={LibrarianMembersScreen} options={{ title: 'Members', headerShown: false }} />
      <LibrarianNav.Screen name="LibrarianProfile" component={LibrarianProfileScreen} options={{ title: 'Profile', headerShown: false }} />
    </LibrarianNav.Navigator>
  );
}

function BorrowerStack() {
  return (
    <BorrowerNav.Navigator id="BorrowerStack" screenOptions={screenOpts}>
      <BorrowerNav.Screen name="BorrowerHome" component={BorrowerHomeScreen} options={{ title: 'My Library', headerShown: false }} />
      <BorrowerNav.Screen name="BorrowerLoans" component={BorrowerLoansScreen} options={{ title: 'My Loans', headerShown: false }} />
      <BorrowerNav.Screen name="BorrowerReservations" component={BorrowerReservationsScreen} options={{ title: 'My Reservations', headerShown: false }} />
      <BorrowerNav.Screen name="BorrowerBookmarks" component={BorrowerBookmarkScreen} options={{ title: 'My Bookmarks', headerShown: false }} />
      <BorrowerNav.Screen name="BorrowerRequests" component={BorrowerBorrowRequestsScreen} options={{ title: 'My Requests', headerShown: false }} />
      <BorrowerNav.Screen name="BorrowerFines" component={BorrowerFinesScreen} options={{ title: 'My Fines', headerShown: false }} />
      <BorrowerNav.Screen name="BorrowerProfile" component={BorrowerProfileScreen} options={{ title: 'Profile', headerShown: false }} />
    </BorrowerNav.Navigator>
  );
}

function AuthenticatedApp() {
  const { user } = useAuth();
  const StackComponent = user?.role === 'member' ? BorrowerStack : user?.role === 'librarian' ? LibrarianStack : AdminStack;
  return (
    <SidebarLayout>
      <StackComponent />
    </SidebarLayout>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return (
    <RootStack.Navigator id="RootStack" screenOptions={{ headerShown: false }}>
      {!user ? (
        <RootStack.Screen name="Authentication" component={AuthStack} />
      ) : (
        <RootStack.Screen name="Authenticated" component={AuthenticatedApp} />
      )}
    </RootStack.Navigator>
  );
}