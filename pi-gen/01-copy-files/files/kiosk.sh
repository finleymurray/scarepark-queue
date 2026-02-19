#!/bin/bash
# Immersive Core Kiosk Launcher
# Launched by kiosk.service via xinit

# Disable screen blanking and DPMS
xset s off
xset s noblank
xset -dpms

# Hide cursor after 0.5s of inactivity
unclutter -idle 0.5 -root &

# Start minimal window manager (needed for Chromium --kiosk fullscreen)
openbox --config-file /dev/null &

# Wait for network (max 30s)
for i in $(seq 1 30); do
  if ping -c1 -W1 8.8.8.8 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Clear Chromium crash flags (prevents "restore session" bar)
CHROMIUM_DIR="/home/kiosk/.config/chromium"
mkdir -p "${CHROMIUM_DIR}/Default"
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "${CHROMIUM_DIR}/Default/Preferences" 2>/dev/null || true
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "${CHROMIUM_DIR}/Default/Preferences" 2>/dev/null || true

# Detect chromium binary
CHROMIUM_BIN=$(command -v chromium-browser 2>/dev/null || command -v chromium 2>/dev/null || echo "/usr/bin/chromium")

# Launch Chromium
exec $CHROMIUM_BIN \
  --noerrdialogs \
  --disable-infobars \
  --kiosk \
  --no-first-run \
  --no-default-browser-check \
  --disable-sync \
  --disable-translate \
  --disable-features=TranslateUI \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --check-for-update-interval=31536000 \
  --disable-component-update \
  --disable-session-crashed-bubble \
  --disable-gpu-compositing \
  --autoplay-policy=no-user-gesture-required \
  --start-fullscreen \
  "https://control.immersivecore.network/screen"
