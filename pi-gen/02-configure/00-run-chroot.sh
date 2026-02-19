#!/bin/bash -e

# ── Wi-Fi Configuration (NetworkManager) ──────────────────────────
# Reads credentials from pi-gen/wifi.conf (not committed to git)
# Create wifi.conf with: WIFI_SSID=YourNetwork and WIFI_PASS=YourPassword
WIFI_CONF="/boot/firmware/wifi.conf"
[ ! -f "$WIFI_CONF" ] && WIFI_CONF="/tmp/wifi.conf"
if [ -f "$WIFI_CONF" ]; then
  . "$WIFI_CONF"
  if [ -n "$WIFI_SSID" ] && [ -n "$WIFI_PASS" ]; then
    mkdir -p /etc/NetworkManager/system-connections
    cat > "/etc/NetworkManager/system-connections/${WIFI_SSID}.nmconnection" << NMEOF
[connection]
id=${WIFI_SSID}
type=wifi
autoconnect=true

[wifi]
mode=infrastructure
ssid=${WIFI_SSID}

[wifi-security]
key-mgmt=wpa-psk
psk=${WIFI_PASS}

[ipv4]
method=auto

[ipv6]
method=auto
NMEOF
    chmod 600 "/etc/NetworkManager/system-connections/${WIFI_SSID}.nmconnection"
  fi
fi

# Create kiosk user if it doesn't exist
if ! id "kiosk" >/dev/null 2>&1; then
  useradd -m -s /bin/bash kiosk
fi
usermod -aG video,audio,input,tty kiosk

# Set ownership of kiosk home files
chown -R kiosk:kiosk /home/kiosk

# Enable kiosk service
systemctl enable kiosk.service

# Enable SSH
systemctl enable ssh

# Set Plymouth theme
plymouth-set-default-theme immersive-core 2>/dev/null || true

# GPU memory — 128MB for Chromium rendering
# Inside chroot, /boot/firmware may or may not exist depending on pi-gen version
CONFIG="/boot/firmware/config.txt"
[ ! -f "$CONFIG" ] && CONFIG="/boot/config.txt"
if [ -f "$CONFIG" ]; then
  if ! grep -q "^gpu_mem=" "$CONFIG" 2>/dev/null; then
    echo "gpu_mem=128" >> "$CONFIG"
  fi
  if ! grep -q "^disable_splash=" "$CONFIG" 2>/dev/null; then
    echo "disable_splash=1" >> "$CONFIG"
  fi
  if ! grep -q "^hdmi_force_hotplug=" "$CONFIG" 2>/dev/null; then
    echo "hdmi_force_hotplug=1" >> "$CONFIG"
  fi
fi

# Boot cmdline tweaks — splash, hide cursor, quiet boot
CMDLINE="/boot/firmware/cmdline.txt"
[ ! -f "$CMDLINE" ] && CMDLINE="/boot/cmdline.txt"
if [ -f "$CMDLINE" ]; then
  if ! grep -q "splash" "$CMDLINE"; then
    sed -i 's/$/ splash quiet/' "$CMDLINE"
  fi
  sed -i 's/console=tty1//' "$CMDLINE"
  if ! grep -q "vt.global_cursor_default=0" "$CMDLINE"; then
    sed -i 's/$/ vt.global_cursor_default=0/' "$CMDLINE"
  fi
fi
