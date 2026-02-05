# App Integration Guide

This guide shows how to integrate `react-native-device-performance` into your React Native app to detect device capabilities at launch and adapt your UI accordingly.

## Table of Contents

1. [Quick Setup](#quick-setup)
2. [Performance Context Provider](#performance-context-provider)
3. [Custom Hooks](#custom-hooks)
4. [Usage Examples](#usage-examples)
5. [Best Practices](#best-practices)

---

## Quick Setup

### 1. Install the Package

```bash
npm install react-native-device-performance
# or
yarn add react-native-device-performance
```

### 2. iOS Setup

```bash
cd ios && pod install && cd ..
```

---

## Performance Context Provider

Create a context that initializes performance detection at app launch and shares it throughout your app.

### Step 1: Create the Context

**File:** `src/contexts/PerformanceContext.tsx`

```typescript
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  ReactNode,
} from 'react';
import DevicePerformance, {
  PerformanceScore,
  DeviceSpecs,
  PerformanceTier,
} from 'react-native-device-performance';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==================== TYPES ====================

interface PerformanceSettings {
  enableAnimations: boolean;
  enableParallax: boolean;
  enableBlur: boolean;
  enableShadows: boolean;
  imageQuality: 'low' | 'medium' | 'high';
  videoQuality: '480p' | '720p' | '1080p';
  listWindowSize: number;
  maxConcurrentDownloads: number;
  enableHaptics: boolean;
}

interface PerformanceContextType {
  // Performance data
  score: PerformanceScore | null;
  specs: DeviceSpecs | null;
  tier: PerformanceTier | null;

  // Loading state
  isLoading: boolean;
  isInitialized: boolean;

  // Computed settings
  settings: PerformanceSettings;

  // Helper functions
  isLowEnd: boolean;
  isMidRange: boolean;
  isHighEnd: boolean;

  // Actions
  refresh: () => Promise<void>;
  runFullBenchmark: () => Promise<void>;
}

// ==================== DEFAULT SETTINGS ====================

const LOW_END_SETTINGS: PerformanceSettings = {
  enableAnimations: false,
  enableParallax: false,
  enableBlur: false,
  enableShadows: false,
  imageQuality: 'low',
  videoQuality: '480p',
  listWindowSize: 5,
  maxConcurrentDownloads: 1,
  enableHaptics: false,
};

const MID_RANGE_SETTINGS: PerformanceSettings = {
  enableAnimations: true,
  enableParallax: false,
  enableBlur: true,
  enableShadows: true,
  imageQuality: 'medium',
  videoQuality: '720p',
  listWindowSize: 10,
  maxConcurrentDownloads: 2,
  enableHaptics: true,
};

const HIGH_END_SETTINGS: PerformanceSettings = {
  enableAnimations: true,
  enableParallax: true,
  enableBlur: true,
  enableShadows: true,
  imageQuality: 'high',
  videoQuality: '1080p',
  listWindowSize: 21,
  maxConcurrentDownloads: 4,
  enableHaptics: true,
};

// ==================== CONTEXT ====================

const PerformanceContext = createContext<PerformanceContextType | undefined>(undefined);

const CACHE_KEY = '@device_performance_cache';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// ==================== PROVIDER ====================

interface PerformanceProviderProps {
  children: ReactNode;
  onInitialized?: (tier: PerformanceTier) => void;
}

export function PerformanceProvider({ children, onInitialized }: PerformanceProviderProps) {
  const [score, setScore] = useState<PerformanceScore | null>(null);
  const [specs, setSpecs] = useState<DeviceSpecs | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize on mount
  useEffect(() => {
    initializePerformance();
  }, []);

  const initializePerformance = async () => {
    try {
      setIsLoading(true);

      // Try to load from cache first for instant UI
      const cached = await loadFromCache();
      if (cached) {
        setScore(cached.score);
        setSpecs(cached.specs);
        setIsInitialized(true);
        onInitialized?.(cached.score.tier);
      }

      // Always fetch fresh data
      const [freshScore, freshSpecs] = await Promise.all([
        DevicePerformance.getPerformanceScore(),
        DevicePerformance.getDeviceSpecs(),
      ]);

      setScore(freshScore);
      setSpecs(freshSpecs);

      // Cache for next launch
      await saveToCache(freshScore, freshSpecs);

      if (!cached) {
        onInitialized?.(freshScore.tier);
      }

      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize performance:', error);
      // Use mid-range defaults on error
      setScore({
        cpu: 50,
        memory: 50,
        storage: 50,
        overall: 50,
        tier: 'MEDIUM',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadFromCache = async (): Promise<{ score: PerformanceScore; specs: DeviceSpecs } | null> => {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const { score, specs, timestamp } = JSON.parse(cached);
        // Check if cache is still valid
        if (Date.now() - timestamp < CACHE_EXPIRY) {
          return { score, specs };
        }
      }
    } catch (error) {
      // Ignore cache errors
    }
    return null;
  };

  const saveToCache = async (score: PerformanceScore, specs: DeviceSpecs) => {
    try {
      await AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ score, specs, timestamp: Date.now() })
      );
    } catch (error) {
      // Ignore cache errors
    }
  };

  const refresh = async () => {
    await initializePerformance();
  };

  const runFullBenchmark = async () => {
    setIsLoading(true);
    try {
      const results = await DevicePerformance.runBenchmark();
      setScore({
        cpu: results.cpuScore,
        memory: results.memoryScore,
        storage: results.storageScore,
        overall: results.overallScore,
        tier: results.performanceTier,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Compute settings based on tier
  const settings = useMemo((): PerformanceSettings => {
    if (!score) return MID_RANGE_SETTINGS;

    switch (score.tier) {
      case 'HIGH':
        return HIGH_END_SETTINGS;
      case 'MEDIUM':
        return MID_RANGE_SETTINGS;
      case 'LOW':
      default:
        return LOW_END_SETTINGS;
    }
  }, [score]);

  const tier = score?.tier ?? null;

  const value: PerformanceContextType = {
    score,
    specs,
    tier,
    isLoading,
    isInitialized,
    settings,
    isLowEnd: tier === 'LOW',
    isMidRange: tier === 'MEDIUM',
    isHighEnd: tier === 'HIGH',
    refresh,
    runFullBenchmark,
  };

  return (
    <PerformanceContext.Provider value={value}>
      {children}
    </PerformanceContext.Provider>
  );
}

// ==================== HOOK ====================

export function usePerformance(): PerformanceContextType {
  const context = useContext(PerformanceContext);
  if (context === undefined) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  return context;
}

// ==================== ADDITIONAL HOOKS ====================

/**
 * Hook to check if animations should be enabled
 */
export function useAnimationsEnabled(): boolean {
  const { settings } = usePerformance();
  return settings.enableAnimations;
}

/**
 * Hook to get image quality setting
 */
export function useImageQuality(): 'low' | 'medium' | 'high' {
  const { settings } = usePerformance();
  return settings.imageQuality;
}

/**
 * Hook for conditional rendering based on performance
 */
export function useConditionalRender() {
  const { isLowEnd, isMidRange, isHighEnd, settings } = usePerformance();

  return {
    // Render helpers
    shouldRenderHeavyComponent: !isLowEnd,
    shouldRenderAnimations: settings.enableAnimations,
    shouldRenderBlur: settings.enableBlur,
    shouldRenderShadows: settings.enableShadows,
    shouldRenderParallax: settings.enableParallax,

    // Quality helpers
    imageQuality: settings.imageQuality,
    videoQuality: settings.videoQuality,

    // List optimization
    listWindowSize: settings.listWindowSize,

    // Tier checks
    isLowEnd,
    isMidRange,
    isHighEnd,
  };
}
```

---

### Step 2: Wrap Your App

**File:** `App.tsx`

```typescript
import React from 'react';
import { PerformanceProvider } from './src/contexts/PerformanceContext';
import { MainApp } from './src/MainApp';

export default function App() {
  const handlePerformanceInitialized = (tier: string) => {
    console.log(`Device performance tier: ${tier}`);

    // You can also send this to analytics
    // analytics.setUserProperty('device_tier', tier);
  };

  return (
    <PerformanceProvider onInitialized={handlePerformanceInitialized}>
      <MainApp />
    </PerformanceProvider>
  );
}
```

---

## Custom Hooks

### useOptimizedImage

```typescript
// src/hooks/useOptimizedImage.ts
import { useMemo } from 'react';
import { usePerformance } from '../contexts/PerformanceContext';

interface ImageSource {
  low: string;
  medium: string;
  high: string;
}

export function useOptimizedImage(sources: ImageSource): string {
  const { settings } = usePerformance();

  return useMemo(() => {
    return sources[settings.imageQuality];
  }, [sources, settings.imageQuality]);
}

// Usage:
// const imageUrl = useOptimizedImage({
//   low: 'https://example.com/image-480.jpg',
//   medium: 'https://example.com/image-720.jpg',
//   high: 'https://example.com/image-1080.jpg',
// });
```

### useOptimizedAnimation

```typescript
// src/hooks/useOptimizedAnimation.ts
import { useCallback } from 'react';
import { LayoutAnimation, Platform, UIManager } from 'react-native';
import { usePerformance } from '../contexts/PerformanceContext';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function useOptimizedAnimation() {
  const { settings } = usePerformance();

  const animate = useCallback(() => {
    if (settings.enableAnimations) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }, [settings.enableAnimations]);

  const animateSpring = useCallback(() => {
    if (settings.enableAnimations) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.spring);
    }
  }, [settings.enableAnimations]);

  return {
    animate,
    animateSpring,
    isEnabled: settings.enableAnimations,
  };
}
```

### useOptimizedList

```typescript
// src/hooks/useOptimizedList.ts
import { useMemo } from 'react';
import { usePerformance } from '../contexts/PerformanceContext';

interface ListConfig {
  windowSize: number;
  maxToRenderPerBatch: number;
  updateCellsBatchingPeriod: number;
  initialNumToRender: number;
  removeClippedSubviews: boolean;
}

export function useOptimizedList(): ListConfig {
  const { tier, settings } = usePerformance();

  return useMemo(() => {
    switch (tier) {
      case 'HIGH':
        return {
          windowSize: 21,
          maxToRenderPerBatch: 10,
          updateCellsBatchingPeriod: 50,
          initialNumToRender: 10,
          removeClippedSubviews: false,
        };
      case 'MEDIUM':
        return {
          windowSize: 11,
          maxToRenderPerBatch: 5,
          updateCellsBatchingPeriod: 100,
          initialNumToRender: 7,
          removeClippedSubviews: true,
        };
      case 'LOW':
      default:
        return {
          windowSize: 5,
          maxToRenderPerBatch: 2,
          updateCellsBatchingPeriod: 150,
          initialNumToRender: 3,
          removeClippedSubviews: true,
        };
    }
  }, [tier]);
}
```

---

## Usage Examples

### 1. Conditional Animation Rendering

```typescript
// src/components/AnimatedCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { usePerformance } from '../contexts/PerformanceContext';

interface AnimatedCardProps {
  title: string;
  children: React.ReactNode;
}

export function AnimatedCard({ title, children }: AnimatedCardProps) {
  const { settings, isLowEnd } = usePerformance();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    // Only apply animations on capable devices
    if (!settings.enableAnimations) {
      return {};
    }

    return {
      transform: [{ scale: withSpring(scale.value) }],
    };
  });

  const handlePressIn = () => {
    if (settings.enableAnimations) {
      scale.value = 0.95;
    }
  };

  const handlePressOut = () => {
    if (settings.enableAnimations) {
      scale.value = 1;
    }
  };

  // Use simple View for low-end devices
  if (isLowEnd) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        {children}
      </View>
    );
  }

  return (
    <Animated.View
      style={[styles.card, animatedStyle]}
      onTouchStart={handlePressIn}
      onTouchEnd={handlePressOut}
    >
      <Text style={styles.title}>{title}</Text>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
});
```

### 2. Adaptive Image Component

```typescript
// src/components/AdaptiveImage.tsx
import React from 'react';
import { Image, ImageProps, StyleSheet, View } from 'react-native';
import { usePerformance } from '../contexts/PerformanceContext';

interface AdaptiveImageProps extends Omit<ImageProps, 'source'> {
  sources: {
    low: string;
    medium: string;
    high: string;
  };
  // Or single source that we'll modify
  baseUrl?: string;
}

export function AdaptiveImage({ sources, baseUrl, style, ...props }: AdaptiveImageProps) {
  const { settings } = usePerformance();

  // Determine image URL based on quality setting
  const imageUrl = React.useMemo(() => {
    if (baseUrl) {
      // Append quality parameter to URL
      const quality = settings.imageQuality;
      const size = quality === 'high' ? 1080 : quality === 'medium' ? 720 : 480;
      return `${baseUrl}?w=${size}&q=${quality === 'high' ? 90 : quality === 'medium' ? 70 : 50}`;
    }
    return sources[settings.imageQuality];
  }, [baseUrl, sources, settings.imageQuality]);

  return (
    <Image
      source={{ uri: imageUrl }}
      style={style}
      // Disable fade on low-end devices
      fadeDuration={settings.enableAnimations ? 300 : 0}
      {...props}
    />
  );
}
```

### 3. Optimized FlatList

```typescript
// src/components/OptimizedFlatList.tsx
import React from 'react';
import { FlatList, FlatListProps } from 'react-native';
import { useOptimizedList } from '../hooks/useOptimizedList';

interface OptimizedFlatListProps<T> extends FlatListProps<T> {}

export function OptimizedFlatList<T>({ ...props }: OptimizedFlatListProps<T>) {
  const listConfig = useOptimizedList();

  return (
    <FlatList
      {...props}
      windowSize={listConfig.windowSize}
      maxToRenderPerBatch={listConfig.maxToRenderPerBatch}
      updateCellsBatchingPeriod={listConfig.updateCellsBatchingPeriod}
      initialNumToRender={listConfig.initialNumToRender}
      removeClippedSubviews={listConfig.removeClippedSubviews}
    />
  );
}
```

### 4. Conditional Blur Effect

```typescript
// src/components/ConditionalBlur.tsx
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from '@react-native-community/blur';
import { usePerformance } from '../contexts/PerformanceContext';

interface ConditionalBlurProps {
  children: React.ReactNode;
  intensity?: number;
  fallbackColor?: string;
}

export function ConditionalBlur({
  children,
  intensity = 10,
  fallbackColor = 'rgba(255, 255, 255, 0.9)',
}: ConditionalBlurProps) {
  const { settings } = usePerformance();

  // Use solid background for low-end devices or if blur is disabled
  if (!settings.enableBlur) {
    return (
      <View style={[styles.container, { backgroundColor: fallbackColor }]}>
        {children}
      </View>
    );
  }

  return (
    <BlurView
      style={styles.container}
      blurType="light"
      blurAmount={intensity}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
```

### 5. Shadow Style Helper

```typescript
// src/utils/adaptiveStyles.ts
import { StyleSheet, Platform } from 'react-native';

interface ShadowConfig {
  enableShadows: boolean;
}

export function getAdaptiveShadow(config: ShadowConfig, elevation: number = 4) {
  if (!config.enableShadows) {
    return {};
  }

  if (Platform.OS === 'android') {
    return { elevation };
  }

  return {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: elevation / 2,
    },
    shadowOpacity: 0.1 + elevation * 0.02,
    shadowRadius: elevation,
  };
}

// Usage in component:
// const { settings } = usePerformance();
// const shadowStyle = getAdaptiveShadow(settings, 4);
```

### 6. Home Screen with Performance Adaptation

```typescript
// src/screens/HomeScreen.tsx
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { usePerformance, useConditionalRender } from '../contexts/PerformanceContext';
import { OptimizedFlatList } from '../components/OptimizedFlatList';
import { AdaptiveImage } from '../components/AdaptiveImage';
import { AnimatedCard } from '../components/AnimatedCard';
import { ConditionalBlur } from '../components/ConditionalBlur';

export function HomeScreen() {
  const { tier, specs, isLoading, refresh } = usePerformance();
  const { shouldRenderAnimations, shouldRenderBlur, imageQuality } = useConditionalRender();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header with conditional blur */}
      <ConditionalBlur intensity={20} fallbackColor="#f0f0f0">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Welcome</Text>
          <Text style={styles.tierBadge}>Device: {tier}</Text>
        </View>
      </ConditionalBlur>

      {/* Device Info Card */}
      <AnimatedCard title="Device Performance">
        <Text>Performance Tier: {tier}</Text>
        <Text>CPU Cores: {specs?.cpu.cores}</Text>
        <Text>RAM: {((specs?.memory.totalRam ?? 0) / (1024 * 1024 * 1024)).toFixed(1)} GB</Text>
        <Text>Animations: {shouldRenderAnimations ? 'Enabled' : 'Disabled'}</Text>
        <Text>Image Quality: {imageQuality}</Text>
      </AnimatedCard>

      {/* Adaptive Image */}
      <AdaptiveImage
        sources={{
          low: 'https://picsum.photos/480/270',
          medium: 'https://picsum.photos/720/405',
          high: 'https://picsum.photos/1080/608',
        }}
        style={styles.heroImage}
        resizeMode="cover"
      />

      {/* More content... */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  tierBadge: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  heroImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginVertical: 16,
  },
});
```

### 7. Video Player with Adaptive Quality

```typescript
// src/components/AdaptiveVideoPlayer.tsx
import React from 'react';
import Video from 'react-native-video';
import { usePerformance } from '../contexts/PerformanceContext';

interface VideoSource {
  '480p': string;
  '720p': string;
  '1080p': string;
}

interface AdaptiveVideoPlayerProps {
  sources: VideoSource;
  style?: any;
}

export function AdaptiveVideoPlayer({ sources, style }: AdaptiveVideoPlayerProps) {
  const { settings } = usePerformance();

  const videoUrl = sources[settings.videoQuality];

  return (
    <Video
      source={{ uri: videoUrl }}
      style={style}
      resizeMode="contain"
      // Reduce buffer on low-end devices
      bufferConfig={{
        minBufferMs: settings.videoQuality === '480p' ? 5000 : 15000,
        maxBufferMs: settings.videoQuality === '480p' ? 15000 : 50000,
        bufferForPlaybackMs: 2500,
        bufferForPlaybackAfterRebufferMs: 5000,
      }}
    />
  );
}
```

---

## Best Practices

### 1. Initialize Early

Always wrap your app with `PerformanceProvider` at the root level so all components have access to performance data.

```typescript
// App.tsx
<PerformanceProvider>
  <NavigationContainer>
    <RootNavigator />
  </NavigationContainer>
</PerformanceProvider>
```

### 2. Cache Results

The context automatically caches results for 24 hours. This ensures instant UI decisions on subsequent launches.

### 3. Use Sensible Defaults

Always have fallback values in case performance detection fails:

```typescript
const { tier = 'MEDIUM' } = usePerformance();
```

### 4. Don't Over-Optimize

Not everything needs to be adapted:
- Text rendering is fast everywhere
- Simple layouts don't need optimization
- Focus on: animations, images, lists, blur effects, shadows

### 5. Test on Real Low-End Devices

Always test your adaptations on actual low-end devices, not just simulators.

### 6. Monitor Performance Impact

Track how your adaptations affect:
- App startup time
- Frame rate
- Memory usage
- Battery drain

### 7. User Override Option

Consider letting users override automatic settings:

```typescript
// Let users force high-quality mode
const [userOverride, setUserOverride] = useState<PerformanceTier | null>(null);
const effectiveTier = userOverride ?? detectedTier;
```

---

## Complete Integration Checklist

- [ ] Install `react-native-device-performance`
- [ ] Run `pod install` for iOS
- [ ] Create `PerformanceContext.tsx`
- [ ] Wrap app with `PerformanceProvider`
- [ ] Create custom hooks for common use cases
- [ ] Update FlatLists with optimized config
- [ ] Add adaptive image loading
- [ ] Conditionally render animations
- [ ] Add conditional blur/shadows
- [ ] Test on low-end devices
- [ ] Add analytics for device tiers

---

## Troubleshooting

### Performance context is undefined

Make sure your component is inside the `PerformanceProvider`:

```typescript
// Wrong
function App() {
  const { tier } = usePerformance(); // Error!
  return <PerformanceProvider>...</PerformanceProvider>;
}

// Correct
function App() {
  return (
    <PerformanceProvider>
      <MainContent /> {/* usePerformance works here */}
    </PerformanceProvider>
  );
}
```

### Animations still laggy on low-end devices

Make sure you're checking `settings.enableAnimations` before running animations:

```typescript
const { settings } = usePerformance();

// Only animate if enabled
if (settings.enableAnimations) {
  Animated.spring(value, { toValue: 1 }).start();
} else {
  value.setValue(1); // Instant change
}
```

### Images loading slowly

Use smaller images for low-end devices and enable caching:

```typescript
<FastImage
  source={{
    uri: imageUrl,
    priority: FastImage.priority.normal,
    cache: FastImage.cacheControl.immutable,
  }}
/>
```
