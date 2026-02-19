# Immersive Core — Raspberry Pi Kiosk Setup

Turn any Raspberry Pi into a managed Immersive Core display screen.

## What You Get

- **Branded boot splash** — Immersive Core logo on black during startup (no Pi rainbow or boot text)
- **Auto-kiosk** — Chromium launches fullscreen to `/screen` on every boot
- **Persistent identity** — Pi remembers its assigned display, survives power cycles
- **Remote management** — Admin panel controls which page each Pi shows
- **SSH access** — Remote into any Pi for debugging

## Requirements

- Raspberry Pi 3B+ or 4 (2GB+ RAM recommended)
- microSD card (16GB+)
- HDMI display
- Wi-Fi or Ethernet connection
- Another computer with SD card reader

## Step 1: Flash Raspberry Pi OS Lite

1. Download and install [Raspberry Pi Imager](https://www.raspberrypi.com/software/)
2. Choose **Raspberry Pi OS Lite (64-bit)** — no desktop needed
3. Click the **gear icon** (⚙️) before flashing to configure:
   - **Set hostname**: e.g. `ic-lobby-1` (unique per Pi)
   - **Enable SSH**: Use password authentication
   - **Set username/password**: `pi` / your chosen password
   - **Configure Wi-Fi**: Enter your network name + password
   - **Set locale**: Your timezone
4. Flash to SD card

> **Wi-Fi**: This is configured in the Raspberry Pi Imager — the setup script doesn't handle Wi-Fi setup. Make sure you enter your network details in the imager settings.

## Step 2: First Boot + SSH In

1. Insert SD card into Pi, connect to HDMI + power
2. Wait ~60 seconds for first boot to complete
3. Find the Pi on your network:
   ```bash
   # From your Mac/laptop:
   ping ic-lobby-1.local

   # Or scan your network:
   arp -a | grep raspberry
   ```
4. SSH into the Pi:
   ```bash
   ssh pi@ic-lobby-1.local
   ```

## Step 3: Run the Setup Script

1. Copy the setup files to the Pi:
   ```bash
   # From your Mac (in the pi-os folder):
   scp setup-kiosk.sh splash.png pi@ic-lobby-1.local:~/
   ```

2. SSH into the Pi and run:
   ```bash
   ssh pi@ic-lobby-1.local
   sudo bash setup-kiosk.sh --hostname ic-lobby-1
   ```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--url URL` | Base URL of your site | `https://immersivecore.network` |
| `--hostname NAME` | Pi hostname (for SSH) | `ic-kiosk` |
| `--rotate DEGREES` | Display rotation (0/90/180/270) | `0` |

### Examples

```bash
# Standard landscape display
sudo bash setup-kiosk.sh --hostname ic-lobby-1

# Portrait mode display (rotated 90°)
sudo bash setup-kiosk.sh --hostname ic-entrance --rotate 90

# Custom URL (for development/staging)
sudo bash setup-kiosk.sh --hostname ic-test --url https://staging.example.com
```

## Step 4: Reboot

```bash
sudo reboot
```

The Pi will:
1. Show the Immersive Core splash screen during boot
2. Auto-launch Chromium fullscreen
3. Load `/screen` and display a 4-character code
4. Wait for assignment from the admin panel

## Step 5: Assign in Admin

1. Go to **Admin → Screens** on your dashboard
2. Find the screen card matching the 4-character code
3. Select a display from the dropdown (e.g. "TV4.5 — Lite Carousel")
4. The Pi navigates to that page within ~30 seconds (or instantly if realtime is connected)

## Day-to-Day Operation

### Power On/Off
Just unplug and replug. The Pi remembers its last assigned page and goes straight there on reboot — no need to reassign.

### Reassign a Screen
Change the dropdown in Admin → Screens at any time. The Pi picks up the change within 30 seconds and switches automatically.

### SSH Access
```bash
ssh pi@ic-lobby-1.local
# or
ssh pi@<ip-address>
```

### Common SSH Commands
```bash
# Check if kiosk is running
sudo systemctl status kiosk

# Restart the kiosk
sudo systemctl restart kiosk

# View kiosk logs
journalctl -u kiosk -f

# Reboot
sudo reboot

# Check Wi-Fi signal
iwconfig wlan0

# Check disk space
df -h
```

### Black Out All Screens
Use the "Black Out Screens" toggle in Admin → Screens. All displays show the Immersive Core splash image. Toggle off to restore live content.

## Troubleshooting

### Pi won't connect to Wi-Fi
- Re-flash with correct Wi-Fi credentials in Raspberry Pi Imager
- Or connect via Ethernet and configure manually:
  ```bash
  sudo raspi-config
  # → System Options → Wireless LAN
  ```

### Screen shows black/nothing
```bash
ssh pi@<hostname>.local
sudo systemctl restart kiosk
```

### Screen shows "Registering..." forever
- Check internet: `ping google.com`
- Check the site is accessible: `curl -I https://immersivecore.network`
- Check DNS: `nslookup immersivecore.network`

### Pi generates a new code after reboot
This should NOT happen with the new persistent system. If it does:
- Check that localStorage isn't being cleared (Chromium `--incognito` flag should NOT be used in production — the setup script includes it for crash recovery, remove if codes regenerate)
- SSH in and check: `ls -la /home/kiosk/.config/chromium/`

### Display is upside down / wrong rotation
```bash
sudo bash setup-kiosk.sh --rotate 180
sudo reboot
```

## Hardware Shopping List

| Item | Quantity | Notes |
|------|----------|-------|
| Raspberry Pi 4 (2GB) | Per screen | 4GB for TV4 carousel |
| Official Pi power supply | Per Pi | 5V 3A USB-C |
| microSD card 16GB+ | Per Pi | Class 10 / A1 |
| Micro HDMI → HDMI cable | Per Pi | Pi 4 uses micro HDMI |
| HDMI display / TV | Per screen | Any resolution |
