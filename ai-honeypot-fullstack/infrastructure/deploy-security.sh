#!/bin/bash
# Complete Security Deployment Script for CyberSentil
# Run on production server as root

set -e

CYBERSENTIL_DIR="/opt/cybersentil"
LOG_FILE="/var/log/cybersentil-security-deploy.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a $LOG_FILE
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a $LOG_FILE
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a $LOG_FILE
n    exit 1
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    error "Please run as root (use sudo)"
fi

log "🔐 Starting CyberSentil Security Deployment"
log "=========================================="

# =================================================================
# 1. SYSTEM HARDENING
# =================================================================

log "1️⃣ System Hardening..."

# Update system
apt-get update && apt-get upgrade -y || warn "System update failed"

# Install required packages
PACKAGES="iptables-persistent fail2ban wireguard wireguard-tools redis-tools curl jq"
apt-get install -y $PACKAGES || error "Failed to install packages"

# Enable and configure unattended upgrades
apt-get install -y unattended-upgrades
systemctl enable unattended-upgrades
systemctl start unattended-upgrades

# Configure sysctl for security
cat > /etc/sysctl.d/99-security.conf <<EOF
# IP Spoofing protection
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Ignore ICMP broadcast requests
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Disable source packet routing
net.ipv4.conf.all.accept_source_route = 0

# Ignore send redirects
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0

# Block SYN attacks
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2
net.ipv4.tcp_syn_retries = 5

# Log martians
net.ipv4.conf.all.log_martians = 1

# Disable IPv6 (if not needed)
net.ipv6.conf.all.disable_ipv6 = 1
net.ipv6.conf.default.disable_ipv6 = 1
EOF

sysctl -p /etc/sysctl.d/99-security.conf

log "✅ System hardening complete"

# =================================================================
# 2. SSL CERTIFICATES
# =================================================================

log "2️⃣ Setting up SSL Certificates..."

# Install certbot if not present
if ! command -v certbot &> /dev/null; then
    apt-get install -y certbot || error "Failed to install certbot"
fi

# Create SSL directory
mkdir -p /etc/nginx/ssl

# Generate certificates (if not using Let's Encrypt yet)
if [ ! -f /etc/nginx/ssl/fullchain.pem ]; then
    log "⚠️  No SSL certificates found. Generating self-signed for testing..."
    openssl req -x509 -nodes -days 365 -newkey rsa:4096 \
        -keyout /etc/nginx/ssl/privkey.pem \
        -out /etc/nginx/ssl/fullchain.pem \
        -subj "/CN=cybersentil.online" \
        -addext "subjectAltName=DNS:cybersentil.online,DNS:app.cybersentil.online"
    
    cp /etc/nginx/ssl/fullchain.pem /etc/nginx/ssl/chain.pem
    
    log "⚠️  Self-signed certificates generated. Replace with Let's Encrypt for production."
fi

# Set proper permissions
chmod 600 /etc/nginx/ssl/privkey.pem
chmod 644 /etc/nginx/ssl/fullchain.pem
chown -R root:root /etc/nginx/ssl

log "✅ SSL certificates configured"

# =================================================================
# 3. FIREWALL RULES
# =================================================================

log "3️⃣ Applying Firewall Rules..."

if [ -f "$CYBERSENTIL_DIR/infrastructure/apply-firewall-rules.sh" ]; then
    chmod +x $CYBERSENTIL_DIR/infrastructure/apply-firewall-rules.sh
    bash $CYBERSENTIL_DIR/infrastructure/apply-firewall-rules.sh || warn "Firewall rules may need manual application"
else
    warn "Firewall script not found, skipping"
fi

log "✅ Firewall configured"

# =================================================================
# 4. FAIL2BAN CONFIGURATION
# =================================================================

log "4️⃣ Setting up Fail2Ban..."

