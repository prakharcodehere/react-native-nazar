import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
  ScrollView,
  Platform,
} from 'react-native';
import {
  getDeviceSpecs,
  getPerformanceScore,
  runBenchmark,
  formatBytes,
  DeviceSpecs,
  PerformanceScore,
  BenchmarkResults,
} from './index';

// ==================== TYPES ====================

interface DevToolsProps {
  /**
   * Enable/disable the DevTools overlay
   * @default true
   */
  enabled?: boolean;
  /**
   * Initial position of the bubble
   * @default 'bottom-right'
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /**
   * Auto-refresh interval in milliseconds (0 to disable)
   * @default 5000
   */
  refreshInterval?: number;
  /**
   * Show only in __DEV__ mode
   * @default true
   */
  devOnly?: boolean;
  /**
   * Custom accent color
   * @default '#007AFF'
   */
  accentColor?: string;
}

// ==================== CONSTANTS ====================

const BUBBLE_SIZE = 56;
const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 480;
const MARGIN = 16;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ==================== HELPER COMPONENTS ====================

const MetricRow = ({
  label,
  value,
  subValue,
  color,
}: {
  label: string;
  value: string;
  subValue?: string;
  color?: string;
}) => (
  <View style={styles.metricRow}>
    <Text style={styles.metricLabel}>{label}</Text>
    <View style={styles.metricValueContainer}>
      <Text style={[styles.metricValue, color ? { color } : null]}>{value}</Text>
      {subValue && <Text style={styles.metricSubValue}>{subValue}</Text>}
    </View>
  </View>
);

const ProgressBar = ({
  value,
  color = '#007AFF',
  backgroundColor = '#E5E5EA',
}: {
  value: number;
  color?: string;
  backgroundColor?: string;
}) => (
  <View style={[styles.progressBar, { backgroundColor }]}>
    <View style={[styles.progressFill, { width: `${Math.min(100, value)}%`, backgroundColor: color }]} />
  </View>
);

const ScoreCircle = ({
  score,
  label,
  size = 60,
  color,
}: {
  score: number;
  label: string;
  size?: number;
  color: string;
}) => (
  <View style={styles.scoreCircleContainer}>
    <View
      style={[
        styles.scoreCircle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: color,
        },
      ]}
    >
      <Text style={[styles.scoreCircleValue, { color }]}>{Math.round(score)}</Text>
    </View>
    <Text style={styles.scoreCircleLabel}>{label}</Text>
  </View>
);

