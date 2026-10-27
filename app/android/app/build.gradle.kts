plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.fintask.fintask"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        isCoreLibraryDesugaringEnabled = true
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }


    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.fintask.fintask"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    buildTypes {
        release {
            // TODO: Add your own signing config for the release build.
            // Signing with the debug keys for now, so `flutter run --release` works.
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}

flutter {
    source = "../.."
}

afterEvaluate {
    tasks.matching { it.name.startsWith("assemble") || it.name.startsWith("package") }.configureEach {
        doLast {
            val rootDir = project.rootDir.parentFile?.parentFile ?: file("${project.rootDir}/../../")
            val artifactsDir = File(rootDir, "artifacts")
            val downloadsDir = File(rootDir, "app/downloads")
            artifactsDir.mkdirs()
            downloadsDir.mkdirs()

            val buildDir = layout.buildDirectory.orNull?.asFile
            if (buildDir != null && buildDir.exists()) {
                val apks = buildDir.walkTopDown()
                    .filter { it.isFile && it.extension.equals("apk", ignoreCase = true) && !it.name.contains("unaligned") }
                    .sortedByDescending { it.lastModified() }
                    .toList()

                val latestApk = apks.firstOrNull()
                if (latestApk != null) {
                    val artifactApk = File(artifactsDir, "fintask.apk")
                    val downloadsApk = File(downloadsDir, "fintask.apk")
                    latestApk.copyTo(artifactApk, overwrite = true)
                    latestApk.copyTo(downloadsApk, overwrite = true)
                    println("📦 [Artifacts] Updated APK (${latestApk.name}) -> ${artifactApk.absolutePath}")
                }
            }
        }
    }
}

