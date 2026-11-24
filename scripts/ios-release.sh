#!/usr/bin/env bash
# BKNY iOS: arşivle ve App Store Connect'e (TestFlight) yükle. Mac + Xcode gerekir.
# Kullanım (proje kökünde):   ./scripts/ios-release.sh            → build numarası otomatik (zaman damgası)
#                             BUILD=7 ./scripts/ios-release.sh     → build numarasını elle ver
# Önkoşul: Xcode → Settings → Accounts'ta Apple Developer hesabın ekli olmalı (imza için).
set -euo pipefail

TEAM_ID="${TEAM_ID:-2FJ93AW33K}"
SCHEME="${SCHEME:-App}"
PROJECT="ios/App/App.xcodeproj"
BUILD="${BUILD:-$(date +%y%m%d%H%M)}"
OUT="build/ios"
ARCHIVE="$OUT/App.xcarchive"

cd "$(dirname "$0")/.."

echo "▶ Web varlıkları ve eklentiler eşitleniyor (cap sync ios)…"
npx cap sync ios

mkdir -p "$OUT"
rm -rf "$ARCHIVE"

echo "▶ Arşivleniyor (Team $TEAM_ID, build $BUILD)… Bu birkaç dakika sürebilir."
xcodebuild archive \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$TEAM_ID" \
  CODE_SIGN_STYLE=Automatic \
  CURRENT_PROJECT_VERSION="$BUILD"

cat > "$OUT/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
</dict>
</plist>
PLIST

echo "▶ App Store Connect'e yükleniyor…"
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$OUT/ExportOptions.plist" \
  -exportPath "$OUT/export" \
  -allowProvisioningUpdates

echo "✔ Yükleme tamam (build $BUILD). 10–30 dk sonra App Store Connect → BKNY → TestFlight'ta görünür."