const SectionHeader = ({ title }: { title: string }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

// ==================== MAIN COMPONENT ====================

export function DevTools({
  enabled = true,
  position = 'bottom-right',
  refreshInterval = 5000,
  devOnly = true,
  accentColor = '#007AFF',
}: DevToolsProps) {
  // Don't render in production if devOnly is true
  if (devOnly && !__DEV__) {
    return null;
  }

  if (!enabled) {
    return null;
  }

  return <DevToolsContent position={position} refreshInterval={refreshInterval} accentColor={accentColor} />;
}

function DevToolsContent({
  position,
  refreshInterval,
  accentColor,
}: {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  refreshInterval: number;
  accentColor: string;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'specs' | 'benchmark'>('overview');
  const [specs, setSpecs] = useState<DeviceSpecs | null>(null);
  const [score, setScore] = useState<PerformanceScore | null>(null);
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResults | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const expandAnim = useRef(new Animated.Value(0)).current;
  const panAnim = useRef(new Animated.ValueXY(getInitialPosition(position))).current;

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [deviceSpecs, performanceScore] = await Promise.all([
        getDeviceSpecs(),
        getPerformanceScore(),
      ]);
      setSpecs(deviceSpecs);
      setScore(performanceScore);
      setIsLoading(false);
    } catch (error) {
      console.error('DevTools: Failed to load data', error);
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0 && isExpanded) {
      const interval = setInterval(loadData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, isExpanded, loadData]);

  // Run benchmark
  const handleRunBenchmark = async () => {
    setIsBenchmarking(true);
    try {
      const results = await runBenchmark();
      setBenchmarkResults(results);
    } catch (error) {
      console.error('Benchmark failed:', error);
    } finally {
      setIsBenchmarking(false);
    }
  };

  // Toggle expansion
  const toggleExpand = () => {
    const toValue = isExpanded ? 0 : 1;
    Animated.spring(expandAnim, {
      toValue,
      useNativeDriver: false,
      friction: 8,
    }).start();
    setIsExpanded(!isExpanded);
  };

  // Pan responder for dragging
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isExpanded,
      onMoveShouldSetPanResponder: () => !isExpanded,
      onPanResponderGrant: () => {
        panAnim.setOffset({
          x: (panAnim.x as any)._value,
          y: (panAnim.y as any)._value,
        });
      },
      onPanResponderMove: Animated.event([null, { dx: panAnim.x, dy: panAnim.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        panAnim.flattenOffset();
        // Snap to edges
        const currentX = (panAnim.x as any)._value;
        const currentY = (panAnim.y as any)._value;
        const snapX = currentX > SCREEN_WIDTH / 2 - BUBBLE_SIZE / 2 ? SCREEN_WIDTH - BUBBLE_SIZE - MARGIN : MARGIN;
        const snapY = Math.max(MARGIN, Math.min(currentY, SCREEN_HEIGHT - BUBBLE_SIZE - MARGIN));

        Animated.spring(panAnim, {
          toValue: { x: snapX, y: snapY },
          useNativeDriver: false,
          friction: 7,
        }).start();
      },
    })
  ).current;

  // Get tier color
  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'HIGH':
        return '#34C759';
      case 'MEDIUM':
        return '#FF9500';
      case 'LOW':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const tierColor = getTierColor(score?.tier);

  // Animated styles
  const bubbleStyle = {
    transform: [
      { translateX: panAnim.x },
      { translateY: panAnim.y },
      {
        scale: expandAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 0],
        }),
      },
    ],
    opacity: expandAnim.interpolate({
      inputRange: [0, 0.5],
      outputRange: [1, 0],
    }),
  };

  const panelStyle = {
    opacity: expandAnim,
    transform: [
      {
        scale: expandAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.8, 1],
        }),
      },
    ],
  };

  return (
    <>
      {/* Floating Bubble */}
      <Animated.View style={[styles.bubble, bubbleStyle]} {...panResponder.panHandlers}>
        <TouchableOpacity style={[styles.bubbleButton, { borderColor: tierColor }]} onPress={toggleExpand}>
          {isLoading ? (
            <Text style={styles.bubbleText}>...</Text>
          ) : (
            <>
              <Text style={[styles.bubbleScore, { color: tierColor }]}>{Math.round(score?.overall ?? 0)}</Text>
              <Text style={styles.bubbleTier}>{score?.tier?.[0] ?? '?'}</Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Expanded Panel */}
      {isExpanded && (
        <Animated.View style={[styles.panel, panelStyle]}>
          {/* Header */}
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.panelTitle}>Device Performance</Text>
              <Text style={[styles.panelTier, { color: tierColor }]}>
                {score?.tier ?? 'Loading'} • {Math.round(score?.overall ?? 0)}/100
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={toggleExpand}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {(['overview', 'specs', 'benchmark'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && { borderBottomColor: accentColor }]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && { color: accentColor }]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {activeTab === 'overview' && (
              <OverviewTab specs={specs} score={score} tierColor={tierColor} accentColor={accentColor} />
            )}
            {activeTab === 'specs' && <SpecsTab specs={specs} />}
            {activeTab === 'benchmark' && (
              <BenchmarkTab
                results={benchmarkResults}
                isBenchmarking={isBenchmarking}
                onRunBenchmark={handleRunBenchmark}
                accentColor={accentColor}
              />
            )}
          </ScrollView>
        </Animated.View>
      )}
    </>
  );
}

// ==================== TAB COMPONENTS ====================

function OverviewTab({
  specs,
  score,
  tierColor,
  accentColor,
}: {
  specs: DeviceSpecs | null;
  score: PerformanceScore | null;
  tierColor: string;
  accentColor: string;
}) {
  if (!specs || !score) {
    return <Text style={styles.loadingText}>Loading...</Text>;
  }

  return (
    <View>
      {/* Score Circles */}
      <View style={styles.scoreCircles}>
        <ScoreCircle score={score.cpu} label="CPU" color={getScoreColor(score.cpu)} />
        <ScoreCircle score={score.memory} label="Memory" color={getScoreColor(score.memory)} />
        <ScoreCircle score={score.storage} label="Storage" color={getScoreColor(score.storage)} />
        {score.gpu !== undefined && <ScoreCircle score={score.gpu} label="GPU" color={getScoreColor(score.gpu)} />}
      </View>

      {/* Quick Stats */}
      <SectionHeader title="Quick Stats" />

      <MetricRow label="Device" value={specs.device.modelName ?? specs.device.model} />
      <MetricRow label="CPU Cores" value={`${specs.cpu.cores} cores`} subValue={specs.cpu.architecture} />
      <MetricRow
        label="RAM"
        value={formatBytes(specs.memory.totalRam)}
        subValue={`${specs.memory.usagePercent.toFixed(0)}% used`}
      />
      <ProgressBar value={specs.memory.usagePercent} color={getUsageColor(specs.memory.usagePercent)} />

      <MetricRow
        label="Storage"
        value={formatBytes(specs.storage.availableStorage)}
        subValue={`of ${formatBytes(specs.storage.totalStorage)}`}
      />
      <ProgressBar value={specs.storage.usagePercent} color={getUsageColor(specs.storage.usagePercent)} />

      <MetricRow
        label="Battery"
        value={`${specs.battery.level.toFixed(0)}%`}
        subValue={specs.battery.isCharging ? 'Charging' : 'Not charging'}
        color={specs.battery.level < 20 ? '#FF3B30' : undefined}
      />

      {specs.thermal && (
        <MetricRow label="Thermal" value={specs.thermal.state} color={getThermalColor(specs.thermal.state)} />
      )}
    </View>
  );
}

