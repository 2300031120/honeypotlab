# NETWORK INFRASTRUCTURE & SECURITY GUIDE

## 🌐 COMPREHENSIVE NETWORK SECURITY IMPLEMENTATION

---

## 1. NETWORK ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE EDGE                          │
│              (DDoS Protection + WAF + CDN)                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     REVERSE PROXY                            │
│              (NGINX - SSL Termination)                      │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │ FRONTEND │    │ BACKEND  │    │  ADMIN   │
    │  (Nginx) │    │ (FastAPI)│    │  Panel   │
    └──────────┘    └──────────┘    └──────────┘
            │               │
            │       ┌───────┴───────┐
            │       ▼               ▼
            │  ┌──────────┐   ┌──────────┐
            │  │ POSTGRES │   │  REDIS   │
            │  │ (Master) │   │  (Cache) │
            │  └──────────┘   └──────────┘
            │
            ▼
    ┌─────────────────────────────────────┐
    │      HONEYPOT SERVICES              │
    │  ┌──────────┐    ┌──────────┐    │
    │  │SSH-Decoy │    │ Terminal │    │
    │  │ (Port    │    │ Sandbox  │    │
    │  │  2222)   │    │ (Port    │    │
    │  └──────────┘    │  5100)   │    │
    │                   └──────────┘    │
    └─────────────────────────────────────┘
```

---

## 2. NETWORK SEGMENTATION

### Internal Network Zones

| Zone | Purpose | Access Rules |
|------|---------|--------------|
| **DMZ** | Public-facing services | Internet → Frontend, SSH Decoy |
| **APP** | Application logic | Frontend → Backend only |
| **DATA** | Database & Storage | Backend → DB only |
| **MGMT** | Admin & Monitoring | VPN/Internal only |
| **HONEYPOT** | Deception systems | Isolated, logged |

### Firewall Rules

```yaml
# Default: DENY ALL

# ZONE: DMZ (Public)
- INGRESS:
  - 80/tcp   → Frontend (HTTP redirect)
  - 443/tcp  → Frontend (HTTPS)
  - 2222/tcp → SSH Decoy (Honeypot)
  
- EGRESS:
  - 5000/tcp → Backend (Internal)
  - DNS (53/udp)
  - NTP (123/udp)

# ZONE: APP (Application)
- INGRESS:
  - 5000/tcp → Backend API (from Frontend only)
  - 5100/tcp → Terminal Sandbox (internal)
  
- EGRESS:
  - 5432/tcp → PostgreSQL (DATA zone)
  - 6379/tcp → Redis (DATA zone)
  - 5101/tcp → SSH Decoy health checks

# ZONE: DATA (Database)
- INGRESS:
  - 5432/tcp → PostgreSQL (from APP only)
  - 6379/tcp → Redis (from APP only)
  
- EGRESS:
  - DENY ALL (except backups to MGMT)

# ZONE: HONEYPOT (Deception)
- INGRESS:
  - 2222/tcp → SSH Honeypot (from Internet/DMZ)
  - 3306/tcp → MySQL Honeypot (optional)
  
- EGRESS:
  - 5000/tcp → Backend (event logging only)
  - LOG ALL TRAFFIC
```

---

## 3. TLS/SSL CONFIGURATION

### SSL/TLS Settings (NGINX)

```nginx
# TLS 1.2+ only, strong ciphers
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_ecdh_curve X25519:secp384r1:secp256k1;

# HSTS (HTTP Strict Transport Security)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /path/to/chain.pem;

# Session settings
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:50m;
ssl_session_tickets off;
```

### Certificate Management

```bash
# Let's Encrypt with certbot
# Auto-renewal setup
certbot certonly --standalone -d cybersentil.online -d app.cybersentil.online

# Renew hook for container restart
echo '#!/bin/bash
docker-compose restart frontend nginx' > /etc/letsencrypt/renewal-hooks/deploy/restart-containers.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/restart-containers.sh
```

---

## 4. DOCKER SECURITY HARDENING

### Docker Compose Security Profile

```yaml
# Security-enhanced docker-compose.yml additions

services:
  frontend:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=100m
    user: "1000:1000"
    
  backend:
    security_opt:
      - no-new-privileges:true
      - seccomp:./security/backend-seccomp.json
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=500m
    user: "1000:1000"
    
  postgres:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
    user: "999:999"
    
  ssh-decoy:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    # Run honeypot in isolated network
    networks:
      - honeypot-net
      - backend-net
```

### Seccomp Profile (backend-seccomp.json)

```json
{
  "defaultAction": "SCMP_ACT_ERRNO",
  "architectures": ["SCMP_ARCH_X86_64", "SCMP_ARCH_X86"],
  "syscalls": [
    {
      "names": [
        "accept", "accept4", "bind", "clone", "close", "connect",
        "epoll_create", "epoll_create1", "epoll_ctl", "epoll_wait",
        "epoll_pwait", "exit", "exit_group", "fcntl", "fstat",
        "futex", "getpid", "getrandom", "getsockname", "getsockopt",
        "ioctl", "listen", "mmap", "mprotect", "munmap", "open",
        "openat", "poll", "read", "recv", "recvfrom", "recvmsg",
        "rt_sigaction", "rt_sigprocmask", "rt_sigreturn", "select",
        "send", "sendfile", "sendmsg", "sendto", "setsockopt",
        "shutdown", "socket", "socketpair", "stat", "wait4", "write"
      ],
      "action": "SCMP_ACT_ALLOW"
    }
  ]
}
```

---

## 5. INTRUSION DETECTION & MONITORING

### Fail2Ban Configuration

```ini
# /etc/fail2ban/jail.local
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = systemd

