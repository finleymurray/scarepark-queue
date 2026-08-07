#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
# Immersive Core — FullPageOS Pi Setup Script
# Run this via SSH after flashing FullPageOS:
#   ssh pi@<ip> 'bash -s' < setup-fullpageos.sh
# ─────────────────────────────────────────────────────────────────────
set -e

echo "=== Immersive Core Pi Setup ==="

# ── 1. Unique hostname from MAC address ──────────────────────────────
MAC=$(cat /sys/class/net/wlan0/address | tr -d ':' | tail -c 5)
HOSTNAME="ic-kiosk-${MAC}"
echo "Setting hostname to ${HOSTNAME}..."
sudo hostnamectl set-hostname "${HOSTNAME}"
sudo sed -i "s/127.0.1.1.*/127.0.1.1\t${HOSTNAME}/" /etc/hosts

# ── 2. Hardware watchdog (auto-reboot on freeze) ─────────────────────
echo "Installing and configuring watchdog..."
sudo apt-get update -qq
sudo apt-get install -y -qq watchdog
sudo sed -i 's/#watchdog-device/watchdog-device/' /etc/watchdog.conf
sudo sed -i 's/#max-load-1/max-load-1/' /etc/watchdog.conf
sudo systemctl enable watchdog
sudo systemctl start watchdog

# Add watchdog to boot config if not present
if ! grep -q "dtparam=watchdog=on" /boot/firmware/config.txt 2>/dev/null; then
  echo "dtparam=watchdog=on" | sudo tee -a /boot/firmware/config.txt > /dev/null
fi

# ── 3. HDMI force hotplug (reliable display output) ──────────────────
if ! grep -q "hdmi_force_hotplug=1" /boot/firmware/config.txt 2>/dev/null; then
  echo "hdmi_force_hotplug=1" | sudo tee -a /boot/firmware/config.txt > /dev/null
fi

# ── 4. GPU memory ────────────────────────────────────────────────────
if grep -q "^gpu_mem=" /boot/firmware/config.txt 2>/dev/null; then
  sudo sed -i 's/^gpu_mem=.*/gpu_mem=128/' /boot/firmware/config.txt
else
  echo "gpu_mem=128" | sudo tee -a /boot/firmware/config.txt > /dev/null
fi

# ── 5. Fix Chromium crash recovery + optimised flags ─────────────────
echo "Patching Chromium startup script..."
sudo tee /opt/custompios/scripts/start_chromium_browser > /dev/null << 'CHROMEOF'
#!/bin/bash

# Clean stale Chromium lock files from unclean shutdown
rm -f /home/pi/.config/chromium/SingletonLock
rm -f /home/pi/.config/chromium/SingletonCookie
rm -f /home/pi/.config/chromium/SingletonSocket

# Mark previous session as clean to prevent "restore pages" dialog
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' /home/pi/.config/chromium/Default/Preferences 2>/dev/null
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' /home/pi/.config/chromium/Default/Preferences 2>/dev/null

flags=(
   --kiosk
   --touch-events=enabled
   --disable-pinch
   --noerrdialogs
   --disable-session-crashed-bubble
   --simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT'
   --disable-component-update
   --overscroll-history-navigation=0
   --disable-features=TranslateUI
   --autoplay-policy=no-user-gesture-required
   --no-first-run
   --no-default-browser-check
   --disable-sync
   --disable-dev-shm-usage
   --disable-extensions
   --disable-webgl
   --disable-background-networking
   --disable-breakpad
   --disable-smooth-scrolling
)

# Standard behavior - runs chromium
chromium-browser "${flags[@]}" --app=$(/opt/custompios/scripts/get_url)
CHROMEOF
sudo chmod +x /opt/custompios/scripts/start_chromium_browser

# ── 6. Set kiosk URL ─────────────────────────────────────────────────
echo "https://corelink.immersivecore.network/screen?hostname=${HOSTNAME}" | sudo tee /boot/firmware/fullpageos.txt > /dev/null

# ── 7. Disable unnecessary services (free RAM & CPU) ─────────────────
echo "Disabling unnecessary services..."
sudo systemctl disable bluetooth 2>/dev/null && sudo systemctl stop bluetooth 2>/dev/null || true
sudo systemctl disable cups 2>/dev/null && sudo systemctl stop cups 2>/dev/null || true
sudo systemctl disable avahi-daemon 2>/dev/null || true
sudo systemctl disable triggerhappy 2>/dev/null && sudo systemctl stop triggerhappy 2>/dev/null || true

# ── 8. Increase swap (safety net for heavy pages) ────────────────────
echo "Increasing swap to 1GB..."
sudo dphys-swapfile swapoff
sudo sed -i 's/CONF_SWAPSIZE=.*/CONF_SWAPSIZE=1024/' /etc/dphys-swapfile
sudo dphys-swapfile setup
sudo dphys-swapfile swapon

# ── 9. Disable screen blanking & power management ────────────────────
echo "Disabling screen blanking..."
sudo mkdir -p /etc/X11/xorg.conf.d
sudo tee /etc/X11/xorg.conf.d/10-blanking.conf > /dev/null << 'XORGEOF'
Section "ServerFlags"
    Option "blank time" "0"
    Option "standby time" "0"
    Option "suspend time" "0"
    Option "off time" "0"
    Option "dpms" "false"
EndSection
XORGEOF

echo ""
echo "=== Setup complete! ==="
echo "Hostname:  ${HOSTNAME}"
echo "SSH:       ssh pi@${HOSTNAME}.local"
echo "URL:       https://corelink.immersivecore.network/screen"
echo "Watchdog:  enabled"
echo "Swap:      1GB"
echo "Bluetooth: disabled"
echo "Screen blanking: disabled"
echo ""
echo "Rebooting in 5 seconds..."
sleep 5
sudo reboot
