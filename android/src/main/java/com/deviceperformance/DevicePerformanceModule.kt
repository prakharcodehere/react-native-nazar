package com.deviceperformance

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Point
import android.opengl.EGL14
import android.opengl.GLES20
import android.os.BatteryManager
import android.os.Build
import android.os.Environment
import android.os.StatFs
import android.os.SystemClock
import android.util.DisplayMetrics
import android.view.WindowManager
import com.facebook.react.bridge.*
import kotlinx.coroutines.*
import java.io.BufferedReader
import java.io.File
import java.io.FileReader
import java.io.RandomAccessFile
import javax.microedition.khronos.egl.EGL10
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.egl.EGLContext

class DevicePerformanceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    override fun getName() = "DevicePerformance"

    override fun onCatalystInstanceDestroy() {
        scope.cancel()
        super.onCatalystInstanceDestroy()
    }

    // ==================== GET DEVICE SPECS ====================
    @ReactMethod
    fun getDeviceSpecs(promise: Promise) {
        scope.launch {
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

                // System Info
                specs.putMap("system", getSystemInfo())

                // Network Info
                specs.putMap("network", getNetworkInfo())

                withContext(Dispatchers.Main) {
                    promise.resolve(specs)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("SPECS_ERROR", e.message, e)
                }
            }
        }
    }

    private fun getCpuInfo(): WritableMap {
        val cpuInfo = Arguments.createMap()

        // Core count
        cpuInfo.putInt("cores", Runtime.getRuntime().availableProcessors())

        // Architecture
        cpuInfo.putString("architecture", Build.SUPPORTED_ABIS.firstOrNull() ?: "unknown")

        // All supported ABIs
        val abis = Arguments.createArray()
        Build.SUPPORTED_ABIS.forEach { abis.pushString(it) }
        cpuInfo.putArray("supportedAbis", abis)

        // CPU frequencies
        cpuInfo.putDouble("maxFrequency", getMaxCpuFrequency())
        cpuInfo.putDouble("minFrequency", getMinCpuFrequency())
        cpuInfo.putDouble("currentFrequency", getCurrentCpuFrequency())

        // CPU usage
        cpuInfo.putDouble("usage", getCpuUsage())

        // CPU model (from /proc/cpuinfo)
        cpuInfo.putString("model", getCpuModel())

        // Is 64-bit
        cpuInfo.putBoolean("is64Bit", Build.SUPPORTED_64_BIT_ABIS.isNotEmpty())

        return cpuInfo
    }

    private fun getMemoryInfo(): WritableMap {
        val memInfo = Arguments.createMap()
        val activityManager = reactContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memoryInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memoryInfo)

        memInfo.putDouble("totalRam", memoryInfo.totalMem.toDouble())
        memInfo.putDouble("availableRam", memoryInfo.availMem.toDouble())
        memInfo.putDouble("usedRam", (memoryInfo.totalMem - memoryInfo.availMem).toDouble())
        memInfo.putDouble("usagePercent", ((memoryInfo.totalMem - memoryInfo.availMem).toDouble() / memoryInfo.totalMem) * 100)
        memInfo.putBoolean("lowMemory", memoryInfo.lowMemory)
        memInfo.putDouble("threshold", memoryInfo.threshold.toDouble())

        // Memory class (app memory limit)
        memInfo.putInt("memoryClass", activityManager.memoryClass)
        memInfo.putInt("largeMemoryClass", activityManager.largeMemoryClass)

        // Runtime memory
        val runtime = Runtime.getRuntime()
        memInfo.putDouble("jvmMaxMemory", runtime.maxMemory().toDouble())
        memInfo.putDouble("jvmTotalMemory", runtime.totalMemory().toDouble())
        memInfo.putDouble("jvmFreeMemory", runtime.freeMemory().toDouble())

        return memInfo
    }

    private fun getStorageInfo(): WritableMap {
        val storageInfo = Arguments.createMap()

        // Internal storage
        val internalStat = StatFs(Environment.getDataDirectory().path)
        val internalTotal = internalStat.blockSizeLong * internalStat.blockCountLong
        val internalAvailable = internalStat.blockSizeLong * internalStat.availableBlocksLong

        storageInfo.putDouble("totalStorage", internalTotal.toDouble())
        storageInfo.putDouble("availableStorage", internalAvailable.toDouble())
        storageInfo.putDouble("usedStorage", (internalTotal - internalAvailable).toDouble())
        storageInfo.putDouble("usagePercent", ((internalTotal - internalAvailable).toDouble() / internalTotal) * 100)

        // External storage (if available)
        val externalDir = Environment.getExternalStorageDirectory()
        if (externalDir.exists()) {
            val externalStat = StatFs(externalDir.path)
            val externalTotal = externalStat.blockSizeLong * externalStat.blockCountLong
            val externalAvailable = externalStat.blockSizeLong * externalStat.availableBlocksLong

            val externalInfo = Arguments.createMap()
            externalInfo.putDouble("total", externalTotal.toDouble())
            externalInfo.putDouble("available", externalAvailable.toDouble())
            storageInfo.putMap("external", externalInfo)
        }

        return storageInfo
    }

    private fun getBatteryInfo(): WritableMap {
        val batteryInfo = Arguments.createMap()

        val batteryIntent = reactContext.registerReceiver(
            null,
            IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        )

        batteryIntent?.let {
            val level = it.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
            val scale = it.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
            val status = it.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
            val health = it.getIntExtra(BatteryManager.EXTRA_HEALTH, -1)
            val temperature = it.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1)
            val voltage = it.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1)
            val plugged = it.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1)
            val technology = it.getStringExtra(BatteryManager.EXTRA_TECHNOLOGY)

            batteryInfo.putDouble("level", if (scale > 0) (level.toDouble() / scale) * 100 else -1.0)
            batteryInfo.putBoolean("isCharging", status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL)
            batteryInfo.putString("health", getBatteryHealthString(health))
            batteryInfo.putDouble("temperature", temperature / 10.0)
            batteryInfo.putInt("voltage", voltage)
            batteryInfo.putString("technology", technology ?: "unknown")
            batteryInfo.putString("chargingType", getChargingType(plugged))
            batteryInfo.putString("status", getBatteryStatusString(status))

            // Battery capacity (if available on Android 5.0+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                val batteryManager = reactContext.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
                batteryManager?.let { bm ->
                    val capacity = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
                    val chargeCounter = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CHARGE_COUNTER)
                    val currentNow = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW)
                    val currentAvg = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_AVERAGE)

                    if (capacity != Integer.MIN_VALUE) batteryInfo.putInt("capacity", capacity)
                    if (chargeCounter != Integer.MIN_VALUE) batteryInfo.putInt("chargeCounter", chargeCounter)
                    if (currentNow != Integer.MIN_VALUE) batteryInfo.putInt("currentNow", currentNow)
                    if (currentAvg != Integer.MIN_VALUE) batteryInfo.putInt("currentAverage", currentAvg)
                }
            }
        }

        return batteryInfo
    }

    private fun getDisplayInfo(): WritableMap {
        val displayInfo = Arguments.createMap()
        val windowManager = reactContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val display = windowManager.defaultDisplay
        val metrics = DisplayMetrics()

        display.getRealMetrics(metrics)

        displayInfo.putInt("widthPixels", metrics.widthPixels)
        displayInfo.putInt("heightPixels", metrics.heightPixels)
        displayInfo.putDouble("density", metrics.density.toDouble())
        displayInfo.putInt("densityDpi", metrics.densityDpi)
        displayInfo.putDouble("scaledDensity", metrics.scaledDensity.toDouble())
        displayInfo.putDouble("xdpi", metrics.xdpi.toDouble())
        displayInfo.putDouble("ydpi", metrics.ydpi.toDouble())

        // Refresh rate
        displayInfo.putDouble("refreshRate", display.refreshRate.toDouble())

        // Screen size in inches
        val widthInches = metrics.widthPixels / metrics.xdpi
        val heightInches = metrics.heightPixels / metrics.ydpi
        val diagonalInches = Math.sqrt((widthInches * widthInches + heightInches * heightInches).toDouble())
        displayInfo.putDouble("screenSizeInches", diagonalInches)

        // HDR capabilities (Android 7.0+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            displayInfo.putBoolean("isHdr", display.isHdr)
            displayInfo.putBoolean("isWideColorGamut", display.isWideColorGamut)
        }

        // Display cutout info (Android 9.0+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val cutout = display.cutout
            displayInfo.putBoolean("hasCutout", cutout != null)
        }

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
        deviceInfo.putString("board", Build.BOARD)
        deviceInfo.putInt("sdkVersion", Build.VERSION.SDK_INT)
        deviceInfo.putString("androidVersion", Build.VERSION.RELEASE)
        deviceInfo.putString("buildId", Build.ID)
        deviceInfo.putString("fingerprint", Build.FINGERPRINT)
        deviceInfo.putString("bootloader", Build.BOOTLOADER)
        deviceInfo.putString("display", Build.DISPLAY)
        deviceInfo.putLong("buildTime", Build.TIME)

        // Security patch level (Android 6.0+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            deviceInfo.putString("securityPatch", Build.VERSION.SECURITY_PATCH)
        }

        // Device type estimation
        deviceInfo.putString("deviceType", getDeviceType())

        return deviceInfo
    }

    private fun getGpuInfo(): WritableMap {
        val gpuInfo = Arguments.createMap()

        try {
            // Try to get OpenGL info
            val egl = EGLContext.getEGL() as? EGL10
            if (egl != null) {
                val display = egl.eglGetDisplay(EGL10.EGL_DEFAULT_DISPLAY)
                egl.eglInitialize(display, intArrayOf(0, 0))

                val configSpec = intArrayOf(
                    EGL10.EGL_RENDERABLE_TYPE, 4, // EGL_OPENGL_ES2_BIT
                    EGL10.EGL_NONE
                )

                val configs = arrayOfNulls<EGLConfig>(1)
                val numConfigs = IntArray(1)
                egl.eglChooseConfig(display, configSpec, configs, 1, numConfigs)

                if (numConfigs[0] > 0) {
                    val contextAttribs = intArrayOf(
                        EGL14.EGL_CONTEXT_CLIENT_VERSION, 2,
                        EGL10.EGL_NONE
                    )
                    val context = egl.eglCreateContext(display, configs[0], EGL10.EGL_NO_CONTEXT, contextAttribs)
                    val surface = egl.eglCreatePbufferSurface(display, configs[0], intArrayOf(
                        EGL10.EGL_WIDTH, 1,
                        EGL10.EGL_HEIGHT, 1,
                        EGL10.EGL_NONE
                    ))

                    egl.eglMakeCurrent(display, surface, surface, context)

                    gpuInfo.putString("renderer", GLES20.glGetString(GLES20.GL_RENDERER) ?: "unknown")
                    gpuInfo.putString("vendor", GLES20.glGetString(GLES20.GL_VENDOR) ?: "unknown")
                    gpuInfo.putString("version", GLES20.glGetString(GLES20.GL_VERSION) ?: "unknown")
                    gpuInfo.putString("extensions", GLES20.glGetString(GLES20.GL_EXTENSIONS) ?: "")

                    egl.eglMakeCurrent(display, EGL10.EGL_NO_SURFACE, EGL10.EGL_NO_SURFACE, EGL10.EGL_NO_CONTEXT)
                    egl.eglDestroySurface(display, surface)
                    egl.eglDestroyContext(display, context)
                    egl.eglTerminate(display)
                }
            }
        } catch (e: Exception) {
            gpuInfo.putString("renderer", "unknown")
            gpuInfo.putString("vendor", Build.MANUFACTURER)
            gpuInfo.putString("error", e.message)
        }

        return gpuInfo
    }

    private fun getSystemInfo(): WritableMap {
        val systemInfo = Arguments.createMap()

        // Uptime
        systemInfo.putDouble("uptimeMillis", SystemClock.uptimeMillis().toDouble())
        systemInfo.putDouble("elapsedRealtimeMillis", SystemClock.elapsedRealtime().toDouble())

        // System features
        val pm = reactContext.packageManager
        systemInfo.putBoolean("hasNfc", pm.hasSystemFeature(PackageManager.FEATURE_NFC))
        systemInfo.putBoolean("hasBluetooth", pm.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH))
        systemInfo.putBoolean("hasBluetoothLe", pm.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE))
        systemInfo.putBoolean("hasCamera", pm.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY))
        systemInfo.putBoolean("hasGps", pm.hasSystemFeature(PackageManager.FEATURE_LOCATION_GPS))
        systemInfo.putBoolean("hasFingerprint", pm.hasSystemFeature(PackageManager.FEATURE_FINGERPRINT))
        systemInfo.putBoolean("hasTelephony", pm.hasSystemFeature(PackageManager.FEATURE_TELEPHONY))
        systemInfo.putBoolean("hasWifi", pm.hasSystemFeature(PackageManager.FEATURE_WIFI))

        // Vulkan support (Android 7.0+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            systemInfo.putBoolean("hasVulkan", pm.hasSystemFeature(PackageManager.FEATURE_VULKAN_HARDWARE_LEVEL))
        }

        return systemInfo
    }

    private fun getNetworkInfo(): WritableMap {
        val networkInfo = Arguments.createMap()

        // Basic network info (connectivity state handled elsewhere for permissions)
        networkInfo.putBoolean("available", true)

        return networkInfo
    }

    // ==================== RUN BENCHMARK ====================
    @ReactMethod
    fun runBenchmark(promise: Promise) {
        scope.launch {
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

                // Multi-threaded CPU benchmark
                val multiThreadScore = runMultiThreadBenchmark()
                results.putDouble("multiThreadScore", multiThreadScore)

                // Calculate overall score (weighted average)
                val overallScore = (cpuScore * 0.35 + memoryScore * 0.25 + storageScore * 0.20 + multiThreadScore * 0.20)
                results.putDouble("overallScore", overallScore)

                // Performance tier
                val tier = when {
                    overallScore >= 80 -> "HIGH"
                    overallScore >= 50 -> "MEDIUM"
                    else -> "LOW"
                }
                results.putString("performanceTier", tier)

                // Detailed breakdown
                val breakdown = Arguments.createMap()
                breakdown.putString("cpuGrade", getGrade(cpuScore))
                breakdown.putString("memoryGrade", getGrade(memoryScore))
                breakdown.putString("storageGrade", getGrade(storageScore))
                breakdown.putString("multiThreadGrade", getGrade(multiThreadScore))
                results.putMap("grades", breakdown)

                withContext(Dispatchers.Main) {
                    promise.resolve(results)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("BENCHMARK_ERROR", e.message, e)
                }
            }
        }
    }

    private fun runCpuBenchmark(): Double {
        val iterations = 1_000_000
        val startTime = System.nanoTime()
        var result = 0.0

        // Perform intensive calculations
        for (i in 0 until iterations) {
            result += Math.sqrt(i.toDouble()) * Math.sin(i.toDouble()) * Math.cos(i.toDouble())
        }

        val duration = (System.nanoTime() - startTime) / 1_000_000.0 // ms

        // Score: faster = higher score (baseline ~400ms = 50 points for 1M iterations)
        return minOf(100.0, maxOf(0.0, (400.0 / duration) * 50))
    }

    private fun runMemoryBenchmark(): Double {
        val startTime = System.nanoTime()

        // Allocate and access memory
        val arrays = mutableListOf<ByteArray>()
        repeat(50) {
            val arr = ByteArray(1024 * 1024) // 1MB each
            // Touch all memory to ensure allocation
            for (j in arr.indices step 4096) {
                arr[j] = j.toByte()
            }
            arrays.add(arr)
        }

        // Read back
        var checksum = 0L
        arrays.forEach { arr ->
            for (j in arr.indices step 4096) {
                checksum += arr[j]
            }
        }

        arrays.clear()
        System.gc()

        val duration = (System.nanoTime() - startTime) / 1_000_000.0
        return minOf(100.0, maxOf(0.0, (300.0 / duration) * 50))
    }

    private fun runStorageBenchmark(): Double {
        return try {
            val file = File(reactContext.cacheDir, "benchmark_test_${System.currentTimeMillis()}")
            val dataSize = 4 * 1024 * 1024 // 4MB
            val data = ByteArray(dataSize) { it.toByte() }

            val startTime = System.nanoTime()

            // Write
            file.writeBytes(data)

            // Read
            val readData = file.readBytes()

            // Verify
            if (readData.size != dataSize) throw Exception("Data mismatch")

            file.delete()

            val duration = (System.nanoTime() - startTime) / 1_000_000.0
            minOf(100.0, maxOf(0.0, (200.0 / duration) * 50))
        } catch (e: Exception) {
            40.0 // Default score on error
        }
    }

    private fun runMultiThreadBenchmark(): Double {
        val cores = Runtime.getRuntime().availableProcessors()
        val iterationsPerThread = 500_000
        val startTime = System.nanoTime()

        runBlocking {
            val jobs = (0 until cores).map {
                async(Dispatchers.Default) {
                    var result = 0.0
                    for (i in 0 until iterationsPerThread) {
                        result += Math.sqrt(i.toDouble()) * Math.sin(i.toDouble())
                    }
                    result
                }
            }
            jobs.awaitAll()
        }

        val duration = (System.nanoTime() - startTime) / 1_000_000.0
        val expectedDuration = 400.0 * cores / 4 // Normalize for 4 cores

        return minOf(100.0, maxOf(0.0, (expectedDuration / duration) * 50))
    }

    // ==================== GET PERFORMANCE SCORE ====================
    @ReactMethod
    fun getPerformanceScore(promise: Promise) {
        scope.launch {
            try {
                val score = Arguments.createMap()

                val cpuScore = calculateCpuScore()
                val memoryScore = calculateMemoryScore()
                val storageScore = calculateStorageScore()
                val gpuScore = calculateGpuScore()

                val overall = (cpuScore * 0.35 + memoryScore * 0.30 + storageScore * 0.15 + gpuScore * 0.20)

                score.putDouble("cpu", cpuScore)
                score.putDouble("memory", memoryScore)
                score.putDouble("storage", storageScore)
                score.putDouble("gpu", gpuScore)
                score.putDouble("overall", overall)

                val tier = when {
                    overall >= 80 -> "HIGH"
                    overall >= 50 -> "MEDIUM"
                    else -> "LOW"
                }
                score.putString("tier", tier)

                // Recommendations
                val recommendations = Arguments.createMap()
                recommendations.putBoolean("enableAnimations", overall >= 40)
                recommendations.putBoolean("enableBlur", overall >= 60)
                recommendations.putBoolean("enableParallax", overall >= 70)
                recommendations.putBoolean("enableShadows", overall >= 45)
                recommendations.putString("imageQuality", when {
                    overall >= 70 -> "high"
                    overall >= 40 -> "medium"
                    else -> "low"
                })
                recommendations.putString("videoQuality", when {
                    overall >= 75 -> "1080p"
                    overall >= 50 -> "720p"
                    else -> "480p"
                })
                recommendations.putInt("listWindowSize", when {
                    overall >= 70 -> 21
                    overall >= 45 -> 11
                    else -> 5
                })
                score.putMap("recommendations", recommendations)

                withContext(Dispatchers.Main) {
                    promise.resolve(score)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    promise.reject("SCORE_ERROR", e.message, e)
                }
            }
        }
    }

    private fun calculateCpuScore(): Double {
        val cores = Runtime.getRuntime().availableProcessors()
        val freq = getMaxCpuFrequency()
        val is64Bit = Build.SUPPORTED_64_BIT_ABIS.isNotEmpty()

        // Core score (max 35 points)
        val coreScore = when {
            cores >= 8 -> 35.0
            cores >= 6 -> 30.0
            cores >= 4 -> 22.0
            cores >= 2 -> 15.0
            else -> 8.0
        }

        // Frequency score (max 50 points)
        val freqScore = when {
            freq >= 2800 -> 50.0
            freq >= 2400 -> 42.0
            freq >= 2000 -> 35.0
            freq >= 1600 -> 25.0
            freq >= 1200 -> 18.0
            else -> 10.0
        }

        // Architecture bonus (max 15 points)
        val archBonus = if (is64Bit) 15.0 else 5.0

        return minOf(100.0, coreScore + freqScore + archBonus)
    }

    private fun calculateMemoryScore(): Double {
        val activityManager = reactContext.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memoryInfo = ActivityManager.MemoryInfo()
        activityManager.getMemoryInfo(memoryInfo)

        val totalGb = memoryInfo.totalMem / (1024.0 * 1024 * 1024)
        val memoryClass = activityManager.memoryClass

        // RAM score (max 70 points)
        val ramScore = when {
            totalGb >= 12 -> 70.0
            totalGb >= 8 -> 60.0
            totalGb >= 6 -> 50.0
            totalGb >= 4 -> 38.0
            totalGb >= 3 -> 28.0
            totalGb >= 2 -> 18.0
            else -> 10.0
        }

        // Memory class score (max 30 points)
        val classScore = when {
            memoryClass >= 512 -> 30.0
            memoryClass >= 256 -> 25.0
            memoryClass >= 192 -> 20.0
            memoryClass >= 128 -> 15.0
            else -> 8.0
        }

        return minOf(100.0, ramScore + classScore)
    }

    private fun calculateStorageScore(): Double {
        val stat = StatFs(Environment.getDataDirectory().path)
        val availableGb = (stat.blockSizeLong * stat.availableBlocksLong) / (1024.0 * 1024 * 1024)
        val totalGb = (stat.blockSizeLong * stat.blockCountLong) / (1024.0 * 1024 * 1024)

        // Available space score (max 60 points)
        val availableScore = when {
            availableGb >= 64 -> 60.0
            availableGb >= 32 -> 50.0
            availableGb >= 16 -> 40.0
            availableGb >= 8 -> 30.0
            availableGb >= 4 -> 20.0
            else -> 10.0
        }

        // Total storage score (max 40 points)
        val totalScore = when {
            totalGb >= 256 -> 40.0
            totalGb >= 128 -> 35.0
            totalGb >= 64 -> 28.0
            totalGb >= 32 -> 20.0
            else -> 12.0
        }

        return minOf(100.0, availableScore + totalScore)
    }

    private fun calculateGpuScore(): Double {
        // Estimate GPU score based on device characteristics
        val sdkVersion = Build.VERSION.SDK_INT
        val is64Bit = Build.SUPPORTED_64_BIT_ABIS.isNotEmpty()

        // Base score from SDK version (newer = better GPU support)
        val sdkScore = when {
            sdkVersion >= 33 -> 40.0 // Android 13+
            sdkVersion >= 31 -> 35.0 // Android 12+
            sdkVersion >= 29 -> 30.0 // Android 10+
            sdkVersion >= 26 -> 22.0 // Android 8+
            else -> 15.0
        }

        // Architecture bonus
        val archBonus = if (is64Bit) 20.0 else 5.0

        // Display-based estimation (higher res usually means better GPU)
        val windowManager = reactContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        windowManager.defaultDisplay.getRealMetrics(metrics)
        val totalPixels = metrics.widthPixels.toLong() * metrics.heightPixels

        val displayScore = when {
            totalPixels >= 3686400 -> 40.0  // 1440p+
            totalPixels >= 2073600 -> 32.0  // 1080p+
            totalPixels >= 921600 -> 22.0   // 720p+
            else -> 12.0
        }

        return minOf(100.0, sdkScore + archBonus + displayScore)
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

    private fun getMinCpuFrequency(): Double {
        return try {
            val reader = RandomAccessFile("/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_min_freq", "r")
            val freq = reader.readLine().toLong()
            reader.close()
            freq / 1000.0
        } catch (e: Exception) {
            0.0
        }
    }

    private fun getCurrentCpuFrequency(): Double {
        return try {
            val reader = RandomAccessFile("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq", "r")
            val freq = reader.readLine().toLong()
            reader.close()
            freq / 1000.0
        } catch (e: Exception) {
            0.0
        }
    }

    private fun getCpuUsage(): Double {
        return try {
            val reader = RandomAccessFile("/proc/stat", "r")
            val line = reader.readLine()
            reader.close()

            val parts = line.split("\\s+".toRegex())
            val user = parts[1].toLong()
            val nice = parts[2].toLong()
            val system = parts[3].toLong()
            val idle = parts[4].toLong()

            val total = user + nice + system + idle
            val used = user + nice + system

            (used.toDouble() / total) * 100
        } catch (e: Exception) {
            0.0
        }
    }

    private fun getCpuModel(): String {
        return try {
            val reader = BufferedReader(FileReader("/proc/cpuinfo"))
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                if (line!!.contains("Hardware") || line!!.contains("model name")) {
                    reader.close()
                    return line!!.split(":").getOrNull(1)?.trim() ?: "unknown"
                }
            }
            reader.close()
            "unknown"
        } catch (e: Exception) {
            "unknown"
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

    private fun getDeviceType(): String {
        val windowManager = reactContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val metrics = DisplayMetrics()
        windowManager.defaultDisplay.getRealMetrics(metrics)

        val widthInches = metrics.widthPixels / metrics.xdpi
        val heightInches = metrics.heightPixels / metrics.ydpi
        val diagonalInches = Math.sqrt((widthInches * widthInches + heightInches * heightInches).toDouble())

        return when {
            diagonalInches >= 10 -> "TABLET"
            diagonalInches >= 7 -> "PHABLET"
            else -> "PHONE"
        }
    }

    private fun getGrade(score: Double): String {
        return when {
            score >= 90 -> "A+"
            score >= 80 -> "A"
            score >= 70 -> "B+"
            score >= 60 -> "B"
            score >= 50 -> "C+"
            score >= 40 -> "C"
            score >= 30 -> "D"
            else -> "F"
        }
    }
}
