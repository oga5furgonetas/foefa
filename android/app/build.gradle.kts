import java.io.File

plugins {
    id("com.android.application")
}

// La clave de firma NUNCA va en el repositorio: ruta y contraseña llegan por
// variables de entorno (ver docs/PLAY_STORE.md). Sin ellas se compila sin
// firmar (vale para probar, no para subir).
val ksPath = System.getenv("FLOTA_KEYSTORE")
val ksPass = System.getenv("FLOTA_KEYSTORE_PASSWORD")

android {
    namespace = "com.flotadsp.flota"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.flotadsp.flota"
        minSdk = 24
        // Play exige API 35 desde el 31-08-2025 y API 36 desde el 31-08-2026.
        targetSdk = 36
        versionCode = 3
        versionName = "1.0.2"

        // Lo que abre la app. /app lleva a cada uno a lo suyo (su ruta, su panel
        // o la pantalla de entrar).
        manifestPlaceholders["hostName"] = "flotadsp.com"
        manifestPlaceholders["defaultUrl"] = "https://flotadsp.com/app"
        manifestPlaceholders["launcherName"] = "FDS"
        // La web declara la app en /.well-known/assetlinks.json; esto es la
        // otra mitad: la app declara la web.
        manifestPlaceholders["assetStatements"] =
            "[{ \"relation\": [\"delegate_permission/common.handle_all_urls\"], " +
            "\"target\": { \"namespace\": \"web\", \"site\": \"https://flotadsp.com\" } }]"
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

    // Dos apps del mismo código (04-10-2026):
    //  · play:  la de Google Play (TWA con Chrome, cobro con Play Billing).
    //  · china: para descargar desde la web en China, donde no hay Play ni
    //    Chrome: paquete propio (.cn, no choca con la de Play) y WebView propio
    //    (src/china). Se compila con  ./gradlew assembleChinaRelease
    flavorDimensions += "canal"
    productFlavors {
        create("play") { dimension = "canal" }
        create("china") {
            dimension = "canal"
            applicationIdSuffix = ".cn"
            versionNameSuffix = "-cn"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.3")
    // Cobro con Google Play desde la web (Digital Goods API + PaymentRequest).
    implementation("com.google.androidbrowserhelper:billing:1.2.0")
}