function SpecsTab({ specs }: { specs: DeviceSpecs | null }) {
  if (!specs) {
    return <Text style={styles.loadingText}>Loading...</Text>;
  }

  return (
    <View>
      <SectionHeader title="Device" />
      <MetricRow label="Model" value={specs.device.modelName ?? specs.device.model} />
      <MetricRow label="Brand" value={specs.device.brand ?? specs.device.manufacturer ?? 'Unknown'} />
      <MetricRow label="OS" value={`${specs.device.systemName ?? Platform.OS} ${specs.device.systemVersion ?? ''}`} />
      <MetricRow label="Type" value={specs.device.deviceType} />

      <SectionHeader title="CPU" />
      <MetricRow label="Cores" value={`${specs.cpu.cores}`} />
      <MetricRow label="Architecture" value={specs.cpu.architecture} />
      {specs.cpu.maxFrequency && <MetricRow label="Max Frequency" value={`${specs.cpu.maxFrequency.toFixed(0)} MHz`} />}
      {specs.cpu.brand && <MetricRow label="Chip" value={specs.cpu.brand} />}

      <SectionHeader title="Memory" />
      <MetricRow label="Total RAM" value={formatBytes(specs.memory.totalRam)} />
      <MetricRow label="Available" value={formatBytes(specs.memory.availableRam)} />
      <MetricRow label="Used" value={formatBytes(specs.memory.usedRam)} />

      <SectionHeader title="Display" />
      <MetricRow label="Resolution" value={`${specs.display.widthPixels}×${specs.display.heightPixels}`} />
      {specs.display.refreshRate && <MetricRow label="Refresh Rate" value={`${specs.display.refreshRate} Hz`} />}
      <MetricRow label="Density" value={`${specs.display.density}x`} />
      {specs.display.screenSizeInches && (
        <MetricRow label="Screen Size" value={`${specs.display.screenSizeInches.toFixed(1)}"`} />
      )}

      <SectionHeader title="Battery" />
      <MetricRow label="Level" value={`${specs.battery.level.toFixed(0)}%`} />
      <MetricRow label="State" value={specs.battery.state} />
      {specs.battery.health && <MetricRow label="Health" value={specs.battery.health} />}
      {specs.battery.temperature && <MetricRow label="Temperature" value={`${specs.battery.temperature.toFixed(1)}°C`} />}

      {specs.gpu && (
        <>
          <SectionHeader title="GPU" />
          {specs.gpu.name && <MetricRow label="Name" value={specs.gpu.name} />}
          {specs.gpu.renderer && <MetricRow label="Renderer" value={specs.gpu.renderer} />}
          {specs.gpu.vendor && <MetricRow label="Vendor" value={specs.gpu.vendor} />}
        </>
      )}

      <View style={{ height: 20 }} />
    </View>
  );
}

function BenchmarkTab({
  results,
  isBenchmarking,
  onRunBenchmark,
  accentColor,
}: {
  results: BenchmarkResults | null;
  isBenchmarking: boolean;
  onRunBenchmark: () => void;
  accentColor: string;
}) {
  return (
    <View>
      <TouchableOpacity
        style={[styles.benchmarkButton, { backgroundColor: accentColor }, isBenchmarking && styles.benchmarkButtonDisabled]}
        onPress={onRunBenchmark}
        disabled={isBenchmarking}
      >
        <Text style={styles.benchmarkButtonText}>{isBenchmarking ? 'Running Benchmark...' : 'Run Full Benchmark'}</Text>
      </TouchableOpacity>

      {isBenchmarking && <Text style={styles.benchmarkNote}>This may take 5-10 seconds...</Text>}

      {results && (
        <>
          <SectionHeader title="Results" />

          <View style={styles.benchmarkResult}>
            <Text style={styles.benchmarkResultLabel}>Overall Score</Text>
            <Text style={[styles.benchmarkResultValue, { color: getScoreColor(results.overallScore) }]}>
              {results.overallScore.toFixed(1)}
            </Text>
            <Text style={[styles.benchmarkTier, { color: getScoreColor(results.overallScore) }]}>
              {results.performanceTier}
            </Text>
          </View>

          <View style={styles.benchmarkScores}>
            <BenchmarkScore label="CPU" score={results.cpuScore} grade={results.grades?.cpuGrade} />
            <BenchmarkScore label="Memory" score={results.memoryScore} grade={results.grades?.memoryGrade} />
            <BenchmarkScore label="Storage" score={results.storageScore} grade={results.grades?.storageGrade} />
            {results.multiThreadScore && (
              <BenchmarkScore label="Multi-Thread" score={results.multiThreadScore} grade={results.grades?.multiThreadGrade} />
            )}
            {results.gpuScore && (
              <BenchmarkScore label="GPU" score={results.gpuScore} grade={results.grades?.gpuGrade} />
            )}
          </View>
        </>
      )}

      {!results && !isBenchmarking && (
        <Text style={styles.benchmarkNote}>Run a benchmark to see detailed performance scores</Text>
      )}
    </View>
  );
}

