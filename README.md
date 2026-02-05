# react-native-nazar

A comprehensive React Native library for measuring device performance, collecting hardware specifications, and running benchmarks. Supports both Old and New Architecture (Turbo Modules).

[![npm version](https://badge.fury.io/js/react-native-nazar.svg)](https://badge.fury.io/js/react-native-nazar)
[![Platform](https://img.shields.io/badge/platform-android%20%7C%20ios-blue.svg)](https://reactnative.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Device Specifications** - CPU, Memory, Storage, Battery, Display, Thermal state
- **Performance Benchmarking** - CPU, Memory, and Storage speed tests
- **Performance Scoring** - Quick device capability assessment (0-100)
- **Performance Tiers** - Automatic categorization (HIGH/MEDIUM/LOW)
- **Cross-Platform** - Full support for iOS and Android
- **TypeScript** - Complete type definitions included
- **Both Architectures** - Supports Old Bridge and New Architecture (Turbo Modules)

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Performance Metrics](#performance-metrics)
- [Use Cases](#use-cases)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
# Using npm
npm install react-native-nazar

# Using yarn
yarn add react-native-nazar
```

### iOS Setup

```bash
cd ios && pod install
```

### Android Setup

No additional setup required. The library auto-links on React Native 0.60+.

### Permissions (Android)

Add to your `AndroidManifest.xml` if you want battery temperature:

```xml
<uses-permission android:name="android.permission.BATTERY_STATS" />
```

## Usage

### Quick Start

```typescript
import DevicePerformance from 'react-native-nazar';

// Get quick performance score
const score = await DevicePerformance.getPerformanceScore();
console.log(`Device Performance: ${score.tier} (${score.overall.toFixed(1)}/100)`);

// Check if low-end device
if (await DevicePerformance.isLowEndDevice()) {
  // Disable heavy animations
  // Reduce image quality
  // Use lighter components
}
```

### Get Device Specifications

```typescript
import { getDeviceSpecs, formatBytes } from 'react-native-nazar';

const specs = await getDeviceSpecs();

// CPU Information
console.log(`CPU Cores: ${specs.cpu.cores}`);
console.log(`Architecture: ${specs.cpu.architecture}`);
console.log(`Max Frequency: ${specs.cpu.maxFrequency} MHz`);

// Memory Information
console.log(`Total RAM: ${formatBytes(specs.memory.totalRam)}`);
console.log(`Available RAM: ${formatBytes(specs.memory.availableRam)}`);
console.log(`Memory Usage: ${specs.memory.usagePercent.toFixed(1)}%`);

// Storage Information
console.log(`Total Storage: ${formatBytes(specs.storage.totalStorage)}`);
console.log(`Available: ${formatBytes(specs.storage.availableStorage)}`);

// Battery Information
console.log(`Battery Level: ${specs.battery.level}%`);
console.log(`Is Charging: ${specs.battery.isCharging}`);
console.log(`Battery Health: ${specs.battery.health}`);

// Display Information
console.log(`Resolution: ${specs.display.widthPixels}x${specs.display.heightPixels}`);
console.log(`Refresh Rate: ${specs.display.refreshRate}Hz`);
console.log(`Density: ${specs.display.density}x`);

// Thermal State (iOS)
console.log(`Thermal State: ${specs.thermal?.state}`);

// Device Information
console.log(`Model: ${specs.device.model}`);
console.log(`Brand: ${specs.device.brand}`);
```

### Run Performance Benchmark

```typescript
import { runBenchmark } from 'react-native-nazar';

// Note: This takes 2-5 seconds to complete
const results = await runBenchmark();

console.log(`CPU Score: ${results.cpuScore.toFixed(1)}/100`);
console.log(`Memory Score: ${results.memoryScore.toFixed(1)}/100`);
console.log(`Storage Score: ${results.storageScore.toFixed(1)}/100`);
console.log(`Overall Score: ${results.overallScore.toFixed(1)}/100`);
console.log(`Performance Tier: ${results.performanceTier}`);
```

### Adaptive Quality Settings

```typescript
import { getRecommendedQuality } from 'react-native-nazar';

const quality = await getRecommendedQuality();

// Use these settings in your app
const videoQuality = quality.videoQuality;      // 'low' | 'medium' | 'high'
const enableAnimations = quality.animationsEnabled; // boolean
const imageQuality = quality.imageQuality;      // 0.5 | 0.7 | 1.0
```

## API Reference

### `getDeviceSpecs(): Promise<DeviceSpecs>`

Returns comprehensive device hardware information.

#### Returns: `DeviceSpecs`

| Property | Type | Description |
|----------|------|-------------|
| `cpu` | `CpuInfo` | CPU cores, architecture, frequency |
| `memory` | `MemoryInfo` | RAM total, available, usage |
| `storage` | `StorageInfo` | Storage total, available, usage |
| `battery` | `BatteryInfo` | Level, charging state, health |
| `display` | `DisplayInfo` | Resolution, density, refresh rate |
| `thermal` | `ThermalInfo` | Thermal state (iOS only) |
| `device` | `DeviceInfo` | Model, brand, OS version |
| `gpu` | `GpuInfo` | GPU renderer info |

---

### `runBenchmark(): Promise<BenchmarkResults>`

Runs CPU, Memory, and Storage benchmarks. Takes 2-5 seconds.

#### Returns: `BenchmarkResults`

| Property | Type | Description |
|----------|------|-------------|
| `cpuScore` | `number` | CPU benchmark score (0-100) |
| `memoryScore` | `number` | Memory benchmark score (0-100) |
| `storageScore` | `number` | Storage benchmark score (0-100) |
| `overallScore` | `number` | Weighted average score (0-100) |
| `performanceTier` | `string` | `'HIGH'` \| `'MEDIUM'` \| `'LOW'` |

---

### `getPerformanceScore(): Promise<PerformanceScore>`

Returns a quick performance estimate based on device specs. Faster than `runBenchmark()`.

#### Returns: `PerformanceScore`

| Property | Type | Description |
|----------|------|-------------|
| `cpu` | `number` | CPU score (0-100) |
| `memory` | `number` | Memory score (0-100) |
| `storage` | `number` | Storage score (0-100) |
| `overall` | `number` | Overall score (0-100) |
| `tier` | `string` | `'HIGH'` \| `'MEDIUM'` \| `'LOW'` |

---

### `isLowEndDevice(): Promise<boolean>`

Quick check if device is considered low-end.

---

### `getRecommendedQuality(): Promise<QualitySettings>`

Returns recommended quality settings based on device performance.

#### Returns: `QualitySettings`

| Property | Type | HIGH | MEDIUM | LOW |
|----------|------|------|--------|-----|
| `videoQuality` | `string` | `'high'` | `'medium'` | `'low'` |
| `animationsEnabled` | `boolean` | `true` | `true` | `false` |
| `imageQuality` | `number` | `1.0` | `0.7` | `0.5` |

---

### `formatBytes(bytes: number): string`

Utility function to format bytes to human-readable string.

```typescript
formatBytes(1073741824) // "1 GB"
formatBytes(1048576)    // "1 MB"
```

## Performance Metrics

### Scoring Algorithm

The performance score is calculated using weighted averages:

| Component | Weight | Factors |
|-----------|--------|---------|
| CPU | 40% | Core count, clock speed |
| Memory | 35% | Total RAM, available RAM |
| Storage | 25% | Available space, read/write speed |

### Performance Tiers

| Tier | Score Range | Typical Devices |
|------|-------------|-----------------|
| HIGH | 80-100 | Flagship phones (< 2 years old) |
| MEDIUM | 50-79 | Mid-range phones, older flagships |
| LOW | 0-49 | Budget phones, devices > 4 years |

### Benchmark Details

#### CPU Benchmark
- Performs 1 million mathematical operations (sqrt, sin)
- Measures completion time
- Baseline: 500ms = 50 points

#### Memory Benchmark
- Allocates/deallocates 100MB of memory
- Measures allocation speed
- Baseline: 200ms = 50 points

#### Storage Benchmark
- Writes and reads 1MB file
- Measures I/O speed
- Baseline: 100ms = 50 points

## Use Cases

### 1. Adaptive Video Quality

```typescript
import { getPerformanceScore } from 'react-native-nazar';

async function getVideoConfig() {
  const { tier } = await getPerformanceScore();

  switch (tier) {
    case 'HIGH':
      return { resolution: '1080p', bitrate: 5000000, fps: 60 };
    case 'MEDIUM':
      return { resolution: '720p', bitrate: 2500000, fps: 30 };
    case 'LOW':
      return { resolution: '480p', bitrate: 1000000, fps: 24 };
  }
}
```

### 2. Conditional Feature Loading

```typescript
import { isLowEndDevice } from 'react-native-nazar';

function App() {
  const [useLiteMode, setUseLiteMode] = useState(false);

  useEffect(() => {
    isLowEndDevice().then(setUseLiteMode);
  }, []);

  return useLiteMode ? <LiteApp /> : <FullApp />;
}
```

### 3. Animation Control

```typescript
import { getPerformanceScore } from 'react-native-nazar';
import { LayoutAnimation } from 'react-native';

async function setupAnimations() {
  const { tier } = await getPerformanceScore();

  if (tier === 'LOW') {
    // Disable layout animations on low-end devices
    LayoutAnimation.configureNext(null);
  }
}
```

### 4. Image Loading Strategy

```typescript
import { getRecommendedQuality } from 'react-native-nazar';

async function getImageUrl(baseUrl: string) {
  const { imageQuality } = await getRecommendedQuality();

  // Request appropriately sized images
  const size = imageQuality === 1.0 ? 'large' :
               imageQuality === 0.7 ? 'medium' : 'small';

  return `${baseUrl}?size=${size}`;
}
```

### 5. Memory Warning Handler

```typescript
import { getDeviceSpecs } from 'react-native-nazar';

async function checkMemoryStatus() {
  const { memory } = await getDeviceSpecs();

  if (memory.usagePercent > 80) {
    // Clear caches
    // Release unused resources
    console.warn('High memory usage detected');
  }

  if (memory.lowMemory) {
    // Emergency memory cleanup
  }
}
```

### 6. Analytics & Crash Reporting

```typescript
import { getDeviceSpecs, getPerformanceScore } from 'react-native-nazar';

async function enrichCrashReport(error: Error) {
  const specs = await getDeviceSpecs();
  const score = await getPerformanceScore();

  return {
    error: error.message,
    stack: error.stack,
    device: {
      model: specs.device.model,
      ram: specs.memory.totalRam,
      availableRam: specs.memory.availableRam,
      cpuCores: specs.cpu.cores,
      performanceTier: score.tier,
      batteryLevel: specs.battery.level,
    }
  };
}
```

## Platform Differences

| Feature | Android | iOS |
|---------|---------|-----|
| CPU Frequency | ✅ | ❌ |
| Battery Temperature | ✅ | ❌ |
| Battery Health | ✅ | ❌ |
| Thermal State | ❌ | ✅ |
| Low Memory Warning | ✅ | ❌ |
| Model Identifier | ✅ | ✅ |

## Troubleshooting

### Module not found

```bash
# Clean and rebuild
cd android && ./gradlew clean && cd ..
cd ios && pod install && cd ..
npx react-native start --reset-cache
```

### Battery info not available (iOS Simulator)

Battery information is not available on iOS Simulator. Test on a real device.

### Benchmark running slowly

The benchmark intentionally takes 2-5 seconds. For quick checks, use `getPerformanceScore()` instead.

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see the [LICENSE](LICENSE) file for details.

---

Made with ❤️ for the React Native community