import { NativeModules, Platform } from 'react-native';

// ==================== ERROR HANDLING ====================

const LINKING_ERROR =
  `The package 'react-native-nazar' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const DevicePerformanceNative = NativeModules.DevicePerformance
  ? NativeModules.DevicePerformance
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

// ==================== TYPE DEFINITIONS ====================

// CPU Types
export interface CpuInfo {
  cores: number;
  activeProcessors?: number;
  architecture: string;
  supportedAbis?: string[];
  is64Bit: boolean;
  maxFrequency?: number;
  minFrequency?: number;
  currentFrequency?: number;
  usage?: number;
  model?: string;
  brand?: string;
  cpuType?: number;
  cpuSubtype?: number;
  estimatedFrequency?: number;
}

// Memory Types
export interface MemoryInfo {
  totalRam: number;
  availableRam: number;
  usedRam: number;
  usagePercent: number;
  lowMemory?: boolean;
  threshold?: number;
  memoryClass?: number;
  largeMemoryClass?: number;
  jvmMaxMemory?: number;
  jvmTotalMemory?: number;
  jvmFreeMemory?: number;
  freeRam?: number;
  activeRam?: number;
  inactiveRam?: number;
  wiredRam?: number;
  compressedRam?: number;
  purgeableRam?: number;
  pageIns?: number;
  pageOuts?: number;
  faults?: number;
}

// Storage Types
export interface StorageInfo {
  totalStorage: number;
  availableStorage: number;
  usedStorage: number;
  usagePercent: number;
  external?: {
    total: number;
    available: number;
  };
  availableForImportantUsage?: number;
  availableForOpportunisticUsage?: number;
}

// Battery Types
export interface BatteryInfo {
  level: number;
  isCharging: boolean;
  state: BatteryState;
  health?: BatteryHealth;
  temperature?: number;
  voltage?: number;
  technology?: string;
  chargingType?: ChargingType;
  capacity?: number;
  chargeCounter?: number;
  currentNow?: number;
  currentAverage?: number;
  isLowPowerMode?: boolean;
}

export type BatteryState = 'CHARGING' | 'DISCHARGING' | 'FULL' | 'NOT_CHARGING' | 'UNPLUGGED' | 'UNKNOWN';
export type BatteryHealth = 'GOOD' | 'OVERHEAT' | 'DEAD' | 'OVER_VOLTAGE' | 'COLD' | 'FAILURE' | 'UNKNOWN';
export type ChargingType = 'AC' | 'USB' | 'WIRELESS' | 'NONE';

// Display Types
export interface DisplayInfo {
  widthPixels: number;
  heightPixels: number;
  widthPoints?: number;
  heightPoints?: number;
  density: number;
  densityDpi?: number;
  scaledDensity?: number;
  xdpi?: number;
  ydpi?: number;
  refreshRate?: number;
  scale?: number;
  nativeScale?: number;
  screenSizeInches?: number;
  ppi?: number;
  isHdr?: boolean;
  isWideColorGamut?: boolean;
  hasCutout?: boolean;
  displayGamut?: string;
  brightness?: number;
  supportsHDR?: boolean;
  edrHeadroom?: number;
}

// Thermal Types
export interface ThermalInfo {
  state: ThermalState;
  level?: number;
  description?: string;
}

export type ThermalState = 'NOMINAL' | 'FAIR' | 'SERIOUS' | 'CRITICAL' | 'UNKNOWN' | 'UNAVAILABLE';

// Device Types
export interface DeviceInfo {
  brand?: string;
  model: string;
  manufacturer?: string;
  device?: string;
  product?: string;
  hardware?: string;
  board?: string;
  name?: string;
  localizedModel?: string;
  systemName?: string;
  systemVersion?: string;
  sdkVersion?: number;
  androidVersion?: string;
  buildId?: string;
  fingerprint?: string;
  bootloader?: string;
  display?: string;
  buildTime?: number;
  securityPatch?: string;
  modelIdentifier?: string;
  modelName?: string;
  identifierForVendor?: string;
  deviceType: DeviceType;
  isSimulator?: boolean;
  isMultitaskingSupported?: boolean;
}

export type DeviceType = 'PHONE' | 'TABLET' | 'PHABLET' | 'TV' | 'CAR' | 'MAC' | 'UNKNOWN';

// GPU Types
export interface GpuInfo {
  renderer?: string;
  vendor?: string;
  version?: string;
  extensions?: string;
  name?: string;
  isHeadless?: boolean;
  isLowPower?: boolean;
  isRemovable?: boolean;
  registryID?: number;
  supportedFamilies?: string[];
  recommendedMaxWorkingSetSize?: number;
  maxThreadsPerThreadgroup?: {
    width: number;
    height: number;
    depth: number;
  };
  error?: string;
}

// System Types
export interface SystemInfo {
  uptimeMillis?: number;
  elapsedRealtimeMillis?: number;
  systemUptime?: number;
  hostName?: string;
  osVersion?: string;
  osMajorVersion?: number;
  osMinorVersion?: number;
  osPatchVersion?: number;
  processName?: string;
  processIdentifier?: number;
  hasNfc?: boolean;
  hasBluetooth?: boolean;
  hasBluetoothLe?: boolean;
  hasCamera?: boolean;
  hasGps?: boolean;
  hasFingerprint?: boolean;
  hasTelephony?: boolean;
  hasWifi?: boolean;
  hasVulkan?: boolean;
  supportsMultipleScenes?: boolean;
  isiOSAppOnMac?: boolean;
}

// Network Types
export interface NetworkInfo {
  available?: boolean;
  reachable?: boolean;
  isWWAN?: boolean;
  isWiFi?: boolean;
}

// Complete Device Specs
export interface DeviceSpecs {
  cpu: CpuInfo;
  memory: MemoryInfo;
  storage: StorageInfo;
  battery: BatteryInfo;
  display: DisplayInfo;
  thermal?: ThermalInfo;
  device: DeviceInfo;
  gpu?: GpuInfo;
  system?: SystemInfo;
  network?: NetworkInfo;
}

// Benchmark Types
export interface BenchmarkResults {
  cpuScore: number;
  memoryScore: number;
  storageScore: number;
  multiThreadScore?: number;
  gpuScore?: number;
  overallScore: number;
  performanceTier: PerformanceTier;
  grades?: {
    cpuGrade: Grade;
    memoryGrade: Grade;
    storageGrade: Grade;
    multiThreadGrade?: Grade;
    gpuGrade?: Grade;
  };
}

// Performance Score Types
export interface PerformanceScore {
  cpu: number;
  memory: number;
  storage: number;
  gpu?: number;
  overall: number;
  tier: PerformanceTier;
  recommendations?: PerformanceRecommendations;
}

export interface PerformanceRecommendations {
  enableAnimations: boolean;
  enableBlur: boolean;
  enableParallax: boolean;
  enableShadows: boolean;
  enableHaptics?: boolean;
  imageQuality: ImageQuality;
  videoQuality: VideoQuality;
  listWindowSize: number;
  maxConcurrentDownloads?: number;
}

export type PerformanceTier = 'HIGH' | 'MEDIUM' | 'LOW';
export type ImageQuality = 'low' | 'medium' | 'high';
export type VideoQuality = '480p' | '720p' | '1080p';
export type Grade = 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';

// ==================== MAIN API FUNCTIONS ====================

/**
 * Get comprehensive device specifications
 * Includes CPU, memory, storage, battery, display, thermal, device, GPU, system, and network info
 * @returns Promise with complete device specifications
 */
export async function getDeviceSpecs(): Promise<DeviceSpecs> {
  return DevicePerformanceNative.getDeviceSpecs();
}

/**
 * Run a full benchmark suite
 * Tests CPU (single & multi-thread), memory, storage, and GPU performance
 * Note: This operation takes 3-8 seconds to complete
 * @returns Promise with benchmark results and scores
 */
export async function runBenchmark(): Promise<BenchmarkResults> {
  return DevicePerformanceNative.runBenchmark();
}

/**
 * Get a quick performance score based on device specifications
 * Much faster than runBenchmark() - uses estimation instead of actual tests
 * Includes recommendations for UI optimization
 * @returns Promise with performance scores and recommendations
 */
export async function getPerformanceScore(): Promise<PerformanceScore> {
  return DevicePerformanceNative.getPerformanceScore();
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Format bytes to human-readable string
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1.50 GB")
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  if (bytes < 0) return 'Invalid';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${value.toFixed(decimals)} ${sizes[i]}`;
}

