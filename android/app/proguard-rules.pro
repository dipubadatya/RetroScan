# ─── RetroScan ProGuard Rules ─────────────────────────────────────────────────
# Added for: react-native-vision-camera v3 ML Kit code scanner (Step 7)

# ML Kit barcode/QR scanning classes
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# Vision Camera native module
-keep class com.mrousavy.camera.** { *; }
-dontwarn com.mrousavy.camera.**

# Worklets Core (peer dep of VisionCamera v3)
-keep class com.swmansion.worklets.** { *; }
-dontwarn com.swmansion.worklets.**

# React Native base rules
-keep class com.facebook.react.** { *; }
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
}
