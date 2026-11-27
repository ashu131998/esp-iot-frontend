import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
}

// Where the app's pages are. A test build can point elsewhere: ./gradlew :dashboard:assembleDebug -PdashboardUrl=http://10.0.2.2:3105
val appUrl = (findProperty("dashboardUrl") as String?)?.trimEnd('/') ?: "https://dashboard.floorbeat.in"

// The release signing key, the same one as FloorBeat Alerts (keystore.properties, written for a build from
// esp-intro/keys/android/, never committed): public/.well-known/assetlinks.json names its fingerprint.
val keystoreFile = rootProject.file("keystore.properties")
val keystore = Properties().apply { if (keystoreFile.exists()) keystoreFile.inputStream().use { load(it) } }

android {
    namespace = "floorbeat.dashboard"
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "in.floorbeat.dashboard"
        minSdk = 24
        targetSdk = 36
        versionCode = 2
        versionName = "1.1.0"
        buildConfigField("String", "APP_URL", "\"$appUrl\"")
    }

    signingConfigs {
        if (keystoreFile.exists()) {
            create("release") {
                storeFile = file(keystore.getProperty("storeFile"))
                storePassword = keystore.getProperty("storePassword")
                keyAlias = keystore.getProperty("keyAlias")
                keyPassword = keystore.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.findByName("release")
            optimization {
                enable = false
            }
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.webkit)
    implementation(libs.androidx.core.splashscreen)
    testImplementation(libs.junit)
}