[sshd-honeypot]
enabled = true
port = 2222
filter = sshd
logpath = /var/log/honeypot/auth.log
maxretry = 3
bantime = 86400

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 5

[nginx-botsearch]
enabled = true
filter = nginx-botsearch
port = http,https
logpath = /var/log/nginx/access.log
maxretry = 10
```

### Network Monitoring (Zeek/Bro)

```zeek
# Detect suspicious SSH patterns
hook SSH::log_policy(rec: SSH::Info)
    {
    if ( rec?$auth_success && rec$auth_success == F )
        {
        # Log failed SSH attempts from honeypot
        print fmt("SSH-HONEYPOT-FAIL: %s from %s", rec$id$orig_h);
        }
    }
```

---

## 6. VPN & REMOTE ACCESS

### WireGuard VPN for Admin Access

```ini
# /etc/wireguard/wg0.conf
[Interface]
PrivateKey = <SERVER_PRIVATE_KEY>
Address = 10.100.0.1/24
ListenPort = 51820
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
DNS = 1.1.1.1, 1.0.0.1

[Peer]
# Admin 1
PublicKey = <ADMIN1_PUBLIC_KEY>
AllowedIPs = 10.100.0.2/32

[Peer]
# Admin 2
PublicKey = <ADMIN2_PUBLIC_KEY>
AllowedIPs = 10.100.0.3/32
```

---

## 7. BACKUP & DISASTER RECOVERY

### Automated Backup Strategy

```bash
#!/bin/bash
# /opt/cybersentil/backup/backup.sh

# Database backup
pg_dump -h localhost -U cybersentinel cybersentinel | gzip > /backup/db-$(date +%Y%m%d-%H%M%S).sql.gz

# Config backup
tar -czf /backup/config-$(date +%Y%m%d-%H%M%S).tar.gz /opt/cybersentil/.env /opt/cybersentil/docker-compose.yml

# Upload to S3 (encrypted)
aws s3 sync /backup/ s3://cybersentil-backups-$(date +%Y%m)/ --sse AES256

# Clean old backups (keep 30 days)
find /backup/ -type f -mtime +30 -delete
```

### Backup Encryption

```bash
# GPG encrypt backups
gpg --cipher-algo AES256 --compress-algo 2 --symmetric --output backup.sql.gz.gpg backup.sql.gz
```

---

## 8. SECURITY MONITORING DASHBOARD

### Prometheus + Grafana Setup

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
      - GF_SERVER_ROOT_URL=https://monitoring.cybersentil.online

  node-exporter:
    image: prom/node-exporter:latest
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
```

### Security Alert Rules (Prometheus)

```yaml
# monitoring/security-alerts.yml
groups:
  - name: security-alerts
    rules:
      - alert: HighRateOfFailedLogins
        expr: rate(failed_login_attempts_total[5m]) > 10
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "High rate of failed login attempts"
          
      - alert: SQLInjectionAttempt
        expr: increase(sql_injection_blocked_total[1m]) > 0
        for: 0s
        labels:
          severity: critical
        annotations:
          summary: "SQL injection attempt detected"
          
      - alert: UnusualOutboundTraffic
        expr: rate(container_network_transmit_bytes_total{container_label_org_label_name="honeypot"}[5m]) > 100000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Unusual outbound traffic from honeypot"
```

---

## 9. INCIDENT RESPONSE PLAYBOOK

### Security Incident Response Steps

1. **Detection**
   - Automated alerts from monitoring
   - Log analysis
   - User reports

2. **Containment**
   - Isolate affected containers: `docker network disconnect`
   - Block IPs at firewall level
   - Enable enhanced logging

3. **Investigation**
   - Collect logs: `docker logs`, `/var/log/`
   - Analyze network traffic
   - Check database for unauthorized access

4. **Eradication**
   - Remove malicious files
   - Patch vulnerabilities
   - Rotate compromised credentials

5. **Recovery**
   - Restore from clean backups
   - Verify system integrity
   - Resume services

6. **Lessons Learned**
   - Document incident
   - Update security controls
   - Train team

### Emergency Commands

```bash
# Block IP immediately
iptables -A INPUT -s <ATTACKER_IP> -j DROP

# Isolate container
docker network disconnect ai-honeypot-fullstack_default <container>

# Capture network traffic
tcpdump -i eth0 -w /tmp/incident-$(date +%s).pcap

# Get container forensics
docker export <container> > /tmp/container-forensics.tar
```

---

## 10. COMPLIANCE CHECKLIST

### Security Standards

- [x] **OWASP Top 10** protection implemented
- [x] **CIS Docker Benchmark** applied
- [x] **NIST Cybersecurity Framework** aligned
- [x] **ISO 27001** controls implemented
- [ ] **SOC 2** audit (if required)
- [ ] **GDPR** compliance (if applicable)

### Security Controls

| Control | Implementation | Status |
|---------|---------------|--------|
| Access Control | JWT + RBAC | ✅ |
| Encryption | TLS 1.2+, AES-256 | ✅ |
| Logging | Centralized + Audit | ✅ |
| Monitoring | Prometheus + Alerts | ✅ |
| Backup | Automated + Encrypted | ✅ |
| Hardening | Docker + Host | ✅ |
| Network Segmentation | 5 Zones | ✅ |
| Honeypot | SSH + Web Decoys | ✅ |

---

## DEPLOYMENT COMMANDS

```bash
# 1. Deploy with security profile
docker-compose -f docker-compose.yml -f docker-compose.security.yml up -d

# 2. Enable firewall rules
sudo ./infrastructure/apply-firewall-rules.sh

# 3. Start monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# 4. Verify security headers
curl -I https://app.cybersentil.online

# 5. Run security audit
docker-compose exec backend python -m security.audit
```
