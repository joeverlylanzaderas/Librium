import React, { useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, LogBox } from 'react-native';
import { NavigationContainer, LinkingOptions, DefaultTheme } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

// ── 1. Import Custom Font Engine & Hooks ─────────────────────
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Fonts } from './src/constants/theme'; // Import your custom font tokens

// Prevent splash screen auto-hiding while assets download
SplashScreen.preventAutoHideAsync().catch(() => {});

// ── Define Web Address URL Mapping ───────────────────────────
const linking: LinkingOptions<any> = {
  prefixes: ['http://localhost:8081', 'libraryapp://'],
  config: {
    screens: {
      AuthRoot: {
        path: 'auth',
        screens: { Login: 'login' },
      },
      AdminRoot: {
        path: 'admin',
        screens: {
          Dashboard: 'dashboard',
          Books: 'books',
          BorrowRequests: 'borrow-requests',
          Loans: 'loans',
          Fines: 'fines',
          Reservations: 'reservations',
          Authors: 'authors',
          Categories: 'categories',
          Departments: 'departments',
          Semesters: 'semesters',
        },
      },
      LibrarianRoot: {
        path: 'librarian',
        screens: {
          LibrarianDashboard: 'dashboard',
          LibrarianBorrowRequests: 'borrow-requests',
          LibrarianLoans: 'loans',
          LibrarianReservations: 'reservations',
          LibrarianFines: 'fines',
          LibrarianBooks: 'books',
          LibrarianMembers: 'members',
        },
      },
      BorrowRoot: {
        path: 'borrower',
        screens: {
          BorrowerHome: 'home',
          BorrowerLoans: 'my-loans',
          BorrowerReservations: 'my-reservations',
          BorrowerRequests: 'my-requests',
          BorrowerFines: 'my-fines',
          BorrowerProfile: 'profile',
        },
      },
    },
  },
};

// ── Root App Component ────────────────────────────────────────
export default function App() {
  // ── 2. Load Literata Binary Files directly into Memory ──────
  const [fontsLoaded, fontError] = useFonts({
    'Literata-Italic': require('./assets/fonts/Literata-Italic.ttf'),
    'Literata-Light': require('./assets/fonts/Literata-Light.ttf'),
    'Literata-LightItalic': require('./assets/fonts/Literata-LightItalic.ttf'),
    'Literata-Medium': require('./assets/fonts/Literata-Medium.ttf'),
    'Literata-MediumItalic': require('./assets/fonts/Literata-MediumItalic.ttf'),
    'Literata-Regular': require('./assets/fonts/Literata-Regular.ttf'),
    'Literata-SemiBold': require('./assets/fonts/Literata-SemiBold.ttf'),
    'Literata-SemiBoldItalic': require('./assets/fonts/Literata-SemiBoldItalic.ttf'),
    'LibreBaskerville-Regular': require('./assets/fonts/LibreBaskerville-Regular.ttf'),
    'LibreBaskerville-Bold': require('./assets/fonts/LibreBaskerville-Bold.ttf'),
    'LibreBaskerville-Italic': require('./assets/fonts/LibreBaskerville-Italic.ttf'),
    'LibreBaskerville-BoldItalic': require('./assets/fonts/LibreBaskerville-BoldItalic.ttf'),
    'LibreBaskerville-Medium': require('./assets/fonts/LibreBaskerville-Medium.ttf'),
    'Gloock-Regular': require('./assets/fonts/Gloock-Regular.ttf'),
  });

  // Drop splash handler once asset hook yields results
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  // ── 3. Build a Native Navigation Overriding Theme ───────────
  // This actively forces top navigation header components to use Literata!
  const CustomNavigationTheme = {
    ...DefaultTheme,
    fonts: {
      ...DefaultTheme.fonts,
      regular: {
        fontFamily: Fonts?.sans ?? 'System',
        fontWeight: 'normal' as const,
      },
      medium: {
        fontFamily: Fonts?.rounded ?? 'System',
        fontWeight: '500' as const,
      },
      bold: {
        fontFamily: Fonts?.serif ?? 'System',
        fontWeight: 'bold' as const,
      },
      heavy: {
        fontFamily: Fonts?.serif ?? 'System',
        fontWeight: '800' as const,
      },
    },
  };

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <AuthProvider>
        {/* Pass the Custom Navigation font mapper down into the wrapper context */}
        <NavigationContainer linking={linking} theme={CustomNavigationTheme}>
          <StatusBar style="light" />
          <AppNavigator />
        </NavigationContainer>
      </AuthProvider>
    </View>
  );
}