import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import {
  getPerformanceScore,
  getDeviceSpecs,
  runBenchmark,
  PerformanceScore,
  DeviceSpecs,
  BenchmarkResults,
  PerformanceTier,
  PerformanceRecommendations,
} from './index';

// ==================== TYPES ====================

export interface PerformanceSettings extends PerformanceRecommendations {
  // Additional computed settings
  shouldReduceMotion: boolean;
  shouldUseSimpleComponents: boolean;
  shouldPreloadImages: boolean;
}

export interface PerformanceContextValue {
  // Performance data
  score: PerformanceScore | null;
  specs: DeviceSpecs | null;
  benchmarkResults: BenchmarkResults | null;

  // Loading states
  isLoading: boolean;
  isInitialized: boolean;
  isBenchmarking: boolean;

  // Computed values
  tier: PerformanceTier | null;
  settings: PerformanceSettings;

  // Tier helpers
  isLowEnd: boolean;
  isMidRange: boolean;
  isHighEnd: boolean;

  // Actions
  refresh: () => Promise<void>;
  runFullBenchmark: () => Promise<BenchmarkResults>;
}

// ==================== DEFAULT SETTINGS ====================

const DEFAULT_LOW_SETTINGS: PerformanceSettings = {
  enableAnimations: false,
  enableBlur: false,
  enableParallax: false,
  enableShadows: false,
  enableHaptics: false,
  imageQuality: 'low',
  videoQuality: '480p',
  listWindowSize: 5,
  maxConcurrentDownloads: 1,
  shouldReduceMotion: true,
  shouldUseSimpleComponents: true,
  shouldPreloadImages: false,
};

const DEFAULT_MEDIUM_SETTINGS: PerformanceSettings = {
  enableAnimations: true,
  enableBlur: true,
  enableParallax: false,
  enableShadows: true,
  enableHaptics: true,
  imageQuality: 'medium',
  videoQuality: '720p',
  listWindowSize: 11,
  maxConcurrentDownloads: 2,
  shouldReduceMotion: false,
  shouldUseSimpleComponents: false,
  shouldPreloadImages: true,
};

const DEFAULT_HIGH_SETTINGS: PerformanceSettings = {
  enableAnimations: true,
  enableBlur: true,
  enableParallax: true,
  enableShadows: true,
  enableHaptics: true,
  imageQuality: 'high',
  videoQuality: '1080p',
  listWindowSize: 21,
  maxConcurrentDownloads: 4,
  shouldReduceMotion: false,
  shouldUseSimpleComponents: false,
  shouldPreloadImages: true,
};

const DEFAULT_SETTINGS = DEFAULT_MEDIUM_SETTINGS;

// ==================== CONTEXT ====================

const PerformanceContext = createContext<PerformanceContextValue | undefined>(undefined);

// ==================== PROVIDER PROPS ====================

export interface PerformanceProviderProps {
  children: ReactNode;
  /**
   * Called when performance detection is complete
   */
  onInitialized?: (tier: PerformanceTier, score: PerformanceScore) => void;
  /**
   * Called when an error occurs
   */
  onError?: (error: Error) => void;
  /**
   * Enable caching of performance results
   * @default true
   */
  enableCaching?: boolean;
  /**
   * Cache key for AsyncStorage (requires @react-native-async-storage/async-storage)
   * @default '@device_performance_cache'
   */
  cacheKey?: string;
  /**
   * Cache expiry time in milliseconds
   * @default 86400000 (24 hours)
   */
  cacheExpiryMs?: number;
  /**
   * Custom storage implementation (defaults to in-memory if AsyncStorage not available)
   */
  storage?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
  };
}

// ==================== PROVIDER ====================

