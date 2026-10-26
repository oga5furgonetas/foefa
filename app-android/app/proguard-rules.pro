# kotlinx.serialization: los serializadores generados se buscan por reflexión en el objeto compañero.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.AnnotationsKt
-keepclassmembers class kotlinx.serialization.json.** { *** Companion; }
-keepclasseswithmembers class kotlinx.serialization.json.** { kotlinx.serialization.KSerializer serializer(...); }
-keep,includedescriptorclasses class com.flotadsp.fds.**$$serializer { *; }
-keepclassmembers class com.flotadsp.fds.** { *** Companion; }
-keepclasseswithmembers class com.flotadsp.fds.** { kotlinx.serialization.KSerializer serializer(...); }

# OkHttp
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# osmdroid
-dontwarn org.osmdroid.**
