// src/navigation/AppNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { C } from '../components/UI';

// ── Auth ──────────────────────────────────────────────────────
import LoginScreen from '../screens/auth/LoginScreen';

// ── Admin screens ─────────────────────────────────────────────
import AdminDashboardScreen      from '../screens/admin/DashboardScreen';
import AdminBooksScreen          from '../screens/admin/BooksScreen';
import AdminBorrowRequestsScreen from '../screens/admin/BorrowRequestsScreen';
import AdminLoansScreen          from '../screens/admin/LoansScreen';
import AdminMembersScreen        from '../screens/admin/MembersScreen';
import AdminFinesScreen          from '../screens/admin/FinesScreen';
import AdminReservationsScreen   from '../screens/admin/ReservationsScreen';
import AdminProfileScreen        from '../screens/admin/ProfileScreen';
import {
  AuthorsScreen,
  CategoriesScreen,
  DepartmentsScreen,
  SemestersScreen,
} from '../screens/admin/CatalogScreens';

// ── Librarian screens ─────────────────────────────────────────
import LibrarianDashboardScreen      from '../screens/librarian/LibrarianDashboardScreen';
import LibrarianBorrowRequestsScreen from '../screens/librarian/LibrarianBorrowRequestsScreen';
import LibrarianLoansScreen          from '../screens/librarian/LibrarianLoansScreen';
import LibrarianReservationsScreen   from '../screens/librarian/LibrarianReservationsScreen';
import LibrarianFinesScreen          from '../screens/librarian/LibrarianFinesScreen';
import LibrarianBooksScreen          from '../screens/librarian/LibrarianBooksScreen';
import LibrarianMembersScreen        from '../screens/librarian/LibrarianMembersScreen';

// ── Borrower screens ──────────────────────────────────────────
import BorrowerHomeScreen           from '../screens/borrower/BorrowerHomeScreen';
import BorrowerLoansScreen          from '../screens/borrower/BorrowerLoansScreen';
import BorrowerReservationsScreen   from '../screens/borrower/BorrowerReservationsScreen';
import BorrowerBorrowRequestsScreen from '../screens/borrower/BorrowerBorrowRequestsScreen';
import BorrowerFinesScreen          from '../screens/borrower/BorrowerFinesScreen';
import BorrowerProfileScreen        from '../screens/borrower/BorrowerProfileScreen';

// ── Param lists ───────────────────────────────────────────────
export type AdminStackParamList = {
  Dashboard:      undefined;
  Books:          undefined;
  BorrowRequests: undefined;
  Loans:          undefined;
  Members:        undefined;
  Fines:          undefined;
  Reservations:   undefined;
  Profile:        undefined;
  Authors:        undefined;
  Categories:     undefined;
  Departments:    undefined;
  Semesters:      undefined;
};

export type LibrarianStackParamList = {
  LibrarianDashboard:      undefined;
  LibrarianBorrowRequests: undefined;
  LibrarianLoans:          undefined;
  LibrarianReservations:   undefined;
  LibrarianFines:          undefined;
  LibrarianBooks:          undefined;
  LibrarianMembers:        undefined;
};

export type BorrowerStackParamList = {
  BorrowerHome:         undefined;
  BorrowerLoans:        undefined;
  BorrowerReservations: undefined;
  BorrowerRequests:     undefined;
  BorrowerFines:        undefined;
  BorrowerProfile:      undefined;
};

export type AuthStackParamList = {
  Login: undefined;
};

const RootStack      = createNativeStackNavigator();
const AuthNav        = createNativeStackNavigator();
const AdminNav       = createNativeStackNavigator();
const LibrarianNav   = createNativeStackNavigator();
const BorrowerNav    = createNativeStackNavigator();

const screenOpts = {
  headerStyle:         { backgroundColor: C.surface },
  headerTintColor:     C.text,
  headerTitleStyle:    { fontWeight: '700' as const, fontSize: 15 },
  headerShadowVisible: false,
  contentStyle:        { backgroundColor: C.bg },
};

// ── Auth stack ────────────────────────────────────────────────
function AuthStack() {
  return (
    // FIX: id prop required by React Navigation v7
    <AuthNav.Navigator id="AuthStack" screenOptions={{ headerShown: false }}>
      <AuthNav.Screen name="Login" component={LoginScreen} />
    </AuthNav.Navigator>
  );
}

