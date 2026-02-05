import Foundation
import UIKit
import Metal
import AVFoundation
import CoreMotion
import SystemConfiguration

@objc(DevicePerformance)
class DevicePerformance: NSObject {

    // MARK: - Get Device Specs
    @objc
    func getDeviceSpecs(_ resolve: @escaping RCTPromiseResolveBlock,
                        reject: @escaping RCTPromiseRejectBlock) {

        DispatchQueue.global(qos: .userInitiated).async {
            var specs: [String: Any] = [:]

            // CPU Info
            specs["cpu"] = self.getCpuInfo()

            // Memory Info
            specs["memory"] = self.getMemoryInfo()

            // Storage Info
            specs["storage"] = self.getStorageInfo()

            // Battery Info (must be on main thread)
            DispatchQueue.main.sync {
                specs["battery"] = self.getBatteryInfo()
            }

            // Display Info (must be on main thread)
            DispatchQueue.main.sync {
                specs["display"] = self.getDisplayInfo()
            }

            // Thermal Info
            specs["thermal"] = self.getThermalInfo()

            // Device Info
            specs["device"] = self.getDeviceInfo()

            // GPU Info
            specs["gpu"] = self.getGpuInfo()

            // System Info
            specs["system"] = self.getSystemInfo()

            // Network Info
            specs["network"] = self.getNetworkInfo()

            DispatchQueue.main.async {
                resolve(specs)
            }
        }
    }

    private func getCpuInfo() -> [String: Any] {
        var cpuInfo: [String: Any] = [:]

        // Core count
        cpuInfo["cores"] = ProcessInfo.processInfo.processorCount
        cpuInfo["activeProcessors"] = ProcessInfo.processInfo.activeProcessorCount

        // Architecture
        #if arch(arm64)
        cpuInfo["architecture"] = "arm64"
        cpuInfo["is64Bit"] = true
        #elseif arch(x86_64)
        cpuInfo["architecture"] = "x86_64"
        cpuInfo["is64Bit"] = true
        #elseif arch(arm)
        cpuInfo["architecture"] = "arm"
        cpuInfo["is64Bit"] = false
        #else
        cpuInfo["architecture"] = "unknown"
        cpuInfo["is64Bit"] = false
        #endif

        // CPU type
        var cpuType: cpu_type_t = 0
        var cpuTypeSize = MemoryLayout<cpu_type_t>.size
        sysctlbyname("hw.cputype", &cpuType, &cpuTypeSize, nil, 0)
        cpuInfo["cpuType"] = cpuType

        // CPU subtype
        var cpuSubtype: cpu_subtype_t = 0
        var cpuSubtypeSize = MemoryLayout<cpu_subtype_t>.size
        sysctlbyname("hw.cpusubtype", &cpuSubtype, &cpuSubtypeSize, nil, 0)
        cpuInfo["cpuSubtype"] = cpuSubtype

        // CPU frequency (estimated for Apple Silicon)
        cpuInfo["estimatedFrequency"] = getEstimatedCpuFrequency()

        // CPU brand
        cpuInfo["brand"] = getCpuBrand()

        return cpuInfo
    }

    private func getMemoryInfo() -> [String: Any] {
        var memInfo: [String: Any] = [:]

        // Total physical memory
        let totalMemory = ProcessInfo.processInfo.physicalMemory
        memInfo["totalRam"] = totalMemory

        // Get detailed memory stats
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
            let compressedMemory = UInt64(vmStats.compressor_page_count) * pageSize
            let purgeableMemory = UInt64(vmStats.purgeable_count) * pageSize

            let usedMemory = activeMemory + wiredMemory + compressedMemory
            let availableMemory = freeMemory + inactiveMemory + purgeableMemory

            memInfo["freeRam"] = freeMemory
            memInfo["activeRam"] = activeMemory
            memInfo["inactiveRam"] = inactiveMemory
            memInfo["wiredRam"] = wiredMemory
            memInfo["compressedRam"] = compressedMemory
            memInfo["purgeableRam"] = purgeableMemory
            memInfo["usedRam"] = usedMemory
            memInfo["availableRam"] = availableMemory
            memInfo["usagePercent"] = Double(usedMemory) / Double(totalMemory) * 100

            // Page statistics
            memInfo["pageIns"] = vmStats.pageins
            memInfo["pageOuts"] = vmStats.pageouts
            memInfo["faults"] = vmStats.faults
        }

