// src/screens/BorrowerBookmarkScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getBookmarks } from '../../services/api';

// Define the structure matching your BookmarkSerializer payload
interface BookmarkItem {
  id: number;
  member: number;
  book: number;
  book_title: string;
  book_cover: string | null;
  bookmarked_date: string;
}

export default function BorrowerBookmarkScreen() {
  const navigation = useNavigation<any>();
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch bookmarks from the backend
  const fetchBookmarks = async (showLoadingIndicator = true) => {
    if (showLoadingIndicator) setLoading(true);
    setError(null);
    try {
      const data = await getBookmarks();
      setBookmarks(data);
    } catch (err: any) {
      console.error('Failed to load bookmarks:', err);
      setError(err?.data?.detail || 'Failed to load your bookmarked items.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBookmarks();
  }, []);

  // Handle pull-to-refresh state
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBookmarks(false);
  }, []);

  // Render individual bookmarked item row
  const renderBookmarkItem = ({ item }: { item: BookmarkItem }) => {
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('BookDetailScreen', { id: item.book })}
      >
        {item.book_cover ? (
          <Image
            source={{ uri: item.book_cover }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.coverImage, styles.placeholderCover]}>
            <Text style={styles.placeholderText}>No Cover</Text>
          </View>
        )}

        <View style={styles.infoContainer}>
          <Text style={styles.bookTitle} numberOfLines={2}>
            {item.book_title}
          </Text>
          <Text style={styles.dateText}>
            Saved on {new Date(item.bookmarked_date).toLocaleDateString()}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchBookmarks()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={bookmarks}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderBookmarkItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#007AFF" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>Your shelf is empty</Text>
            <Text style={styles.emptySubtitle}>
              Books you bookmark while exploring the library catalog will show up here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 20,
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  coverImage: {
    width: 65,
    height: 95,
    borderRadius: 6,
    backgroundColor: '#EAEAEA',
  },
  placeholderCover: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  placeholderText: {
    fontSize: 10,
    color: '#A0AEC0',
    textAlign: 'center',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  bookTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A202C',
    marginBottom: 6,
    lineHeight: 22,
  },
  dateText: {
    fontSize: 13,
    color: '#718096',
  },
  errorText: {
    fontSize: 15,
    color: '#E53E3E',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#718096',
    textAlign: 'center',
    lineHeight: 20,
  },
});