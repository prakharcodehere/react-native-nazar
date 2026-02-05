import { Platform } from 'react-native';
import { getDeviceSpecs, getPerformanceScore, runBenchmark } from './index';
import type { DeviceSpecs, PerformanceScore, BenchmarkResults } from './index';

// ==================== CONFIGURATION ====================

export interface DashboardConfig {
  /**
   * The dashboard API URL (e.g., "https://your-dashboard.vercel.app/api/metrics")
   */
  apiUrl: string;

  /**
   * API key for authentication
   */
  apiKey: string;

  /**
   * Enable/disable sending data to dashboard (default: true)
   */
  enabled?: boolean;

  /**
   * Enable/disable analytics/BigQuery integration (default: false)
   * When true, also sends data to your analytics endpoint
   */
  analyticsEnabled?: boolean;

  /**
   * Custom analytics endpoint URL (e.g., BigQuery ingestion URL)
   * Required if analyticsEnabled is true
   */
  analyticsUrl?: string;

  /**
   * Analytics API key (if different from dashboard API key)
   */
  analyticsApiKey?: string;

  /**
   * Optional user ID to associate with metrics
   */
  userId?: string;

  /**
   * Optional session ID
   */
  sessionId?: string;

  /**
   * App version string
   */
  appVersion?: string;

  /**
   * Run benchmark when reporting (slower but more accurate)
   * Default: false (uses quick score estimation)
   */
  runBenchmark?: boolean;

  /**
   * Custom headers to send with requests
   */
  customHeaders?: Record<string, string>;

  /**
   * Timeout in milliseconds (default: 10000)
   */
  timeout?: number;

  /**
   * Callback when report succeeds
   */
  onSuccess?: (response: ReportResponse) => void;

  /**
   * Callback when report fails
   */
  onError?: (error: Error) => void;

  /**
   * Enable debug logging (default: false)
   */
  debug?: boolean;
}

export interface ReportResponse {
  success: boolean;
  inserted?: number;
  errors?: unknown[];
  analyticsResponse?: unknown;
}

export interface MetricPayload {
  deviceId: string;
  userId?: string;
  sessionId?: string;
  appVersion?: string;

  // Performance scores
  overallScore: number;
  performanceTier: string;
  cpuScore?: number;
  memoryScore?: number;
  storageScore?: number;
  gpuScore?: number;
  multiThreadScore?: number;

  // Device info
  deviceBrand?: string;
  deviceModel?: string;
  deviceType?: string;
  platform: 'ios' | 'android';
  osVersion?: string;

  // Hardware specs
  cpuCores?: number;
  cpuArchitecture?: string;
  cpuFrequency?: number;
  totalRam?: number;
  availableRam?: number;
  memoryUsagePercent?: number;
  totalStorage?: number;
  availableStorage?: number;
  storageUsagePercent?: number;

  // Display
  screenWidth?: number;
  screenHeight?: number;
  screenDensity?: number;
  refreshRate?: number;

  // Battery
  batteryLevel?: number;
  isCharging?: boolean;
  batteryHealth?: string;

  // Other
  thermalState?: string;
  networkType?: string;
  gpuRenderer?: string;
  gpuVendor?: string;

  // Raw data
  rawSpecs?: DeviceSpecs;
  rawBenchmarks?: BenchmarkResults;
  recommendations?: unknown;

  recordedAt: string;
}

// ==================== DASHBOARD REPORTER CLASS ====================

let globalConfig: DashboardConfig | null = null;

/**
 * Initialize the dashboard reporter with configuration
 * Call this once at app startup (e.g., in App.tsx)
 */
export function initDashboardReporter(config: DashboardConfig): void {
  globalConfig = config;

  if (config.debug) {
    console.log('[DevicePerformance] Dashboard reporter initialized', {
      apiUrl: config.apiUrl,
      analyticsEnabled: config.analyticsEnabled,
      enabled: config.enabled ?? true,
    });
  }
}

/**
 * Get unique device identifier
 * Uses identifierForVendor on iOS, Android ID on Android
 */
async function getDeviceId(specs: DeviceSpecs): Promise<string> {
  // Use device identifier if available
  if (specs.device.identifierForVendor) {
    return specs.device.identifierForVendor;
  }

  // Fallback: generate a pseudo-unique ID from device properties
  const fingerprint = [
    specs.device.model,
    specs.device.manufacturer,
    specs.cpu.cores,
    specs.memory.totalRam,
    specs.display.widthPixels,
    specs.display.heightPixels,
  ].join('-');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `device-${Math.abs(hash).toString(16)}`;
}

