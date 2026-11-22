import { useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export function useScreenMotion() {
  const isFocused = useIsFocused();
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (isFocused) {
      translateY.value = 8;
      translateY.value = withTiming(0, { duration: 240, reduceMotion: ReduceMotion.System });
      return;
    }

    translateY.value = 0;
  }, [isFocused, translateY]);

  return useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
}
