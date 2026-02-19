#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# Immersive Core — Raspberry Pi Kiosk Setup
# ═══════════════════════════════════════════════════════════════════
#
# Transforms a fresh Raspberry Pi OS Lite into an Immersive Core
# display kiosk. Run once after flashing, reboot, and it's ready.
#
# Usage:
#   sudo bash setup-kiosk.sh [options]
#
# Options:
#   --url URL           Base URL (default: https://immersivecore.network)
#   --hostname NAME     Set Pi hostname (default: ic-kiosk)
#   --rotate DEGREES    Display rotation: 0, 90, 180, 270 (default: 0)
#
# ═══════════════════════════════════════════════════════════════════

# ── Defaults ──
KIOSK_URL="https://immersivecore.network"
KIOSK_HOSTNAME="ic-kiosk"
KIOSK_ROTATE=0
KIOSK_USER="kiosk"

# ── Parse arguments ──
while [[ $# -gt 0 ]]; do
  case $1 in
    --url)      KIOSK_URL="$2"; shift 2 ;;
    --hostname) KIOSK_HOSTNAME="$2"; shift 2 ;;
    --rotate)   KIOSK_ROTATE="$2"; shift 2 ;;
    *)          echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo ""
echo "═══════════════════════════════════════════"
echo "  IMMERSIVE CORE — Pi Kiosk Setup"
echo "═══════════════════════════════════════════"
echo ""
echo "  URL:      ${KIOSK_URL}/screen"
echo "  Hostname: ${KIOSK_HOSTNAME}"
echo "  Rotation: ${KIOSK_ROTATE}°"
echo ""

# ── Must be root ──
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Please run with sudo"
  exit 1
fi

# ── 1. System update + packages ──
echo "[1/8] Installing packages..."
apt-get update -qq

# Install base packages first (these always exist)
apt-get install -y \
  xserver-xorg x11-xserver-utils xinit \
  unclutter \
  plymouth plymouth-themes \
  sed || {
    echo "ERROR: Base package install failed!"
    exit 1
  }

# Install chromium — try 'chromium' first (newer Pi OS), fall back to 'chromium-browser'
if apt-get install -y chromium 2>/dev/null; then
  CHROMIUM_PKG="chromium"
elif apt-get install -y chromium-browser 2>/dev/null; then
  CHROMIUM_PKG="chromium-browser"
else
  echo "ERROR: Could not install chromium or chromium-browser!"
  exit 1
fi
echo "  Chromium installed as: $CHROMIUM_PKG"

echo "  Packages installed OK"

# ── 2. Create kiosk user ──
echo "[2/8] Setting up kiosk user..."
if ! id "${KIOSK_USER}" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "${KIOSK_USER}"
  echo "  Created user: ${KIOSK_USER}"
else
  echo "  User ${KIOSK_USER} already exists"
fi
# Add to necessary groups
usermod -aG video,audio,input,tty "${KIOSK_USER}"

# ── 3. Set hostname ──
echo "[3/8] Setting hostname to ${KIOSK_HOSTNAME}..."
hostnamectl set-hostname "${KIOSK_HOSTNAME}" 2>/dev/null || {
  echo "${KIOSK_HOSTNAME}" > /etc/hostname
  sed -i "s/127.0.1.1.*/127.0.1.1\t${KIOSK_HOSTNAME}/" /etc/hosts
}

# ── 4. Enable SSH ──
echo "[4/8] Enabling SSH..."
systemctl enable ssh 2>/dev/null || true
systemctl start ssh 2>/dev/null || true

# ── 5. GPU memory + display config ──
echo "[5/8] Configuring display..."
CONFIG="/boot/config.txt"
# Fallback for newer Pi OS
[ ! -f "$CONFIG" ] && CONFIG="/boot/firmware/config.txt"

