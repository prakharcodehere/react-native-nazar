/**
 * React Hooks for NazarProfiler
 *
 * Provides easy integration with React components and navigation
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { NazarProfiler, ComponentMetrics, ScreenMetrics, GlobalMetrics, ProfilerData } from './NazarProfiler';

// ==================== useProfiledComponent ====================

export interface UseProfiledComponentOptions {
  /** Component name for tracking */
  name: string;
  /** Track renders (default: true) */
  trackRenders?: boolean;
  /** Track mounts (default: true) */
  trackMounts?: boolean;
}

/**
 * Hook to profile a component's render performance
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { metrics, isSlowRender } = useProfiledComponent({ name: 'MyComponent' });
 *   // ...
 * }
 * ```
 */
export function useProfiledComponent(options: UseProfiledComponentOptions) {
  const { name, trackRenders = true, trackMounts = true } = options;
  const mountTimeRef = useRef<number>(0);
  const renderStartRef = useRef<number>(Date.now());
  const [metrics, setMetrics] = useState<ComponentMetrics | null>(null);

  // Track mount
  useEffect(() => {
    if (!trackMounts) return;

    const mountTime = Date.now() - mountTimeRef.current;
    NazarProfiler.componentDidMount(name, mountTime);

    return () => {
      // Component unmounted
    };
  }, [name, trackMounts]);

  // Track renders
  useEffect(() => {
    if (!trackRenders) return;

    const renderTime = Date.now() - renderStartRef.current;
    if (renderTime > 0) {
      NazarProfiler.componentDidRender(name, renderTime);
    }

    // Update metrics
    const currentMetrics = NazarProfiler.getComponentMetrics(name);
    setMetrics(currentMetrics);

    // Reset for next render
    renderStartRef.current = Date.now();
  });

  // Set mount start time
  mountTimeRef.current = mountTimeRef.current || Date.now();

  const isSlowRender = useMemo(() => {
    return metrics ? metrics.lastRenderTime > 16 : false;
  }, [metrics]);

  return {
    metrics,
    isSlowRender,
    averageRenderTime: metrics?.averageRenderTime ?? 0,
    renderCount: metrics?.renderCount ?? 0,
  };
}

// ==================== useProfiledScreen ====================

export interface UseProfiledScreenOptions {
  /** Screen name for tracking */
  screenName: string;
  /** Auto-track interactions (default: true) */
  trackInteractions?: boolean;
}

/**
 * Hook to profile a screen's overall performance
 *
 * Usage:
 * ```tsx
 * function HomeScreen() {
 *   const { metrics, summary } = useProfiledScreen({ screenName: 'Home' });
 *   // ...
 * }
 * ```
 */
export function useProfiledScreen(options: UseProfiledScreenOptions) {
  const { screenName, trackInteractions = true } = options;
  const [metrics, setMetrics] = useState<ScreenMetrics | null>(null);

  // Track screen entry/exit
  useEffect(() => {
    NazarProfiler.enterScreen(screenName);

    // Update metrics periodically
    const interval = setInterval(() => {
      const currentMetrics = NazarProfiler.getScreenMetrics(screenName);
      setMetrics(currentMetrics);
    }, 1000);

    return () => {
      clearInterval(interval);
      NazarProfiler.exitScreen(screenName);
    };
  }, [screenName]);

  // Track interactions
  const trackInteraction = useCallback(() => {
    if (trackInteractions) {
      NazarProfiler.trackInteraction();
    }
  }, [trackInteractions]);

  const summary = useMemo(() => {
    return NazarProfiler.getCurrentScreenSummary();
  }, [metrics]);

  return {
    metrics,
    summary,
    trackInteraction,
    isCurrentScreen: NazarProfiler.getCurrentScreen() === screenName,
  };
}

// ==================== useProfilerSession ====================

export interface UseProfilerSessionOptions {
  /** Auto-start profiling (default: false in production, true in dev) */
  autoStart?: boolean;
  /** Slow render threshold in ms (default: 16) */
  slowRenderThreshold?: number;
  /** Memory spike threshold in bytes (default: 50MB) */
  memorySpikeThreshold?: number;
}

/**
 * Hook to manage profiler session
 *
 * Usage:
 * ```tsx
 * function App() {
 *   const { start, stop, globalMetrics, isRunning } = useProfilerSession({ autoStart: __DEV__ });
 *   // ...
 * }
 * ```
 */
