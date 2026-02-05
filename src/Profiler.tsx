import React, {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
} from 'react';
import { InteractionManager, LayoutAnimation, Platform, View, Text, StyleSheet, TouchableOpacity } from 'react-native';

// ==================== TYPES ====================

export interface ScreenMetrics {
  screenName: string;
  mountTime: number;
  renderTime: number;
  interactionTime: number;
  jsThreadTime?: number;
  timestamp: number;
  navigationType?: 'push' | 'pop' | 'replace' | 'initial';
  // Memory snapshot
  memoryUsage?: {
    usedJSHeapSize?: number;
    totalJSHeapSize?: number;
  };
}

export interface RenderMetrics {
  componentName: string;
  phase: 'mount' | 'update';
  actualDuration: number;
  baseDuration: number;
  startTime: number;
  commitTime: number;
  interactions?: Set<unknown>;
}

export interface ProfilerSession {
  sessionId: string;
  startTime: number;
  screens: ScreenMetrics[];
  renders: RenderMetrics[];
  slowRenders: RenderMetrics[];
  averageRenderTime: number;
  averageMountTime: number;
  slowestScreen: ScreenMetrics | null;
  totalScreenViews: number;
}

export interface ProfilerConfig {
  /**
   * Enable/disable profiler (default: __DEV__)
   */
  enabled?: boolean;

  /**
   * Threshold for "slow" render in ms (default: 16ms = 1 frame at 60fps)
   */
  slowRenderThreshold?: number;

  /**
   * Threshold for "slow" mount in ms (default: 100ms)
   */
  slowMountThreshold?: number;

  /**
   * Maximum renders to keep in memory (default: 100)
   */
  maxRenders?: number;

  /**
   * Maximum screens to keep in memory (default: 50)
   */
  maxScreens?: number;

  /**
   * Log slow renders to console (default: true in DEV)
   */
  logSlowRenders?: boolean;

  /**
   * Log screen transitions to console (default: true in DEV)
   */
  logScreenTransitions?: boolean;

  /**
   * Callback when a slow render is detected
   */
  onSlowRender?: (metrics: RenderMetrics) => void;

  /**
   * Callback when screen metrics are recorded
   */
  onScreenMetrics?: (metrics: ScreenMetrics) => void;

  /**
   * Send metrics to dashboard
   */
  sendToDashboard?: boolean;

  /**
   * Dashboard API URL for profiler metrics
   */
  dashboardUrl?: string;

  /**
   * Dashboard API key
   */
  dashboardApiKey?: string;
}

// ==================== CONTEXT ====================

interface ProfilerContextValue {
  config: ProfilerConfig;
  session: ProfilerSession;
  recordScreen: (metrics: ScreenMetrics) => void;
  recordRender: (metrics: RenderMetrics) => void;
  startScreenTimer: (screenName: string, navigationType?: string) => () => void;
  getSession: () => ProfilerSession;
  clearSession: () => void;
}

const defaultSession: ProfilerSession = {
  sessionId: Date.now().toString(36),
  startTime: Date.now(),
  screens: [],
  renders: [],
  slowRenders: [],
  averageRenderTime: 0,
  averageMountTime: 0,
  slowestScreen: null,
  totalScreenViews: 0,
};

const ProfilerContext = createContext<ProfilerContextValue | null>(null);

// ==================== PROVIDER ====================

export interface ProfilerProviderProps {
  children: React.ReactNode;
  config?: ProfilerConfig;
}

