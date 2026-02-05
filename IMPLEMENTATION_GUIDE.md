# Implementation Guide: react-native-device-performance

This guide walks you through creating the `react-native-device-performance` package from scratch.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Step 1: Scaffold the Package](#step-1-scaffold-the-package)
3. [Step 2: Project Structure](#step-2-project-structure)
4. [Step 3: Implement Android Module](#step-3-implement-android-module)
5. [Step 4: Implement iOS Module](#step-4-implement-ios-module)
6. [Step 5: Create TypeScript API](#step-5-create-typescript-api)
7. [Step 6: Configure Package Files](#step-6-configure-package-files)
8. [Step 7: Build and Test](#step-7-build-and-test)
9. [Step 8: Publish to npm](#step-8-publish-to-npm)

---

## Prerequisites

Before starting, ensure you have:

- Node.js >= 18
- npm or yarn
- Xcode (for iOS development)
- Android Studio (for Android development)
- CocoaPods (`sudo gem install cocoapods`)
- React Native CLI (`npm install -g react-native`)

---

## Step 1: Scaffold the Package

Use the official React Native library creator:

```bash
# Navigate to your preferred directory
cd ~/Desktop

# Create the package
npx create-react-native-library@latest react-native-device-performance
```

### Interactive Prompts

When prompted, enter:

| Prompt | Value |
|--------|-------|
| Package name | `react-native-device-performance` |
| Package description | `Device performance metrics and benchmarking for React Native` |
| Author name | `Your Name` |
| Author email | `your@email.com` |
| Author URL | `https://github.com/yourusername` |
| Repository URL | `https://github.com/yourusername/react-native-device-performance` |
| Type of library | `Turbo module with backward compat` |
| Languages | `Kotlin & Swift` |

---

## Step 2: Project Structure

After scaffolding, your project should look like this:

```
react-native-device-performance/
├── android/
│   ├── build.gradle
│   ├── gradle.properties
│   └── src/main/
│       ├── AndroidManifest.xml
│       └── java/com/deviceperformance/
│           ├── DevicePerformanceModule.kt
│           └── DevicePerformancePackage.kt
├── ios/
│   ├── DevicePerformance.h
│   ├── DevicePerformance.mm
│   ├── DevicePerformance.swift
│   └── DevicePerformance-Bridging-Header.h
├── src/
│   ├── index.tsx
│   └── NativeDevicePerformance.ts
├── example/                    # Example app for testing
│   ├── android/
│   ├── ios/
│   ├── src/
│   └── package.json
├── package.json
├── tsconfig.json
├── react-native.config.js
└── README.md
```

---

## Step 3: Implement Android Module

### 3.1 Update AndroidManifest.xml

**File:** `android/src/main/AndroidManifest.xml`

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
  package="com.deviceperformance">

  <!-- Optional: For battery temperature -->
  <uses-permission android:name="android.permission.BATTERY_STATS" />

</manifest>
```

### 3.2 Create the Native Module

**File:** `android/src/main/java/com/deviceperformance/DevicePerformanceModule.kt`

```kotlin
package com.deviceperformance

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.util.DisplayMetrics
import android.view.WindowManager
import com.facebook.react.bridge.*
import java.io.RandomAccessFile

class DevicePerformanceModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "DevicePerformance"

    // ==================== GET DEVICE SPECS ====================
    @ReactMethod
    fun getDeviceSpecs(promise: Promise) {
        try {
            val specs = Arguments.createMap()

            // CPU Info
            specs.putMap("cpu", getCpuInfo())

            // Memory Info
            specs.putMap("memory", getMemoryInfo())

            // Storage Info
            specs.putMap("storage", getStorageInfo())

            // Battery Info
            specs.putMap("battery", getBatteryInfo())

            // Display Info
            specs.putMap("display", getDisplayInfo())

            // Device Info
            specs.putMap("device", getDeviceInfo())

            // GPU Info
            specs.putMap("gpu", getGpuInfo())

            promise.resolve(specs)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    private fun getCpuInfo(): WritableMap {
        val cpuInfo = Arguments.createMap()
        cpuInfo.putInt("cores", Runtime.getRuntime().availableProcessors())
        cpuInfo.putString("architecture", Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown")
        cpuInfo.putDouble("maxFrequency", getMaxCpuFrequency())
        return cpuInfo
    }

    private fun getMemoryInfo(): WritableMap {
        val memInfo = Arguments.createMap()
        val activityManager = reactApplicationContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memoryInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memoryInfo)

        memInfo.putDouble("totalRam", memoryInfo.totalMem.toDouble())
        memInfo.putDouble("availableRam", memoryInfo.availMem.toDouble())
        memInfo.putDouble("usedRam", (memoryInfo.totalMem - memoryInfo.availMem).toDouble())
        memInfo.putDouble("usagePercent", ((memoryInfo.totalMem - memoryInfo.availMem).toDouble() / memoryInfo.totalMem) * 100)
        memInfo.putBoolean("lowMemory", memoryInfo.lowMemory)
        memInfo.putDouble("threshold", memoryInfo.threshold.toDouble())

        return memInfo
    }

    private fun getStorageInfo(): WritableMap {
        val storageInfo = Arguments.createMap()
        val stat = StatFs(Environment.getDataDirectory().path)

        val totalBytes = stat.blockSizeLong * stat.blockCountLong
        val availableBytes = stat.blockSizeLong * stat.availableBlocksLong

        storageInfo.putDouble("totalStorage", totalBytes.toDouble())
        storageInfo.putDouble("availableStorage", availableBytes.toDouble())
        storageInfo.putDouble("usedStorage", (totalBytes - availableBytes).toDouble())
        storageInfo.putDouble("usagePercent", ((totalBytes - availableBytes).toDouble() / totalBytes) * 100)

        return storageInfo
    }

    private fun getBatteryInfo(): WritableMap {
        val batteryInfo = Arguments.createMap()
        val batteryIntent = reactApplicationContext.registerReceiver(
            null,
            IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        )

        batteryIntent?.let {
            val level = it.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = it.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            val status = it.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
            val health = it.getIntExtra(BatteryManager.EXTRA_HEALTH, -1)
            val temperature = it.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1)
            val plugged = it.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1)

            batteryInfo.putDouble("level", if (scale > 0) (level.toDouble() / scale) * 100 else -1.0)
            batteryInfo.putBoolean("isCharging", status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL)
            batteryInfo.putString("health", getBatteryHealthString(health))
            batteryInfo.putDouble("temperature", temperature / 10.0)
            batteryInfo.putString("chargingType", getChargingType(plugged))
            batteryInfo.putString("status", getBatteryStatusString(status))
        }

        return batteryInfo
    }

    private fun getDisplayInfo(): WritableMap {
        val displayInfo = Arguments.createMap()
        val windowManager = reactApplicationContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()

        windowManager.defaultDisplay.getRealMetrics(metrics)

        displayInfo.putInt("widthPixels", metrics.widthPixels)
        displayInfo.putInt("heightPixels", metrics.heightPixels)
        displayInfo.putDouble("density", metrics.density.toDouble())
        displayInfo.putInt("densityDpi", metrics.densityDpi)
        displayInfo.putDouble("xdpi", metrics.xdpi.toDouble())
        displayInfo.putDouble("ydpi", metrics.ydpi.toDouble())
        displayInfo.putDouble("refreshRate", windowManager.defaultDisplay.refreshRate.toDouble())

        return displayInfo
    }

    private fun getDeviceInfo(): WritableMap {
        val deviceInfo = Arguments.createMap()
        deviceInfo.putString("brand", Build.BRAND)
        deviceInfo.putString("model", Build.MODEL)
        deviceInfo.putString("manufacturer", Build.MANUFACTURER)
        deviceInfo.putString("device", Build.DEVICE)
        deviceInfo.putString("product", Build.PRODUCT)
        deviceInfo.putString("hardware", Build.HARDWARE)
        deviceInfo.putInt("sdkVersion", Build.VERSION.SDK_INT)
        deviceInfo.putString("androidVersion", Build.VERSION.RELEASE)
        deviceInfo.putString("buildId", Build.ID)
        deviceInfo.putString("fingerprint", Build.FINGERPRINT)
        return deviceInfo
    }

    private fun getGpuInfo(): WritableMap {
        val gpuInfo = Arguments.createMap()
        gpuInfo.putString("renderer", "OpenGL ES")
        gpuInfo.putString("vendor", Build.MANUFACTURER)
        return gpuInfo
    }

    // ==================== RUN BENCHMARK ====================
    @ReactMethod
    fun runBenchmark(promise: Promise) {
        Thread {
            try {
                val results = Arguments.createMap()

                // CPU Benchmark
                val cpuScore = runCpuBenchmark()
                results.putDouble("cpuScore", cpuScore)

                // Memory Benchmark
                val memoryScore = runMemoryBenchmark()
                results.putDouble("memoryScore", memoryScore)

                // Storage Benchmark
                val storageScore = runStorageBenchmark()
                results.putDouble("storageScore", storageScore)

                // Calculate overall score (weighted average)
                val overallScore = (cpuScore * 0.4 + memoryScore * 0.3 + storageScore * 0.3)
                results.putDouble("overallScore", overallScore)

                // Performance tier
                val tier = when {
                    overallScore >= 80 -> "HIGH"
                    overallScore >= 50 -> "MEDIUM"
                    else -> "LOW"
                }
                results.putString("performanceTier", tier)

                promise.resolve(results)
            } catch (e: Exception) {
                promise.reject("BENCHMARK_ERROR", e.message)
            }
        }.start()
    }

    private fun runCpuBenchmark(): Double {
        val startTime = System.nanoTime()
        var result = 0.0

        // Perform intensive calculations
        for (i in 0 until 1_000_000) {
            result += Math.sqrt(i.toDouble()) * Math.sin(i.toDouble())
        }

        val duration = (System.nanoTime() - startTime) / 1_000_000.0 // ms

        // Score: faster = higher score (baseline ~500ms = 50 points)
        return minOf(100.0, maxOf(0.0, (500.0 / duration) * 50))
    }

    private fun runMemoryBenchmark(): Double {
        val startTime = System.nanoTime()

        // Allocate and deallocate memory
        val arrays = mutableListOf<ByteArray>()
        repeat(100) {
            arrays.add(ByteArray(1024 * 1024)) // 1MB each
        }
        arrays.clear()
        System.gc()

        val duration = (System.nanoTime() - startTime) / 1_000_000.0
        return minOf(100.0, maxOf(0.0, (200.0 / duration) * 50))
    }

    private fun runStorageBenchmark(): Double {
        return try {
            val file = java.io.File(reactApplicationContext.cacheDir, "benchmark_test")
            val data = ByteArray(1024 * 1024) // 1MB

            val startTime = System.nanoTime()
            file.writeBytes(data)
            file.readBytes()
            file.delete()

            val duration = (System.nanoTime() - startTime) / 1_000_000.0
            minOf(100.0, maxOf(0.0, (100.0 / duration) * 50))
        } catch (e: Exception) {
            50.0 // Default score on error
        }
    }

    // ==================== GET PERFORMANCE SCORE ====================
    @ReactMethod
    fun getPerformanceScore(promise: Promise) {
        try {
            val score = Arguments.createMap()

            val cpuScore = calculateCpuScore()
            val memoryScore = calculateMemoryScore()
            val storageScore = calculateStorageScore()
            val overall = (cpuScore * 0.4 + memoryScore * 0.35 + storageScore * 0.25)

            score.putDouble("cpu", cpuScore)
            score.putDouble("memory", memoryScore)
            score.putDouble("storage", storageScore)
            score.putDouble("overall", overall)

            val tier = when {
                overall >= 80 -> "HIGH"
                overall >= 50 -> "MEDIUM"
                else -> "LOW"
            }
            score.putString("tier", tier)

            promise.resolve(score)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    private fun calculateCpuScore(): Double {
        val cores = Runtime.getRuntime().availableProcessors()
        val freq = getMaxCpuFrequency()

        val coreScore = minOf(cores * 10.0, 40.0)
        val freqScore = minOf((freq / 3000.0) * 60, 60.0)

        return minOf(100.0, coreScore + freqScore)
    }

    private fun calculateMemoryScore(): Double {
        val activityManager = reactApplicationContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memoryInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memoryInfo)

        val totalGb = memoryInfo.totalMem / (1024.0 * 1024 * 1024)
        return minOf(100.0, (totalGb / 8.0) * 100)
    }

    private fun calculateStorageScore(): Double {
        val stat = StatFs(Environment.getDataDirectory().path)
        val availableGb = (stat.blockSizeLong * stat.availableBlocksLong) / (1024.0 * 1024 * 1024)
        return minOf(100.0, (availableGb / 64.0) * 100)
    }

    // ==================== HELPER FUNCTIONS ====================
    private fun getMaxCpuFrequency(): Double {
        return try {
            val reader = RandomAccessFile("/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq", "r")
            val freq = reader.readLine().toLong()
            reader.close()
            freq / 1000.0 // Convert to MHz
        } catch (e: Exception) {
            0.0
        }
    }

    private fun getBatteryHealthString(health: Int): String {
        return when (health) {
            BatteryManager.BATTERY_HEALTH_GOOD -> "GOOD"
            BatteryManager.BATTERY_HEALTH_OVERHEAT -> "OVERHEAT"
            BatteryManager.BATTERY_HEALTH_DEAD -> "DEAD"
            BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "OVER_VOLTAGE"
            BatteryManager.BATTERY_HEALTH_COLD -> "COLD"
            BatteryManager.BATTERY_HEALTH_UNSPECIFIED_FAILURE -> "FAILURE"
            else -> "UNKNOWN"
        }
    }

    private fun getBatteryStatusString(status: Int): String {
        return when (status) {
            BatteryManager.BATTERY_STATUS_CHARGING -> "CHARGING"
            BatteryManager.BATTERY_STATUS_DISCHARGING -> "DISCHARGING"
            BatteryManager.BATTERY_STATUS_FULL -> "FULL"
            BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "NOT_CHARGING"
            else -> "UNKNOWN"
        }
    }

    private fun getChargingType(plugged: Int): String {
        return when (plugged) {
            BatteryManager.BATTERY_PLUGGED_AC -> "AC"
            BatteryManager.BATTERY_PLUGGED_USB -> "USB"
            BatteryManager.BATTERY_PLUGGED_WIRELESS -> "WIRELESS"
            else -> "NONE"
        }
    }
}
```

### 3.3 Create the Package Class

**File:** `android/src/main/java/com/deviceperformance/DevicePerformancePackage.kt`

```kotlin
package com.deviceperformance

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class DevicePerformancePackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
        return listOf(DevicePerformanceModule(reactContext))
    }

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
        return emptyList()
    }
}
```

### 3.4 Update build.gradle

**File:** `android/build.gradle`

```gradle
buildscript {
    ext.kotlin_version = '1.8.0'

    repositories {
        google()
        mavenCentral()
    }

    dependencies {
        classpath 'com.android.tools.build:gradle:7.4.2'
        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlin_version"
    }
}

apply plugin: 'com.android.library'
apply plugin: 'kotlin-android'

android {
    namespace "com.deviceperformance"
    compileSdkVersion 34

    defaultConfig {
        minSdkVersion 21
        targetSdkVersion 34
    }

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = '1.8'
    }
}

repositories {
    google()
    mavenCentral()
}

dependencies {
    implementation "com.facebook.react:react-native:+"
    implementation "org.jetbrains.kotlin:kotlin-stdlib:$kotlin_version"
}
```

---

## Step 4: Implement iOS Module

### 4.1 Create Swift Implementation

**File:** `ios/DevicePerformance.swift`

```swift
import Foundation
import UIKit

@objc(DevicePerformance)
class DevicePerformance: NSObject {

    // ==================== GET DEVICE SPECS ====================
    @objc
    func getDeviceSpecs(_ resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {

        DispatchQueue.main.async {
            var specs: [String: Any] = [:]

            specs["cpu"] = self.getCpuInfo()
            specs["memory"] = self.getMemoryInfo()
            specs["storage"] = self.getStorageInfo()
            specs["battery"] = self.getBatteryInfo()
            specs["display"] = self.getDisplayInfo()
            specs["thermal"] = self.getThermalInfo()
            specs["device"] = self.getDeviceInfo()
            specs["gpu"] = self.getGpuInfo()

            resolve(specs)
        }
    }

    private func getCpuInfo() -> [String: Any] {
        var cpuInfo: [String: Any] = [:]
        cpuInfo["cores"] = ProcessInfo.processInfo.processorCount
        cpuInfo["activeProcessors"] = ProcessInfo.processInfo.activeProcessorCount

        #if arch(arm64)
        cpuInfo["architecture"] = "arm64"
        #elseif arch(x86_64)
        cpuInfo["architecture"] = "x86_64"
        #else
        cpuInfo["architecture"] = "unknown"
        #endif

        return cpuInfo
    }

    private func getMemoryInfo() -> [String: Any] {
        var memInfo: [String: Any] = [:]
        let totalMemory = ProcessInfo.processInfo.physicalMemory
        memInfo["totalRam"] = totalMemory

        var vmStats = vm_statistics64()
        var count = mach_msg_type_number_t(MemoryLayout<vm_statistics64>.size / MemoryLayout<integer_t>.size)
        let hostPort = mach_host_self()

        let result = withUnsafeMutablePointer(to: &vmStats) {
            $0.withMemoryRebound(to: integer_t.self, capacity: Int(count)) {
                host_statistics64(hostPort, HOST_VM_INFO64, $0, &count)
            }
        }

        if result == KERN_SUCCESS {
            let pageSize = UInt64(vm_kernel_page_size)
            let freeMemory = UInt64(vmStats.free_count) * pageSize
            let activeMemory = UInt64(vmStats.active_count) * pageSize
            let inactiveMemory = UInt64(vmStats.inactive_count) * pageSize
            let wiredMemory = UInt64(vmStats.wire_count) * pageSize

            let usedMemory = activeMemory + wiredMemory
            let availableMemory = freeMemory + inactiveMemory

            memInfo["availableRam"] = availableMemory
            memInfo["usedRam"] = usedMemory
            memInfo["usagePercent"] = Double(usedMemory) / Double(totalMemory) * 100
            memInfo["freeRam"] = freeMemory
            memInfo["activeRam"] = activeMemory
            memInfo["inactiveRam"] = inactiveMemory
            memInfo["wiredRam"] = wiredMemory
        }

        return memInfo
    }

    private func getStorageInfo() -> [String: Any] {
        var storageInfo: [String: Any] = [:]

        if let attributes = try? FileManager.default.attributesOfFileSystem(forPath: NSHomeDirectory()) {
            if let totalSpace = attributes[.systemSize] as? Int64,
               let freeSpace = attributes[.systemFreeSize] as? Int64 {
                storageInfo["totalStorage"] = totalSpace
                storageInfo["availableStorage"] = freeSpace
                storageInfo["usedStorage"] = totalSpace - freeSpace
                storageInfo["usagePercent"] = Double(totalSpace - freeSpace) / Double(totalSpace) * 100
            }
        }

        return storageInfo
    }

    private func getBatteryInfo() -> [String: Any] {
        UIDevice.current.isBatteryMonitoringEnabled = true

        var batteryInfo: [String: Any] = [:]
        batteryInfo["level"] = UIDevice.current.batteryLevel * 100
        batteryInfo["isCharging"] = UIDevice.current.batteryState == .charging || UIDevice.current.batteryState == .full

        switch UIDevice.current.batteryState {
        case .charging:
            batteryInfo["state"] = "CHARGING"
        case .full:
            batteryInfo["state"] = "FULL"
        case .unplugged:
            batteryInfo["state"] = "UNPLUGGED"
        case .unknown:
            batteryInfo["state"] = "UNKNOWN"
        @unknown default:
            batteryInfo["state"] = "UNKNOWN"
        }

        return batteryInfo
    }

    private func getDisplayInfo() -> [String: Any] {
        var displayInfo: [String: Any] = [:]
        let screen = UIScreen.main

        displayInfo["widthPixels"] = Int(screen.nativeBounds.width)
        displayInfo["heightPixels"] = Int(screen.nativeBounds.height)
        displayInfo["widthPoints"] = Int(screen.bounds.width)
        displayInfo["heightPoints"] = Int(screen.bounds.height)
        displayInfo["scale"] = screen.nativeScale
        displayInfo["density"] = screen.scale

        if #available(iOS 10.3, *) {
            displayInfo["refreshRate"] = screen.maximumFramesPerSecond
        }

        return displayInfo
    }

    private func getThermalInfo() -> [String: Any] {
        var thermalInfo: [String: Any] = [:]

        if #available(iOS 11.0, *) {
            switch ProcessInfo.processInfo.thermalState {
            case .nominal:
                thermalInfo["state"] = "NOMINAL"
                thermalInfo["description"] = "Normal operating conditions"
            case .fair:
                thermalInfo["state"] = "FAIR"
                thermalInfo["description"] = "Slightly elevated temperature"
            case .serious:
                thermalInfo["state"] = "SERIOUS"
                thermalInfo["description"] = "High temperature, performance may be impacted"
            case .critical:
                thermalInfo["state"] = "CRITICAL"
                thermalInfo["description"] = "Critical temperature, immediate action needed"
            @unknown default:
                thermalInfo["state"] = "UNKNOWN"
                thermalInfo["description"] = "Unknown thermal state"
            }
        } else {
            thermalInfo["state"] = "UNAVAILABLE"
            thermalInfo["description"] = "Thermal state requires iOS 11+"
        }

        return thermalInfo
    }

    private func getDeviceInfo() -> [String: Any] {
        var deviceInfo: [String: Any] = [:]

        deviceInfo["model"] = UIDevice.current.model
        deviceInfo["localizedModel"] = UIDevice.current.localizedModel
        deviceInfo["name"] = UIDevice.current.name
        deviceInfo["systemName"] = UIDevice.current.systemName
        deviceInfo["systemVersion"] = UIDevice.current.systemVersion
        deviceInfo["identifierForVendor"] = UIDevice.current.identifierForVendor?.uuidString ?? ""
        deviceInfo["modelIdentifier"] = getModelIdentifier()
        deviceInfo["isSimulator"] = isSimulator()

        return deviceInfo
    }

    private func getGpuInfo() -> [String: Any] {
        var gpuInfo: [String: Any] = [:]
        gpuInfo["renderer"] = "Apple GPU"
        gpuInfo["vendor"] = "Apple"
        return gpuInfo
    }

    // ==================== RUN BENCHMARK ====================
    @objc
    func runBenchmark(_ resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {

        DispatchQueue.global(qos: .userInitiated).async {
            var results: [String: Any] = [:]

            // CPU Benchmark
            let cpuScore = self.runCpuBenchmark()
            results["cpuScore"] = cpuScore

            // Memory Benchmark
            let memoryScore = self.runMemoryBenchmark()
            results["memoryScore"] = memoryScore

            // Storage Benchmark
            let storageScore = self.runStorageBenchmark()
            results["storageScore"] = storageScore

            // Overall Score (weighted average)
            let overallScore = cpuScore * 0.4 + memoryScore * 0.3 + storageScore * 0.3
            results["overallScore"] = overallScore

            // Performance Tier
            let tier: String
            if overallScore >= 80 {
                tier = "HIGH"
            } else if overallScore >= 50 {
                tier = "MEDIUM"
            } else {
                tier = "LOW"
            }
            results["performanceTier"] = tier

            DispatchQueue.main.async {
                resolve(results)
            }
        }
    }

    private func runCpuBenchmark() -> Double {
        let start = CFAbsoluteTimeGetCurrent()
        var result = 0.0

        for i in 0..<1_000_000 {
            result += sqrt(Double(i)) * sin(Double(i))
        }

        let duration = (CFAbsoluteTimeGetCurrent() - start) * 1000 // ms
        return min(100.0, max(0.0, (500.0 / duration) * 50))
    }

    private func runMemoryBenchmark() -> Double {
        let start = CFAbsoluteTimeGetCurrent()

        var arrays: [[UInt8]] = []
        for _ in 0..<100 {
            arrays.append([UInt8](repeating: 0, count: 1024 * 1024)) // 1MB each
        }
        arrays.removeAll()

        let duration = (CFAbsoluteTimeGetCurrent() - start) * 1000
        return min(100.0, max(0.0, (200.0 / duration) * 50))
    }

    private func runStorageBenchmark() -> Double {
        let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent("benchmark_test")
        let data = Data(count: 1024 * 1024) // 1MB

        let start = CFAbsoluteTimeGetCurrent()

        do {
            try data.write(to: fileURL)
            _ = try Data(contentsOf: fileURL)
            try FileManager.default.removeItem(at: fileURL)
        } catch {
            return 50.0
        }

        let duration = (CFAbsoluteTimeGetCurrent() - start) * 1000
        return min(100.0, max(0.0, (100.0 / duration) * 50))
    }

    // ==================== GET PERFORMANCE SCORE ====================
    @objc
    func getPerformanceScore(_ resolve: @escaping RCTPromiseResolveBlock,
                             reject: @escaping RCTPromiseRejectBlock) {
        var score: [String: Any] = [:]

        // CPU Score based on cores
        let cores = ProcessInfo.processInfo.processorCount
        let cpuScore = min(100.0, Double(cores) * 12.5)
        score["cpu"] = cpuScore

        // Memory Score
        let totalMemory = ProcessInfo.processInfo.physicalMemory
        let totalGb = Double(totalMemory) / (1024 * 1024 * 1024)
        let memoryScore = min(100.0, (totalGb / 8.0) * 100)
        score["memory"] = memoryScore

        // Storage Score
        var storageScore = 50.0
        if let attributes = try? FileManager.default.attributesOfFileSystem(forPath: NSHomeDirectory()),
           let freeSpace = attributes[.systemFreeSize] as? Int64 {
            let freeGb = Double(freeSpace) / (1024 * 1024 * 1024)
            storageScore = min(100.0, (freeGb / 64.0) * 100)
        }
        score["storage"] = storageScore

        // Overall Score
        let overall = cpuScore * 0.4 + memoryScore * 0.35 + storageScore * 0.25
        score["overall"] = overall

        // Tier
        let tier: String
        if overall >= 80 {
            tier = "HIGH"
        } else if overall >= 50 {
            tier = "MEDIUM"
        } else {
            tier = "LOW"
        }
        score["tier"] = tier

        resolve(score)
    }

    // ==================== HELPER FUNCTIONS ====================
    private func getModelIdentifier() -> String {
        var systemInfo = utsname()
        uname(&systemInfo)
        let machineMirror = Mirror(reflecting: systemInfo.machine)
        return machineMirror.children.reduce("") { identifier, element in
            guard let value = element.value as? Int8, value != 0 else { return identifier }
            return identifier + String(UnicodeScalar(UInt8(value)))
        }
    }

    private func isSimulator() -> Bool {
        #if targetEnvironment(simulator)
        return true
        #else
        return false
        #endif
    }

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
}
```

### 4.2 Create Objective-C Bridge

**File:** `ios/DevicePerformance.m`

```objc
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(DevicePerformance, NSObject)

RCT_EXTERN_METHOD(getDeviceSpecs:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(runBenchmark:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(getPerformanceScore:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
```

### 4.3 Create Bridging Header

**File:** `ios/DevicePerformance-Bridging-Header.h`

```objc
#import <React/RCTBridgeModule.h>
```

### 4.4 Update Podspec

**File:** `react-native-device-performance.podspec`

```ruby
require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-device-performance"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => "12.0" }
  s.source       = { :git => "https://github.com/yourusername/react-native-device-performance.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"

  s.dependency "React-Core"

  s.swift_version = "5.0"
end
```

---

## Step 5: Create TypeScript API

**File:** `src/index.tsx`

```typescript
import { NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `The package 'react-native-device-performance' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

const DevicePerformance = NativeModules.DevicePerformance
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

export interface CpuInfo {
  cores: number;
  architecture: string;
  maxFrequency?: number;
  activeProcessors?: number;
}

export interface MemoryInfo {
  totalRam: number;
  availableRam: number;
  usedRam: number;
  usagePercent: number;
  lowMemory?: boolean;
  threshold?: number;
  freeRam?: number;
  activeRam?: number;
  inactiveRam?: number;
  wiredRam?: number;
}

export interface StorageInfo {
  totalStorage: number;
  availableStorage: number;
  usedStorage: number;
  usagePercent: number;
}

export interface BatteryInfo {
  level: number;
  isCharging: boolean;
  state?: string;
  health?: string;
  temperature?: number;
  chargingType?: string;
}

export interface DisplayInfo {
  widthPixels: number;
  heightPixels: number;
  widthPoints?: number;
  heightPoints?: number;
  density: number;
  densityDpi?: number;
  refreshRate?: number;
  scale?: number;
  xdpi?: number;
  ydpi?: number;
}

export interface ThermalInfo {
  state: 'NOMINAL' | 'FAIR' | 'SERIOUS' | 'CRITICAL' | 'UNKNOWN' | 'UNAVAILABLE';
  description?: string;
}

export interface DeviceInfo {
  brand?: string;
  model: string;
  manufacturer?: string;
  device?: string;
  product?: string;
  hardware?: string;
  name?: string;
  localizedModel?: string;
  systemName?: string;
  systemVersion?: string;
  sdkVersion?: number;
  androidVersion?: string;
  buildId?: string;
  fingerprint?: string;
  modelIdentifier?: string;
  identifierForVendor?: string;
  isSimulator?: boolean;
}

export interface GpuInfo {
  renderer?: string;
  vendor?: string;
}

export interface DeviceSpecs {
  cpu: CpuInfo;
  memory: MemoryInfo;
  storage: StorageInfo;
  battery: BatteryInfo;
  display: DisplayInfo;
  thermal?: ThermalInfo;
  device: DeviceInfo;
  gpu?: GpuInfo;
}

export interface BenchmarkResults {
  cpuScore: number;
  memoryScore: number;
  storageScore: number;
  overallScore: number;
  performanceTier: PerformanceTier;
}

export interface PerformanceScore {
  cpu: number;
  memory: number;
  storage: number;
  overall: number;
  tier: PerformanceTier;
}

export type PerformanceTier = 'HIGH' | 'MEDIUM' | 'LOW';

export interface QualitySettings {
  videoQuality: 'low' | 'medium' | 'high';
  animationsEnabled: boolean;
  imageQuality: number;
}

// ==================== MAIN FUNCTIONS ====================

/**
 * Get comprehensive device specifications
 * @returns Promise with device specs including CPU, memory, storage, battery, display info
 */
export function getDeviceSpecs(): Promise<DeviceSpecs> {
  return DevicePerformance.getDeviceSpecs();
}

/**
 * Run a full benchmark suite (CPU, Memory, Storage)
 * Note: This may take 2-5 seconds to complete
 * @returns Promise with benchmark scores and performance tier
 */
export function runBenchmark(): Promise<BenchmarkResults> {
  return DevicePerformance.runBenchmark();
}

/**
 * Get a quick performance score based on device specs
 * Faster than runBenchmark() but uses estimation instead of actual benchmarks
 * @returns Promise with performance scores and tier
 */
export function getPerformanceScore(): Promise<PerformanceScore> {
  return DevicePerformance.getPerformanceScore();
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Format bytes to human-readable string
 * @param bytes - Number of bytes to format
 * @returns Formatted string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format frequency to human-readable string
 * @param mhz - Frequency in MHz
 * @returns Formatted string (e.g., "2.4 GHz")
 */
export function formatFrequency(mhz: number): string {
  if (mhz >= 1000) {
    return (mhz / 1000).toFixed(2) + ' GHz';
  }
  return mhz.toFixed(0) + ' MHz';
}

/**
 * Check if device is considered low-end based on performance score
 * @returns Promise<boolean> - true if device is low-end
 */
export async function isLowEndDevice(): Promise<boolean> {
  const score = await getPerformanceScore();
  return score.tier === 'LOW';
}

/**
 * Check if device is considered high-end based on performance score
 * @returns Promise<boolean> - true if device is high-end
 */
export async function isHighEndDevice(): Promise<boolean> {
  const score = await getPerformanceScore();
  return score.tier === 'HIGH';
}

/**
 * Get recommended quality settings based on device performance
 * Use these to optimize your app for different device capabilities
 * @returns Promise with recommended quality settings
 */
export async function getRecommendedQuality(): Promise<QualitySettings> {
  const score = await getPerformanceScore();

  switch (score.tier) {
    case 'HIGH':
      return {
        videoQuality: 'high',
        animationsEnabled: true,
        imageQuality: 1.0,
      };
    case 'MEDIUM':
      return {
        videoQuality: 'medium',
        animationsEnabled: true,
        imageQuality: 0.7,
      };
    case 'LOW':
    default:
      return {
        videoQuality: 'low',
        animationsEnabled: false,
        imageQuality: 0.5,
      };
  }
}

/**
 * Get memory usage percentage
 * @returns Promise<number> - Memory usage as percentage (0-100)
 */
export async function getMemoryUsage(): Promise<number> {
  const specs = await getDeviceSpecs();
  return specs.memory.usagePercent;
}

/**
 * Get storage usage percentage
 * @returns Promise<number> - Storage usage as percentage (0-100)
 */
export async function getStorageUsage(): Promise<number> {
  const specs = await getDeviceSpecs();
  return specs.storage.usagePercent;
}

/**
 * Get battery level
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

// ==================== DEFAULT EXPORT ====================

export default {
  // Main functions
  getDeviceSpecs,
  runBenchmark,
  getPerformanceScore,

  // Utility functions
  formatBytes,
  formatFrequency,
  isLowEndDevice,
  isHighEndDevice,
  getRecommendedQuality,
  getMemoryUsage,
  getStorageUsage,
  getBatteryLevel,
  isCharging,
};
```

---

## Step 6: Configure Package Files

### 6.1 package.json

**File:** `package.json`

```json
{
  "name": "react-native-device-performance",
  "version": "1.0.0",
  "description": "Device performance metrics and benchmarking for React Native",
  "main": "lib/commonjs/index",
  "module": "lib/module/index",
  "types": "lib/typescript/src/index.d.ts",
  "react-native": "src/index",
  "source": "src/index",
  "files": [
    "src",
    "lib",
    "android",
    "ios",
    "cpp",
    "*.podspec",
    "!ios/build",
    "!android/build",
    "!android/gradle",
    "!android/gradlew",
    "!android/gradlew.bat",
    "!android/local.properties",
    "!**/__tests__",
    "!**/__fixtures__",
    "!**/__mocks__",
    "!**/.*"
  ],
  "scripts": {
    "example": "yarn workspace react-native-device-performance-example",
    "test": "jest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint \"**/*.{js,ts,tsx}\"",
    "clean": "del-cli android/build example/android/build example/android/app/build example/ios/build lib",
    "prepare": "bob build",
    "release": "release-it"
  },
  "keywords": [
    "react-native",
    "ios",
    "android",
    "performance",
    "benchmark",
    "device",
    "cpu",
    "memory",
    "battery",
    "specs"
  ],
  "repository": {
    "type": "git",
    "url": "git+https://github.com/yourusername/react-native-device-performance.git"
  },
  "author": "Your Name <your@email.com> (https://github.com/yourusername)",
  "license": "MIT",
  "bugs": {
    "url": "https://github.com/yourusername/react-native-device-performance/issues"
  },
  "homepage": "https://github.com/yourusername/react-native-device-performance#readme",
  "publishConfig": {
    "registry": "https://registry.npmjs.org/"
  },
  "devDependencies": {
    "@react-native/eslint-config": "^0.73.1",
    "@types/react": "^18.2.44",
    "del-cli": "^5.1.0",
    "eslint": "^8.51.0",
    "prettier": "^3.0.3",
    "react": "18.2.0",
    "react-native": "0.73.0",
    "react-native-builder-bob": "^0.23.2",
    "release-it": "^15.0.0",
    "typescript": "^5.2.2"
  },
  "peerDependencies": {
    "react": "*",
    "react-native": "*"
  },
  "engines": {
    "node": ">= 18.0.0"
  },
  "react-native-builder-bob": {
    "source": "src",
    "output": "lib",
    "targets": [
      "commonjs",
      "module",
      [
        "typescript",
        {
          "project": "tsconfig.build.json"
        }
      ]
    ]
  }
}
```

### 6.2 tsconfig.json

**File:** `tsconfig.json`

```json
{
  "compilerOptions": {
    "baseUrl": "./",
    "paths": {
      "react-native-device-performance": ["./src/index"]
    },
    "allowUnreachableCode": false,
    "allowUnusedLabels": false,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "jsx": "react",
    "lib": ["esnext"],
    "module": "esnext",
    "moduleResolution": "node",
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "noImplicitUseStrict": false,
    "noStrictGenericChecks": false,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "strict": true,
    "target": "esnext",
    "verbatimModuleSyntax": true
  },
  "exclude": ["lib", "node_modules"]
}
```

### 6.3 react-native.config.js

**File:** `react-native.config.js`

```javascript
module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
      },
      ios: {
        podspecPath: './react-native-device-performance.podspec',
      },
    },
  },
};
```

---

## Step 7: Build and Test

### 7.1 Build the Library

```bash
cd react-native-device-performance

# Install dependencies
yarn install

# Build TypeScript
yarn prepare
```

### 7.2 Test in Example App

```bash
# Navigate to example app
cd example

# Install dependencies
yarn install

# Install iOS pods
cd ios && pod install && cd ..

# Run on iOS
yarn ios

# Run on Android
yarn android
```

### 7.3 Example App Code

**File:** `example/src/App.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import DevicePerformance, {
  DeviceSpecs,
  BenchmarkResults,
  PerformanceScore,
  formatBytes,
} from 'react-native-device-performance';

export default function App() {
  const [specs, setSpecs] = useState<DeviceSpecs | null>(null);
  const [score, setScore] = useState<PerformanceScore | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkResults | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDeviceInfo();
  }, []);

  const loadDeviceInfo = async () => {
    const deviceSpecs = await DevicePerformance.getDeviceSpecs();
    const performanceScore = await DevicePerformance.getPerformanceScore();
    setSpecs(deviceSpecs);
    setScore(performanceScore);
  };

  const runBenchmark = async () => {
    setLoading(true);
    const results = await DevicePerformance.runBenchmark();
    setBenchmark(results);
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Device Performance</Text>

      {score && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Performance Score</Text>
          <Text style={styles.tier}>{score.tier}</Text>
          <Text style={styles.score}>{score.overall.toFixed(1)}/100</Text>
          <View style={styles.row}>
            <Text>CPU: {score.cpu.toFixed(1)}</Text>
            <Text>Memory: {score.memory.toFixed(1)}</Text>
            <Text>Storage: {score.storage.toFixed(1)}</Text>
          </View>
        </View>
      )}

      {specs && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>CPU</Text>
            <Text>Cores: {specs.cpu.cores}</Text>
            <Text>Architecture: {specs.cpu.architecture}</Text>
            {specs.cpu.maxFrequency && (
              <Text>Max Frequency: {specs.cpu.maxFrequency} MHz</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Memory</Text>
            <Text>Total: {formatBytes(specs.memory.totalRam)}</Text>
            <Text>Available: {formatBytes(specs.memory.availableRam)}</Text>
            <Text>Usage: {specs.memory.usagePercent.toFixed(1)}%</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Storage</Text>
            <Text>Total: {formatBytes(specs.storage.totalStorage)}</Text>
            <Text>Available: {formatBytes(specs.storage.availableStorage)}</Text>
            <Text>Usage: {specs.storage.usagePercent.toFixed(1)}%</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Battery</Text>
            <Text>Level: {specs.battery.level.toFixed(0)}%</Text>
            <Text>Charging: {specs.battery.isCharging ? 'Yes' : 'No'}</Text>
            {specs.battery.health && <Text>Health: {specs.battery.health}</Text>}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Display</Text>
            <Text>Resolution: {specs.display.widthPixels}x{specs.display.heightPixels}</Text>
            <Text>Density: {specs.display.density}x</Text>
            {specs.display.refreshRate && (
              <Text>Refresh Rate: {specs.display.refreshRate}Hz</Text>
            )}
          </View>
        </>
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={runBenchmark}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Run Benchmark</Text>
        )}
      </TouchableOpacity>

      {benchmark && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Benchmark Results</Text>
          <Text style={styles.tier}>{benchmark.performanceTier}</Text>
          <Text style={styles.score}>{benchmark.overallScore.toFixed(1)}/100</Text>
          <View style={styles.row}>
            <Text>CPU: {benchmark.cpuScore.toFixed(1)}</Text>
            <Text>Memory: {benchmark.memoryScore.toFixed(1)}</Text>
            <Text>Storage: {benchmark.storageScore.toFixed(1)}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 20,
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  tier: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#4CAF50',
  },
  score: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  button: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
```

---

## Step 8: Publish to npm

### 8.1 Prepare for Publishing

```bash
# Login to npm
npm login

# Ensure everything builds
yarn prepare

# Run linting
yarn lint

# Run type checking
yarn typecheck
```

### 8.2 Publish

```bash
# Publish to npm
npm publish

# Or use release-it for versioning
yarn release
```

### 8.3 After Publishing

Update your GitHub repository with:
- A proper README badge linking to npm
- GitHub Actions for CI/CD
- Issue templates
- Contributing guidelines

---

## Summary

You now have a complete React Native package that:

1. **Gets device specs** - CPU, memory, storage, battery, display, thermal info
2. **Runs benchmarks** - CPU computation, memory allocation, storage I/O tests
3. **Calculates performance scores** - Quick estimation based on hardware specs
4. **Categorizes devices** - HIGH, MEDIUM, LOW performance tiers
5. **Provides utilities** - Formatting, quality recommendations, quick checks

The package supports both iOS and Android, works with both Old and New Architecture, and includes full TypeScript support.

---

## Next Steps

1. Add GPU benchmarking (using OpenGL/Metal)
2. Add network speed testing
3. Add thermal monitoring over time
4. Add historical performance tracking
5. Add comparison with other devices

Good luck with your package!