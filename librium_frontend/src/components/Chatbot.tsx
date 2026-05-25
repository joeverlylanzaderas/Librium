// src/components/Chatbot.tsx
import React, { useState, useRef, useEffect } from 'react';
import { ScrollView, Alert } from 'react-native';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getToken } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { height } = Dimensions.get('window');

interface Message {
  role: 'user' | 'assistant';
  message: string;
  created_at?: string;
}

export default function Chatbot() {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const isDesktop = width > 768;

  const modalWidth = isDesktop ? 400 : width;
  const modalRight = isDesktop ? 20 : 0;

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      loadChatHistory();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && user) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    }
  }, [isOpen, user]);

  const loadChatHistory = async () => {
    try {
      // No token needed anymore
      const response = await fetch('https://librium.onrender.com/api/library/chat/', {
        credentials: 'include', 
      });
      const data = await response.json();
      if (Array.isArray(data)) {
        setMessages(data.reverse());
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) return;

    const userMessage: Message = {
      role: 'user',
      message: message.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const userQuestion = message.trim();
    setMessage('');
    setLoading(true);

    try {
      // No token needed - public endpoint
      const response = await fetch('https://librium.onrender.com/api/library/chat/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include', 
        body: JSON.stringify({ message: userQuestion }),
      });


      const data = await response.json();
      const botMessage: Message = {
        role: 'assistant',
        message: data.assistant?.message || 'Sorry, I could not process that request.',
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        message: 'Network error. Please try again later.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[s.messageRow, isUser ? s.userRow : s.assistantRow]}>
        <View style={[s.messageBubble, isUser ? s.userBubble : s.assistantBubble]}>
          <Text style={[s.messageText, isUser ? s.userText : s.assistantText]}>
            {item.message}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <>
      <TouchableOpacity
        style={s.floatingButton}
        onPress={() => setIsOpen(true)}
        activeOpacity={0.8}
      >
        <Feather name="message-circle" size={28} color="#fff" />
        <View style={s.notificationBadge}>
          <Text style={s.notificationText}>🤖</Text>
        </View>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.modalContainer}
        >
          <View style={[s.chatContainer, { width: modalWidth, right: modalRight }]}>
            <View style={s.header}>
              <View style={s.headerLeft}>
                <View style={s.headerIcon}>
                  <Feather name="book-open" size={18} color="#FBF5DD" />
                </View>
                <Text style={s.headerTitle}>Librium Assistant</Text>
              </View>
              <View style={s.headerButtons}>
                <TouchableOpacity onPress={clearChat} style={s.clearButton}>
                  <Feather name="trash-2" size={18} color="#FBF5DD" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsOpen(false)} style={s.closeButton}>
                  <Feather name="x" size={22} color="#FBF5DD" />
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(_, index) => index.toString()}
              renderItem={renderMessage}
              contentContainerStyle={s.messagesList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
              ListEmptyComponent={
                <View style={s.emptyContainer}>
                  <Feather name="message-square" size={48} color="#C4A77D" />
                  <Text style={s.emptyText}>Ask me anything about Librium!</Text>
                  <Text style={s.emptySubtext}>
                    📚 Books • 🔖 Reservations • 💰 Fines • 📖 Borrowing
                  </Text>
                </View>
              }
            />

            {loading && (
              <View style={s.loadingContainer}>
                <ActivityIndicator size="small" color="#8B6914" />
                <Text style={s.loadingText}>Typing...</Text>
              </View>
            )}

            {messages.length === 0 && !loading && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.suggestionsContainer}>
                {['Library hours?', 'Borrowing limits?', 'Overdue fines?', 'Reserve a book?'].map((suggestion, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={s.suggestionChip}
                    onPress={() => setMessage(suggestion)}
                  >
                    <Text style={s.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={s.inputContainer}>
              <TextInput
                ref={inputRef}
                style={s.input}
                value={message}
                onChangeText={setMessage}
                placeholder="Ask a question..."
                placeholderTextColor="#A68A64"
                multiline
                onSubmitEditing={(e) => {
                  if (Platform.OS !== 'web' && message.trim()) {
                    sendMessage();
                  }
                }}
                onKeyPress={(e: any) => {
                  if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <TouchableOpacity
                style={[s.sendButton, !message.trim() && s.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={!message.trim() || loading}
              >
                <Feather name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#8B6914',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#DAA520',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationText: {
    fontSize: 10,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  chatContainer: {
    height: height * 0.7,
    maxHeight: 600,
    backgroundColor: '#F5F0E8',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    position: 'absolute',
    bottom: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#1F150C',
    borderBottomWidth: 1,
    borderBottomColor: '#E8DCC8',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8B6914',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FBF5DD',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Georgia',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearButton: {
    padding: 4,
  },
  closeButton: {
    padding: 4,
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageRow: {
    marginBottom: 12,
  },
  userRow: {
    alignItems: 'flex-end',
  },
  assistantRow: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: '#8B6914',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8DCC8',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: '#2D1F10',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8DCC8',
  },
  loadingText: {
    color: '#A68A64',
    fontSize: 12,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8DCC8',
    backgroundColor: '#FFFDF9',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F0E8',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
    color: '#2D1F10',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8B6914',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#C4A77D',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    color: '#4A3728',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Georgia',
  },
  emptySubtext: {
    color: '#A68A64',
    fontSize: 12,
    textAlign: 'center',
  },
  suggestionsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
  },
  suggestionChip: {
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E8DCC8',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 8,
  },
  suggestionText: {
    color: '#8B6914',
    fontSize: 12,
    fontWeight: '500',
  },
});