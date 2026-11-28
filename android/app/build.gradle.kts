import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
}

// Push (Firebase Cloud Messaging) when the Firebase project's file is in place: app/google-services.json,
// copied in from esp-intro/keys/firebase/ for a build (never committed). Without it the app runs, without push.
if (file("google-services.json").exists()) apply(plugin = "com.google.gms.google-services")

// Where the app's pages are: FloorBeat, one app since 3.0.0 (its alerts, dashboard and stock; the web app's
// src/lib/dashboard-app.ts). A test build can point elsewhere: ./gradlew assembleDebug -PappUrl=http://10.0.2.2:3105
val appUrl = (findProperty("appUrl") as String?)?.trimEnd('/') ?: "https://dashboard.floorbeat.in"

// The release signing key (the same key as every earlier build, or phones refuse the update): keystore.properties,
// written for a build from esp-intro/keys/android/ (README.md), never committed.
val keystoreFile = rootProject.file("keystore.properties")
val keystore = Properties().apply { if (keystoreFile.exists()) keystoreFile.inputStream().use { load(it) } }

android {
    namespace = "floorbeat.alerts"
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        // The package every FloorBeat Alerts install has had since 1.0.0 (the Trusted Web Activity): kept, so the one
        // app installs over it as an update, and its push (Firebase knows this package) rings on through the update.
        applicationId = "in.floorbeat.alerts"
        minSdk = 24
        targetSdk = 36
        versionCode = 4
        versionName = "3.0.1"
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
    implementation(libs.androidx.fragment)
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)
    testImplementation(libs.junit)
    testImplementation(libs.json)
}
