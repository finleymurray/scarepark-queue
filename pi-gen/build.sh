#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# Immersive Core — Build Custom Pi OS Image
# ═══════════════════════════════════════════════════════════════════
#
# Builds a custom Raspberry Pi OS Lite image with the Immersive Core
# kiosk pre-installed. Requires Docker.
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

echo "[1/4] Cloning pi-gen..."
if [ -d "$PIGEN_DIR" ]; then
  echo "  pi-gen repo already exists, pulling latest..."
  cd "$PIGEN_DIR"
  git pull --quiet
else
  git clone --depth 1 https://github.com/RPi-Distro/pi-gen.git "$PIGEN_DIR"
  cd "$PIGEN_DIR"
fi

echo "[2/4] Configuring build..."

# Write pi-gen config
cat > config << 'EOF'
IMG_NAME=immersive-core-kiosk
RELEASE=bookworm
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

# Remove old link/dir if exists
rm -rf "${PIGEN_DIR}/${STAGE_NAME}"

# Create the stage directory structure
mkdir -p "${PIGEN_DIR}/${STAGE_NAME}"

# Copy our stage files into the pi-gen structure
cp -r "${SCRIPT_DIR}/00-install-packages" "${PIGEN_DIR}/${STAGE_NAME}/"
cp -r "${SCRIPT_DIR}/01-copy-files" "${PIGEN_DIR}/${STAGE_NAME}/"
cp -r "${SCRIPT_DIR}/02-configure" "${PIGEN_DIR}/${STAGE_NAME}/"
cp "${SCRIPT_DIR}/EXPORT_IMAGE" "${PIGEN_DIR}/${STAGE_NAME}/"

# Ensure scripts are executable
chmod +x "${PIGEN_DIR}/${STAGE_NAME}/01-copy-files/00-run.sh"
chmod +x "${PIGEN_DIR}/${STAGE_NAME}/02-configure/00-run-chroot.sh"

echo "[4/4] Building image (this takes 20-40 minutes)..."
echo ""
echo "  Building with Docker..."
echo "  Logs: ${PIGEN_DIR}/work/*/build.log"
echo ""

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
  echo "Check build logs: ${PIGEN_DIR}/work/*/build.log"
  exit 1
fi
