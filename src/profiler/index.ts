/**
 * Nazar Profiler - Independent Performance Profiling Module
 *
 * This module is completely standalone and does not depend on
 * any other Nazar SDK functionality. You can use it independently.
 *
 * Usage:
 * ```tsx
 * // Import from the profiler subpath
 * import { NazarProfiler, ProfilerOverlay, useProfiledScreen } from 'react-native-nazar/profiler';
 *
 * // Or import from main package
 * import { NazarProfiler, ProfilerOverlay } from 'react-native-nazar';
 *
 * // For custom UI, use useProfilerData hook
 * import { useProfilerData, setProfilerCustomData } from 'react-native-nazar/profiler';
 *
 * function MyCustomProfiler() {
 *   const data = useProfilerData();
 *   return (
 *     <View>
 *       <Text>FPS: {data.fps.current}</Text>
 *       <Text>Memory: {data.memory.formatted.current}</Text>
 *       <Text>Health: {data.health.status} ({data.health.score}%)</Text>
 *     </View>
 *   );
 * }
 * ```
 */

// Core profiler
export { NazarProfiler, default as Profiler } from './NazarProfiler';
export type {
  ComponentMetrics,
  ScreenMetrics,
  ProfilerSnapshot,
  GlobalMetrics,
  FrameMetrics,
  ProfilerEventType,
  ProfilerEventPayload,
  ProfilerData,
} from './NazarProfiler';

// React hooks
export {
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
} from './useProfiler';
export type {
  UseProfiledComponentOptions,
  UseProfiledScreenOptions,
  UseProfilerSessionOptions,
  UseProfilerDataOptions,
} from './useProfiler';

// UI Component
export { ProfilerOverlay } from './ProfilerOverlay';
export type { ProfilerOverlayProps } from './ProfilerOverlay';
