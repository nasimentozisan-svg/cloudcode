#!/usr/bin/env bash
# EFK CAMERA: Secrets 混入チェック（CI とローカルの両方で実行する）
#
# 外部サービスに依存しない自前のゲート。
# ここが通らない限り main にマージできないようにする。
set -uo pipefail

fail=0
note() { printf '  %s\n' "$1"; }
ng()   { printf '\033[31mNG\033[0m %s\n' "$1"; fail=1; }
ok()   { printf '\033[32mOK\033[0m %s\n' "$1"; }

echo "== 1. コミットしてはいけないファイルが追跡されていないか =="
forbidden=$(git ls-files | grep -E \
  '(^|/)(local\.properties|keystore\.properties|google-services\.json)$|\.(jks|keystore|p12|pem)$|client_secret.*\.json$|service-account.*\.json$|(^|/)\.env($|\.)' \
  || true)
if [ -n "$forbidden" ]; then
  ng "秘密情報になりうるファイルが追跡されています:"
  echo "$forbidden" | while read -r f; do note "$f"; done
else
  ok "追跡禁止ファイルはありません"
fi

echo
echo "== 2. ソース内に Credential らしき文字列がないか =="
# 追跡ファイルのみを対象にする（build/ などは見ない）
patterns=(
  'ya29\.[A-Za-z0-9_-]{20,}'          # OAuth アクセストークン
  '1//[A-Za-z0-9_-]{20,}'             # リフレッシュトークン
  'AIza[A-Za-z0-9_-]{30,}'            # Google API キー
  '-----BEGIN [A-Z ]*PRIVATE KEY-----' # 秘密鍵
  '"type"[[:space:]]*:[[:space:]]*"service_account"'
  'client_secret"[[:space:]]*:[[:space:]]*"[^"]{10,}'
)
# このルール自体を「説明している」ファイルは対象外にする。
# （検査パターンを本文に書いてあるだけで実際の秘密情報ではないため）
# これらのファイルも GitHub の Secret scanning / Push protection では検査されます。
allowlist=(
  'scripts/check-secrets.sh'
  'app/src/main/java/jp/efk/camera/util/Redactor.kt'
  'app/src/test/java/jp/efk/camera/RedactorTest.kt'
  'SECURITY.md'
  'docs/EFK_CAMERA_v1_技術設計書.md'
)
exclude_re=$(IFS='|'; echo "^(${allowlist[*]}):")

hits=0
for p in "${patterns[@]}"; do
  found=$(git ls-files -z \
    | xargs -0 grep -InE -- "$p" 2>/dev/null \
    | grep -vE "$exclude_re" \
    || true)
  if [ -n "$found" ]; then
    ng "パターン '$p' に一致しました:"
    echo "$found" | while read -r l; do note "$l"; done
    hits=1
  fi
done
[ "$hits" -eq 0 ] && ok "Credential らしき文字列はありません"

echo
echo "== 3. ログ出力が SafeLog 経由になっているか =="
# android.util.Log を直接使うと、トークンやURLが素のままログに残りうる
raw=$(git ls-files '*.kt' \
  | grep -v 'util/SafeLog.kt' \
  | xargs grep -InE '(^|[^a-zA-Z])Log\.(v|d|i|w|e)\(' 2>/dev/null || true)
if [ -n "$raw" ]; then
  ng "android.util.Log を直接呼んでいる箇所があります（SafeLog を使ってください）:"
  echo "$raw" | while read -r l; do note "$l"; done
else
  ok "ログ出力はすべて SafeLog 経由です"
fi

echo
if [ "$fail" -ne 0 ]; then
  echo "Secrets チェックに失敗しました。"
  exit 1
fi
echo "Secrets チェックはすべて通過しました。"
