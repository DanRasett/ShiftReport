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
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(8);

  useEffect(() => {
    if (isFocused) {
      opacity.value = withTiming(1, { duration: 240, reduceMotion: ReduceMotion.System });
      translateY.value = withTiming(0, { duration: 240, reduceMotion: ReduceMotion.System });
      return;
    }

    opacity.value = 1;
    translateY.value = 0;
  }, [isFocused, opacity, translateY]);

  return useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));
}
