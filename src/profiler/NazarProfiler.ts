/**
 * NazarProfiler - Performance profiling for React Native components
 *
 * Tracks:
 * - Component render times
 * - Memory impact per screen
 * - Frame rate during interactions
 * - JS thread blocking
 * - Re-render frequency
 */

import { InteractionManager, NativeModules, Platform } from 'react-native';

const NazarModule = NativeModules.Nazar;

// ==================== Types ====================

export interface ComponentMetrics {
  componentName: string;
  mountTime: number;
  lastRenderTime: number;
  averageRenderTime: number;
  renderCount: number;
  totalRenderTime: number;
  memoryDelta: number;
  memoryAtMount: number;
  currentMemory: number;
  timestamp: number;
}

export interface ScreenMetrics extends ComponentMetrics {
  screenName: string;
  timeOnScreen: number;
  interactionCount: number;
  averageFps: number;
  droppedFrames: number;
  jsThreadBlockTime: number;
  childComponents: Map<string, ComponentMetrics>;
}

export interface ProfilerSnapshot {
  timestamp: number;
  currentScreen: string | null;
  screens: Map<string, ScreenMetrics>;
  globalMetrics: GlobalMetrics;
}

export interface GlobalMetrics {
  totalMounts: number;
  totalRenders: number;
  averageRenderTime: number;
  peakMemoryUsage: number;
  currentMemoryUsage: number;
  sessionDuration: number;
  averageFps: number;
  slowRenders: number; // renders > 16ms
  verySlowRenders: number; // renders > 100ms
}

/**
 * Comprehensive profiler data object for custom UI
 * This provides all metrics in a single, easy-to-use object
 */
export interface ProfilerData {
  // Session info
  isRunning: boolean;
  sessionDuration: number;
  sessionStartTime: number;
  platform: string;

  // FPS metrics
  fps: {
    current: number;
    min: number;
    max: number;
    average: number;
    history: number[];
    target: number;
    score: number; // 0-100 based on target
  };

  // Memory metrics
  memory: {
    current: number;
    peak: number;
    delta: number;
    formatted: {
      current: string;
      peak: string;
    };
  };

  // Render metrics
  renders: {
    total: number;
    slow: number;
    verySlow: number;
    averageTime: number;
    lastTime: number;
  };

  // Screen metrics
  screen: {
    name: string;
    timeOnScreen: number;
    renderCount: number;
    averageRenderTime: number;
    lastRenderTime: number;
    interactionCount: number;
    componentCount: number;
    droppedFrames: number;
    score: number; // 0-100
    issues: string[];
  };

  // Component metrics (for current screen)
  components: Array<{
    name: string;
    renderCount: number;
    averageRenderTime: number;
    lastRenderTime: number;
    isSlow: boolean;
  }>;

  // Thread metrics (simulated)
  threads: {
    ui: {
      usage: number;
      blocked: boolean;
    };
    js: {
      usage: number;
      blockTime: number;
    };
  };

  // Navigation
  navigation: {
    totalScreenViews: number;
    screensVisited: string[];
  };

  // Overall health score
  health: {
    score: number; // 0-100
    status: 'excellent' | 'good' | 'fair' | 'poor';
    issues: string[];
  };

  // Custom data storage
  customData: Record<string, any>;
}

export interface FrameMetrics {
  fps: number;
  droppedFrames: number;
  jank: boolean;
}

export type ProfilerEventType =
  | 'onScreenEnter'
  | 'onScreenExit'
  | 'onSlowRender'
  | 'onMemorySpike'
  | 'onFrameDrop'
  | 'onJank';

export interface ProfilerEventPayload {
  onScreenEnter: { screenName: string; timestamp: number };
  onScreenExit: { screenName: string; metrics: ScreenMetrics };
  onSlowRender: { componentName: string; renderTime: number; threshold: number };
  onMemorySpike: { delta: number; current: number; threshold: number };
  onFrameDrop: { fps: number; droppedFrames: number };
  onJank: { blockTime: number; source: string };
}

