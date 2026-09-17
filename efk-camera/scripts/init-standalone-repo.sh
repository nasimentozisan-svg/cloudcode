#!/usr/bin/env bash
# EFK CAMERA を専用リポジトリへ切り出すスクリプト。
#
# いまは作業の都合で cloudcode リポジトリの efk-camera/ 配下に置いてあります。
# ご指示どおり専用リポジトリで独立管理するために、これを実行してください。
#
# 【事前にやること】
#   1. https://github.com/new を開く
#   2. Repository name: efk-camera
#   3. Visibility: Private  ← 推奨
#   4. 「Add a README file」「Add .gitignore」「Choose a license」は
#      すべて **チェックを外す**（空のリポジトリを作る）
#   5. 「Create repository」
#
# 【使い方】
#   bash scripts/init-standalone-repo.sh [GitHubユーザー名]
#
set -euo pipefail

OWNER="${1:-nasimentozisan-svg}"
REPO="efk-camera"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)/${REPO}"

echo "コピー元 : $SRC"
echo "作業場所 : $WORK"
echo "作成先   : https://github.com/${OWNER}/${REPO}"
echo

mkdir -p "$WORK"
# .git / ビルド成果物は持っていかない
tar -C "$SRC" \
    --exclude=./.git \
    --exclude=./build \
    --exclude=./app/build \
    --exclude=./.gradle \
    --exclude=./.idea \
    --exclude='./*.jks' \
    --exclude=./keystore.properties \
    --exclude=./local.properties \
    -cf - . | tar -C "$WORK" -xf -

cd "$WORK"
chmod +x gradlew scripts/*.sh

echo "== Secrets チェック =="
git init -q -b main
git add -A
bash scripts/check-secrets.sh

git -c user.name="EFK" -c user.email="efk@example.invalid" \
    commit -q -m "EFK CAMERA v1 初版

KYV47での固定カメラ撮影、同一LAN内のブラウザからの遠隔操作、
YouTube自動アップロードと安全な元動画削除までを実装。"

git remote add origin "https://github.com/${OWNER}/${REPO}.git"

cat <<MSG

準備ができました。次のコマンドで push してください。

  cd $WORK
  git push -u origin main

push 後、GitHub で以下を設定してください（README / SECURITY.md 参照）。

  1. Settings → Code security → Secret scanning / Push protection を Enable
  2. Settings → Branches → main にブランチ保護
       - Require a pull request before merging
       - Require status checks: 「Secret 混入チェック」「ビルド / テスト / Lint」
  3. Settings → Secrets and variables → Actions に署名鍵の4件を登録（リリース時のみ必要）

MSG