/**
 * Format frequency to human-readable string
 * @param mhz - Frequency in MHz
 * @returns Formatted string (e.g., "2.40 GHz")
 */
export function formatFrequency(mhz: number): string {
  if (mhz >= 1000) {
    return `${(mhz / 1000).toFixed(2)} GHz`;
  }
  return `${mhz.toFixed(0)} MHz`;
}

/**
 * Format percentage
 * @param value - Percentage value (0-100)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted string (e.g., "75.5%")
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format temperature
 * @param celsius - Temperature in Celsius
 * @param unit - Target unit ('C' or 'F')
 * @returns Formatted string (e.g., "35.5°C")
 */
export function formatTemperature(celsius: number, unit: 'C' | 'F' = 'C'): string {
  if (unit === 'F') {
    const fahrenheit = (celsius * 9) / 5 + 32;
    return `${fahrenheit.toFixed(1)}°F`;
  }
  return `${celsius.toFixed(1)}°C`;
}

// ==================== CONVENIENCE FUNCTIONS ====================

/**
 * Check if device is considered low-end
 * @returns Promise<boolean> - true if device performance tier is LOW
 */
export async function isLowEndDevice(): Promise<boolean> {
  const score = await getPerformanceScore();
  return score.tier === 'LOW';
}

/**
 * Check if device is considered mid-range
 * @returns Promise<boolean> - true if device performance tier is MEDIUM
 */