export function PerformanceProvider({
  children,
  onInitialized,
  onError,
  enableCaching = true,
  cacheKey = '@device_performance_cache',
  cacheExpiryMs = 24 * 60 * 60 * 1000,
  storage,
}: PerformanceProviderProps) {
  const [score, setScore] = useState<PerformanceScore | null>(null);
  const [specs, setSpecs] = useState<DeviceSpecs | null>(null);
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResults | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  // In-memory cache fallback
  const inMemoryCache = useMemo(() => {
    const cache: Record<string, string> = {};
    return {
      getItem: async (key: string) => cache[key] ?? null,
      setItem: async (key: string, value: string) => {
        cache[key] = value;
      },
    };
  }, []);

  const storageImpl = storage ?? inMemoryCache;

  // Load from cache
  const loadFromCache = useCallback(async (): Promise<{
    score: PerformanceScore;
    specs: DeviceSpecs;
  } | null> => {
    if (!enableCaching) return null;

    try {
      const cached = await storageImpl.getItem(cacheKey);
      if (cached) {
        const { score: cachedScore, specs: cachedSpecs, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < cacheExpiryMs) {
          return { score: cachedScore, specs: cachedSpecs };
        }
      }
    } catch {
      // Ignore cache errors
    }
    return null;
  }, [enableCaching, storageImpl, cacheKey, cacheExpiryMs]);

  // Save to cache
  const saveToCache = useCallback(
    async (performanceScore: PerformanceScore, deviceSpecs: DeviceSpecs) => {
      if (!enableCaching) return;

      try {
        await storageImpl.setItem(
          cacheKey,
          JSON.stringify({
            score: performanceScore,
            specs: deviceSpecs,
            timestamp: Date.now(),
          })
        );
      } catch {
        // Ignore cache errors
      }
    },
    [enableCaching, storageImpl, cacheKey]
  );

  // Initialize performance detection
  const initialize = useCallback(async () => {
    try {
      setIsLoading(true);

      // Try cache first for instant UI
      const cached = await loadFromCache();
      if (cached) {
        setScore(cached.score);
        setSpecs(cached.specs);
        setIsInitialized(true);
        onInitialized?.(cached.score.tier, cached.score);
      }

      // Fetch fresh data
      const [freshScore, freshSpecs] = await Promise.all([getPerformanceScore(), getDeviceSpecs()]);

      setScore(freshScore);
      setSpecs(freshSpecs);

      // Cache for next launch
      await saveToCache(freshScore, freshSpecs);

      if (!cached) {
        onInitialized?.(freshScore.tier, freshScore);
      }

      setIsInitialized(true);
    } catch (error) {
      console.error('Performance detection failed:', error);
      onError?.(error as Error);

      // Set fallback values
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
  }, [loadFromCache, saveToCache, onInitialized, onError]);

  // Initialize on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Refresh function
  const refresh = useCallback(async () => {
    await initialize();
  }, [initialize]);

  // Run full benchmark
  const runFullBenchmark = useCallback(async (): Promise<BenchmarkResults> => {
    setIsBenchmarking(true);
    try {
      const results = await runBenchmark();
      setBenchmarkResults(results);

      // Update score from benchmark results
      setScore((prev) =>
        prev
          ? {
              ...prev,
              cpu: results.cpuScore,
              memory: results.memoryScore,
              storage: results.storageScore,
              overall: results.overallScore,
              tier: results.performanceTier,
            }
          : null
      );

      return results;
    } finally {
      setIsBenchmarking(false);
    }
  }, []);

  // Compute settings based on tier
  const settings = useMemo((): PerformanceSettings => {
    if (!score) return DEFAULT_SETTINGS;

    const baseSettings =
      score.tier === 'HIGH'
        ? DEFAULT_HIGH_SETTINGS
        : score.tier === 'MEDIUM'
          ? DEFAULT_MEDIUM_SETTINGS
          : DEFAULT_LOW_SETTINGS;

    // Merge with recommendations if available
    if (score.recommendations) {
      return {
        ...baseSettings,
        ...score.recommendations,
        shouldReduceMotion: !score.recommendations.enableAnimations,
        shouldUseSimpleComponents: score.tier === 'LOW',
        shouldPreloadImages: score.tier !== 'LOW',
      };
    }

    return baseSettings;
  }, [score]);

  const tier = score?.tier ?? null;

  const value: PerformanceContextValue = {
    score,
    specs,
    benchmarkResults,
    isLoading,
    isInitialized,
    isBenchmarking,
    tier,
    settings,
    isLowEnd: tier === 'LOW',
    isMidRange: tier === 'MEDIUM',
    isHighEnd: tier === 'HIGH',
    refresh,
    runFullBenchmark,
  };

  return <PerformanceContext.Provider value={value}>{children}</PerformanceContext.Provider>;
}

// ==================== HOOKS ====================

/**
 * Hook to access performance context
 * Must be used within a PerformanceProvider
 */
export function usePerformance(): PerformanceContextValue {
  const context = useContext(PerformanceContext);
  if (context === undefined) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  return context;
}

/**
 * Hook to check if animations should be enabled
 */
export function useAnimationsEnabled(): boolean {
  const { settings, isInitialized } = usePerformance();
  // Enable animations by default until we know better
  return isInitialized ? settings.enableAnimations : true;
}

/**
 * Hook to check if blur effects should be enabled
 */
export function useBlurEnabled(): boolean {
  const { settings, isInitialized } = usePerformance();
  return isInitialized ? settings.enableBlur : true;
}

/**
 * Hook to check if shadows should be enabled
 */
export function useShadowsEnabled(): boolean {
  const { settings, isInitialized } = usePerformance();
  return isInitialized ? settings.enableShadows : true;
}

/**
 * Hook to get image quality setting
 */
export function useImageQuality(): 'low' | 'medium' | 'high' {
  const { settings, isInitialized } = usePerformance();
  return isInitialized ? settings.imageQuality : 'medium';
}

/**
 * Hook to get video quality setting
 */
export function useVideoQuality(): '480p' | '720p' | '1080p' {
  const { settings, isInitialized } = usePerformance();
  return isInitialized ? settings.videoQuality : '720p';
}

/**
 * Hook to get list window size for FlatList/VirtualizedList
 */
export function useListWindowSize(): number {
  const { settings, isInitialized } = usePerformance();
  return isInitialized ? settings.listWindowSize : 11;
}

/**
 * Hook for conditional rendering based on performance
 */
export function useConditionalRender() {
  const { isLowEnd, isMidRange, isHighEnd, settings, isInitialized } = usePerformance();

  return {
    // Initialized check
    isReady: isInitialized,

    // Render helpers
    shouldRenderAnimations: settings.enableAnimations,
    shouldRenderBlur: settings.enableBlur,
    shouldRenderShadows: settings.enableShadows,
    shouldRenderParallax: settings.enableParallax,
    shouldRenderHaptics: settings.enableHaptics,
    shouldReduceMotion: settings.shouldReduceMotion,
    shouldUseSimpleComponents: settings.shouldUseSimpleComponents,
    shouldPreloadImages: settings.shouldPreloadImages,

    // Quality settings
    imageQuality: settings.imageQuality,
    videoQuality: settings.videoQuality,
    listWindowSize: settings.listWindowSize,
    maxConcurrentDownloads: settings.maxConcurrentDownloads,

    // Tier checks
    isLowEnd,
    isMidRange,
    isHighEnd,
  };
}

/**
 * Hook to get optimized FlatList props
 */
export function useOptimizedListProps() {
  const { settings, tier, isInitialized } = usePerformance();

  return useMemo(() => {
    if (!isInitialized) {
      return {
        windowSize: 11,
        maxToRenderPerBatch: 5,
        updateCellsBatchingPeriod: 100,
        initialNumToRender: 7,
        removeClippedSubviews: true,
      };
    }

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
          windowSize: settings.listWindowSize,
          maxToRenderPerBatch: 5,
          updateCellsBatchingPeriod: 100,
          initialNumToRender: 7,
          removeClippedSubviews: true,
        };
      case 'LOW':
      default:
        return {
          windowSize: settings.listWindowSize,
          maxToRenderPerBatch: 2,
          updateCellsBatchingPeriod: 150,
          initialNumToRender: 3,
          removeClippedSubviews: true,
        };
    }
  }, [tier, settings, isInitialized]);
}

/**
 * Hook to get device summary string
 */
export function useDeviceSummary(): string {
  const { specs, score, isInitialized } = usePerformance();

  return useMemo(() => {
    if (!isInitialized || !specs || !score) {
      return 'Loading...';
    }

    const model = specs.device.modelName ?? specs.device.model;
    const tier = score.tier;
    const cores = specs.cpu.cores;
    const ramGB = (specs.memory.totalRam / (1024 * 1024 * 1024)).toFixed(1);

    return `${model} (${tier}) - ${cores} cores, ${ramGB}GB RAM`;
  }, [specs, score, isInitialized]);
}