function BenchmarkScore({ label, score, grade }: { label: string; score: number; grade?: string }) {
  const color = getScoreColor(score);
  return (
    <View style={styles.benchmarkScoreItem}>
      <Text style={styles.benchmarkScoreLabel}>{label}</Text>
      <View style={styles.benchmarkScoreRow}>
        <Text style={[styles.benchmarkScoreValue, { color }]}>{score.toFixed(0)}</Text>
        {grade && <Text style={[styles.benchmarkScoreGrade, { color }]}>{grade}</Text>}
      </View>
      <ProgressBar value={score} color={color} />
    </View>
  );
}

// ==================== HELPERS ====================

function getInitialPosition(position: string) {
  switch (position) {
    case 'top-left':
      return { x: MARGIN, y: MARGIN + 44 };
    case 'top-right':
      return { x: SCREEN_WIDTH - BUBBLE_SIZE - MARGIN, y: MARGIN + 44 };
    case 'bottom-left':
      return { x: MARGIN, y: SCREEN_HEIGHT - BUBBLE_SIZE - MARGIN - 34 };
    case 'bottom-right':
    default:
      return { x: SCREEN_WIDTH - BUBBLE_SIZE - MARGIN, y: SCREEN_HEIGHT - BUBBLE_SIZE - MARGIN - 34 };
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#34C759';
  if (score >= 60) return '#30D158';
  if (score >= 40) return '#FF9500';
  if (score >= 20) return '#FF6B00';
  return '#FF3B30';
}

function getUsageColor(usage: number): string {
  if (usage < 50) return '#34C759';
  if (usage < 75) return '#FF9500';
  return '#FF3B30';
}

function getThermalColor(state: string): string {
  switch (state) {
    case 'NOMINAL':
      return '#34C759';
    case 'FAIR':
      return '#FF9500';
    case 'SERIOUS':
      return '#FF6B00';
    case 'CRITICAL':
      return '#FF3B30';
    default:
      return '#8E8E93';
  }
}

// ==================== STYLES ====================

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    zIndex: 9999,
  },
  bubbleButton: {
    width: BUBBLE_SIZE,
    height: BUBBLE_SIZE,
    borderRadius: BUBBLE_SIZE / 2,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  bubbleText: {
    color: '#FFF',
    fontSize: 14,
  },
  bubbleScore: {
    fontSize: 18,
    fontWeight: '700',
  },
  bubbleTier: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: -2,
  },
  panel: {
    position: 'absolute',
    top: 60,
    left: (SCREEN_WIDTH - PANEL_WIDTH) / 2,
    width: PANEL_WIDTH,
    maxHeight: PANEL_HEIGHT,
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    zIndex: 10000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  panelTier: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#8E8E93',
    marginTop: -2,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: PANEL_HEIGHT - 140,
  },
  loadingText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  scoreCircles: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  scoreCircleContainer: {
    alignItems: 'center',
  },
  scoreCircle: {
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreCircleValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  scoreCircleLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E8E93',
    marginTop: 6,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  metricLabel: {
    fontSize: 14,
    color: '#FFF',
  },
  metricValueContainer: {
    alignItems: 'flex-end',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  metricSubValue: {
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 1,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  benchmarkButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  benchmarkButtonDisabled: {
    opacity: 0.6,
  },
  benchmarkButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  benchmarkNote: {
    color: '#8E8E93',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  benchmarkResult: {
    alignItems: 'center',
    marginBottom: 20,
  },
  benchmarkResultLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  benchmarkResultValue: {
    fontSize: 48,
    fontWeight: '700',
  },
  benchmarkTier: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  benchmarkScores: {
    marginBottom: 20,
  },
  benchmarkScoreItem: {
    marginBottom: 12,
  },
  benchmarkScoreLabel: {
    fontSize: 13,
    color: '#FFF',
    marginBottom: 4,
  },
  benchmarkScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  benchmarkScoreValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  benchmarkScoreGrade: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#2C2C2E',
    borderRadius: 4,
    overflow: 'hidden',
  },
});

export default DevTools;