export async function isMidRangeDevice(): Promise<boolean> {
  const score = await getPerformanceScore();
  return score.tier === 'MEDIUM';
}

/**
 * Check if device is considered high-end
 * @returns Promise<boolean> - true if device performance tier is HIGH
 */
export async function isHighEndDevice(): Promise<boolean> {
  const score = await getPerformanceScore();
  return score.tier === 'HIGH';
}

/**
 * Get recommended quality settings
 * @returns Promise with quality settings based on device performance
 */
export async function getRecommendedSettings(): Promise<PerformanceRecommendations> {
  const score = await getPerformanceScore();
  return (
    score.recommendations ?? {
      enableAnimations: score.overall >= 40,
      enableBlur: score.overall >= 55,
      enableParallax: score.overall >= 70,
      enableShadows: score.overall >= 45,
      imageQuality: score.overall >= 70 ? 'high' : score.overall >= 45 ? 'medium' : 'low',
      videoQuality: score.overall >= 75 ? '1080p' : score.overall >= 50 ? '720p' : '480p',
      listWindowSize: score.overall >= 70 ? 21 : score.overall >= 45 ? 11 : 5,
    }
  );
}

/**
 * Get current memory usage percentage
 * @returns Promise<number> - Memory usage as percentage (0-100)
 */
export async function getMemoryUsage(): Promise<number> {
  const specs = await getDeviceSpecs();
  return specs.memory.usagePercent;
}

/**
 * Get current storage usage percentage
 * @returns Promise<number> - Storage usage as percentage (0-100)
 */
export async function getStorageUsage(): Promise<number> {
  const specs = await getDeviceSpecs();
  return specs.storage.usagePercent;
}

/**
 * Get current battery level
 * @returns Promise<number> - Battery level as percentage (0-100)
 */
export async function getBatteryLevel(): Promise<number> {
  const specs = await getDeviceSpecs();
  return specs.battery.level;
}

/**
 * Check if device is currently charging
 * @returns Promise<boolean> - true if charging
 */
export async function isCharging(): Promise<boolean> {
  const specs = await getDeviceSpecs();
  return specs.battery.isCharging;
}

/**
 * Check if device is in low memory state
 * @returns Promise<boolean> - true if low memory (Android only, always false on iOS)
 */
export async function isLowMemory(): Promise<boolean> {
  const specs = await getDeviceSpecs();
  return specs.memory.lowMemory ?? false;
}

