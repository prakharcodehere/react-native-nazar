# Contributing to react-native-nazar

Thank you for your interest in contributing! Here's how you can help.

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/react-native-nazar.git
   cd react-native-nazar
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature
   ```

## Development

### Project Structure

```
src/
  index.ts              # Main exports & DevicePerformance API
  PerformanceContext.tsx # React context, provider & hooks
  DashboardReporter.ts  # Performance reporting to external dashboards
  DevTools.tsx           # Debug overlay component
  Profiler.tsx           # Legacy profiler
  profiler/             # Enhanced NazarProfiler module
android/               # Android native module
ios/                   # iOS native module
example/               # Example app
```

### Running the Example App

```bash
cd example
npm install
npx pod-install  # iOS only
npm run ios      # or npm run android
```

### Type Checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

## Making Changes

- Write clear, concise commit messages
- Add TypeScript types for all public APIs
- Test on both iOS and Android when possible
- Keep backwards compatibility in mind

## Pull Request Process

1. Update the README.md if you've changed public APIs
2. Make sure `npm run typecheck` passes
3. Make sure `npm run lint` passes
4. Describe your changes in the PR description
5. Link any related issues

## Reporting Bugs

Open an issue with:
- Device model and OS version
- React Native version
- Steps to reproduce
- Expected vs actual behavior

## Feature Requests

Open an issue describing:
- The problem you're trying to solve
- Your proposed solution
- Any alternatives you've considered

## Code of Conduct

Be respectful and constructive. We're all here to build something great together.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
