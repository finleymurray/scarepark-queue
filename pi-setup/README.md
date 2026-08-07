# Immersive Core — Pi Kiosk Setup (FullPageOS)

## Flashing a new Pi

### Step 1: Flash FullPageOS
1. Download [FullPageOS](https://github.com/guysoft/FullPageOS/releases)
2. Flash to SD card using [Raspberry Pi Imager](https://www.raspberrypi.com/software/)

### Step 2: Configure in Raspberry Pi Imager (before flashing)
In Imager's OS Customisation settings, set:
- **Wi-Fi** — your network SSID and password
- **SSH** — enable with password authentication

### Step 3: Run setup
Eject SD card, put it in the Pi, and boot. Wait ~60s for it to connect to Wi-Fi, then from your Mac:

```bash
scp /Users/finleymurray/Projects/scarepark-queue/pi-setup/splash.png pi@<ip>:/tmp/splash.png && ssh pi@<ip> "sudo cp /tmp/splash.png /boot/firmware/splash.png"
ssh pi@<ip> 'bash -s' < /Users/finleymurray/Projects/scarepark-queue/pi-setup/setup-fullpageos.sh
```

Default FullPageOS password: `pi`

To find the Pi's IP: check your router's connected devices page, or run `arp -a` on your Mac.

The setup script will:
- Set a unique hostname (`ic-kiosk-XXXX` from MAC address)
- Set the kiosk URL with hostname parameter (for identity recovery)
- Install hardware watchdog (auto-reboot on freeze)
- Patch Chromium to recover from crashes/power loss
- Add optimised Chromium flags for Pi performance
- Enable HDMI force hotplug + 128MB GPU memory
- Disable bluetooth, cups, avahi, triggerhappy
- Increase swap to 1GB
- Disable screen blanking
- Reboot automatically

### Step 4: Assign screen
1. Open the admin panel at `https://corelink.immersivecore.network/admin`
2. Go to **Screens** — the new Pi should appear with its hostname
3. Assign it to the desired attraction/TV

## Pi credentials
| Field | Value |
|-------|-------|
| User | `pi` |
| Default password | `pi` |
| Hostname | `ic-kiosk-XXXX` (last 4 of MAC) |
| SSH | `ssh pi@<ip>` (`.local` may not resolve on all networks) |

## Troubleshooting

### Stuck on loading screen after reboot
SSH in and run:
```bash
pkill -f chromium
rm -f ~/.config/chromium/SingletonLock
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' ~/.config/chromium/Default/Preferences
DISPLAY=:0 /opt/custompios/scripts/start_chromium_browser &
```

### Change the URL remotely
```bash
ssh pi@<ip> "echo 'https://corelink.immersivecore.network/screen?hostname=\$(hostname)' | sudo tee /boot/firmware/fullpageos.txt && sudo reboot"
```

### Force reboot
```bash
ssh pi@<ip> sudo reboot
```

### Clear GPU/shader cache (rendering glitches)
```bash
ssh pi@<ip> "pkill -f chromium && sleep 2 && rm -rf ~/.config/chromium/GPUCache ~/.config/chromium/ShaderCache"
```
Chromium will auto-relaunch.
