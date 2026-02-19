#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# Immersive Core — Build Custom Pi OS Image
# ═══════════════════════════════════════════════════════════════════
#
# Builds a custom Raspberry Pi OS Lite (64-bit) image with the
# Immersive Core kiosk pre-installed. Requires Docker.
#
# Usage:
#   cd pi-gen
#   ./build.sh
#
# Output:
#   ../deploy/immersive-core-kiosk-YYYY-MM-DD.img.zip
#
# ═══════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PIGEN_DIR="${SCRIPT_DIR}/.pi-gen-repo"
STAGE_NAME="stage-kiosk"

echo ""
echo "═══════════════════════════════════════════"
echo "  IMMERSIVE CORE — Pi OS Image Builder"
echo "═══════════════════════════════════════════"
echo ""

# Check Docker
if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is required. Install Docker Desktop first."
  exit 1
fi

if ! docker info &>/dev/null; then
  echo "ERROR: Docker is not running. Start Docker Desktop first."
  exit 1
fi

echo "[1/4] Cloning pi-gen (bookworm arm64 branch)..."
if [ -d "$PIGEN_DIR" ]; then
  echo "  Removing old pi-gen repo..."
  rm -rf "$PIGEN_DIR"
fi
git clone --depth 1 --branch bookworm-arm64 https://github.com/RPi-Distro/pi-gen.git "$PIGEN_DIR"
cd "$PIGEN_DIR"

echo "[2/4] Configuring build..."

# Write pi-gen config — RELEASE is set by the branch (bookworm)
cat > config << 'EOF'
IMG_NAME=immersive-core-kiosk
TARGET_HOSTNAME=ic-kiosk
FIRST_USER_NAME=pi
FIRST_USER_PASS=immersivecore
LOCALE_DEFAULT=en_GB.UTF-8
KEYBOARD_KEYMAP=gb
KEYBOARD_LAYOUT="English (UK)"
TIMEZONE_DEFAULT=Europe/London
WPA_COUNTRY=GB
ENABLE_SSH=1
DEPLOY_COMPRESSION=zip
STAGE_LIST="stage0 stage1 stage2 stage-kiosk"
EOF

# Skip stages 3-5
touch stage3/SKIP stage4/SKIP stage5/SKIP
touch stage3/SKIP_IMAGES stage4/SKIP_IMAGES stage5/SKIP_IMAGES

echo "[3/4] Linking custom kiosk stage..."

# Remove old stage if exists
rm -rf "${PIGEN_DIR}/${STAGE_NAME}"

# Create the stage directory structure
mkdir -p "${PIGEN_DIR}/${STAGE_NAME}"

# Copy our stage files into the pi-gen structure
cp "${SCRIPT_DIR}/prerun.sh" "${PIGEN_DIR}/${STAGE_NAME}/"
cp -r "${SCRIPT_DIR}/00-install-packages" "${PIGEN_DIR}/${STAGE_NAME}/"
cp -r "${SCRIPT_DIR}/01-copy-files" "${PIGEN_DIR}/${STAGE_NAME}/"
cp -r "${SCRIPT_DIR}/02-configure" "${PIGEN_DIR}/${STAGE_NAME}/"
cp "${SCRIPT_DIR}/EXPORT_IMAGE" "${PIGEN_DIR}/${STAGE_NAME}/"

# Copy Wi-Fi credentials if present (wifi.conf is gitignored)
if [ -f "${SCRIPT_DIR}/wifi.conf" ]; then
  cp "${SCRIPT_DIR}/wifi.conf" "${PIGEN_DIR}/${STAGE_NAME}/01-copy-files/files/wifi.conf"
  echo "  Wi-Fi config found — credentials will be baked in"
else
  echo "  No wifi.conf found — Wi-Fi must be configured manually after boot"
  echo "  Create pi-gen/wifi.conf with: WIFI_SSID=... and WIFI_PASS=..."
fi

# Ensure scripts are executable
chmod +x "${PIGEN_DIR}/${STAGE_NAME}/prerun.sh"
chmod +x "${PIGEN_DIR}/${STAGE_NAME}/01-copy-files/00-run.sh"
chmod +x "${PIGEN_DIR}/${STAGE_NAME}/02-configure/00-run-chroot.sh"

echo "[4/4] Building image (this takes 20-40 minutes)..."
echo ""
echo "  Building with Docker..."
echo ""

# Remove stale container from previous builds (if any)
docker rm -v pigen_work 2>/dev/null || true

./build-docker.sh

# Copy output
if ls deploy/*.zip &>/dev/null; then
  mkdir -p "${SCRIPT_DIR}/../deploy"
  cp deploy/*.zip "${SCRIPT_DIR}/../deploy/"
  echo ""
  echo "═══════════════════════════════════════════"
  echo "  Build complete!"
  echo "═══════════════════════════════════════════"
  echo ""
  echo "  Image: $(ls deploy/*.zip)"
  echo "  Copied to: $(ls ${SCRIPT_DIR}/../deploy/*.zip)"
  echo ""
  echo "  Flash with Raspberry Pi Imager:"
  echo "  1. Open Imager → Choose OS → Use custom"
  echo "  2. Select the .img.zip file"
  echo "  3. Set Wi-Fi in OS Customisation (hostname is pre-set)"
  echo "  4. Flash → plug in → code appears on screen"
  echo ""
else
  echo ""
  echo "ERROR: No image found in deploy/"
  echo "Check build logs in: ${PIGEN_DIR}/work/"
  exit 1
fi