/**
 * Build the metric payload from device specs and scores
 */
function buildPayload(
  specs: DeviceSpecs,
  score: PerformanceScore,
  deviceId: string,
  config: DashboardConfig,
  benchmarkResults?: BenchmarkResults
): MetricPayload {
  return {
    deviceId,
    userId: config.userId,
    sessionId: config.sessionId,
    appVersion: config.appVersion,

    // Scores
    overallScore: score.overall,
    performanceTier: score.tier,
    cpuScore: score.cpu,
    memoryScore: score.memory,
    storageScore: score.storage,
    gpuScore: score.gpu,
    multiThreadScore: benchmarkResults?.multiThreadScore,

    // Device
    deviceBrand: specs.device.brand ?? specs.device.manufacturer,
    deviceModel: specs.device.model,
    deviceType: specs.device.deviceType,
    platform: Platform.OS as 'ios' | 'android',
    osVersion: specs.device.systemVersion,

    // CPU
    cpuCores: specs.cpu.cores,
    cpuArchitecture: specs.cpu.architecture,
    cpuFrequency: specs.cpu.maxFrequency ?? specs.cpu.currentFrequency,

    // Memory
    totalRam: specs.memory.totalRam,
    availableRam: specs.memory.availableRam,
    memoryUsagePercent: specs.memory.usagePercent,

    // Storage
    totalStorage: specs.storage.totalStorage,
    availableStorage: specs.storage.availableStorage,
    storageUsagePercent: specs.storage.usagePercent,

    // Display
    screenWidth: specs.display.widthPixels,
    screenHeight: specs.display.heightPixels,
    screenDensity: specs.display.density,
    refreshRate: specs.display.refreshRate,

    // Battery
    batteryLevel: specs.battery.level,
    isCharging: specs.battery.isCharging,
    batteryHealth: specs.battery.health,

    // Thermal
    thermalState: specs.thermal?.state,

    // Network
    networkType: specs.network?.isWiFi ? 'wifi' : specs.network?.isWWAN ? 'cellular' : undefined,

    // GPU
    gpuRenderer: specs.gpu?.renderer,
    gpuVendor: specs.gpu?.vendor,

    // Raw data
    rawSpecs: specs,
    rawBenchmarks: benchmarkResults,
    recommendations: score.recommendations,

    recordedAt: new Date().toISOString(),
  };
}

/**
 * Send data to the dashboard API
 */
async function sendToDashboard(
  payload: MetricPayload,
  config: DashboardConfig
): Promise<{ success: boolean; data?: unknown }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout ?? 10000);

  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        ...config.customHeaders,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Dashboard API error: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Send data to analytics/BigQuery endpoint
 */