/**
 * Get thermal state
 * @returns Promise<ThermalState> - Current thermal state
 */
export async function getThermalState(): Promise<ThermalState> {
  const specs = await getDeviceSpecs();
  return specs.thermal?.state ?? 'UNKNOWN';
}

/**
 * Check if device is overheating
 * @returns Promise<boolean> - true if thermal state is SERIOUS or CRITICAL
 */
export async function isOverheating(): Promise<boolean> {
  const state = await getThermalState();
  return state === 'SERIOUS' || state === 'CRITICAL';
}

/**
 * Get total RAM in GB
 * @returns Promise<number> - Total RAM in gigabytes
 */
export async function getTotalRamGB(): Promise<number> {
  const specs = await getDeviceSpecs();
  return specs.memory.totalRam / (1024 * 1024 * 1024);
}

/**
 * Get CPU core count
 * @returns Promise<number> - Number of CPU cores
 */
export async function getCpuCores(): Promise<number> {
  const specs = await getDeviceSpecs();
  return specs.cpu.cores;
}

/**
 * Get device model name
 * @returns Promise<string> - Device model (e.g., "iPhone 14 Pro")
 */
export async function getDeviceModel(): Promise<string> {
  const specs = await getDeviceSpecs();
  return specs.device.modelName ?? specs.device.model;
}

/**
 * Get performance tier
 * @returns Promise<PerformanceTier> - 'HIGH', 'MEDIUM', or 'LOW'
 */
export async function getPerformanceTier(): Promise<PerformanceTier> {
  const score = await getPerformanceScore();
  return score.tier;
}

// ==================== ADAPTIVE QUALITY HELPERS ====================

interface ImageUrlConfig {
  low?: string;
  medium?: string;
  high?: string;
}

/**
 * Get optimized image URL based on device performance
 * @param urls - Object with low, medium, high quality URLs
 * @returns Promise<string> - Appropriate URL for device
 */
export async function getOptimizedImageUrl(urls: ImageUrlConfig): Promise<string> {
  const settings = await getRecommendedSettings();
  const quality = settings.imageQuality;

  return urls[quality] ?? urls.medium ?? urls.high ?? urls.low ?? '';
}

interface VideoUrlConfig {
  '480p'?: string;
  '720p'?: string;
  '1080p'?: string;
}

/**
 * Get optimized video URL based on device performance
 * @param urls - Object with 480p, 720p, 1080p quality URLs
 * @returns Promise<string> - Appropriate URL for device
 */
export async function getOptimizedVideoUrl(urls: VideoUrlConfig): Promise<string> {
  const settings = await getRecommendedSettings();
  const quality = settings.videoQuality;

  return urls[quality] ?? urls['720p'] ?? urls['480p'] ?? '';
}

/**
 * Get optimized FlatList/VirtualizedList config
 * @returns Promise with optimized list configuration
 */
export async function getOptimizedListConfig(): Promise<{
  windowSize: number;
  maxToRenderPerBatch: number;
  updateCellsBatchingPeriod: number;
  initialNumToRender: number;
  removeClippedSubviews: boolean;
}> {
  const score = await getPerformanceScore();

  if (score.tier === 'HIGH') {
    return {
      windowSize: 21,
      maxToRenderPerBatch: 10,
      updateCellsBatchingPeriod: 50,
      initialNumToRender: 10,
      removeClippedSubviews: false,
    };
  } else if (score.tier === 'MEDIUM') {
    return {
      windowSize: 11,
      maxToRenderPerBatch: 5,
      updateCellsBatchingPeriod: 100,
      initialNumToRender: 7,
      removeClippedSubviews: true,
    };
  } else {
    return {
      windowSize: 5,
      maxToRenderPerBatch: 2,
      updateCellsBatchingPeriod: 150,
      initialNumToRender: 3,
      removeClippedSubviews: true,
    };
  }
}

// ==================== DEFAULT EXPORT ====================

// ==================== RE-EXPORT CONTEXT & HOOKS ====================

export {
  PerformanceProvider,
  usePerformance,
  useAnimationsEnabled,
  useBlurEnabled,
  useShadowsEnabled,
  useImageQuality,
  useVideoQuality,
  useListWindowSize,
  useConditionalRender,
  useOptimizedListProps,
  useDeviceSummary,
} from './PerformanceContext';