export function ProfilerProvider({ children, config = {} }: ProfilerProviderProps) {
  const defaultConfig: ProfilerConfig = {
    enabled: __DEV__,
    slowRenderThreshold: 16,
    slowMountThreshold: 100,
    maxRenders: 100,
    maxScreens: 50,
    logSlowRenders: __DEV__,
    logScreenTransitions: __DEV__,
    sendToDashboard: false,
    ...config,
  };

  const sessionRef = useRef<ProfilerSession>({ ...defaultSession });
  const [, forceUpdate] = useState(0);

  const recordScreen = useCallback((metrics: ScreenMetrics) => {
    if (!defaultConfig.enabled) return;

    const session = sessionRef.current;
    session.screens.push(metrics);
    session.totalScreenViews++;

    // Keep only last N screens
    if (session.screens.length > (defaultConfig.maxScreens ?? 50)) {
      session.screens.shift();
    }

    // Update averages
    const mountTimes = session.screens.map((s) => s.mountTime);
    session.averageMountTime =
      mountTimes.reduce((a, b) => a + b, 0) / mountTimes.length;

    // Track slowest screen
    if (
      !session.slowestScreen ||
      metrics.mountTime > session.slowestScreen.mountTime
    ) {
      session.slowestScreen = metrics;
    }

    if (defaultConfig.logScreenTransitions) {
      console.log(
        `[Profiler] Screen: ${metrics.screenName} | Mount: ${metrics.mountTime.toFixed(1)}ms | Render: ${metrics.renderTime.toFixed(1)}ms | Interactive: ${metrics.interactionTime.toFixed(1)}ms`
      );
    }

    if (defaultConfig.onScreenMetrics) {
      defaultConfig.onScreenMetrics(metrics);
    }

    forceUpdate((n) => n + 1);
  }, [defaultConfig]);

  const recordRender = useCallback((metrics: RenderMetrics) => {
    if (!defaultConfig.enabled) return;

    const session = sessionRef.current;
    session.renders.push(metrics);

    // Keep only last N renders
    if (session.renders.length > (defaultConfig.maxRenders ?? 100)) {
      session.renders.shift();
    }

    // Update averages
    const renderTimes = session.renders.map((r) => r.actualDuration);
    session.averageRenderTime =
      renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;

    // Check for slow render
    if (metrics.actualDuration > (defaultConfig.slowRenderThreshold ?? 16)) {
      session.slowRenders.push(metrics);

      if (defaultConfig.logSlowRenders) {
        console.warn(
          `[Profiler] Slow ${metrics.phase}: ${metrics.componentName} took ${metrics.actualDuration.toFixed(2)}ms`
        );
      }

      if (defaultConfig.onSlowRender) {
        defaultConfig.onSlowRender(metrics);
      }
    }
  }, [defaultConfig]);

  const startScreenTimer = useCallback((screenName: string, navigationType?: string) => {
    if (!defaultConfig.enabled) return () => {};

    const startTime = performance.now();
    let renderEndTime = 0;

    // Mark render end after next frame
    requestAnimationFrame(() => {
      renderEndTime = performance.now();
    });

    // Return cleanup function that records final metrics
    return () => {
      const mountTime = performance.now() - startTime;

      InteractionManager.runAfterInteractions(() => {
        const interactionTime = performance.now() - startTime;

        const metrics: ScreenMetrics = {
          screenName,
          mountTime,
          renderTime: renderEndTime - startTime,
          interactionTime,
          timestamp: Date.now(),
          navigationType: navigationType as ScreenMetrics['navigationType'],
        };

        recordScreen(metrics);
      });
    };
  }, [defaultConfig.enabled, recordScreen]);

  const getSession = useCallback(() => sessionRef.current, []);

  const clearSession = useCallback(() => {
    sessionRef.current = {
      ...defaultSession,
      sessionId: Date.now().toString(36),
      startTime: Date.now(),
    };
    forceUpdate((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({
      config: defaultConfig,
      session: sessionRef.current,
      recordScreen,
      recordRender,
      startScreenTimer,
      getSession,
      clearSession,
    }),
    [defaultConfig, recordScreen, recordRender, startScreenTimer, getSession, clearSession]
  );

  return (
    <ProfilerContext.Provider value={value}>
      {children}
    </ProfilerContext.Provider>
  );
}

// ==================== HOOKS ====================

export function useProfiler() {
  const context = useContext(ProfilerContext);
  if (!context) {
    throw new Error('useProfiler must be used within a ProfilerProvider');
  }
  return context;
}

/**
 * Hook to profile a screen's performance
 * Call at the top of your screen component
 *
 * @example
 * ```tsx
 * function HomeScreen() {
 *   useScreenProfiler('HomeScreen');
 *   return <View>...</View>;
 * }
 * ```
 */
export function useScreenProfiler(
  screenName: string,
  options: { navigationType?: string; disabled?: boolean } = {}
) {
  const context = useContext(ProfilerContext);
  const mountTimeRef = useRef(performance.now());
  const hasRecordedRef = useRef(false);

  useEffect(() => {
    if (!context || !context.config.enabled || options.disabled) return;

    const mountTime = performance.now() - mountTimeRef.current;
    let renderEndTime = performance.now();

    // Get render time after animation frame
    requestAnimationFrame(() => {
      renderEndTime = performance.now() - mountTimeRef.current;

      // Wait for interactions to complete
      InteractionManager.runAfterInteractions(() => {
        if (hasRecordedRef.current) return;
        hasRecordedRef.current = true;

        const interactionTime = performance.now() - mountTimeRef.current;

        context.recordScreen({
          screenName,
          mountTime,
          renderTime: renderEndTime,
          interactionTime,
          timestamp: Date.now(),
          navigationType: options.navigationType as ScreenMetrics['navigationType'],
        });
      });
    });
  }, [context, screenName, options.navigationType, options.disabled]);
}

/**
 * Hook to get current profiler session data
 */
export function useProfilerSession() {
  const context = useContext(ProfilerContext);
  return context?.session ?? defaultSession;
}

/**
 * Hook to get profiler stats
 */
export function useProfilerStats() {
  const session = useProfilerSession();

  return useMemo(() => ({
    totalScreenViews: session.totalScreenViews,
    averageMountTime: session.averageMountTime,
    averageRenderTime: session.averageRenderTime,
    slowRenderCount: session.slowRenders.length,
    slowestScreen: session.slowestScreen,
    recentScreens: session.screens.slice(-10),
    recentSlowRenders: session.slowRenders.slice(-10),
  }), [session]);
}

// ==================== PROFILER COMPONENT ====================

interface ProfiledComponentProps {
  id: string;
  children: React.ReactNode;
}

/**
 * Wrapper component that profiles render performance
 *
 * @example
 * ```tsx
 * <ProfiledComponent id="ExpensiveList">
 *   <ExpensiveListComponent />
 * </ProfiledComponent>
 * ```
 */
export function ProfiledComponent({ id, children }: ProfiledComponentProps) {
  const context = useContext(ProfilerContext);

  const onRenderCallback = useCallback(
    (
      id: string,
      phase: 'mount' | 'update',
      actualDuration: number,
      baseDuration: number,
      startTime: number,
      commitTime: number
    ) => {
      if (context) {
        context.recordRender({
          componentName: id,
          phase,
          actualDuration,
          baseDuration,
          startTime,
          commitTime,
        });
      }
    },
    [context]
  );

  if (!context?.config.enabled) {
    return <>{children}</>;
  }

  return (
    <React.Profiler id={id} onRender={onRenderCallback}>
      {children}
    </React.Profiler>
  );
}

// ==================== PROFILER OVERLAY ====================

interface ProfilerOverlayProps {
  visible?: boolean;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

/**
 * Debug overlay showing real-time profiler stats
 * Only renders in development mode
 */
export function ProfilerOverlay({ visible = true, position = 'bottom-right' }: ProfilerOverlayProps) {
  const stats = useProfilerStats();
  const [expanded, setExpanded] = useState(false);

  if (!__DEV__ || !visible) return null;

  const positionStyle = {
    'top-left': { top: 50, left: 10 },
    'top-right': { top: 50, right: 10 },
    'bottom-left': { bottom: 100, left: 10 },
    'bottom-right': { bottom: 100, right: 10 },
  }[position];

  return (
    <View style={[styles.overlay, positionStyle]}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)}>
        <View style={styles.header}>
          <Text style={styles.headerText}>Profiler</Text>
          <Text style={styles.badge}>
            {stats.slowRenderCount > 0 ? `${stats.slowRenderCount} slow` : 'OK'}
          </Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <Text style={styles.stat}>
            Screens: {stats.totalScreenViews}
          </Text>
          <Text style={styles.stat}>
            Avg Mount: {stats.averageMountTime.toFixed(1)}ms
          </Text>
          <Text style={styles.stat}>
            Avg Render: {stats.averageRenderTime.toFixed(2)}ms
          </Text>
          {stats.slowestScreen && (
            <Text style={styles.stat}>
              Slowest: {stats.slowestScreen.screenName} ({stats.slowestScreen.mountTime.toFixed(0)}ms)
            </Text>
          )}

          <Text style={styles.sectionTitle}>Recent Screens:</Text>
          {stats.recentScreens.slice(-3).map((s, i) => (
            <Text key={i} style={styles.listItem}>
              {s.screenName}: {s.mountTime.toFixed(0)}ms
            </Text>
          ))}

          {stats.recentSlowRenders.length > 0 && (
            <>
              <Text style={styles.sectionTitleWarning}>Slow Renders:</Text>
              {stats.recentSlowRenders.slice(-3).map((r, i) => (
                <Text key={i} style={styles.listItemWarning}>
                  {r.componentName}: {r.actualDuration.toFixed(1)}ms
                </Text>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 8,
    padding: 8,
    minWidth: 150,
    zIndex: 9999,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  badge: {
    backgroundColor: '#22c55e',
    color: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 10,
    overflow: 'hidden',
  },
  content: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 8,
  },
  stat: {
    color: '#fff',
    fontSize: 11,
    marginBottom: 2,
  },
  sectionTitle: {
    color: '#3b82f6',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitleWarning: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
  },
  listItem: {
    color: '#9ca3af',
    fontSize: 10,
    marginLeft: 8,
  },
  listItemWarning: {
    color: '#fbbf24',
    fontSize: 10,
    marginLeft: 8,
  },
});

// ==================== NAVIGATION INTEGRATION ====================

/**
 * Create a screen listener for React Navigation
 * Automatically profiles all screen transitions
 *
 * @example
 * ```tsx
 * // In your navigation container
 * const { recordScreen } = useProfiler();
 * const screenListener = createNavigationListener(recordScreen);
 *
 * <NavigationContainer onStateChange={screenListener.onStateChange}>
 *   ...
 * </NavigationContainer>
 * ```
 */
export function createNavigationListener(recordScreen: (metrics: ScreenMetrics) => void) {
  let lastScreen: string | null = null;
  let navigationStart = 0;

  return {
    onStateChange: (state: unknown) => {
      const currentScreen = getActiveRouteName(state);

      if (currentScreen && currentScreen !== lastScreen) {
        const now = performance.now();

        if (lastScreen && navigationStart) {
          // Record transition time
          const transitionTime = now - navigationStart;
          console.log(`[Profiler] Navigation: ${lastScreen} -> ${currentScreen} (${transitionTime.toFixed(0)}ms)`);
        }

        lastScreen = currentScreen;
        navigationStart = now;

        // Use InteractionManager to measure when screen is interactive
        InteractionManager.runAfterInteractions(() => {
          const mountTime = performance.now() - navigationStart;
          recordScreen({
            screenName: currentScreen,
            mountTime,
            renderTime: mountTime * 0.7, // Estimate
            interactionTime: mountTime,
            timestamp: Date.now(),
            navigationType: 'push',
          });
        });
      }
    },
  };
}

// Helper to get active route name from navigation state
function getActiveRouteName(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null;
  const navState = state as { routes?: { name: string; state?: unknown }[]; index?: number };

  if (!navState.routes || navState.index === undefined) return null;

  const route = navState.routes[navState.index];
  if (!route) return null;

  // Dive into nested navigators
  if (route.state) {
    return getActiveRouteName(route.state);
  }

  return route.name;
}

// ==================== EXPORT ====================

export default {
  ProfilerProvider,
  ProfiledComponent,
  ProfilerOverlay,
  useProfiler,
  useScreenProfiler,
  useProfilerSession,
  useProfilerStats,
  createNavigationListener,
};
