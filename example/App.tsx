import React, {useState} from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import {
  PerformanceProvider,
  usePerformance,
  useConditionalRender,
  useDeviceSummary,
  DevTools,
  getDeviceSpecs,
  runBenchmark,
  getPerformanceScore,
  isLowEndDevice,
  formatBytes,
  formatPercent,
} from 'react-native-nazar';

function PerformanceDemo() {
  const {score, specs, tier, isLoading, settings, runFullBenchmark, isBenchmarking} =
    usePerformance();
  const conditional = useConditionalRender();
  const summary = useDeviceSummary();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Analyzing device...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>react-native-nazar</Text>
      <Text style={styles.subtitle}>Device Performance Monitor</Text>

      {/* Device Summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Device Summary</Text>
        <Text style={styles.summaryText}>{summary}</Text>
      </View>

      {/* Performance Score */}
      {score && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Performance Score</Text>
          <Text style={styles.scoreText}>{score.overall}/100</Text>
          <Text style={styles.tierBadge}>Tier: {tier}</Text>
          <View style={styles.row}>
            <ScoreItem label="CPU" value={score.cpu} />
            <ScoreItem label="Memory" value={score.memory} />
            <ScoreItem label="Storage" value={score.storage} />
            <ScoreItem label="GPU" value={score.gpu} />
          </View>
        </View>
      )}

      {/* Device Specs */}
      {specs && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Device Specs</Text>
          <SpecRow label="Model" value={specs.device.model} />
          <SpecRow label="OS" value={`${specs.device.osName} ${specs.device.osVersion}`} />
          <SpecRow label="CPU Cores" value={`${specs.cpu.cores}`} />
          <SpecRow label="Total RAM" value={formatBytes(specs.memory.total)} />
          <SpecRow label="Memory Used" value={formatPercent(specs.memory.usedPercentage)} />
          <SpecRow label="Storage" value={formatBytes(specs.storage.total)} />
          <SpecRow label="Battery" value={`${specs.battery.level}%`} />
          <SpecRow label="Thermal" value={specs.thermal.state} />
        </View>
      )}

      {/* Adaptive Settings */}
      {settings && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Adaptive Quality Settings</Text>
          <SpecRow label="Animations" value={settings.enableAnimations ? 'ON' : 'OFF'} />
          <SpecRow label="Blur Effects" value={settings.enableBlur ? 'ON' : 'OFF'} />
          <SpecRow label="Shadows" value={settings.enableShadows ? 'ON' : 'OFF'} />
          <SpecRow label="Image Quality" value={settings.imageQuality} />
          <SpecRow label="Video Quality" value={settings.videoQuality} />
        </View>
      )}

      {/* Conditional Rendering */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Conditional Rendering</Text>
        <SpecRow label="Render Animations" value={conditional.shouldRenderAnimations ? 'Yes' : 'No'} />
        <SpecRow label="Render Blur" value={conditional.shouldRenderBlur ? 'Yes' : 'No'} />
        <SpecRow label="Render Parallax" value={conditional.shouldRenderParallax ? 'Yes' : 'No'} />
        <SpecRow label="Reduce Motion" value={conditional.shouldReduceMotion ? 'Yes' : 'No'} />
        <SpecRow label="Preload Images" value={conditional.shouldPreloadImages ? 'Yes' : 'No'} />
      </View>

      {/* Benchmark */}
      <TouchableOpacity
        style={[styles.button, isBenchmarking && styles.buttonDisabled]}
        onPress={runFullBenchmark}
        disabled={isBenchmarking}>
        <Text style={styles.buttonText}>
          {isBenchmarking ? 'Running Benchmark...' : 'Run Full Benchmark'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function ScoreItem({label, value}: {label: string; value: number}) {
  return (
    <View style={styles.scoreItem}>
      <Text style={styles.scoreItemValue}>{value}</Text>
      <Text style={styles.scoreItemLabel}>{label}</Text>
    </View>
  );
}

function SpecRow({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.specRow}>
      <Text style={styles.specLabel}>{label}</Text>
      <Text style={styles.specValue}>{value}</Text>
    </View>
  );
}

function StandaloneApiDemo() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const runStandaloneCheck = async () => {
    setLoading(true);
    try {
      const specs = await getDeviceSpecs();
      const score = await getPerformanceScore();
      const lowEnd = await isLowEndDevice();

      setResult(
        `Device: ${specs.device.model}\n` +
          `Score: ${score.overall}/100 (${score.tier})\n` +
          `Low-end: ${lowEnd ? 'Yes' : 'No'}\n` +
          `RAM: ${formatBytes(specs.memory.total)}\n` +
          `CPU: ${specs.cpu.cores} cores`,
      );
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Standalone API (No Provider)</Text>
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={runStandaloneCheck}
        disabled={loading}>
        <Text style={styles.buttonText}>
          {loading ? 'Checking...' : 'Get Device Info'}
        </Text>
      </TouchableOpacity>
      {result ? <Text style={styles.resultText}>{result}</Text> : null}
    </View>
  );
}

export default function App() {
  return (
    <PerformanceProvider>
      <SafeAreaView style={styles.safeArea}>
        <PerformanceDemo />
        <DevTools enabled position="bottomRight" />
      </SafeAreaView>
    </PerformanceProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
  },
  scoreText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#6366f1',
    textAlign: 'center',
  },
  tierBadge: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
    textAlign: 'center',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  scoreItem: {
    alignItems: 'center',
  },
  scoreItemValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
  },
  scoreItemLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  specLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  specValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  button: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultText: {
    marginTop: 12,
    fontSize: 13,
    color: '#334155',
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  summaryText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
});