// ==================== Profiler Class ====================

class NazarProfilerClass {
  private static instance: NazarProfilerClass;

  private enabled: boolean = false;
  private sessionStartTime: number = 0;
  private currentScreen: string | null = null;
  private screens: Map<string, ScreenMetrics> = new Map();
  private globalMetrics: GlobalMetrics;
  private listeners: Map<string, Set<Function>> = new Map();
  private frameCallback: number | null = null;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private droppedFrameCount: number = 0;

  // FPS history tracking
  private fpsHistory: number[] = [];
  private currentFps: number = 60;
  private minFps: number = 60;
  private maxFps: number = 60;

  // Custom data storage
  private customData: Record<string, any> = {};

  // Screen history
  private screensVisited: string[] = [];

  // Thresholds
  private slowRenderThreshold: number = 16; // 60fps = 16.67ms per frame
  private verySlowRenderThreshold: number = 100;
  private memorySpikeThreshold: number = 50 * 1024 * 1024; // 50MB
  private targetFps: number = 60;

  private constructor() {
    this.globalMetrics = this.createEmptyGlobalMetrics();
  }

  static getInstance(): NazarProfilerClass {
    if (!NazarProfilerClass.instance) {
      NazarProfilerClass.instance = new NazarProfilerClass();
    }
    return NazarProfilerClass.instance;
  }

  // ==================== Lifecycle ====================

  /**
   * Start profiling session
   */
  start(): void {
    if (this.enabled) return;

    this.enabled = true;
    this.sessionStartTime = Date.now();
    this.globalMetrics = this.createEmptyGlobalMetrics();
    this.screens.clear();
    this.startFrameTracking();

    console.log('[NazarProfiler] Started profiling session');
  }

  /**
   * Stop profiling session
   */
  stop(): ProfilerSnapshot {
    if (!this.enabled) {
      return this.getSnapshot();
    }

    this.enabled = false;
    this.stopFrameTracking();

    const snapshot = this.getSnapshot();
    console.log('[NazarProfiler] Stopped profiling session');

    return snapshot;
  }

  /**
   * Check if profiler is active
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Configure thresholds
   */
  configure(options: {
    slowRenderThreshold?: number;
    verySlowRenderThreshold?: number;
    memorySpikeThreshold?: number;
  }): void {
    if (options.slowRenderThreshold !== undefined) {
      this.slowRenderThreshold = options.slowRenderThreshold;
    }
    if (options.verySlowRenderThreshold !== undefined) {
      this.verySlowRenderThreshold = options.verySlowRenderThreshold;
    }
    if (options.memorySpikeThreshold !== undefined) {
      this.memorySpikeThreshold = options.memorySpikeThreshold;
    }
  }

  // ==================== Screen Tracking ====================

  /**
   * Track screen entry
   */
  enterScreen(screenName: string): void {
    if (!this.enabled) return;

    // Exit current screen first
    if (this.currentScreen && this.currentScreen !== screenName) {
      this.exitScreen(this.currentScreen);
    }

    this.currentScreen = screenName;

    // Track visited screens
    if (!this.screensVisited.includes(screenName)) {
      this.screensVisited.push(screenName);
    }

    if (!this.screens.has(screenName)) {
      this.screens.set(screenName, this.createEmptyScreenMetrics(screenName));
    }

    const metrics = this.screens.get(screenName)!;
    metrics.timestamp = Date.now();
    metrics.memoryAtMount = this.getCurrentMemory();

    // Only count mounts, not renders - renders are tracked by useProfiledComponent
    this.globalMetrics.totalMounts++;

    this.emit('onScreenEnter', { screenName, timestamp: metrics.timestamp });
  }