export type { PerformanceContextValue, PerformanceProviderProps, PerformanceSettings } from './PerformanceContext';

// ==================== RE-EXPORT DEVTOOLS ====================

export { DevTools } from './DevTools';

// ==================== RE-EXPORT DASHBOARD REPORTER ====================

export {
  initDashboardReporter,
  reportPerformance,
  reportPerformanceSilent,
  usePerformanceReporter,
} from './DashboardReporter';

export type {
  DashboardConfig,
  ReportResponse,
  MetricPayload,
  UsePerformanceReporterOptions,
  UsePerformanceReporterResult,
} from './DashboardReporter';

// ==================== RE-EXPORT PROFILER (Legacy) ====================

export {
  ProfilerProvider,
  ProfiledComponent,
  ProfilerOverlay,
  useProfiler,
  useScreenProfiler,
  useProfilerSession,
  useProfilerStats,
  createNavigationListener,
} from './Profiler';

export type {
  ScreenMetrics,
  RenderMetrics,
  ProfilerSession,
  ProfilerConfig,
  ProfilerProviderProps,
} from './Profiler';

// ==================== RE-EXPORT NAZAR PROFILER (New Enhanced) ====================
// The new NazarProfiler provides more comprehensive profiling with custom data support

export { NazarProfiler, Profiler as NazarProfilerClass } from './profiler';
export type {
  ComponentMetrics as NazarComponentMetrics,
  ScreenMetrics as NazarScreenMetrics,
  ProfilerSnapshot,
  GlobalMetrics,
  FrameMetrics,
  ProfilerEventType,
  ProfilerEventPayload,
  ProfilerData,
} from './profiler';

export {
  useProfiledComponent,
  useProfiledScreen,
  useProfilerSession as useNazarProfilerSession,
  useProfilerEvents,
  useProfilerData,
  withProfiler,
  createNavigationListener as createNazarNavigationListener,
  setProfilerCustomData,
  getProfilerCustomData,
  clearProfilerCustomData,
} from './profiler';
export type {
  UseProfiledComponentOptions,
  UseProfiledScreenOptions,
  UseProfilerSessionOptions,
  UseProfilerDataOptions,
} from './profiler';

export { ProfilerOverlay as NazarProfilerOverlay } from './profiler';
export type { ProfilerOverlayProps as NazarProfilerOverlayProps } from './profiler';

// ==================== DEFAULT EXPORT ====================

// Import dashboard reporter functions for default export
import {
  initDashboardReporter,
  reportPerformance,
  reportPerformanceSilent,
  usePerformanceReporter,
} from './DashboardReporter';

// Import profiler functions for default export
import {
  ProfilerProvider,
  ProfiledComponent,
  ProfilerOverlay,
  useProfiler,
  useScreenProfiler,
  useProfilerSession,
  useProfilerStats,
  createNavigationListener,
} from './Profiler';

const DevicePerformance = {
  // Main functions
  getDeviceSpecs,
  runBenchmark,
  getPerformanceScore,

  // Utility functions
  formatBytes,
  formatFrequency,
  formatPercent,
  formatTemperature,

  // Convenience functions
  isLowEndDevice,
  isMidRangeDevice,
  isHighEndDevice,
  getRecommendedSettings,
  getMemoryUsage,
  getStorageUsage,
  getBatteryLevel,
  isCharging,
  isLowMemory,
  getThermalState,
  isOverheating,
  getTotalRamGB,
  getCpuCores,
  getDeviceModel,
  getPerformanceTier,

  // Adaptive quality helpers
  getOptimizedImageUrl,
  getOptimizedVideoUrl,
  getOptimizedListConfig,

  // Dashboard reporting
  initDashboardReporter,
  reportPerformance,
  reportPerformanceSilent,
  usePerformanceReporter,

  // Profiler
  ProfilerProvider,
  ProfiledComponent,
  ProfilerOverlay,
  useProfiler,
  useScreenProfiler,
  useProfilerSession,
  useProfilerStats,
  createNavigationListener,
};

export default DevicePerformance;
