import java.io.FileInputStream
import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

// keystore.properties があれば署名する。無ければ debug 署名のままビルドが通る。
// （CI の通常ビルドや、鍵を持っていない環境でも失敗させないため）
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.exists()) {
        FileInputStream(keystorePropertiesFile).use { load(it) }
    }
}
val hasReleaseKeystore = keystoreProperties.getProperty("storeFile") != null

// CI からは -PgitSha=<sha> で渡す。ローカルビルドでは "local"。
val gitSha: String = (project.findProperty("gitSha") as String?)?.take(7) ?: "local"

android {
    namespace = "jp.efk.camera"
    compileSdk = 35

    defaultConfig {
        // ★ debug と release で applicationId を変えてはいけない。
        //    Google OAuth の Android クライアントは「パッケージ名 + 署名SHA-1」で
        //    照合するため、suffix を付けると認証が通らなくなる。
        applicationId = "jp.efk.camera"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        buildConfigField("String", "GIT_SHA", "\"$gitSha\"")
    }

    signingConfigs {
        if (hasReleaseKeystore) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
        debug {
            isMinifyEnabled = false
            // ★ keystore.properties があれば debug も同じ鍵で署名する。
            //    debug と release で署名が変わると SHA-1 も変わり、Google Cloud に
            //    2つ登録する必要が出て、片方を忘れると「release だけ認証が失敗する」
            //    という分かりにくい事故になる。鍵を1つに揃えてそれを防ぐ。
            if (hasReleaseKeystore) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    lint {
        abortOnError = true
        warningsAsErrors = false
        checkReleaseBuilds = false
        disable += setOf("GradleDependency", "NewerVersionAvailable")
    }

    packaging {
        resources {
            excludes += setOf(
                "META-INF/DEPENDENCIES",
                "META-INF/LICENSE*",
                "META-INF/NOTICE*",
                "META-INF/*.kotlin_module",
            )
        }
    }
}

// 手元が JDK 21、CI が JDK 17 でも同じバイトコードになるよう固定する。
kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.constraintlayout)
    implementation(libs.androidx.lifecycle.service)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.kotlinx.coroutines.android)

    implementation(libs.camera.core)
    implementation(libs.camera.camera2)
    implementation(libs.camera.lifecycle)
    implementation(libs.camera.video)

    implementation(libs.work.runtime.ktx)

    implementation(libs.okhttp)
    implementation(libs.nanohttpd)
    implementation(libs.play.services.auth)
    implementation(libs.zxing.core)

    testImplementation(libs.junit)
}