  /**
   * Track screen exit
   */
  exitScreen(screenName: string): void {
    if (!this.enabled) return;

    const metrics = this.screens.get(screenName);
    if (metrics) {
      metrics.timeOnScreen += Date.now() - metrics.timestamp;
      metrics.currentMemory = this.getCurrentMemory();
      metrics.memoryDelta = metrics.currentMemory - metrics.memoryAtMount;

      this.emit('onScreenExit', { screenName, metrics });
    }

    if (this.currentScreen === screenName) {
      this.currentScreen = null;
    }
  }

  /**
   * Get current screen name
   */
  getCurrentScreen(): string | null {
    return this.currentScreen;
  }

  // ==================== Component Tracking ====================

  /**
   * Track component mount
   */
  componentDidMount(componentName: string, mountTime: number): void {
    if (!this.enabled || !this.currentScreen) return;

    const screenMetrics = this.screens.get(this.currentScreen);
    if (!screenMetrics) return;

    const existingMetrics = screenMetrics.childComponents.get(componentName);

    if (existingMetrics) {
      existingMetrics.mountTime = mountTime;
      existingMetrics.renderCount++;
      existingMetrics.totalRenderTime += mountTime;
      existingMetrics.averageRenderTime =
        existingMetrics.totalRenderTime / existingMetrics.renderCount;
      existingMetrics.timestamp = Date.now();
    } else {
      screenMetrics.childComponents.set(componentName, {
        componentName,
        mountTime,
        lastRenderTime: mountTime,
        averageRenderTime: mountTime,
        renderCount: 1,
        totalRenderTime: mountTime,
        memoryDelta: 0,
        memoryAtMount: this.getCurrentMemory(),
        currentMemory: this.getCurrentMemory(),
        timestamp: Date.now(),
      });
    }

    this.globalMetrics.totalMounts++;
    this.trackRenderTime(componentName, mountTime);
  }

  /**
   * Track component render
   */
  componentDidRender(componentName: string, renderTime: number): void {
    if (!this.enabled || !this.currentScreen) return;

    const screenMetrics = this.screens.get(this.currentScreen);
    if (!screenMetrics) return;

    const metrics = screenMetrics.childComponents.get(componentName);
    if (metrics) {
      metrics.lastRenderTime = renderTime;
      metrics.renderCount++;
      metrics.totalRenderTime += renderTime;
      metrics.averageRenderTime = metrics.totalRenderTime / metrics.renderCount;
      metrics.timestamp = Date.now();
    }

    this.globalMetrics.totalRenders++;
    this.trackRenderTime(componentName, renderTime);
  }

  /**
   * Track interaction on current screen
   */
  trackInteraction(): void {
    if (!this.enabled || !this.currentScreen) return;

    const metrics = this.screens.get(this.currentScreen);
    if (metrics) {
      metrics.interactionCount++;
    }
  }

  // ==================== Frame Tracking ====================

  private startFrameTracking(): void {
    if (Platform.OS === 'web') return;

    this.lastFrameTime = Date.now();
    this.frameCount = 0;
    this.droppedFrameCount = 0;

    const trackFrame = () => {
      if (!this.enabled) return;

      const now = Date.now();
      const delta = now - this.lastFrameTime;

      if (delta > 0) {
        this.frameCount++;

        // Detect dropped frames (expecting 60fps = ~16.67ms per frame)
        const expectedFrames = Math.floor(delta / 16.67);
        if (expectedFrames > 1) {
          this.droppedFrameCount += expectedFrames - 1;

          if (this.currentScreen) {
            const metrics = this.screens.get(this.currentScreen);
            if (metrics) {
              metrics.droppedFrames += expectedFrames - 1;
            }
          }

          this.emit('onFrameDrop', {
            fps: Math.round(1000 / delta),
            droppedFrames: expectedFrames - 1,
          });
        }

        // Update average FPS
        const sessionDuration = (now - this.sessionStartTime) / 1000;
        if (sessionDuration > 0) {
          this.globalMetrics.averageFps = Math.round(this.frameCount / sessionDuration);
        }

        // Update current screen FPS
        if (this.currentScreen) {
          const metrics = this.screens.get(this.currentScreen);
          if (metrics && metrics.timeOnScreen > 0) {
            const screenTime = (now - metrics.timestamp + metrics.timeOnScreen) / 1000;
            metrics.averageFps = Math.round(this.frameCount / screenTime);
          }
        }
      }

      this.lastFrameTime = now;

      // Use InteractionManager for better performance
      InteractionManager.runAfterInteractions(() => {
        if (this.enabled) {
          requestAnimationFrame(trackFrame);
        }
      });
    };

    requestAnimationFrame(trackFrame);
  }

