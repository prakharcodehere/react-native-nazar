/**
 * ProfilerOverlay - Real-time performance monitoring overlay
 *
 * Uses the useProfilerData hook internally to demonstrate its usage.
 * Users can build their own custom UI using the same hook.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  ScrollView,
} from 'react-native';
import { NazarProfiler } from './NazarProfiler';
import { useProfilerData } from './useProfiler';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ProfilerOverlayProps {
  visible?: boolean;
  initialPosition?: { x: number; y: number };
  autoStart?: boolean;
  updateInterval?: number;
}

// Colors - iOS style
const Colors = {
  bg: 'rgba(28, 28, 30, 0.95)',
  bgLight: '#2C2C2E',
  bgCard: '#3A3A3C',
  green: '#30D158',
  yellow: '#FFD60A',
  red: '#FF453A',
  blue: '#0A84FF',
  purple: '#BF5AF2',
  orange: '#FF9F0A',
  cyan: '#64D2FF',
  pink: '#FF375F',
  text: '#FFFFFF',
  textDim: '#98989F',
  border: '#48484A',
};

const getColor = (value: number, good: number, warn: number, inverse = false) => {
  if (inverse) {
    if (value <= good) return Colors.green;
    if (value <= warn) return Colors.yellow;
    return Colors.red;
  }
  if (value >= good) return Colors.green;
  if (value >= warn) return Colors.yellow;
  return Colors.red;
};

const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
};

const getHealthColor = (status: string) => {
  switch (status) {
    case 'excellent': return Colors.green;
    case 'good': return Colors.cyan;
    case 'fair': return Colors.yellow;
    case 'poor': return Colors.red;
    default: return Colors.textDim;
  }
};

type ViewMode = 'bubble' | 'compact' | 'full';

export const ProfilerOverlay: React.FC<ProfilerOverlayProps> = ({
  visible = true,
  initialPosition = { x: SCREEN_WIDTH - 80, y: 100 },
  autoStart = true,
  updateInterval = 500,
}) => {
  const [mode, setMode] = useState<ViewMode>('bubble');

  // Use the new useProfilerData hook - this is the main data source
  const data = useProfilerData({ updateInterval, autoStart });

  const pan = useRef(new Animated.ValueXY(initialPosition)).current;

  // Pan responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gesture) => {
        pan.flattenOffset();

        // Snap to edges
        const width = mode === 'full' ? SCREEN_WIDTH - 20 : mode === 'compact' ? 220 : 70;
        const finalX = gesture.moveX < SCREEN_WIDTH / 2 ? 10 : SCREEN_WIDTH - width - 10;
        Animated.spring(pan.x, { toValue: finalX, useNativeDriver: false }).start();

        // Tap to cycle modes
        if (Math.abs(gesture.dx) < 5 && Math.abs(gesture.dy) < 5) {
          setMode(prev => {
            if (prev === 'bubble') return 'compact';
            if (prev === 'compact') return 'full';
            return 'bubble';
          });
        }
      },
    })
  ).current;

  const toggleProfiler = useCallback(() => {
    if (data.isRunning) {
      NazarProfiler.stop();
    } else {
      NazarProfiler.start();
    }
  }, [data.isRunning]);

  const resetStats = useCallback(() => {
    NazarProfiler.reset();
    NazarProfiler.start();
  }, []);

  if (!visible) return null;

  // Extract data from the hook
  const { fps, memory, renders, screen, threads, health, navigation } = data;
  const fpsColor = getColor(fps.current, 55, 30);
  const memoryMB = Math.round(memory.current / (1024 * 1024));

  // ==================== Bubble View ====================
  if (mode === 'bubble') {
    return (
      <Animated.View
        style={[
          styles.bubble,
          { transform: [{ translateX: pan.x }, { translateY: pan.y }] },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={[styles.bubbleCircle, { borderColor: fpsColor }]}>
          <Text style={[styles.bubbleFps, { color: fpsColor }]}>{fps.current}</Text>
          <Text style={styles.bubbleLabel}>FPS</Text>
        </View>
        <View style={[styles.statusDot, { backgroundColor: data.isRunning ? Colors.green : Colors.red }]} />
      </Animated.View>
    );
  }

  // ==================== Compact View ====================
  if (mode === 'compact') {
    return (
      <Animated.View
        style={[
          styles.compact,
          { transform: [{ translateX: pan.x }, { translateY: pan.y }] },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Header */}
        <View style={styles.compactHeader}>
          <View style={styles.headerLeft}>
            <View style={[styles.dot, { backgroundColor: data.isRunning ? Colors.green : Colors.red }]} />
            <Text style={styles.compactTitle}>Performance</Text>
          </View>
          <TouchableOpacity onPress={toggleProfiler} style={styles.iconBtn}>
            <Text style={styles.iconText}>{data.isRunning ? '⏸️' : '▶️'}</Text>
          </TouchableOpacity>
        </View>

        {/* Screen */}
        <Text style={styles.screenText} numberOfLines={1}>📱 {screen.name}</Text>

        {/* Main Metrics */}
        <View style={styles.compactGrid}>
          <View style={styles.compactMetric}>
            <Text style={[styles.compactValue, { color: fpsColor }]}>{fps.current}</Text>
            <Text style={styles.compactLabel}>FPS</Text>
          </View>
          <View style={styles.compactMetric}>
            <Text style={[styles.compactValue, { color: Colors.purple }]}>{renders.total}</Text>
            <Text style={styles.compactLabel}>Renders</Text>
          </View>
          <View style={styles.compactMetric}>
            <Text style={[styles.compactValue, { color: Colors.cyan }]}>{memoryMB}MB</Text>
            <Text style={styles.compactLabel}>Memory</Text>
          </View>
          <View style={styles.compactMetric}>
            <Text style={[styles.compactValue, { color: Colors.orange }]}>{renders.slow}</Text>
            <Text style={styles.compactLabel}>Slow</Text>
          </View>
        </View>

        {/* FPS Bar */}
        <View style={styles.fpsBarContainer}>
          <View style={styles.fpsBarBg}>
            <View style={[styles.fpsBar, { width: `${fps.score}%`, backgroundColor: fpsColor }]} />
          </View>
          <Text style={styles.fpsBarText}>{fps.score}%</Text>
        </View>

        {/* Mini Stats */}
        <View style={styles.miniStats}>
          <Text style={styles.miniStat}>⏱️ {formatDuration(data.sessionDuration)}</Text>
          <Text style={styles.miniStat}>📊 Avg: {fps.average}</Text>
        </View>
      </Animated.View>
    );
  }

  // ==================== Full View ====================
  return (
    <Animated.View
      style={[
        styles.full,
        { transform: [{ translateX: pan.x }, { translateY: pan.y }] },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Header */}
      <View style={styles.fullHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.dot, { backgroundColor: data.isRunning ? Colors.green : Colors.red }]} />
          <Text style={styles.fullTitle}>Nazar Profiler</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={resetStats} style={styles.iconBtn}>
            <Text style={styles.iconText}>🔄</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleProfiler} style={styles.iconBtn}>
            <Text style={styles.iconText}>{data.isRunning ? '⏸️' : '▶️'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Health Score */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health Score</Text>
          <View style={styles.healthRow}>
            <Text style={[styles.healthScore, { color: getHealthColor(health.status) }]}>
              {health.score}%
            </Text>
            <Text style={[styles.healthStatus, { color: getHealthColor(health.status) }]}>
              {health.status.toUpperCase()}
            </Text>
          </View>
          {health.issues.length > 0 && (
            <View style={styles.issuesList}>
              {health.issues.map((issue, i) => (
                <Text key={i} style={styles.issueText}>⚠️ {issue}</Text>
              ))}
            </View>
          )}
        </View>

        {/* Current Screen */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Screen</Text>
          <Text style={styles.screenName}>{screen.name}</Text>
        </View>

        {/* FPS Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frame Rate</Text>
          <View style={styles.fpsDisplay}>
            <Text style={[styles.bigFps, { color: fpsColor }]}>{fps.current}</Text>
            <Text style={styles.fpsUnit}>FPS</Text>
          </View>

          {/* FPS Graph */}
          <View style={styles.fpsGraph}>
            {fps.history.slice(-30).map((f, i) => (
              <View
                key={i}
                style={[
                  styles.fpsGraphBar,
                  {
                    height: `${Math.min(100, (f / 70) * 100)}%`,
                    backgroundColor: getColor(f, 55, 30),
                  },
                ]}
              />
            ))}
          </View>

          <View style={styles.fpsStats}>
            <View style={styles.fpsStat}>
              <Text style={styles.fpsStatValue}>{fps.min}</Text>
              <Text style={styles.fpsStatLabel}>Min</Text>
            </View>
            <View style={styles.fpsStat}>
              <Text style={[styles.fpsStatValue, { color: Colors.green }]}>{fps.average}</Text>
              <Text style={styles.fpsStatLabel}>Avg</Text>
            </View>
            <View style={styles.fpsStat}>
              <Text style={styles.fpsStatValue}>{fps.max}</Text>
              <Text style={styles.fpsStatLabel}>Max</Text>
            </View>
          </View>
        </View>

        {/* Render Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Renders</Text>
          <View style={styles.metricsRow}>
            <MetricCard label="Total" value={renders.total} color={Colors.purple} />
            <MetricCard label="Slow (>16ms)" value={renders.slow} color={Colors.yellow} />
            <MetricCard label="Very Slow" value={renders.verySlow} color={Colors.red} />
          </View>
        </View>

        {/* Memory */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Memory</Text>
          <View style={styles.metricsRow}>
            <MetricCard label="Current" value={memory.formatted.current} color={Colors.cyan} />
            <MetricCard label="Peak" value={memory.formatted.peak} color={Colors.orange} />
          </View>
        </View>

        {/* Thread Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thread Activity</Text>
          <View style={styles.threadRow}>
            <View style={styles.thread}>
              <Text style={styles.threadLabel}>UI Thread</Text>
              <View style={styles.threadBarBg}>
                <View style={[styles.threadBar, { width: `${Math.min(100, threads.ui.usage)}%`, backgroundColor: Colors.blue }]} />
              </View>
              <Text style={styles.threadValue}>{threads.ui.usage.toFixed(1)}%</Text>
            </View>
            <View style={styles.thread}>
              <Text style={styles.threadLabel}>JS Thread</Text>
              <View style={styles.threadBarBg}>
                <View style={[styles.threadBar, { width: `${Math.min(100, threads.js.usage)}%`, backgroundColor: Colors.purple }]} />
              </View>
              <Text style={styles.threadValue}>{threads.js.usage.toFixed(1)}%</Text>
            </View>
          </View>
        </View>

        {/* Session Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session</Text>
          <View style={styles.sessionGrid}>
            <View style={styles.sessionItem}>
              <Text style={styles.sessionValue}>{formatDuration(data.sessionDuration)}</Text>
              <Text style={styles.sessionLabel}>Duration</Text>
            </View>
            <View style={styles.sessionItem}>
              <Text style={styles.sessionValue}>{navigation.totalScreenViews}</Text>
              <Text style={styles.sessionLabel}>Screen Views</Text>
            </View>
            <View style={styles.sessionItem}>
              <Text style={styles.sessionValue}>{data.platform}</Text>
              <Text style={styles.sessionLabel}>Platform</Text>
            </View>
          </View>
        </View>

        {/* Screen Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Screen Details</Text>
          <View style={styles.detailsGrid}>
            <DetailRow label="Render Count" value={screen.renderCount.toString()} />
            <DetailRow label="Avg Render" value={`${screen.averageRenderTime.toFixed(2)}ms`} />
            <DetailRow label="Last Render" value={`${screen.lastRenderTime.toFixed(2)}ms`} />
            <DetailRow label="Time on Screen" value={formatDuration(screen.timeOnScreen / 1000)} />
            <DetailRow label="Interactions" value={screen.interactionCount.toString()} />
            <DetailRow label="Components" value={screen.componentCount.toString()} />
            <DetailRow label="Dropped Frames" value={screen.droppedFrames.toString()} />
          </View>
        </View>

        {/* Components */}
        {data.components.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Components ({data.components.length})</Text>
            <View style={styles.detailsGrid}>
              {data.components.slice(0, 5).map((comp, i) => (
                <DetailRow
                  key={i}
                  label={comp.name}
                  value={`${comp.renderCount} renders, ${comp.averageRenderTime.toFixed(1)}ms avg`}
                />
              ))}
            </View>
          </View>
        )}

        {/* Navigation History */}
        {navigation.screensVisited.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Navigation History</Text>
            <View style={styles.navHistory}>
              {navigation.screensVisited.slice(-5).map((screenName, i) => (
                <Text key={i} style={styles.navItem}>
                  {i + 1}. {screenName}
                </Text>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </Animated.View>
  );
};

// Helper Components
const MetricCard: React.FC<{ label: string; value: string | number; color: string }> = ({ label, value, color }) => (
  <View style={styles.metricCard}>
    <Text style={[styles.metricCardValue, { color }]}>{value}</Text>
    <Text style={styles.metricCardLabel}>{label}</Text>
  </View>
);

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  // Bubble
  bubble: {
    position: 'absolute',
    zIndex: 9999,
    alignItems: 'center',
  },
  bubbleCircle: {
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: Colors.bg,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 12,
  },
  bubbleFps: {
    fontSize: 22,
    fontWeight: '800',
  },
  bubbleLabel: {
    fontSize: 10,
    color: Colors.textDim,
    fontWeight: '600',
    marginTop: -2,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },

  // Compact
  compact: {
    position: 'absolute',
    zIndex: 9999,
    width: 220,
    backgroundColor: Colors.bg,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  compactTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  iconBtn: {
    padding: 4,
  },
  iconText: {
    fontSize: 16,
  },
  screenText: {
    color: Colors.textDim,
    fontSize: 12,
    marginBottom: 12,
  },
  compactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  compactMetric: {
    width: '47%',
    backgroundColor: Colors.bgLight,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  compactValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  compactLabel: {
    fontSize: 10,
    color: Colors.textDim,
    fontWeight: '600',
    marginTop: 2,
  },
  fpsBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  fpsBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.bgLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fpsBar: {
    height: '100%',
    borderRadius: 3,
  },
  fpsBarText: {
    color: Colors.textDim,
    fontSize: 11,
    fontWeight: '600',
    width: 35,
  },
  miniStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  miniStat: {
    color: Colors.textDim,
    fontSize: 11,
  },

  // Full
  full: {
    position: 'absolute',
    zIndex: 9999,
    width: SCREEN_WIDTH - 20,
    maxHeight: SCREEN_HEIGHT * 0.7,
    backgroundColor: Colors.bg,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fullHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  fullTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: Colors.textDim,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  screenName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  fpsDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  bigFps: {
    fontSize: 48,
    fontWeight: '800',
  },
  fpsUnit: {
    color: Colors.textDim,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  fpsGraph: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 50,
    gap: 2,
    marginBottom: 10,
    backgroundColor: Colors.bgLight,
    borderRadius: 8,
    padding: 4,
  },
  fpsGraphBar: {
    flex: 1,
    borderRadius: 2,
    minHeight: 2,
  },
  fpsStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  fpsStat: {
    alignItems: 'center',
  },
  fpsStatValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  fpsStatLabel: {
    color: Colors.textDim,
    fontSize: 10,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: Colors.bgLight,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  metricCardValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  metricCardLabel: {
    color: Colors.textDim,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  threadRow: {
    gap: 12,
  },
  thread: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  threadLabel: {
    color: Colors.textDim,
    fontSize: 12,
    width: 70,
  },
  threadBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.bgLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  threadBar: {
    height: '100%',
    borderRadius: 4,
  },
  threadValue: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
    width: 45,
    textAlign: 'right',
  },
  sessionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  sessionItem: {
    flex: 1,
    backgroundColor: Colors.bgLight,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  sessionValue: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sessionLabel: {
    color: Colors.textDim,
    fontSize: 10,
    marginTop: 4,
  },
  detailsGrid: {
    backgroundColor: Colors.bgLight,
    borderRadius: 12,
    padding: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: {
    color: Colors.textDim,
    fontSize: 13,
    flex: 1,
  },
  detailValue: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },

  // Health section
  healthRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  healthScore: {
    fontSize: 42,
    fontWeight: '800',
  },
  healthStatus: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  issuesList: {
    marginTop: 10,
    backgroundColor: Colors.bgLight,
    borderRadius: 8,
    padding: 10,
  },
  issueText: {
    color: Colors.yellow,
    fontSize: 12,
    marginBottom: 4,
  },

  // Navigation history
  navHistory: {
    backgroundColor: Colors.bgLight,
    borderRadius: 8,
    padding: 10,
  },
  navItem: {
    color: Colors.text,
    fontSize: 12,
    marginBottom: 4,
  },
});

export default ProfilerOverlay;
