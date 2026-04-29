#!/bin/bash

echo "Fixing network..."

sudo ifconfig en5 down
sleep 1
sudo ifconfig en5 up

sudo ipconfig set en5 DHCP

echo "Testing..."
ping -c 3 8.8.8.8

