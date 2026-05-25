// ── App.tsx ───────────────────────────────────────────────
import React, { useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, LogBox } from 'react-native';
import { NavigationContainer, LinkingOptions, DefaultTheme } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import { AlertProvider } from './src/components/AlertProvider';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Fonts } from './src/constants/theme';
import Chatbot from './src/components/Chatbot'; 

SplashScreen.preventAutoHideAsync().catch(() => {});

// ── Corrected Linking Configurations ──────────────────────────
const linking: LinkingOptions<any> = {
  prefixes: [
    // Web development
    'http://localhost:8081',
    'http://localhost:8000',
    'http://127.0.0.1:8081',
    'http://127.0.0.1:8000',
    'http://10.0.2.2:8081',          // Android emulator → host machine
    'http://10.0.2.2:8000',
    
    // Web production
    'https://librium-web.netlify.app',
    'https://librium.onrender.com',
    
    // Mobile (APK/iOS) - custom scheme
    'librium://',
  ],
  config: {
    screens: {
      Authentication: {
        path: '',
        screens: {
          Login: 'login',
          Register: 'register',
        },
      },
      Authenticated: {
        path: '',
        screens: {
          AdminStack: {
            path: 'admin',
            screens: {
              Dashboard: 'dashboard',
              Books: 'books',
              BorrowRequests: 'borrow-requests',
              Loans: 'loans',
              Members: 'members',
              Fines: 'fines',
              Reservations: 'reservations',
              Profile: 'profile',
              Authors: 'authors',
              Categories: 'categories',
              Departments: 'departments',
              Semesters: 'semesters',
            },
          },
          LibrarianStack: {
            path: 'librarian',
            screens: {
              LibrarianDashboard: 'dashboard',
              LibrarianBorrowRequests: 'borrow-requests',
              LibrarianLoans: 'loans',
              LibrarianReservations: 'reservations',
              LibrarianFines: 'fines',
              LibrarianBooks: 'books',
              LibrarianMembers: 'members',
              LibrarianProfile: 'profile',
            },
          },
          BorrowerStack: {
            path: 'borrower',
            screens: {
              BorrowerHome: 'home',
              BorrowerLoans: 'my-loans',
              BorrowerReservations: 'my-reservations',
              BorrowerBookmarks: 'my-bookmarks',
              BorrowerRequests: 'my-requests',
              BorrowerFines: 'my-fines',
              BorrowerProfile: 'profile',
            },
          },
        },
      },
    },
  },
};

// ── Screen Title Mapping ──────────────────────────────────────
const getScreenTitle = (routeName: string): string => {
  const titles: Record<string, string> = {
    // Auth
    Login: 'Librium | Login',
    Register: 'Librium | Register',
    
    // Admin
    Dashboard: 'Librium | Admin Dashboard',
    Books: 'Librium | Manage Books',
    BorrowRequests: 'Librium | Borrow Requests',
    Loans: 'Librium | Manage Loans',
    Members: 'Librium | Manage Members',
    Fines: 'Librium | Manage Fines',
    Reservations: 'Librium | Manage Reservations',
    Profile: 'Librium | Profile',
    Authors: 'Librium | Manage Authors',
    Categories: 'Librium | Manage Categories',
    Departments: 'Librium | Manage Departments',
    Semesters: 'Librium | Manage Semesters',
    
    // Librarian
    LibrarianDashboard: 'Librium | Librarian Dashboard',
    LibrarianBorrowRequests: 'Librium | Borrow Requests',
    LibrarianLoans: 'Librium | Manage Loans',
    LibrarianReservations: 'Librium | Manage Reservations',
    LibrarianFines: 'Librium | Manage Fines',
    LibrarianBooks: 'Librium | Manage Books',
    LibrarianMembers: 'Librium | Manage Members',
    LibrarianProfile: 'Librium | Profile',
    
    // Borrower
    BorrowerHome: 'Librium | My Library',
    BorrowerLoans: 'Librium | My Loans',
    BorrowerReservations: 'Librium | My Reservations',
    BorrowerBookmarks: 'Librium | My Bookmarks',
    BorrowerRequests: 'Librium | My Borrow Requests',
    BorrowerFines: 'Librium | My Fines',
  };
  return titles[routeName] || 'Librium';
};

// ── Root App Component ────────────────────────────────────────
export default function App() {
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

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

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
        <AlertProvider>
          <NavigationContainer
            linking={linking}
            theme={CustomNavigationTheme}
            onStateChange={(state: any) => {
              // Update browser tab title and URL on web
              if (typeof document !== 'undefined' && state?.routes) {
                // Get the current screen name from the navigation state
                let currentRoute = state.routes[state.routes.length - 1];
                while (currentRoute?.state?.routes) {
                  const nested = currentRoute.state.routes[currentRoute.state.routes.length - 1];
                  if (!nested) break;
                  currentRoute = nested;
                }
                const screenName = currentRoute?.name || 'Librium';
                document.title = getScreenTitle(screenName);
              }
            }}
          >
            <StatusBar style="light" />
            <AppNavigator />
            <Chatbot /> {/* ← Chatbot is now visible on ALL screens (including Login) */}
          </NavigationContainer>
        </AlertProvider>
      </AuthProvider>
    </View>
  );
}