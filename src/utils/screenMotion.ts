import { useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

export const screenEntrance = (delay: number) =>
  FadeInDown.duration(280).delay(delay).reduceMotion(ReduceMotion.System);

export function useScreenMotionKey() {
  const isFocused = useIsFocused();
  const [motionKey, setMotionKey] = useState(0);

  useEffect(() => {
    if (isFocused) setMotionKey(key => key + 1);
  }, [isFocused]);

  return motionKey;
}

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
