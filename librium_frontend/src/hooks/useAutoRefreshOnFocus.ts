import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

export function useAutoRefreshOnFocus(load: () => Promise<void>, intervalMs = 15000) {
  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, intervalMs);
      return () => clearInterval(timer);
    }, [load, intervalMs])
  );
}