if [ -f "$CONFIG" ]; then
  # GPU memory — 128MB for Chromium rendering
  if ! grep -q "^gpu_mem=" "$CONFIG" 2>/dev/null; then
    echo "gpu_mem=128" >> "$CONFIG"
  else
    sed -i 's/^gpu_mem=.*/gpu_mem=128/' "$CONFIG"
  fi

  # Disable rainbow splash
  if ! grep -q "^disable_splash=" "$CONFIG" 2>/dev/null; then
    echo "disable_splash=1" >> "$CONFIG"
  else
    sed -i 's/^disable_splash=.*/disable_splash=1/' "$CONFIG"
  fi

  # Display rotation
  if [ "$KIOSK_ROTATE" != "0" ]; then
    if ! grep -q "^display_rotate=" "$CONFIG" 2>/dev/null; then
      echo "display_rotate=${KIOSK_ROTATE}" >> "$CONFIG"
    else
      sed -i "s/^display_rotate=.*/display_rotate=${KIOSK_ROTATE}/" "$CONFIG"
    fi
  fi
  echo "  Config: $CONFIG updated"
else
  echo "  WARNING: No config.txt found, skipping display config"
fi

# ── 6. Plymouth boot splash ──
echo "[6/8] Installing boot splash..."
PLYMOUTH_DIR="/usr/share/plymouth/themes/immersive-core"
mkdir -p "${PLYMOUTH_DIR}"

# Copy splash image
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "${SCRIPT_DIR}/splash.png" ]; then
  cp "${SCRIPT_DIR}/splash.png" "${PLYMOUTH_DIR}/splash.png"
  echo "  Splash image copied"
else
  echo "  WARNING: splash.png not found in ${SCRIPT_DIR}"
fi

# Create Plymouth theme
cat > "${PLYMOUTH_DIR}/immersive-core.plymouth" << 'PLYMOUTHEOF'
[Plymouth Theme]
Name=Immersive Core
Description=Immersive Core kiosk boot splash
ModuleName=script

[script]
ImageDir=/usr/share/plymouth/themes/immersive-core
ScriptFile=/usr/share/plymouth/themes/immersive-core/immersive-core.script
PLYMOUTHEOF

cat > "${PLYMOUTH_DIR}/immersive-core.script" << 'SCRIPTEOF'
# Immersive Core Plymouth Script — black background + centered logo

Window.SetBackgroundTopColor(0, 0, 0);
Window.SetBackgroundBottomColor(0, 0, 0);

logo_image = Image("splash.png");
logo_sprite = Sprite(logo_image);

# Scale to fit screen while maintaining aspect ratio
screen_width = Window.GetWidth();
screen_height = Window.GetHeight();
image_width = logo_image.GetWidth();
image_height = logo_image.GetHeight();

scale_x = screen_width / image_width;
scale_y = screen_height / image_height;
scale = Math.Min(scale_x, scale_y) * 0.6;

scaled_width = image_width * scale;
scaled_height = image_height * scale;

logo_sprite.SetX(screen_width / 2 - scaled_width / 2);
logo_sprite.SetY(screen_height / 2 - scaled_height / 2);
logo_sprite.SetImage(logo_image.Scale(scaled_width, scaled_height));
SCRIPTEOF

# Set as default theme
plymouth-set-default-theme immersive-core 2>/dev/null || true

# Enable plymouth in boot
CMDLINE="/boot/cmdline.txt"
[ ! -f "$CMDLINE" ] && CMDLINE="/boot/firmware/cmdline.txt"
if [ -f "$CMDLINE" ]; then
  # Add splash + quiet if not present
  if ! grep -q "splash" "$CMDLINE"; then
    sed -i 's/$/ splash quiet/' "$CMDLINE"
  fi
  # Remove console=tty1 to hide boot text
  sed -i 's/console=tty1//' "$CMDLINE"
  # Add vt.global_cursor_default=0 to hide cursor
  if ! grep -q "vt.global_cursor_default=0" "$CMDLINE"; then
    sed -i 's/$/ vt.global_cursor_default=0/' "$CMDLINE"
  fi
  echo "  Boot cmdline updated"
else
  echo "  WARNING: No cmdline.txt found"
fi

# ── 7. Kiosk X session + Chromium ──
echo "[7/8] Creating kiosk service..."