export function useProfilerSession(options: UseProfilerSessionOptions = {}) {
  const { autoStart = __DEV__, slowRenderThreshold, memorySpikeThreshold } = options;

  const [isRunning, setIsRunning] = useState(NazarProfiler.isEnabled());
  const [globalMetrics, setGlobalMetrics] = useState<GlobalMetrics | null>(null);

  // Configure thresholds
  useEffect(() => {
    NazarProfiler.configure({
      slowRenderThreshold,
      memorySpikeThreshold,
    });
  }, [slowRenderThreshold, memorySpikeThreshold]);

  // Auto-start if enabled
  useEffect(() => {
    if (autoStart && !NazarProfiler.isEnabled()) {
      NazarProfiler.start();
      setIsRunning(true);
    }

    // Update metrics periodically
    const interval = setInterval(() => {
      if (NazarProfiler.isEnabled()) {
        setGlobalMetrics(NazarProfiler.getGlobalMetrics());
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [autoStart]);

  const start = useCallback(() => {
    NazarProfiler.start();
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    const snapshot = NazarProfiler.stop();
    setIsRunning(false);
    return snapshot;
  }, []);

  const reset = useCallback(() => {
    NazarProfiler.reset();
    setGlobalMetrics(NazarProfiler.getGlobalMetrics());
  }, []);

  const getSnapshot = useCallback(() => {
    return NazarProfiler.getSnapshot();
  }, []);

  const getSlowRenders = useCallback(() => {
    return NazarProfiler.getSlowRenders();
  }, []);

  return {
    isRunning,
    globalMetrics,
    start,
    stop,
    reset,
    getSnapshot,
    getSlowRenders,
  };
}

// ==================== useProfilerEvents ====================

/**
 * Hook to subscribe to profiler events
 *
 * Usage:
 * ```tsx
 * function PerformanceMonitor() {
 *   useProfilerEvents({
 *     onSlowRender: ({ componentName, renderTime }) => {
 *       console.warn(`Slow render: ${componentName} took ${renderTime}ms`);
 *     },
 *   });
 * }
 * ```
 */
export function useProfilerEvents(handlers: {
  onScreenEnter?: (payload: { screenName: string; timestamp: number }) => void;
  onScreenExit?: (payload: { screenName: string; metrics: ScreenMetrics }) => void;
  onSlowRender?: (payload: { componentName: string; renderTime: number; threshold: number }) => void;
  onMemorySpike?: (payload: { delta: number; current: number; threshold: number }) => void;
  onFrameDrop?: (payload: { fps: number; droppedFrames: number }) => void;
  onJank?: (payload: { blockTime: number; source: string }) => void;
}) {
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    if (handlers.onScreenEnter) {
      unsubscribers.push(NazarProfiler.on('onScreenEnter', handlers.onScreenEnter));
    }
    if (handlers.onScreenExit) {
      unsubscribers.push(NazarProfiler.on('onScreenExit', handlers.onScreenExit));
    }
    if (handlers.onSlowRender) {
      unsubscribers.push(NazarProfiler.on('onSlowRender', handlers.onSlowRender));
    }
    if (handlers.onMemorySpike) {
      unsubscribers.push(NazarProfiler.on('onMemorySpike', handlers.onMemorySpike));
    }
    if (handlers.onFrameDrop) {
      unsubscribers.push(NazarProfiler.on('onFrameDrop', handlers.onFrameDrop));
    }
    if (handlers.onJank) {
      unsubscribers.push(NazarProfiler.on('onJank', handlers.onJank));
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [
    handlers.onScreenEnter,
    handlers.onScreenExit,
    handlers.onSlowRender,
    handlers.onMemorySpike,
    handlers.onFrameDrop,
    handlers.onJank,
  ]);
}

// ==================== withProfiler HOC ====================

/**
 * Higher-order component to add profiling to any component
 *
 * Usage:
 * ```tsx
 * const ProfiledMyComponent = withProfiler(MyComponent, 'MyComponent');
 * ```
 */
export function withProfiler<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName: string
): React.FC<P> {
  const ProfiledComponent: React.FC<P> = (props) => {
    useProfiledComponent({ name: componentName });
    return <WrappedComponent {...props} />;
  };

  ProfiledComponent.displayName = `Profiled(${componentName})`;

  return ProfiledComponent;
}

// ==================== useProfilerData ====================

export interface UseProfilerDataOptions {
  /** Update interval in ms (default: 500) */
  updateInterval?: number;
  /** Auto-start profiler if not running (default: true) */
  autoStart?: boolean;
  /** Track FPS (default: true) */
  trackFps?: boolean;
}

/**
 * Hook to get comprehensive profiler data for building custom UI
 *
 * This is the main hook users should use to build custom performance monitoring UIs.
 * It provides all metrics in a single, easy-to-use object that updates at the specified interval.
 *
 * Usage:
 * ```tsx
 * function MyCustomProfiler() {
 *   const data = useProfilerData({ updateInterval: 500 });
 *
 *   return (
 *     <View>
 *       <Text>FPS: {data.fps.current}</Text>
 *       <Text>Memory: {data.memory.formatted.current}</Text>
 *       <Text>Health: {data.health.status}</Text>
 *       <Text>Custom: {data.customData.myKey}</Text>
 *     </View>
 *   );
 * }
 * ```
 */
export function useProfilerData(options: UseProfilerDataOptions = {}): ProfilerData {
  const { updateInterval = 500, autoStart = true, trackFps = true } = options;

  const [data, setData] = useState<ProfilerData>(() => NazarProfiler.getProfilerData());
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());

  // Auto-start profiler
  useEffect(() => {
    if (autoStart && !NazarProfiler.isEnabled()) {
      NazarProfiler.start();
    }
  }, [autoStart]);

  // FPS tracking using requestAnimationFrame
  useEffect(() => {
    if (!trackFps) return;

    let animationId: number;
    let frames = 0;
    let lastTime = performance.now();

    const countFrame = (currentTime: number) => {
      frames++;

      // Calculate FPS every second
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round(frames * 1000 / (currentTime - lastTime));
        NazarProfiler.recordFps(Math.min(fps, 120));
        frames = 0;
        lastTime = currentTime;
      }

      animationId = requestAnimationFrame(countFrame);
    };

    animationId = requestAnimationFrame(countFrame);

    return () => cancelAnimationFrame(animationId);
  }, [trackFps]);

  // Update data at interval
  useEffect(() => {
    const interval = setInterval(() => {
      setData(NazarProfiler.getProfilerData());
    }, updateInterval);

    return () => clearInterval(interval);
  }, [updateInterval]);

  return data;
}

/**
 * Set custom data that will be available in useProfilerData().customData
 *
 * Usage:
 * ```tsx
 * // Set custom data
 * setProfilerCustomData('apiCalls', 42);
 * setProfilerCustomData('lastError', 'Network timeout');
 *
 * // Access in useProfilerData
 * const data = useProfilerData();
 * console.log(data.customData.apiCalls); // 42
 * ```
 */
export function setProfilerCustomData(key: string, value: any): void {
  NazarProfiler.setCustomData(key, value);
}

/**
 * Get custom data from profiler
 */
export function getProfilerCustomData(key: string): any {
  return NazarProfiler.getCustomData(key);
}

/**
 * Clear profiler custom data
 */
export function clearProfilerCustomData(key?: string): void {
  NazarProfiler.clearCustomData(key);
}

// ==================== Navigation Integration ====================

/**
 * Create navigation state listener for profiler
 *
 * Usage with React Navigation:
 * ```tsx
 * const navigationRef = useNavigationContainerRef();
 *
 * useEffect(() => {
 *   return navigationRef.addListener('state', createNavigationListener());
 * }, []);
 * ```
 */
export function createNavigationListener() {
  let currentRouteName: string | undefined;

  return (state: any) => {
    const getActiveRouteName = (navState: any): string | undefined => {
      if (!navState) return undefined;
      if (!navState.routes || navState.index === undefined) return undefined;

      const route = navState.routes[navState.index];
      if (route.state) {
        return getActiveRouteName(route.state);
      }
      return route.name;
    };

    // Handle both onStateChange (direct state) and listener format (state.data.state)
    const navState = state?.data?.state || state;
    const routeName = getActiveRouteName(navState);

    if (routeName && routeName !== currentRouteName) {
      if (currentRouteName) {
        NazarProfiler.exitScreen(currentRouteName);
      }
      NazarProfiler.enterScreen(routeName);
      currentRouteName = routeName;
    }
  };
}

export default {
  useProfiledComponent,
  useProfiledScreen,
  useProfilerSession,
  useProfilerEvents,
  useProfilerData,
  withProfiler,
  createNavigationListener,
  setProfilerCustomData,
  getProfilerCustomData,
  clearProfilerCustomData,
};
