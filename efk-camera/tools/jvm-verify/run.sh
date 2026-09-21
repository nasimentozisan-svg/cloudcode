#!/usr/bin/env bash
# Android SDK が使えない環境で、コンパイルと Unit Test だけを検証する。
# 正式な検証は ./gradlew lintDebug testDebugUnitTest assembleDebug（= CI）。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CACHE="$ROOT/.jvm-verify-cache"
STUBS="$ROOT/tools/jvm-verify/stubs"
SRC="$ROOT/app/src"
KOTLIN_VERSION=2.0.21
ANDROID_ALL=15-robolectric-13954326
MC=https://repo1.maven.org/maven2

mkdir -p "$CACHE/lib"

fetch() { # fetch <url> <出力先>
  [ -s "$2" ] && return 0
  echo "  取得: $(basename "$2")"
  curl -sSL --fail -o "$2" "$1"
}

echo "== 依存物を用意 =="
if [ ! -x "$CACHE/kotlinc/bin/kotlinc" ]; then
  fetch "https://github.com/JetBrains/kotlin/releases/download/v$KOTLIN_VERSION/kotlin-compiler-$KOTLIN_VERSION.zip" "$CACHE/kc.zip"
  (cd "$CACHE" && unzip -q -o kc.zip && rm -f kc.zip && chmod +x kotlinc/bin/*)
fi
fetch "$MC/org/robolectric/android-all/$ANDROID_ALL/android-all-$ANDROID_ALL.jar" "$CACHE/android-all.jar"
fetch "$MC/org/nanohttpd/nanohttpd/2.3.1/nanohttpd-2.3.1.jar"                      "$CACHE/lib/nanohttpd.jar"
fetch "$MC/com/squareup/okhttp3/okhttp/4.12.0/okhttp-4.12.0.jar"                   "$CACHE/lib/okhttp.jar"
fetch "$MC/com/squareup/okio/okio-jvm/3.6.0/okio-jvm-3.6.0.jar"                    "$CACHE/lib/okio.jar"
fetch "$MC/org/json/json/20231013/json-20231013.jar"                               "$CACHE/lib/json.jar"
fetch "$MC/org/jetbrains/kotlinx/kotlinx-coroutines-core-jvm/1.8.1/kotlinx-coroutines-core-jvm-1.8.1.jar" "$CACHE/lib/coroutines.jar"
fetch "$MC/com/google/zxing/core/3.5.3/core-3.5.3.jar"                             "$CACHE/lib/zxing.jar"
fetch "$MC/com/google/guava/guava/33.3.1-android/guava-33.3.1-android.jar"         "$CACHE/lib/guava.jar"
fetch "$MC/junit/junit/4.13.2/junit-4.13.2.jar"                                    "$CACHE/lib/junit.jar"
fetch "$MC/org/hamcrest/hamcrest-core/1.3/hamcrest-core-1.3.jar"                   "$CACHE/lib/hamcrest.jar"

# R クラスはレイアウトから生成する（実ビルドと同じ id が揃っているかの確認も兼ねる）
mkdir -p "$CACHE/gen"
{
  echo "package jp.efk.camera"
  echo "object R {"
  echo "    object layout { const val activity_main = 1 }"
  echo "    object id {"
  grep -ohE 'android:id="@\+id/[A-Za-z0-9_]+"' "$SRC/main/res/layout/"*.xml \
    | sed 's/.*id\///;s/"//' | sort -u | awk '{printf "        const val %s = %d\n", $1, NR+100}'
  echo "    }"
  echo "}"
} > "$CACHE/gen/R.kt"

KOTLINC="$CACHE/kotlinc/bin/kotlinc"
CP="$(ls "$CACHE"/lib/*.jar | tr '\n' ':')$CACHE/android-all.jar"

echo
echo "== 本体をコンパイル =="
"$KOTLINC" -nowarn -jvm-target 17 -cp "$CP" -d "$CACHE/main.jar" \
  "$STUBS"/*.kt "$CACHE/gen/R.kt" \
  $(find "$SRC/main/java" -name '*.kt')
echo "  OK"

echo
echo "== テストをコンパイル =="
"$KOTLINC" -nowarn -jvm-target 17 -cp "$CACHE/main.jar:$CP" -d "$CACHE/test.jar" \
  $(find "$SRC/test/java" -name '*.kt')
echo "  OK"

echo
echo "== テストを実行 =="
TESTS=$(find "$SRC/test/java" -name '*Test.kt' -exec basename {} .kt \; | sed 's/^/jp.efk.camera./' | tr '\n' ' ')
java -cp "$CACHE/main.jar:$CACHE/test.jar:$CP:$CACHE/kotlinc/lib/kotlin-stdlib.jar" \
  org.junit.runner.JUnitCore $TESTS
