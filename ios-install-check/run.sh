#!/usr/bin/env bash
# Acceptance 1 on iPhone: adds the live app to the home screen of an iOS
# Simulator through Safari's Share → Add to Home Screen, then opens it from the
# home screen and checks it runs standalone. macOS only; needs Xcode and
# XcodeGen (`brew install xcodegen`). LIVE_URL defaults to the Pages URL.
set -euo pipefail
cd "$(dirname "$0")"
LIVE_URL="${LIVE_URL:-https://nfdzgg.github.io/Progressive-Overload-Tracker/}"

xcodebuild -version
SDK=$(xcrun --sdk iphonesimulator --show-sdk-version)
# Newest iOS runtime the selected Xcode supports, first iPhone (not SE) on it.
UDID=$(xcrun simctl list devices available -j | python3 -c '
import json, sys
sdk = tuple(int(p) for p in sys.argv[1].split(".")[:2])
best = None
for runtime, devices in json.load(sys.stdin)["devices"].items():
    if ".iOS-" not in runtime:
        continue
    version = tuple(int(p) for p in runtime.split(".iOS-")[1].split("-")[:2])
    if version > sdk:
        continue
    for d in devices:
        if d["name"].startswith("iPhone") and " SE" not in d["name"]:
            if best is None or version > best[0]:
                best = (version, d["udid"], d["name"], runtime)
            break
if best is None:
    sys.exit("no iPhone simulator for iOS " + sys.argv[1])
print(best[1])
print("Simulator:", best[2], best[3], file=sys.stderr)
' "$SDK")

xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b
# Warm up Safari on the live URL: its first launch on a fresh simulator can
# outlast XCTest's app launch timeout, and iOS 26 shows a one-time tip about
# the ••• menu on the first page load.
xcrun simctl openurl "$UDID" "$LIVE_URL"
sleep 45
xcrun simctl terminate "$UDID" com.apple.mobilesafari 2>/dev/null || true
xcodegen generate
rm -rf build/InstallCheck.xcresult

status=0
TEST_RUNNER_LIVE_URL="$LIVE_URL" xcodebuild test \
  -project InstallCheck.xcodeproj \
  -scheme Host \
  -destination "id=$UDID" \
  -derivedDataPath build/DerivedData \
  -resultBundlePath build/InstallCheck.xcresult \
  -test-timeouts-enabled YES \
  -maximum-test-execution-time-allowance 900 || status=$?

# The simulator screen at the end, also printed to the log.
if xcrun simctl io "$UDID" screenshot build/final.png >/dev/null 2>&1 &&
  sips -Z 844 -s format jpeg -s formatOptions 60 build/final.png --out build/final.jpg >/dev/null; then
  echo "IOS_SCREENSHOT final-screen $(base64 -i build/final.jpg | tr -d '\n')"
fi
exit "$status"
