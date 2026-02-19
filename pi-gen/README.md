# Immersive Core — Custom Pi OS Image Builder

Build a pre-configured Raspberry Pi OS image with the Immersive Core kiosk baked in. Flash it, set Wi-Fi, plug in — it boots straight to a code on screen. No SSH setup needed.

## Requirements

- Docker Desktop (must be running)
- ~10GB free disk space
- 20-40 minutes for the build

## Build the Image

```bash
cd pi-gen
./build.sh
```

The output image lands in `deploy/immersive-core-kiosk-YYYY-MM-DD.img.zip`.

## Flash a Pi

1. Open **Raspberry Pi Imager**
2. Choose OS → **Use custom** → select the `.img.zip` file
3. Click **OS Customisation** (gear icon):
   - Set **hostname** (e.g. `ic-lobby-1`) — unique per Pi
   - Set **Wi-Fi** credentials
   - Password is pre-set to `immersivecore` (change in customisation if needed)
4. Flash to SD card

## Boot

1. Insert SD card, connect HDMI + power
2. Pi boots → Immersive Core splash → Chromium fullscreen → 4-letter code
3. Go to **Admin → Screens**, find the code, assign a display
4. Pi navigates to the assigned page within 30 seconds

## What's Pre-Installed

- Chromium in kiosk mode (fullscreen, no UI)
- Openbox window manager (for proper fullscreen)
- Plymouth boot splash (Immersive Core branding)
- SSH enabled
- Screen blanking disabled
- Auto-restart on crash
- Persistent identity (survives reboots/power cycles)

## SSH Access

Default credentials: `pi` / `immersivecore`

```bash
ssh pi@ic-lobby-1.local
```

## Manual Setup Alternative

If you don't want to build a custom image, see `../pi-os/setup-kiosk.sh` for a script that configures a standard Pi OS Lite install.
