#!/bin/bash
# Network Firewall Rules Script for CyberSentil
# Run as root: sudo ./apply-firewall-rules.sh

set -e

echo "🔒 Applying Network Security Firewall Rules..."

# Flush existing rules
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X

# Default policy: DROP
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow ICMP (ping) - limited
iptables -A INPUT -p icmp --icmp-type echo-request -m limit --limit 1/second -j ACCEPT

# SSH (management only - restrict to VPN)
# iptables -A INPUT -p tcp --dport 22 -s 10.100.0.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 22 -j ACCEPT  # Temporarily open, restrict later

# HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# SSH Honeypot (Port 2222) - Log and Accept
iptables -A INPUT -p tcp --dport 2222 -j LOG --log-prefix "[HONEYPOT-SSH] " --log-level 4
iptables -A INPUT -p tcp --dport 2222 -j ACCEPT

# WireGuard VPN
iptables -A INPUT -p udp --dport 51820 -j ACCEPT

# Docker networks (internal)
iptables -A INPUT -s 172.20.0.0/16 -j ACCEPT

# Rate limiting for HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -m limit --limit 25/minute --limit-burst 100 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -m limit --limit 25/minute --limit-burst 100 -j ACCEPT

# Block common attack patterns
# NULL packets
iptables -A INPUT -p tcp --tcp-flags ALL NONE -j DROP

# XMAS packets
iptables -A INPUT -p tcp --tcp-flags ALL ALL -j DROP

# SYN flood protection
iptables -A INPUT -p tcp --syn -m limit --limit 2/second --limit-burst 6 -j ACCEPT

# Block fragments
iptables -A INPUT -f -j DROP

# Block bad TCP flags combinations
iptables -A INPUT -p tcp --tcp-flags SYN,FIN SYN,FIN -j DROP
iptables -A INPUT -p tcp --tcp-flags SYN,RST SYN,RST -j DROP
iptables -A INPUT -p tcp --tcp-flags FIN,RST FIN,RST -j DROP
iptables -A INPUT -p tcp --tcp-flags ACK,FIN FIN -j DROP
iptables -A INPUT -p tcp --tcp-flags ACK,PSH PSH -j DROP
iptables -A INPUT -p tcp --tcp-flags ACK,URG URG -j DROP

# Log dropped packets (limited)
iptables -A INPUT -m limit --limit 5/min -j LOG --log-prefix "[IPTABLES-DROP] " --log-level 4

# Allow forwarding for Docker
iptables -A FORWARD -i eth0 -o docker0 -j ACCEPT
iptables -A FORWARD -i docker0 -o eth0 -j ACCEPT

# NAT for Docker containers
iptables -t nat -A POSTROUTING -s 172.20.0.0/16 ! -o docker0 -j MASQUERADE

# Save rules
echo "💾 Saving firewall rules..."
if command -v iptables-save &> /dev/null; then
    iptables-save > /etc/iptables/rules.v4
    echo "✅ Rules saved to /etc/iptables/rules.v4"
elif command -v netfilter-persistent &> /dev/null; then
    netfilter-persistent save
    echo "✅ Rules saved via netfilter-persistent"
else
    echo "⚠️ iptables-save not found. Install iptables-persistent to save rules:"
    echo "   sudo apt-get install iptables-persistent"
fi

# Display rules
echo ""
echo "📋 Current Firewall Rules:"
echo "=========================="
iptables -L -n -v --line-numbers | head -50

echo ""
echo "✅ Firewall rules applied successfully!"
echo ""
echo "🔧 Useful commands:"
echo "   View logs: sudo tail -f /var/log/kern.log | grep IPTABLES"
echo "   List rules: sudo iptables -L -n -v"
echo "   Block IP:   sudo iptables -A INPUT -s <IP> -j DROP"
echo "   Allow IP:   sudo iptables -I INPUT -s <IP> -j ACCEPT"
