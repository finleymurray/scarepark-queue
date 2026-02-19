#!/bin/bash -e

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
CONFIG="/boot/firmware/config.txt"
[ ! -f "$CONFIG" ] && CONFIG="/boot/config.txt"
if [ -f "$CONFIG" ]; then
  if ! grep -q "^gpu_mem=" "$CONFIG" 2>/dev/null; then
    echo "gpu_mem=128" >> "$CONFIG"
  fi
  if ! grep -q "^disable_splash=" "$CONFIG" 2>/dev/null; then
    echo "disable_splash=1" >> "$CONFIG"
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
