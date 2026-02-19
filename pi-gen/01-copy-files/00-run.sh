#!/bin/bash -e

# Create kiosk user home
install -d "${ROOTFS_DIR}/home/kiosk"

# Kiosk launcher script
install -m 755 files/kiosk.sh "${ROOTFS_DIR}/home/kiosk/kiosk.sh"

# Systemd service
install -m 644 files/kiosk.service "${ROOTFS_DIR}/lib/systemd/system/kiosk.service"

# Auto-login fallback
install -d "${ROOTFS_DIR}/etc/systemd/system/getty@tty1.service.d"
install -m 644 files/autologin.conf "${ROOTFS_DIR}/etc/systemd/system/getty@tty1.service.d/autologin.conf"

# X11 wrapper config (allow non-console users to start X)
install -d "${ROOTFS_DIR}/etc/X11"
install -m 644 files/Xwrapper.config "${ROOTFS_DIR}/etc/X11/Xwrapper.config"

# Disable screen blanking
install -m 644 files/disable-blanking.sh "${ROOTFS_DIR}/etc/profile.d/disable-blanking.sh"

# Plymouth theme
install -d "${ROOTFS_DIR}/usr/share/plymouth/themes/immersive-core"
install -m 644 files/immersive-core.plymouth "${ROOTFS_DIR}/usr/share/plymouth/themes/immersive-core/immersive-core.plymouth"
install -m 644 files/immersive-core.script "${ROOTFS_DIR}/usr/share/plymouth/themes/immersive-core/immersive-core.script"
install -m 644 files/splash.png "${ROOTFS_DIR}/usr/share/plymouth/themes/immersive-core/splash.png"

# Unique hostname generator (runs once on first boot)
install -m 755 files/set-hostname.sh "${ROOTFS_DIR}/usr/local/bin/set-hostname.sh"
install -m 644 files/set-hostname.service "${ROOTFS_DIR}/lib/systemd/system/set-hostname.service"

# Copy Wi-Fi config if present (wifi.conf is gitignored)
if [ -f files/wifi.conf ]; then
  install -m 600 files/wifi.conf "${ROOTFS_DIR}/tmp/wifi.conf"
fi