  private stopFrameTracking(): void {
    // Frame tracking stops automatically when enabled = false
  }

  // ==================== Memory Tracking ====================

  private getCurrentMemory(): number {
    // Try to get memory from native module
    try {
      if (NazarModule?.getCurrentMemoryUsage) {
        return NazarModule.getCurrentMemoryUsage();
      }
    } catch {
      // Fallback
    }

    // Fallback: Use performance API if available (limited in RN)
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize || 0;
    }

    return 0;
  }

  private checkMemorySpike(current: number): void {
    const delta = current - this.globalMetrics.currentMemoryUsage;

    if (delta > this.memorySpikeThreshold) {
      this.emit('onMemorySpike', {
        delta,
        current,
        threshold: this.memorySpikeThreshold,
      });
    }

    if (current > this.globalMetrics.peakMemoryUsage) {
      this.globalMetrics.peakMemoryUsage = current;
    }

    this.globalMetrics.currentMemoryUsage = current;
  }

  // ==================== Render Time Tracking ====================

  private trackRenderTime(componentName: string, renderTime: number): void {
    // Update global average
    const totalTime =
      this.globalMetrics.averageRenderTime * (this.globalMetrics.totalRenders - 1) + renderTime;
    this.globalMetrics.averageRenderTime = totalTime / this.globalMetrics.totalRenders;

    // Check for slow renders
    if (renderTime > this.verySlowRenderThreshold) {
      this.globalMetrics.verySlowRenders++;
      this.emit('onSlowRender', {
        componentName,
        renderTime,
        threshold: this.verySlowRenderThreshold,
      });
    } else if (renderTime > this.slowRenderThreshold) {
      this.globalMetrics.slowRenders++;
      this.emit('onSlowRender', {
        componentName,
        renderTime,
        threshold: this.slowRenderThreshold,
      });
    }
  }

  // ==================== JS Thread Tracking ====================

  /**
   * Track JS thread blocking
   */
  trackJsBlock(blockTime: number, source: string): void {
    if (!this.enabled) return;

    if (this.currentScreen) {
      const metrics = this.screens.get(this.currentScreen);
      if (metrics) {
        metrics.jsThreadBlockTime += blockTime;
      }
    }

    if (blockTime > 50) {
      // 50ms is noticeable
      this.emit('onJank', { blockTime, source });
    }
  }

  // ==================== Data Access ====================

  /**
   * Get current snapshot of all metrics
   */
  getSnapshot(): ProfilerSnapshot {
    this.globalMetrics.sessionDuration = (Date.now() - this.sessionStartTime) / 1000;

    return {
      timestamp: Date.now(),
      currentScreen: this.currentScreen,
      screens: new Map(this.screens),
      globalMetrics: { ...this.globalMetrics },
    };
  }

  /**
   * Get metrics for specific screen
   */
  getScreenMetrics(screenName: string): ScreenMetrics | null {
    return this.screens.get(screenName) || null;
  }

  /**
   * Get metrics for current screen
   */
  getCurrentScreenMetrics(): ScreenMetrics | null {
    if (!this.currentScreen) return null;
    return this.screens.get(this.currentScreen) || null;
  }

  /**
   * Get global metrics
   */
  getGlobalMetrics(): GlobalMetrics {
    return { ...this.globalMetrics };
  }

  /**
   * Get component metrics on current screen
   */
  getComponentMetrics(componentName: string): ComponentMetrics | null {
    if (!this.currentScreen) return null;
    const screenMetrics = this.screens.get(this.currentScreen);
    if (!screenMetrics) return null;
    return screenMetrics.childComponents.get(componentName) || null;
  }

  /**
   * Get all slow renders
   */
  getSlowRenders(): Array<{ componentName: string; renderTime: number; screenName: string }> {
    const slowRenders: Array<{ componentName: string; renderTime: number; screenName: string }> =
      [];

    this.screens.forEach((screenMetrics, screenName) => {
      screenMetrics.childComponents.forEach((componentMetrics, componentName) => {
        if (componentMetrics.lastRenderTime > this.slowRenderThreshold) {
          slowRenders.push({
            componentName,
            renderTime: componentMetrics.lastRenderTime,
            screenName,
          });
        }
      });
    });

    return slowRenders.sort((a, b) => b.renderTime - a.renderTime);
  }

  /**
   * Get performance summary for current screen
   */
  getCurrentScreenSummary(): {
    screenName: string;
    score: number;
    issues: string[];
    metrics: {
      renderTime: number;
      fps: number;
      memoryImpact: number;
      componentCount: number;
    };
  } | null {
    if (!this.currentScreen) return null;

    const metrics = this.screens.get(this.currentScreen);
    if (!metrics) return null;

    const issues: string[] = [];
    let score = 100;

    // Check for slow renders
    const slowComponents = Array.from(metrics.childComponents.values()).filter(
      (c) => c.averageRenderTime > this.slowRenderThreshold
    );

    if (slowComponents.length > 0) {
      issues.push(`${slowComponents.length} slow component(s)`);
      score -= slowComponents.length * 10;
    }

    // Check FPS
    if (metrics.averageFps < 50) {
      issues.push(`Low FPS: ${metrics.averageFps}`);
      score -= 20;
    } else if (metrics.averageFps < 55) {
      issues.push(`Slightly low FPS: ${metrics.averageFps}`);
      score -= 10;
    }

    // Check memory impact
    const memoryMB = metrics.memoryDelta / (1024 * 1024);
    if (memoryMB > 50) {
      issues.push(`High memory impact: ${memoryMB.toFixed(1)}MB`);
      score -= 20;
    } else if (memoryMB > 20) {
      issues.push(`Moderate memory impact: ${memoryMB.toFixed(1)}MB`);
      score -= 10;
    }

    // Check dropped frames
    if (metrics.droppedFrames > 10) {
      issues.push(`${metrics.droppedFrames} dropped frames`);
      score -= 15;
    }

    // Check JS thread blocking
    if (metrics.jsThreadBlockTime > 500) {
      issues.push(`JS thread blocked for ${metrics.jsThreadBlockTime}ms`);
      score -= 15;
    }

    return {
      screenName: metrics.screenName,
      score: Math.max(0, score),
      issues,
      metrics: {
        renderTime: metrics.averageRenderTime,
        fps: metrics.averageFps,
        memoryImpact: metrics.memoryDelta,
        componentCount: metrics.childComponents.size,
      },
    };
  }

  // ==================== Event System ====================

  /**
   * Subscribe to profiler events
   */
  on<T extends ProfilerEventType>(
    event: T,
    callback: (payload: ProfilerEventPayload[T]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Unsubscribe from profiler events
   */
  off<T extends ProfilerEventType>(
    event: T,
    callback: (payload: ProfilerEventPayload[T]) => void
  ): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit<T extends ProfilerEventType>(event: T, payload: ProfilerEventPayload[T]): void {
    this.listeners.get(event)?.forEach((callback) => {
      try {
        callback(payload);
      } catch (e) {
        console.warn(`[NazarProfiler] Error in ${event} listener:`, e);
      }
    });
  }

  // ==================== Helpers ====================

  private createEmptyGlobalMetrics(): GlobalMetrics {
    return {
      totalMounts: 0,
      totalRenders: 0,
      averageRenderTime: 0,
      peakMemoryUsage: 0,
      currentMemoryUsage: 0,
      sessionDuration: 0,
      averageFps: 60,
      slowRenders: 0,
      verySlowRenders: 0,
    };
  }

  private createEmptyScreenMetrics(screenName: string): ScreenMetrics {
    return {
      screenName,
      componentName: screenName,
      mountTime: 0,
      lastRenderTime: 0,
      averageRenderTime: 0,
      renderCount: 0,
      totalRenderTime: 0,
      memoryDelta: 0,
      memoryAtMount: 0,
      currentMemory: 0,
      timestamp: Date.now(),
      timeOnScreen: 0,
      interactionCount: 0,
      averageFps: 60,
      droppedFrames: 0,
      jsThreadBlockTime: 0,
      childComponents: new Map(),
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.screens.clear();
    this.currentScreen = null;
    this.globalMetrics = this.createEmptyGlobalMetrics();
    this.sessionStartTime = Date.now();
    this.frameCount = 0;
    this.droppedFrameCount = 0;
    this.fpsHistory = [];
    this.currentFps = 60;
    this.minFps = 60;
    this.maxFps = 60;
    this.customData = {};
    this.screensVisited = [];
  }

  // ==================== FPS History Tracking ====================

  /**
   * Record current FPS value (called internally)
   */
  recordFps(fps: number): void {
    this.currentFps = fps;

    // Update min/max
    if (fps < this.minFps) this.minFps = fps;
    if (fps > this.maxFps) this.maxFps = fps;

    // Keep last 60 FPS values (1 minute at 1 reading/sec)
    this.fpsHistory.push(fps);
    if (this.fpsHistory.length > 60) {
      this.fpsHistory.shift();
    }
  }

  /**
   * Get FPS history
   */
  getFpsHistory(): number[] {
    return [...this.fpsHistory];
  }

  /**
   * Get current FPS
   */
  getCurrentFps(): number {
    return this.currentFps;
  }

  // ==================== Custom Data ====================

  /**
   * Set custom data that can be accessed in the profiler data object
   */
  setCustomData(key: string, value: any): void {
    this.customData[key] = value;
  }

  /**
   * Get custom data
   */
  getCustomData(key: string): any {
    return this.customData[key];
  }

  /**
   * Get all custom data
   */
  getAllCustomData(): Record<string, any> {
    return { ...this.customData };
  }

  /**
   * Clear custom data
   */
  clearCustomData(key?: string): void {
    if (key) {
      delete this.customData[key];
    } else {
      this.customData = {};
    }
  }

  // ==================== Comprehensive Data Object ====================

  /**
   * Get comprehensive profiler data for custom UI
   * This is the main method users should use to build custom UIs
   */
  getProfilerData(): ProfilerData {
    const currentScreenMetrics = this.getCurrentScreenMetrics();
    const summary = this.getCurrentScreenSummary();
    const sessionDuration = this.enabled ? (Date.now() - this.sessionStartTime) / 1000 : 0;

    // Calculate average FPS
    const avgFps = this.fpsHistory.length > 0
      ? Math.round(this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length)
      : this.currentFps;

    // Calculate FPS score (0-100)
    const fpsScore = Math.min(100, Math.round((this.currentFps / this.targetFps) * 100));

    // Format memory
    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // Get components for current screen
    const components: ProfilerData['components'] = [];
    if (currentScreenMetrics) {
      currentScreenMetrics.childComponents.forEach((metrics, name) => {
        components.push({
          name,
          renderCount: metrics.renderCount,
          averageRenderTime: metrics.averageRenderTime,
          lastRenderTime: metrics.lastRenderTime,
          isSlow: metrics.averageRenderTime > this.slowRenderThreshold,
        });
      });
    }

    // Calculate health score
    let healthScore = 100;
    const healthIssues: string[] = [];

    if (this.currentFps < 50) {
      healthScore -= 30;
      healthIssues.push('Low FPS detected');
    } else if (this.currentFps < 55) {
      healthScore -= 15;
      healthIssues.push('Slightly low FPS');
    }

    if (this.globalMetrics.slowRenders > 10) {
      healthScore -= 20;
      healthIssues.push(`${this.globalMetrics.slowRenders} slow renders`);
    }

    if (this.globalMetrics.verySlowRenders > 0) {
      healthScore -= 25;
      healthIssues.push(`${this.globalMetrics.verySlowRenders} very slow renders`);
    }

    const memoryMB = this.globalMetrics.currentMemoryUsage / (1024 * 1024);
    if (memoryMB > 200) {
      healthScore -= 20;
      healthIssues.push('High memory usage');
    } else if (memoryMB > 100) {
      healthScore -= 10;
      healthIssues.push('Elevated memory usage');
    }

    healthScore = Math.max(0, healthScore);

    const getHealthStatus = (score: number): ProfilerData['health']['status'] => {
      if (score >= 80) return 'excellent';
      if (score >= 60) return 'good';
      if (score >= 40) return 'fair';
      return 'poor';
    };

    return {
      isRunning: this.enabled,
      sessionDuration,
      sessionStartTime: this.sessionStartTime,
      platform: Platform.OS,

      fps: {
        current: this.currentFps,
        min: this.minFps,
        max: this.maxFps,
        average: avgFps,
        history: [...this.fpsHistory],
        target: this.targetFps,
        score: fpsScore,
      },

      memory: {
        current: this.globalMetrics.currentMemoryUsage,
        peak: this.globalMetrics.peakMemoryUsage,
        delta: this.globalMetrics.peakMemoryUsage - this.globalMetrics.currentMemoryUsage,
        formatted: {
          current: formatBytes(this.globalMetrics.currentMemoryUsage),
          peak: formatBytes(this.globalMetrics.peakMemoryUsage),
        },
      },

      renders: {
        total: this.globalMetrics.totalRenders,
        slow: this.globalMetrics.slowRenders,
        verySlow: this.globalMetrics.verySlowRenders,
        averageTime: this.globalMetrics.averageRenderTime,
        lastTime: currentScreenMetrics?.lastRenderTime ?? 0,
      },

      screen: {
        name: this.currentScreen || '--',
        timeOnScreen: currentScreenMetrics?.timeOnScreen ?? 0,
        renderCount: currentScreenMetrics?.renderCount ?? 0,
        averageRenderTime: currentScreenMetrics?.averageRenderTime ?? 0,
        lastRenderTime: currentScreenMetrics?.lastRenderTime ?? 0,
        interactionCount: currentScreenMetrics?.interactionCount ?? 0,
        componentCount: currentScreenMetrics?.childComponents.size ?? 0,
        droppedFrames: currentScreenMetrics?.droppedFrames ?? 0,
        score: summary?.score ?? 100,
        issues: summary?.issues ?? [],
      },

      components,

      threads: {
        ui: {
          usage: Math.random() * 30 + 10, // Simulated - would need native module
          blocked: false,
        },
        js: {
          usage: Math.random() * 40 + 15, // Simulated - would need native module
          blockTime: currentScreenMetrics?.jsThreadBlockTime ?? 0,
        },
      },

      navigation: {
        totalScreenViews: this.globalMetrics.totalMounts,
        screensVisited: [...this.screensVisited],
      },

      health: {
        score: healthScore,
        status: getHealthStatus(healthScore),
        issues: healthIssues,
      },

      customData: { ...this.customData },
    };
  }

  /**
   * Get session start time
   */
  getSessionStartTime(): number {
    return this.sessionStartTime;
  }

  /**
   * Set target FPS (default: 60)
   */
  setTargetFps(fps: number): void {
    this.targetFps = fps;
  }
}

// ==================== Singleton Export ====================

export const NazarProfiler = NazarProfilerClass.getInstance();

export default NazarProfiler;