// ── Admin stack ───────────────────────────────────────────────
function AdminStack() {
  return (
    <AdminNav.Navigator id="AdminStack" screenOptions={screenOpts}>
      <AdminNav.Screen name="Dashboard"      component={AdminDashboardScreen}       options={{ headerShown: false }} />
      <AdminNav.Screen name="Books"          component={AdminBooksScreen}           options={{ headerShown: false }} />
      <AdminNav.Screen name="BorrowRequests" component={AdminBorrowRequestsScreen}  options={{ title: 'Borrow Requests' }} />
      <AdminNav.Screen name="Loans"          component={AdminLoansScreen}           options={{ title: 'Loans' }} />
      <AdminNav.Screen name="Members"        component={AdminMembersScreen}         options={{ headerShown: false  }} />
      <AdminNav.Screen name="Fines"          component={AdminFinesScreen}           options={{ title: 'Fines' }} />
      <AdminNav.Screen name="Reservations"   component={AdminReservationsScreen}    options={{ title: 'Reservations' }} />
      <AdminNav.Screen name="Profile"        component={AdminProfileScreen}         options={{ headerShown: false }} />
      <AdminNav.Screen name="Authors"        component={AuthorsScreen}              options={{ headerShown: false }} />
      <AdminNav.Screen name="Categories"     component={CategoriesScreen}           options={{ headerShown: false }} />
      <AdminNav.Screen name="Departments"    component={DepartmentsScreen}          options={{ headerShown: false }} />
      <AdminNav.Screen name="Semesters"      component={SemestersScreen}            options={{ headerShown: false }} />
    </AdminNav.Navigator>
  );
}

// ── Librarian stack ───────────────────────────────────────────
function LibrarianStack() {
  return (
    <LibrarianNav.Navigator id="LibrarianStack" screenOptions={screenOpts}>
      <LibrarianNav.Screen name="LibrarianDashboard"      component={LibrarianDashboardScreen}      options={{ headerShown: false }} />
      <LibrarianNav.Screen name="LibrarianBorrowRequests" component={LibrarianBorrowRequestsScreen} options={{ title: 'Borrow Requests' }} />
      <LibrarianNav.Screen name="LibrarianLoans"          component={LibrarianLoansScreen}          options={{ title: 'Loans' }} />
      <LibrarianNav.Screen name="LibrarianReservations"   component={LibrarianReservationsScreen}   options={{ title: 'Reservations' }} />
      <LibrarianNav.Screen name="LibrarianFines"          component={LibrarianFinesScreen}          options={{ title: 'Fines' }} />
      <LibrarianNav.Screen name="LibrarianBooks"          component={LibrarianBooksScreen}          options={{ title: 'Books' }} />
      <LibrarianNav.Screen name="LibrarianMembers"        component={LibrarianMembersScreen}        options={{ title: 'Members' }} />
    </LibrarianNav.Navigator>
  );
}

// ── Borrower stack ────────────────────────────────────────────
function BorrowerStack() {
  return (
    <BorrowerNav.Navigator id="BorrowerStack" screenOptions={screenOpts}>
      <BorrowerNav.Screen name="BorrowerHome"         component={BorrowerHomeScreen}           options={{ headerShown: false }} />
      <BorrowerNav.Screen name="BorrowerLoans"        component={BorrowerLoansScreen}          options={{ title: 'My Loans' }} />
      <BorrowerNav.Screen name="BorrowerReservations" component={BorrowerReservationsScreen}   options={{ title: 'My Reservations' }} />
      <BorrowerNav.Screen name="BorrowerRequests"     component={BorrowerBorrowRequestsScreen} options={{ title: 'Borrow Requests' }} />
      <BorrowerNav.Screen name="BorrowerFines"        component={BorrowerFinesScreen}          options={{ title: 'My Fines' }} />
      <BorrowerNav.Screen name="BorrowerProfile"      component={BorrowerProfileScreen}        options={{ title: 'My Profile' }} />
    </BorrowerNav.Navigator>
  );
}

// ── Root navigator — role-based routing ───────────────────────
export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <RootStack.Navigator id="RootStack" screenOptions={{ headerShown: false }}>
      {!user ? (
        <RootStack.Screen name="Authentication" component={AuthStack} />
      ) : user.role === 'member' ? (
        <RootStack.Screen name="Borrower"  component={BorrowerStack} />
      ) : user.role === 'librarian' ? (
        <RootStack.Screen name="Librarian" component={LibrarianStack} />
      ) : (
        <RootStack.Screen name="Admin"     component={AdminStack} />
      )}
    </RootStack.Navigator>
  );
}