        return memInfo
    }

    private func getStorageInfo() -> [String: Any] {
        var storageInfo: [String: Any] = [:]

        do {
            let fileURL = URL(fileURLWithPath: NSHomeDirectory())
            let values = try fileURL.resourceValues(forKeys: [
                .volumeTotalCapacityKey,
                .volumeAvailableCapacityKey,
                .volumeAvailableCapacityForImportantUsageKey,
                .volumeAvailableCapacityForOpportunisticUsageKey
            ])

            if let totalCapacity = values.volumeTotalCapacity {
                storageInfo["totalStorage"] = Int64(totalCapacity)
            }

            if let availableCapacity = values.volumeAvailableCapacity {
                storageInfo["availableStorage"] = Int64(availableCapacity)
            }

            if let importantUsage = values.volumeAvailableCapacityForImportantUsage {
                storageInfo["availableForImportantUsage"] = importantUsage
            }

            if let opportunisticUsage = values.volumeAvailableCapacityForOpportunisticUsage {
                storageInfo["availableForOpportunisticUsage"] = opportunisticUsage
            }

            if let total = values.volumeTotalCapacity,
               let available = values.volumeAvailableCapacity {
                let used = Int64(total) - Int64(available)
                storageInfo["usedStorage"] = used
                storageInfo["usagePercent"] = Double(used) / Double(total) * 100
            }
        } catch {
            // Fallback to FileManager
            if let attrs = try? FileManager.default.attributesOfFileSystem(forPath: NSHomeDirectory()) {
                if let total = attrs[.systemSize] as? Int64 {
                    storageInfo["totalStorage"] = total
                }
                if let free = attrs[.systemFreeSize] as? Int64 {
                    storageInfo["availableStorage"] = free
                    if let total = attrs[.systemSize] as? Int64 {
                        storageInfo["usedStorage"] = total - free
                        storageInfo["usagePercent"] = Double(total - free) / Double(total) * 100
                    }
                }
            }
        }

        return storageInfo
    }

    private func getBatteryInfo() -> [String: Any] {
        var batteryInfo: [String: Any] = [:]

        UIDevice.current.isBatteryMonitoringEnabled = true

        let level = UIDevice.current.batteryLevel
        batteryInfo["level"] = level >= 0 ? level * 100 : -1

        let state = UIDevice.current.batteryState
        batteryInfo["isCharging"] = state == .charging || state == .full

        switch state {
        case .unknown:
            batteryInfo["state"] = "UNKNOWN"
        case .unplugged:
            batteryInfo["state"] = "UNPLUGGED"
        case .charging:
            batteryInfo["state"] = "CHARGING"
        case .full:
            batteryInfo["state"] = "FULL"
        @unknown default:
            batteryInfo["state"] = "UNKNOWN"
        }

        // Low power mode
        batteryInfo["isLowPowerMode"] = ProcessInfo.processInfo.isLowPowerModeEnabled

        return batteryInfo
    }

    private func getDisplayInfo() -> [String: Any] {
        var displayInfo: [String: Any] = [:]

        let screen = UIScreen.main

        // Native resolution
        displayInfo["widthPixels"] = Int(screen.nativeBounds.width)
        displayInfo["heightPixels"] = Int(screen.nativeBounds.height)

        // Point resolution
        displayInfo["widthPoints"] = Int(screen.bounds.width)
        displayInfo["heightPoints"] = Int(screen.bounds.height)

        // Scale and density
        displayInfo["scale"] = screen.scale
        displayInfo["nativeScale"] = screen.nativeScale

        // Refresh rate
        if #available(iOS 10.3, *) {
            displayInfo["refreshRate"] = screen.maximumFramesPerSecond
        }

        // Display gamut
        if #available(iOS 10.0, *) {
            switch screen.traitCollection.displayGamut {
            case .SRGB:
                displayInfo["displayGamut"] = "sRGB"
            case .P3:
                displayInfo["displayGamut"] = "P3"
            case .unspecified:
                displayInfo["displayGamut"] = "unspecified"
            @unknown default:
                displayInfo["displayGamut"] = "unknown"
            }
        }

        // Screen brightness
        displayInfo["brightness"] = screen.brightness

        // Calculate screen size in inches
        let ppi = getPPI()
        if ppi > 0 {
            let widthInches = screen.nativeBounds.width / CGFloat(ppi)
            let heightInches = screen.nativeBounds.height / CGFloat(ppi)
            let diagonalInches = sqrt(widthInches * widthInches + heightInches * heightInches)
            displayInfo["screenSizeInches"] = diagonalInches
            displayInfo["ppi"] = ppi
        }

        // HDR capability
        if #available(iOS 16.0, *) {
            displayInfo["supportsHDR"] = screen.potentialEDRHeadroom > 1.0
            displayInfo["edrHeadroom"] = screen.potentialEDRHeadroom
        }

        return displayInfo
    }

    private func getThermalInfo() -> [String: Any] {
        var thermalInfo: [String: Any] = [:]

        if #available(iOS 11.0, *) {
            let state = ProcessInfo.processInfo.thermalState

            switch state {
            case .nominal:
                thermalInfo["state"] = "NOMINAL"
                thermalInfo["level"] = 0
                thermalInfo["description"] = "Normal operating temperature"
            case .fair:
                thermalInfo["state"] = "FAIR"
                thermalInfo["level"] = 1
                thermalInfo["description"] = "Slightly elevated temperature"
            case .serious:
                thermalInfo["state"] = "SERIOUS"
                thermalInfo["level"] = 2
                thermalInfo["description"] = "High temperature, performance may be reduced"
            case .critical:
                thermalInfo["state"] = "CRITICAL"
                thermalInfo["level"] = 3
                thermalInfo["description"] = "Critical temperature, immediate throttling"
            @unknown default:
                thermalInfo["state"] = "UNKNOWN"
                thermalInfo["level"] = -1
                thermalInfo["description"] = "Unknown thermal state"
            }
        } else {
            thermalInfo["state"] = "UNAVAILABLE"
            thermalInfo["level"] = -1
            thermalInfo["description"] = "Thermal state requires iOS 11+"
        }

        return thermalInfo
    }

    private func getDeviceInfo() -> [String: Any] {
        var deviceInfo: [String: Any] = [:]

        let device = UIDevice.current

        deviceInfo["model"] = device.model
        deviceInfo["localizedModel"] = device.localizedModel
        deviceInfo["name"] = device.name
        deviceInfo["systemName"] = device.systemName
        deviceInfo["systemVersion"] = device.systemVersion

        // Model identifier (e.g., iPhone14,2)
        let modelIdentifier = getModelIdentifier()
        deviceInfo["modelIdentifier"] = modelIdentifier
        deviceInfo["modelName"] = getModelName(modelIdentifier)

        // UUID
        if let uuid = device.identifierForVendor?.uuidString {
            deviceInfo["identifierForVendor"] = uuid
        }

        // User interface idiom
        switch device.userInterfaceIdiom {
        case .phone:
            deviceInfo["deviceType"] = "PHONE"
        case .pad:
            deviceInfo["deviceType"] = "TABLET"
        case .tv:
            deviceInfo["deviceType"] = "TV"
        case .carPlay:
            deviceInfo["deviceType"] = "CAR"
        case .mac:
            deviceInfo["deviceType"] = "MAC"
        default:
            deviceInfo["deviceType"] = "UNKNOWN"
        }

        // Is simulator
        #if targetEnvironment(simulator)
        deviceInfo["isSimulator"] = true
        #else
        deviceInfo["isSimulator"] = false
        #endif

        // Multitasking supported
        deviceInfo["isMultitaskingSupported"] = device.isMultitaskingSupported

        return deviceInfo
    }

    private func getGpuInfo() -> [String: Any] {
        var gpuInfo: [String: Any] = [:]

        // Metal device info
        if let device = MTLCreateSystemDefaultDevice() {
            gpuInfo["name"] = device.name
            gpuInfo["isHeadless"] = device.isHeadless
            gpuInfo["isLowPower"] = device.isLowPower
            gpuInfo["isRemovable"] = device.isRemovable

            if #available(iOS 11.0, *) {
                gpuInfo["registryID"] = device.registryID

                // GPU family support
                var families: [String] = []
                if device.supportsFamily(.apple1) { families.append("Apple1") }
                if device.supportsFamily(.apple2) { families.append("Apple2") }
                if device.supportsFamily(.apple3) { families.append("Apple3") }
                if device.supportsFamily(.apple4) { families.append("Apple4") }
                if device.supportsFamily(.apple5) { families.append("Apple5") }
                if #available(iOS 14.0, *) {
                    if device.supportsFamily(.apple6) { families.append("Apple6") }
                    if device.supportsFamily(.apple7) { families.append("Apple7") }
                }
                if #available(iOS 15.0, *) {
                    if device.supportsFamily(.apple8) { families.append("Apple8") }
                }
                gpuInfo["supportedFamilies"] = families
            }

            // Recommended working set size
            if #available(iOS 12.0, *) {
                gpuInfo["recommendedMaxWorkingSetSize"] = device.recommendedMaxWorkingSetSize
            }

            // Max threads per threadgroup
            gpuInfo["maxThreadsPerThreadgroup"] = [
                "width": device.maxThreadsPerThreadgroup.width,
                "height": device.maxThreadsPerThreadgroup.height,
                "depth": device.maxThreadsPerThreadgroup.depth
            ]
        } else {
            gpuInfo["error"] = "Metal not available"
        }

        return gpuInfo
    }

    private func getSystemInfo() -> [String: Any] {
        var systemInfo: [String: Any] = [:]

        // Uptime
        systemInfo["systemUptime"] = ProcessInfo.processInfo.systemUptime

        // Host name
        systemInfo["hostName"] = ProcessInfo.processInfo.hostName

        // OS version
        let osVersion = ProcessInfo.processInfo.operatingSystemVersion
        systemInfo["osVersion"] = "\(osVersion.majorVersion).\(osVersion.minorVersion).\(osVersion.patchVersion)"
        systemInfo["osMajorVersion"] = osVersion.majorVersion
        systemInfo["osMinorVersion"] = osVersion.minorVersion
        systemInfo["osPatchVersion"] = osVersion.patchVersion

        // Environment
        systemInfo["processName"] = ProcessInfo.processInfo.processName
        systemInfo["processIdentifier"] = ProcessInfo.processInfo.processIdentifier

        // Capabilities
        systemInfo["supportsMultipleScenes"] = ProcessInfo.processInfo.isiOSAppOnMac == false

        if #available(iOS 14.0, *) {
            systemInfo["isiOSAppOnMac"] = ProcessInfo.processInfo.isiOSAppOnMac
        }

        return systemInfo
    }

    private func getNetworkInfo() -> [String: Any] {
        var networkInfo: [String: Any] = [:]

        // Check network reachability
        var zeroAddress = sockaddr_in()
        zeroAddress.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        zeroAddress.sin_family = sa_family_t(AF_INET)

        guard let reachability = withUnsafePointer(to: &zeroAddress, {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                SCNetworkReachabilityCreateWithAddress(nil, $0)
            }
        }) else {
            networkInfo["reachable"] = false
            return networkInfo
        }

        var flags = SCNetworkReachabilityFlags()
        if !SCNetworkReachabilityGetFlags(reachability, &flags) {
            networkInfo["reachable"] = false
            return networkInfo
        }

        let isReachable = flags.contains(.reachable)
        let needsConnection = flags.contains(.connectionRequired)
        let isWWAN = flags.contains(.isWWAN)

        networkInfo["reachable"] = isReachable && !needsConnection
        networkInfo["isWWAN"] = isWWAN
        networkInfo["isWiFi"] = isReachable && !isWWAN

        return networkInfo
    }

    // MARK: - Run Benchmark
    @objc
    func runBenchmark(_ resolve: @escaping RCTPromiseResolveBlock,
                      reject: @escaping RCTPromiseRejectBlock) {

        DispatchQueue.global(qos: .userInitiated).async {
            var results: [String: Any] = [:]

            // CPU Benchmark (single-threaded)
            let cpuScore = self.runCpuBenchmark()
            results["cpuScore"] = cpuScore

            // Memory Benchmark
            let memoryScore = self.runMemoryBenchmark()
            results["memoryScore"] = memoryScore

            // Storage Benchmark
            let storageScore = self.runStorageBenchmark()
            results["storageScore"] = storageScore

            // Multi-threaded CPU Benchmark
            let multiThreadScore = self.runMultiThreadBenchmark()
            results["multiThreadScore"] = multiThreadScore

            // GPU Benchmark (Metal compute)
            let gpuScore = self.runGpuBenchmark()
            results["gpuScore"] = gpuScore

            // Calculate overall score (weighted)
            let overallScore = cpuScore * 0.25 + memoryScore * 0.20 + storageScore * 0.15 + multiThreadScore * 0.20 + gpuScore * 0.20
            results["overallScore"] = overallScore

            // Performance tier
            let tier: String
            if overallScore >= 80 {
                tier = "HIGH"
            } else if overallScore >= 50 {
                tier = "MEDIUM"
            } else {
                tier = "LOW"
            }
            results["performanceTier"] = tier

            // Grades
            results["grades"] = [
                "cpuGrade": self.getGrade(cpuScore),
                "memoryGrade": self.getGrade(memoryScore),
                "storageGrade": self.getGrade(storageScore),
                "multiThreadGrade": self.getGrade(multiThreadScore),
                "gpuGrade": self.getGrade(gpuScore)
            ]

            DispatchQueue.main.async {
                resolve(results)
            }
        }
    }

    private func runCpuBenchmark() -> Double {
        let iterations = 1_000_000
        let start = CFAbsoluteTimeGetCurrent()
        var result = 0.0

        for i in 0..<iterations {
            result += sqrt(Double(i)) * sin(Double(i)) * cos(Double(i))
        }

        let duration = (CFAbsoluteTimeGetCurrent() - start) * 1000 // ms

        // Score: faster = higher (baseline ~300ms = 50 points)
        return min(100.0, max(0.0, (300.0 / duration) * 50))
    }

    private func runMemoryBenchmark() -> Double {
        let start = CFAbsoluteTimeGetCurrent()

        // Allocate and access memory
        var arrays: [[UInt8]] = []
        for _ in 0..<50 {
            var arr = [UInt8](repeating: 0, count: 1024 * 1024) // 1MB
            // Touch memory
            for j in stride(from: 0, to: arr.count, by: 4096) {
                arr[j] = UInt8(j & 0xFF)
            }
            arrays.append(arr)
        }

        // Read back
        var checksum: UInt64 = 0
        for arr in arrays {
            for j in stride(from: 0, to: arr.count, by: 4096) {
                checksum += UInt64(arr[j])
            }
        }

        arrays.removeAll()

        let duration = (CFAbsoluteTimeGetCurrent() - start) * 1000
        return min(100.0, max(0.0, (250.0 / duration) * 50))
    }

    private func runStorageBenchmark() -> Double {
        let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent("benchmark_\(UUID().uuidString)")
        let dataSize = 4 * 1024 * 1024 // 4MB
        let data = Data(count: dataSize)

        let start = CFAbsoluteTimeGetCurrent()

        do {
            // Write
            try data.write(to: fileURL)

            // Read
            let readData = try Data(contentsOf: fileURL)

            // Verify
            guard readData.count == dataSize else {
                throw NSError(domain: "Benchmark", code: 1, userInfo: nil)
            }

            // Cleanup
            try FileManager.default.removeItem(at: fileURL)
        } catch {
            return 40.0 // Default on error
        }

        let duration = (CFAbsoluteTimeGetCurrent() - start) * 1000
        return min(100.0, max(0.0, (150.0 / duration) * 50))
    }

    private func runMultiThreadBenchmark() -> Double {
        let cores = ProcessInfo.processInfo.activeProcessorCount
        let iterationsPerThread = 500_000
        let start = CFAbsoluteTimeGetCurrent()

        let group = DispatchGroup()
        let queue = DispatchQueue(label: "benchmark", attributes: .concurrent)

        for _ in 0..<cores {
            group.enter()
            queue.async {
                var result = 0.0
                for i in 0..<iterationsPerThread {
                    result += sqrt(Double(i)) * sin(Double(i))
                }
                group.leave()
            }
        }

        group.wait()

        let duration = (CFAbsoluteTimeGetCurrent() - start) * 1000
        let expectedDuration = 300.0 * Double(cores) / 4.0 // Normalize for 4 cores

        return min(100.0, max(0.0, (expectedDuration / duration) * 50))
    }

    private func runGpuBenchmark() -> Double {
        guard let device = MTLCreateSystemDefaultDevice(),
              let commandQueue = device.makeCommandQueue() else {
            return 50.0 // Default if Metal not available
        }

        let bufferSize = 1024 * 1024 * 4 // 4MB of floats
        guard let buffer = device.makeBuffer(length: bufferSize, options: .storageModeShared) else {
            return 50.0
        }

        // Fill buffer with data
        let floatPtr = buffer.contents().assumingMemoryBound(to: Float.self)
        let floatCount = bufferSize / MemoryLayout<Float>.size
        for i in 0..<floatCount {
            floatPtr[i] = Float(i)
        }

        let start = CFAbsoluteTimeGetCurrent()

        // Simple GPU computation - just measure command buffer execution time
        for _ in 0..<10 {
            guard let commandBuffer = commandQueue.makeCommandBuffer() else { continue }
            commandBuffer.commit()
            commandBuffer.waitUntilCompleted()
        }

        let duration = (CFAbsoluteTimeGetCurrent() - start) * 1000
        return min(100.0, max(0.0, (50.0 / duration) * 50))
    }

    // MARK: - Get Performance Score
    @objc
    func getPerformanceScore(_ resolve: @escaping RCTPromiseResolveBlock,
                             reject: @escaping RCTPromiseRejectBlock) {

        DispatchQueue.global(qos: .userInitiated).async {
            var score: [String: Any] = [:]

            let cpuScore = self.calculateCpuScore()
            let memoryScore = self.calculateMemoryScore()
            let storageScore = self.calculateStorageScore()
            let gpuScore = self.calculateGpuScore()

            let overall = cpuScore * 0.30 + memoryScore * 0.30 + storageScore * 0.15 + gpuScore * 0.25

            score["cpu"] = cpuScore
            score["memory"] = memoryScore
            score["storage"] = storageScore
            score["gpu"] = gpuScore
            score["overall"] = overall

            let tier: String
            if overall >= 80 {
                tier = "HIGH"
            } else if overall >= 50 {
                tier = "MEDIUM"
            } else {
                tier = "LOW"
            }
            score["tier"] = tier

            // Recommendations based on score
            var recommendations: [String: Any] = [:]
            recommendations["enableAnimations"] = overall >= 40
            recommendations["enableBlur"] = overall >= 55
            recommendations["enableParallax"] = overall >= 70
            recommendations["enableShadows"] = overall >= 45
            recommendations["enableHaptics"] = overall >= 35
            recommendations["imageQuality"] = overall >= 70 ? "high" : (overall >= 45 ? "medium" : "low")
            recommendations["videoQuality"] = overall >= 75 ? "1080p" : (overall >= 50 ? "720p" : "480p")
            recommendations["listWindowSize"] = overall >= 70 ? 21 : (overall >= 45 ? 11 : 5)
            recommendations["maxConcurrentDownloads"] = overall >= 70 ? 4 : (overall >= 45 ? 2 : 1)
            score["recommendations"] = recommendations

            DispatchQueue.main.async {
                resolve(score)
            }
        }
    }

    private func calculateCpuScore() -> Double {
        let cores = ProcessInfo.processInfo.processorCount

        // Core score
        let coreScore: Double
        switch cores {
        case _ where cores >= 8: coreScore = 45.0
        case _ where cores >= 6: coreScore = 38.0
        case _ where cores >= 4: coreScore = 28.0
        case _ where cores >= 2: coreScore = 18.0
        default: coreScore = 10.0
        }

        // Architecture bonus (Apple Silicon)
        var archBonus = 0.0
        #if arch(arm64)
        archBonus = 25.0
        #else
        archBonus = 10.0
        #endif

        // Device generation bonus (based on model identifier)
        let modelIdentifier = getModelIdentifier()
        let generationBonus = getGenerationBonus(modelIdentifier)

        return min(100.0, coreScore + archBonus + generationBonus)
    }

    private func calculateMemoryScore() -> Double {
        let totalMemory = ProcessInfo.processInfo.physicalMemory
        let totalGb = Double(totalMemory) / (1024 * 1024 * 1024)

        // RAM score
        let ramScore: Double
        switch totalGb {
        case _ where totalGb >= 8: ramScore = 100.0
        case _ where totalGb >= 6: ramScore = 85.0
        case _ where totalGb >= 4: ramScore = 65.0
        case _ where totalGb >= 3: ramScore = 50.0
        case _ where totalGb >= 2: ramScore = 35.0
        default: ramScore = 20.0
        }

        return ramScore
    }

    private func calculateStorageScore() -> Double {
        guard let attrs = try? FileManager.default.attributesOfFileSystem(forPath: NSHomeDirectory()),
              let freeSpace = attrs[.systemFreeSize] as? Int64,
              let totalSpace = attrs[.systemSize] as? Int64 else {
            return 50.0
        }

        let freeGb = Double(freeSpace) / (1024 * 1024 * 1024)
        let totalGb = Double(totalSpace) / (1024 * 1024 * 1024)

        // Available space score (60%)
        let availableScore: Double
        switch freeGb {
        case _ where freeGb >= 64: availableScore = 60.0
        case _ where freeGb >= 32: availableScore = 50.0
        case _ where freeGb >= 16: availableScore = 40.0
        case _ where freeGb >= 8: availableScore = 28.0
        case _ where freeGb >= 4: availableScore = 18.0
        default: availableScore = 10.0
        }

        // Total storage score (40%)
        let totalScore: Double
        switch totalGb {
        case _ where totalGb >= 512: totalScore = 40.0
        case _ where totalGb >= 256: totalScore = 35.0
        case _ where totalGb >= 128: totalScore = 28.0
        case _ where totalGb >= 64: totalScore = 20.0
        default: totalScore = 12.0
        }

        return availableScore + totalScore
    }

    private func calculateGpuScore() -> Double {
        guard let device = MTLCreateSystemDefaultDevice() else {
            return 40.0
        }

        var score = 50.0 // Base score for having Metal

        // GPU family support adds points
        if #available(iOS 14.0, *) {
            if device.supportsFamily(.apple7) { score += 30.0 }
            else if device.supportsFamily(.apple6) { score += 25.0 }
            else if device.supportsFamily(.apple5) { score += 20.0 }
            else if device.supportsFamily(.apple4) { score += 15.0 }
            else if device.supportsFamily(.apple3) { score += 10.0 }
            else { score += 5.0 }
        }

        // Low power device penalty
        if device.isLowPower {
            score -= 10.0
        }

        return min(100.0, max(0.0, score))
    }

    // MARK: - Helper Functions

    private func getModelIdentifier() -> String {
        var systemInfo = utsname()
        uname(&systemInfo)
        let machineMirror = Mirror(reflecting: systemInfo.machine)
        return machineMirror.children.reduce("") { identifier, element in
            guard let value = element.value as? Int8, value != 0 else { return identifier }
            return identifier + String(UnicodeScalar(UInt8(value)))
        }
    }

    private func getModelName(_ identifier: String) -> String {
        // iPhone models
        switch identifier {
        case "iPhone15,4": return "iPhone 15"
        case "iPhone15,5": return "iPhone 15 Plus"
        case "iPhone16,1": return "iPhone 15 Pro"
        case "iPhone16,2": return "iPhone 15 Pro Max"
        case "iPhone14,7": return "iPhone 14"
        case "iPhone14,8": return "iPhone 14 Plus"
        case "iPhone15,2": return "iPhone 14 Pro"
        case "iPhone15,3": return "iPhone 14 Pro Max"
        case "iPhone14,2": return "iPhone 13 Pro"
        case "iPhone14,3": return "iPhone 13 Pro Max"
        case "iPhone14,4": return "iPhone 13 mini"
        case "iPhone14,5": return "iPhone 13"
        case "iPhone13,1": return "iPhone 12 mini"
        case "iPhone13,2": return "iPhone 12"
        case "iPhone13,3": return "iPhone 12 Pro"
        case "iPhone13,4": return "iPhone 12 Pro Max"
        case "iPhone12,1": return "iPhone 11"
        case "iPhone12,3": return "iPhone 11 Pro"
        case "iPhone12,5": return "iPhone 11 Pro Max"
        // iPad models
        case "iPad14,1", "iPad14,2": return "iPad mini (6th gen)"
        case "iPad13,18", "iPad13,19": return "iPad (10th gen)"
        case "iPad14,3", "iPad14,4": return "iPad Pro 11-inch (4th gen)"
        case "iPad14,5", "iPad14,6": return "iPad Pro 12.9-inch (6th gen)"
        // Simulator
        case "i386", "x86_64", "arm64": return "Simulator"
        default: return identifier
        }
    }

    private func getGenerationBonus(_ identifier: String) -> Double {
        // Extract generation number from identifier
        if identifier.contains("iPhone16") { return 30.0 } // iPhone 15 Pro series
        if identifier.contains("iPhone15") { return 28.0 } // iPhone 14/15 series
        if identifier.contains("iPhone14") { return 25.0 } // iPhone 13 series
        if identifier.contains("iPhone13") { return 22.0 } // iPhone 12 series
        if identifier.contains("iPhone12") { return 18.0 } // iPhone 11 series
        if identifier.contains("iPhone11") { return 15.0 } // iPhone XR/XS
        if identifier.contains("iPhone10") { return 12.0 } // iPhone X/8
        if identifier.contains("iPad14") { return 28.0 }   // Latest iPads
        if identifier.contains("iPad13") { return 25.0 }
        return 10.0
    }

    private func getEstimatedCpuFrequency() -> Double {
        // Apple doesn't expose CPU frequency, estimate based on model
        let identifier = getModelIdentifier()
        if identifier.contains("iPhone16") { return 3780.0 } // A17 Pro
        if identifier.contains("iPhone15") { return 3460.0 } // A16
        if identifier.contains("iPhone14") { return 3230.0 } // A15
        if identifier.contains("iPhone13") { return 3100.0 } // A14
        if identifier.contains("iPhone12") { return 2650.0 } // A13
        return 2400.0
    }

    private func getCpuBrand() -> String {
        let identifier = getModelIdentifier()
        if identifier.contains("iPhone16") { return "Apple A17 Pro" }
        if identifier.contains("iPhone15,2") || identifier.contains("iPhone15,3") { return "Apple A16 Bionic" }
        if identifier.contains("iPhone15") || identifier.contains("iPhone14,7") || identifier.contains("iPhone14,8") { return "Apple A15 Bionic" }
        if identifier.contains("iPhone14") { return "Apple A15 Bionic" }
        if identifier.contains("iPhone13") { return "Apple A14 Bionic" }
        if identifier.contains("iPhone12") { return "Apple A13 Bionic" }
        if identifier.contains("iPad14,3") || identifier.contains("iPad14,4") || identifier.contains("iPad14,5") || identifier.contains("iPad14,6") { return "Apple M2" }
        return "Apple Silicon"
    }

    private func getPPI() -> Int {
        let identifier = getModelIdentifier()
        // iPhone PPI values
        if identifier.contains("iPhone16") || identifier.contains("iPhone15") { return 460 }
        if identifier.contains("iPhone14") || identifier.contains("iPhone13") { return 460 }
        if identifier.contains("iPhone12") { return 460 }
        if identifier.contains("iPhone11") { return 458 }
        // iPad PPI
        if identifier.contains("iPad") { return 264 }
        return 326 // Default iPhone PPI
    }

    private func getGrade(_ score: Double) -> String {
        switch score {
        case 90...100: return "A+"
        case 80..<90: return "A"
        case 70..<80: return "B+"
        case 60..<70: return "B"
        case 50..<60: return "C+"
        case 40..<50: return "C"
        case 30..<40: return "D"
        default: return "F"
        }
    }

    @objc
    static func requiresMainQueueSetup() -> Bool {
        return false
    }
}