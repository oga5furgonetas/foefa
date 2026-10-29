import org.jetbrains.kotlin.gradle.dsl.JvmTarget
import java.io.File

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// LA APP NATIVA DE FDS (25-10-2026). Sustituye en Google Play a la TWA de `android/` con el MISMO paquete
// (`com.flotadsp.flota`) y la misma clave de firma: es una actualización de la misma app, no otra.
// La clave nunca va en el repositorio: ruta y contraseña por variables de entorno (docs/PLAY_STORE.md).
// Sin variables, se busca en la carpeta del usuario (~/.flota-android.keystore y ~/.flota-android-keystore.txt, como
// dice docs/PLAY_STORE.md): así la contraseña no pasa por la línea de órdenes ni por ningún log.
val casa = File(System.getProperty("user.home"))
val ksPath = System.getenv("FLOTA_KEYSTORE") ?: casa.resolve(".flota-android.keystore").path
val ksPass = System.getenv("FLOTA_KEYSTORE_PASSWORD")
    ?: casa.resolve(".flota-android-keystore.txt").takeIf { it.isFile }?.readText()?.trim()
// Para probar contra un servidor simulado: ./gradlew assembleDebug -PapiUrl=http://10.0.2.2:8787/api/
val apiUrl = (project.findProperty("apiUrl") as String?) ?: "https://flota-backend.fly.dev/api/"

android {
    namespace = "com.flotadsp.fds"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.flotadsp.flota"
        minSdk = 26
        targetSdk = 36
        // La TWA llegó a code 4 (1.0.3): la nativa empieza en 10.
        versionCode = 16
        versionName = "2.2.4"
        buildConfigField("String", "API_URL", "\"$apiUrl\"")
        buildConfigField("String", "WEB_URL", "\"https://flotadsp.com\"")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables { useSupportLibrary = true }
        // El APK para descargar desde la web, solo con las librerías de los móviles (ML Kit trae las suyas para cada
        // procesador: con las cuatro, 67 MB; con estas dos, menos de la mitad). El AAB de Play va completo: Play
        // ya le da a cada móvil solo las suyas.   ./gradlew :app:assembleRelease -PsoloMoviles
        // Con -PsoloMoviles=arm64, solo los de 64 bits (casi todos los móviles de hoy): ~21 MB, se puede mandar al móvil.
        (project.findProperty("soloMoviles") as String?)?.let { v ->
            ndk { abiFilters += if (v == "arm64") listOf("arm64-v8a") else listOf("arm64-v8a", "armeabi-v7a") }
        }
        // Y con su propio paquete, como la TWA (`android/`, variante web): la de Play la firma Google con OTRA clave,
        // así que con el mismo paquete no se instala encima («App no instalada») ni se actualiza luego desde Play.
        // `com.flotadsp.flota.web` va firmada con la clave de subida, está en assetlinks.json y actualiza la que ya
        // se bajó de la web.   ./gradlew :app:assembleRelease -PsoloMoviles -PparaWeb
        if (project.hasProperty("paraWeb")) applicationIdSuffix = ".web"
    }

    signingConfigs {
        if (ksPath != null && ksPass != null && File(ksPath).exists()) {
            create("release") {
                storeFile = File(ksPath)
                storePassword = ksPass
                keyAlias = "flota"
                keyPassword = ksPass
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release")
        }
        // La de publicación (R8, recursos recortados) para probarla en el emulador contra el servidor de pruebas:
        //   ./gradlew :app:installPrueba -PapiUrl=http://10.0.2.2:8787/api/
        // Firmada con la clave de depuración y con la red de pruebas de `src/debug`: lo que R8 rompa sale aquí.
        create("prueba") {
            initWith(getByName("release"))
            applicationIdSuffix = ".prueba"
            versionNameSuffix = "-prueba"
            signingConfig = signingConfigs.getByName("debug")
            matchingFallbacks += listOf("release")
        }
    }
    sourceSets.getByName("prueba") {
        manifest.srcFile("src/debug/AndroidManifest.xml")
        res.srcDirs("src/debug/res")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    testOptions {
        unitTests {
            isReturnDefaultValues = true
        }
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
            excludes += "/META-INF/LICENSE*"
        }
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
        freeCompilerArgs.addAll(
            "-opt-in=kotlin.RequiresOptIn",
            "-opt-in=androidx.compose.material3.ExperimentalMaterial3Api",
            "-opt-in=androidx.compose.foundation.layout.ExperimentalLayoutApi",
            "-opt-in=kotlinx.serialization.ExperimentalSerializationApi",
        )
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.process)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.exifinterface)
    implementation(libs.androidx.work)
    implementation(libs.androidx.camera.camera2)
    implementation(libs.androidx.camera.lifecycle)
    implementation(libs.androidx.camera.view)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.coroutines.play)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.okhttp)
    implementation(libs.mlkit.barcode)
    implementation(libs.mlkit.texto)
    implementation(libs.osmdroid)
    implementation(libs.play.location)
    debugImplementation(libs.androidx.compose.ui.tooling)

    testImplementation(libs.junit)
    testImplementation(libs.truth)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.okhttp.mockwebserver)
    androidTestImplementation(libs.androidx.test.junit)
    androidTestImplementation(libs.androidx.test.runner)
    androidTestImplementation(libs.truth)
}
