#!/bin/bash
# Generate unique hostname from MAC address on first boot
# Result: ic-kiosk-XXXX (last 4 hex chars of wlan0 or eth0 MAC)

MAC=$(cat /sys/class/net/wlan0/address 2>/dev/null || cat /sys/class/net/eth0/address 2>/dev/null)
if [ -n "$MAC" ]; then
  SUFFIX=$(echo "$MAC" | tr -d ':' | tail -c 5)
  HOSTNAME="ic-kiosk-${SUFFIX}"
  hostnamectl set-hostname "$HOSTNAME"
  # Update /etc/hosts
  sed -i "s/ic-kiosk/${HOSTNAME}/g" /etc/hosts 2>/dev/null
fi

# Disable this service so it only runs once
systemctl disable set-hostname.service