async function sendToAnalytics(
  payload: MetricPayload,
  config: DashboardConfig
): Promise<{ success: boolean; data?: unknown }> {
  if (!config.analyticsUrl) {
    throw new Error('Analytics URL not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout ?? 10000);

  try {
    const response = await fetch(config.analyticsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.analyticsApiKey ?? config.apiKey,
        ...config.customHeaders,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Analytics API error: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Report device performance to dashboard (and optionally analytics)
 * Uses globally configured settings from initDashboardReporter()
 */
export async function reportPerformance(
  overrideConfig?: Partial<DashboardConfig>
): Promise<ReportResponse> {
  const config = { ...globalConfig, ...overrideConfig } as DashboardConfig;

  if (!config.apiUrl || !config.apiKey) {
    throw new Error(
      'Dashboard not configured. Call initDashboardReporter() first or provide apiUrl and apiKey.'
    );
  }

  if (config.enabled === false) {
    if (config.debug) {
      console.log('[DevicePerformance] Reporting disabled, skipping');
    }
    return { success: true };
  }

  try {
    // Gather device data
    const [specs, score] = await Promise.all([
      getDeviceSpecs(),
      getPerformanceScore(),
    ]);

    // Optionally run benchmark
    let benchmarkResults: BenchmarkResults | undefined;
    if (config.runBenchmark) {
      if (config.debug) {
        console.log('[DevicePerformance] Running benchmark...');
      }
      benchmarkResults = await runBenchmark();
    }

    // Get device ID
    const deviceId = await getDeviceId(specs);

    // Build payload
    const payload = buildPayload(specs, score, deviceId, config, benchmarkResults);

    if (config.debug) {
      console.log('[DevicePerformance] Sending metrics:', {
        deviceId,
        overallScore: payload.overallScore,
        tier: payload.performanceTier,
        platform: payload.platform,
      });
    }

    // Send to dashboard
    const dashboardResponse = await sendToDashboard(payload, config);

    // Optionally send to analytics
    let analyticsResponse: unknown;
    if (config.analyticsEnabled && config.analyticsUrl) {
      if (config.debug) {
        console.log('[DevicePerformance] Sending to analytics...');
      }
      try {
        const result = await sendToAnalytics(payload, config);
        analyticsResponse = result.data;
      } catch (analyticsError) {
        if (config.debug) {
          console.warn('[DevicePerformance] Analytics send failed:', analyticsError);
        }
        // Don't fail the whole operation if analytics fails
      }
    }

    const response: ReportResponse = {
      success: true,
      inserted: 1,
      analyticsResponse,
    };

    if (config.onSuccess) {
      config.onSuccess(response);
    }

    return response;
  } catch (error) {
    if (config.debug) {
      console.error('[DevicePerformance] Report failed:', error);
    }

    if (config.onError) {
      config.onError(error as Error);
    }

    throw error;
  }
}

/**
 * Report performance silently (won't throw on error)
 * Useful for fire-and-forget reporting
 */
export async function reportPerformanceSilent(
  overrideConfig?: Partial<DashboardConfig>
): Promise<ReportResponse | null> {
  try {
    return await reportPerformance(overrideConfig);
  } catch {
    return null;
  }
}

// ==================== REACT HOOK ====================

import { useEffect, useRef, useCallback, useState } from 'react';

export interface UsePerformanceReporterOptions {
  /**
   * Report immediately on mount (default: true)
   */
  reportOnMount?: boolean;

  /**
   * Report interval in milliseconds (0 = disabled)
   * Default: 0 (only reports on mount)
   */
  reportInterval?: number;

  /**
   * Override configuration for this hook instance
   */
  config?: Partial<DashboardConfig>;
}

export interface UsePerformanceReporterResult {
  /**
   * Manually trigger a report
   */
  report: () => Promise<ReportResponse | null>;

  /**
   * Whether a report is in progress
   */
  isReporting: boolean;

  /**
   * Last report response
   */
  lastResponse: ReportResponse | null;

  /**
   * Last error (if any)
   */
  lastError: Error | null;
}

/**
 * React hook for automatic performance reporting
 *
 * @example
 * ```tsx
 * // In App.tsx - initialize once
 * initDashboardReporter({
 *   apiUrl: 'https://your-dashboard.vercel.app/api/metrics',
 *   apiKey: 'your-api-key',
 *   analyticsEnabled: false, // Set to true for BigQuery
 *   analyticsUrl: 'https://your-bigquery-endpoint.com/ingest',
 * });
 *
 * // In any component
 * function MyComponent() {
 *   const { report, isReporting } = usePerformanceReporter({
 *     reportOnMount: true,
 *   });
 *
 *   return <Button onPress={report} disabled={isReporting}>Report Now</Button>;
 * }
 * ```
 */
export function usePerformanceReporter(
  options: UsePerformanceReporterOptions = {}
): UsePerformanceReporterResult {
  const { reportOnMount = true, reportInterval = 0, config } = options;

  const [isReporting, setIsReporting] = useState(false);
  const [lastResponse, setLastResponse] = useState<ReportResponse | null>(null);
  const [lastError, setLastError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const reportedRef = useRef(false);

  const report = useCallback(async (): Promise<ReportResponse | null> => {
    if (!mountedRef.current) return null;

    setIsReporting(true);
    setLastError(null);

    try {
      const response = await reportPerformance(config);
      if (mountedRef.current) {
        setLastResponse(response);
        setIsReporting(false);
      }
      return response;
    } catch (error) {
      if (mountedRef.current) {
        setLastError(error as Error);
        setIsReporting(false);
      }
      return null;
    }
  }, [config]);

  // Report on mount
  useEffect(() => {
    if (reportOnMount && !reportedRef.current) {
      reportedRef.current = true;
      report();
    }
  }, [reportOnMount, report]);

  // Report interval
  useEffect(() => {
    if (reportInterval <= 0) return;

    const intervalId = setInterval(() => {
      report();
    }, reportInterval);

    return () => clearInterval(intervalId);
  }, [reportInterval, report]);

  // Cleanup
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    report,
    isReporting,
    lastResponse,
    lastError,
  };
}

// ==================== EXPORT ====================

export default {
  initDashboardReporter,
  reportPerformance,
  reportPerformanceSilent,
  usePerformanceReporter,
};