# Detect chromium binary path
CHROMIUM_BIN=$(command -v chromium-browser 2>/dev/null || command -v chromium 2>/dev/null || echo "/usr/bin/chromium")
echo "  Chromium binary: $CHROMIUM_BIN"

# Chromium kiosk startup script
KIOSK_HOME="/home/${KIOSK_USER}"
cat > "${KIOSK_HOME}/kiosk.sh" << KIOSKEOF
#!/bin/bash
# Immersive Core Kiosk Launcher
# Launches Chromium in fullscreen kiosk mode pointing to /screen

# Disable screen blanking and DPMS
xset s off
xset s noblank
xset -dpms

# Hide cursor after 0.5s of inactivity
unclutter -idle 0.5 -root &

# Wait for network (max 30s)
for i in \$(seq 1 30); do
  if ping -c1 -W1 8.8.8.8 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Clear Chromium crash flags (prevents "restore session" bar)
CHROMIUM_DIR="${KIOSK_HOME}/.config/chromium"
mkdir -p "\${CHROMIUM_DIR}/Default"
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "\${CHROMIUM_DIR}/Default/Preferences" 2>/dev/null || true
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "\${CHROMIUM_DIR}/Default/Preferences" 2>/dev/null || true

# Launch Chromium
exec ${CHROMIUM_BIN} \\
  --noerrdialogs \\
  --disable-infobars \\
  --kiosk \\
  --incognito \\
  --disable-translate \\
  --disable-features=TranslateUI \\
  --disable-pinch \\
  --overscroll-history-navigation=0 \\
  --check-for-update-interval=31536000 \\
  --disable-component-update \\
  --disable-session-crashed-bubble \\
  --disable-gpu-compositing \\
  --enable-features=OverlayScrollbar \\
  --autoplay-policy=no-user-gesture-required \\
  --start-fullscreen \\
  "${KIOSK_URL}/screen"
KIOSKEOF

chmod +x "${KIOSK_HOME}/kiosk.sh"
chown "${KIOSK_USER}:${KIOSK_USER}" "${KIOSK_HOME}/kiosk.sh"

# Systemd service for auto-starting X + kiosk
cat > /etc/systemd/system/kiosk.service << SERVICEEOF
[Unit]
Description=Immersive Core Kiosk
Wants=network-online.target
After=network-online.target

[Service]
User=${KIOSK_USER}
Group=${KIOSK_USER}
Type=simple
ExecStart=/usr/bin/xinit ${KIOSK_HOME}/kiosk.sh -- :0 -nolisten tcp vt7
Restart=on-failure
RestartSec=5

# Environment for X
Environment=DISPLAY=:0
Environment=XAUTHORITY=${KIOSK_HOME}/.Xauthority

[Install]
WantedBy=multi-user.target
SERVICEEOF

systemctl daemon-reload
systemctl enable kiosk.service
echo "  Kiosk service created and enabled"

# Auto-login on tty1 (backup if systemd service fails)
mkdir -p /etc/systemd/system/getty@tty1.service.d
cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf << LOGINEOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin ${KIOSK_USER} --noclear %I \$TERM
LOGINEOF

# ── 8. Disable screen blanking globally ──
echo "[8/8] Final configuration..."

# Disable screen blanking in console
cat > /etc/profile.d/disable-blanking.sh << 'BLANKEOF'
# Disable screen blanking for kiosk
setterm -blank 0 -powerdown 0 2>/dev/null || true
BLANKEOF

# Disable Wi-Fi power management (prevents drops)
if [ -d /etc/NetworkManager ]; then
  cat > /etc/NetworkManager/conf.d/wifi-powersave.conf << 'WIFIEOF'
[connection]
wifi.powersave = 2
WIFIEOF
fi

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Setup complete!"
echo "═══════════════════════════════════════════"
echo ""
echo "  Next steps:"
echo "  1. Reboot: sudo reboot"
echo "  2. Pi will show Immersive Core splash, then"
echo "     auto-launch Chromium → ${KIOSK_URL}/screen"
echo "  3. Enter the code shown on-screen in Admin → Screens"
echo ""
echo "  SSH into this Pi:  ssh pi@${KIOSK_HOSTNAME}.local"
echo ""
