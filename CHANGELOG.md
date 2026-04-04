# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2025-01-01

### Fixed
- Updated error message to show correct package name
- Renamed podspec to match package name (`react-native-nazar`)

## [1.0.1] - 2025-01-01

### Added
- GitHub Actions workflow for npm auto-publish

## [1.0.0] - 2025-01-01

### Added
- Device specifications API (CPU, Memory, Storage, Battery, Display, Thermal, GPU, Network)
- Performance benchmarking (CPU, Memory, Storage, Multi-thread, GPU)
- Performance scoring with tier classification (HIGH/MEDIUM/LOW)
- Adaptive quality recommendations
- `PerformanceProvider` React context with hooks
- Conditional rendering hooks (`useConditionalRender`, `useAnimationsEnabled`, etc.)
- `DevTools` debug overlay component
- `NazarProfiler` for component and screen profiling
- `ProfilerOverlay` real-time monitoring UI
- Dashboard reporter for external analytics
- Formatting utilities (`formatBytes`, `formatFrequency`, `formatPercent`, `formatTemperature`)
- Full TypeScript support
- iOS and Android native modules
- Support for both Old and New Architecture (Turbo Modules)