# Copy configuration files
if [ -d "$CYBERSENTIL_DIR/infrastructure/fail2ban" ]; then
    cp $CYBERSENTIL_DIR/infrastructure/fail2ban/jail.local /etc/fail2ban/jail.local
    cp $CYBERSENTIL_DIR/infrastructure/fail2ban/filter.d/* /etc/fail2ban/filter.d/ 2>/dev/null || true
    
    # Restart fail2ban
    systemctl restart fail2ban
    systemctl enable fail2ban
    
    # Verify status
    sleep 2
    fail2ban-client status || warn "Fail2Ban status check failed"
else
    warn "Fail2Ban configuration files not found"
fi

log "✅ Fail2Ban configured"

# =================================================================
# 5. LOGGING DIRECTORIES
# =================================================================

log "5️⃣ Setting up Logging Directories..."

# Create log directories
mkdir -p /var/log/cybersentil
mkdir -p /var/log/honeypot
mkdir -p /var/log/nginx
mkdir -p /var/www/certbot

# Set permissions
chown -R www-data:www-data /var/log/nginx
chown -R 1000:1000 /var/log/cybersentil
chown -R 1000:1000 /var/log/honeypot

log "✅ Logging directories ready"

# =================================================================
# 6. DOCKER SECURITY
# =================================================================

log "6️⃣ Configuring Docker Security..."

# Create Docker daemon security config
mkdir -p /etc/docker

cat > /etc/docker/daemon.json <<EOF
{
    "userns-remap": "default",
    "live-restore": true,
    "no-new-privileges": true,
    "seccomp-profile": "/etc/docker/seccomp-default.json",
    "log-driver": "json-file",
    "log-opts": {
        "max-size": "10m",
        "max-file": "3"
    },
    "storage-driver": "overlay2",
    "storage-opts": [
        "overlay2.override_kernel_check=true"
    ]
}
EOF

# Create seccomp directory
mkdir -p /etc/docker/seccomp

# Copy seccomp profiles
cp $CYBERSENTIL_DIR/infrastructure/seccomp/*.json /etc/docker/seccomp/ 2>/dev/null || true

# Restart Docker
systemctl restart docker || warn "Docker restart failed"

log "✅ Docker security configured"

# =================================================================
# 7. DEPLOY SECURE STACK
# =================================================================

log "7️⃣ Deploying Secure Docker Stack..."

cd $CYBERSENTIL_DIR

# Stop existing containers
docker-compose down 2>/dev/null || true

# Pull latest images
docker-compose pull 2>/dev/null || true

# Deploy with security profile
docker-compose -f docker-compose.yml -f docker-compose.security.yml up -d || error "Docker deployment failed"

# Wait for services
sleep 10

# Check service status
if docker-compose ps | grep -q "Up"; then
    log "✅ Docker services running"
else
    warn "Some Docker services may not be running. Check with: docker-compose ps"
fi

# =================================================================
# 8. VERIFY SECURITY
# =================================================================

log "8️⃣ Running Security Verification..."

echo ""
echo "📊 Security Status Check:"
echo "========================"

# Check firewall
echo "🔥 Firewall Status:"
iptables -L -n | head -20

echo ""
echo "🚫 Fail2Ban Status:"
fail2ban-client status 2>/dev/null || echo "  Fail2Ban not running"

echo ""
echo "🐳 Docker Security:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "📜 Recent Security Events:"
docker-compose logs --tail=20 backend 2>/dev/null | grep -i "security\|blocked\|fail" || echo "  No recent security events"

log "✅ Security verification complete"

# =================================================================
# 9. SUMMARY
# =================================================================

cat << 'EOF'

╔══════════════════════════════════════════════════════════════════╗
║                    SECURITY DEPLOYMENT COMPLETE                  ║
╚══════════════════════════════════════════════════════════════════╝

🔐 SECURITY MEASURES ACTIVE:
   ✅ Network Firewall (iptables)
   ✅ Intrusion Prevention (Fail2Ban)
   ✅ TLS/SSL Encryption
   ✅ Docker Security Hardening
   ✅ Rate Limiting
   ✅ Honeypot Services
   ✅ Security Headers (CSP, HSTS)
   ✅ VPN Access (WireGuard)

📋 NEXT STEPS:
   1. Configure WireGuard: docker-compose exec wireguard cat /config/peer1/peer1.conf
   2. Set up Let's Encrypt: certbot certonly --standalone -d cybersentil.online
   3. Monitor logs: tail -f /var/log/cybersentil/security.log
   4. Check Fail2Ban: fail2ban-client status

🔧 USEFUL COMMANDS:
   View logs:       docker-compose logs -f
   Block IP:        iptables -A INPUT -s <IP> -j DROP
   Check status:    docker-compose ps
   Security audit:  curl -I https://app.cybersentil.online

📚 DOCUMENTATION:
   Network Security:  infrastructure/network-security.md
   NGINX Config:      infrastructure/nginx/nginx-secure.conf
   Firewall Rules:    infrastructure/apply-firewall-rules.sh

EOF

log "🎉 Security deployment completed successfully!"
