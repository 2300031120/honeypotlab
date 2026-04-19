# 🔐 Credential Rotation Guide

## CyberSentil AI Honeypot - Security Best Practices

---

## 🚨 **Critical: Immediate Action Required**

Your `.env` file contains sensitive credentials that need to be rotated immediately.

---

## 📋 **Credentials to Rotate**

### **1. Database Credentials**
```bash
POSTGRES_PASSWORD=oiAOhl6J0EZnFhl2I38tOAWB
```
**Action Required**:
1. Generate new strong password (32+ chars, mixed case, numbers, symbols)
2. Update `.env` file
3. Update PostgreSQL database password
4. Restart postgres service

**How to Rotate**:
```bash
# Connect to PostgreSQL
docker exec -it ai-honeypot-fullstack-postgres-1 psql -U cybersentinel -d cybersentinel

# Change password
ALTER USER cybersentiel WITH PASSWORD 'NEW_STRONG_PASSWORD_HERE';

# Exit
\q

# Update .env file
POSTGRES_PASSWORD=NEW_STRONG_PASSWORD_HERE

# Restart services
docker-compose restart postgres backend
```

---

### **2. Admin Account Credentials**
```bash
BOOTSTRAP_ADMIN_USERNAME=admin
BOOTSTRAP_ADMIN_EMAIL=admin@cybersentil.online
BOOTSTRAP_ADMIN_PASSWORD=Adm!sImyEpJLA8gQAofa
```
**Action Required**:
1. Log in as admin
2. Change password in UI
3. Update `.env` file with new password
4. Remove from `.env` (use UI instead)

**How to Rotate**:
```bash
# Log in to the application
# Navigate to Settings > Account
# Change password
# Update .env file
BOOTSTRAP_ADMIN_PASSWORD=NEW_STRONG_PASSWORD_HERE
```

---

### **3. Application Secret Key**
```bash
SECRET_KEY=your-secret-key-here
```
**Action Required**:
1. Generate new secret key (32+ chars, random)
2. Update `.env` file
3. Restart backend service
4. All existing sessions will be invalidated (expected)

**How to Rotate**:
```bash
# Generate new secret key
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Update .env file
SECRET_KEY=NEW_SECRET_KEY_HERE

# Restart backend
docker-compose restart backend
```

---

### **4. Protocol Shared Secret**
```bash
PROTOCOL_SHARED_SECRET=f1fb8bad6da016cfe7f9809a97630a75db9c35786d909c4b
```
**Action Required**:
1. Generate new random secret (32+ chars)
2. Update `.env` file
3. Restart backend and honeypot services
4. Update any external integrations using this secret

**How to Rotate**:
```bash
# Generate new secret
python -c "import secrets; print(secrets.token_hex(32))"

# Update .env file
PROTOCOL_SHARED_SECRET=NEW_SECRET_HERE

# Restart services
docker-compose restart backend ssh-decoy mysql-decoy
```

---

### **5. Cloudflare Tunnel Token**
```bash
CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoiYjMyOGQ5OWI2MWU4OTMxM2NlMzE5ODg3NTE4Zjk5MGYi...
```
**Action Required**:
1. Go to Cloudflare Zero Trust Dashboard
2. Delete old tunnel token
3. Generate new tunnel token
4. Update `.env` file
5. Restart cloudflared service

**How to Rotate**:
```bash
# Go to Cloudflare Zero Trust Dashboard
# Navigate to Networks > Tunnels
# Delete old token
# Generate new token
# Update .env file
CLOUDFLARE_TUNNEL_TOKEN=NEW_TOKEN_HERE

# Restart cloudflared
docker-compose restart cloudflared
```

---

### **6. SMTP Credentials**
```bash
SMTP_PASSWORD=***REMOVED*** (Generate new key in SendinBrevo dashboard)
```
**Action Required**:
1. Log in to SendinBrevo (Brevo)
2. Generate new API key/SMTP password
3. Update `.env` file
4. Restart backend service
5. Test email sending

**How to Rotate**:
```bash
# Log in to SendinBrevo
# Navigate to SMTP & API
# Generate new SMTP key
# Update .env file
SMTP_PASSWORD=NEW_SMTP_PASSWORD

# Restart backend
docker-compose restart backend

# Test email sending
```

---

### **7. SSH Honeypot Credentials**
```bash
PROTOCOL_SSH_TRAP_CREDENTIALS=opsdecoy:NIHfBNvoTCjSzAYu,backupdecoy:Vea7udciXjdhYueR
```
**Action Required**:
1. Generate new random passwords for each trap user
2. Update `.env` file
3. Restart ssh-decoy service
4. Update any documentation

**How to Rotate**:
```bash
# Generate new passwords
python -c "import secrets; print(secrets.token_urlsafe(16))"

# Update .env file
PROTOCOL_SSH_TRAP_CREDENTIALS=opsdecoy:NEW_PASS1,backupdecoy:NEW_PASS2

# Restart ssh-decoy
docker-compose restart ssh-decoy
```

---

### **8. MySQL Honeypot Credentials**
```bash
PROTOCOL_MYSQL_TRAP_CREDENTIALS=mysqlbait:F93zYXFl0XmzRcln,reporting:QgAu7bZAPRzAPXkX
```
**Action Required**:
1. Generate new random passwords for each trap user
2. Update `.env` file
3. Restart mysql-decoy service
4. Update any documentation

**How to Rotate**:
```bash
# Generate new passwords
python -c "import secrets; print(secrets.token_urlsafe(16))"

# Update .env file
PROTOCOL_MYSQL_TRAP_CREDENTIALS=mysqlbait:NEW_PASS1,reporting:NEW_PASS2

# Restart mysql-decoy
docker-compose restart mysql-decoy
```

---

## 🔄 **Automated Rotation Script**

Create a script to help with credential rotation:

```bash
#!/bin/bash
# rotate_credentials.sh

echo "=== CyberSentil Credential Rotation Script ==="
echo ""

# Generate new passwords
NEW_POSTGRES_PASSWORD=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
NEW_SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
NEW_SHARED_SECRET=$(python -c "import secrets; print(secrets.token_hex(32))")

echo "Generated new credentials:"
echo "POSTGRES_PASSWORD: $NEW_POSTGRES_PASSWORD"
echo "SECRET_KEY: $NEW_SECRET_KEY"
echo "PROTOCOL_SHARED_SECRET: $NEW_SHARED_SECRET"
echo ""

# Update .env file
sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$NEW_POSTGRES_PASSWORD/" .env
sed -i "s/^SECRET_KEY=.*/SECRET_KEY=$NEW_SECRET_KEY/" .env
sed -i "s/^PROTOCOL_SHARED_SECRET=.*/PROTOCOL_SHARED_SECRET=$NEW_SHARED_SECRET/" .env

echo "Updated .env file"
echo ""

# Update PostgreSQL password
docker exec -it ai-honeypot-fullstack-postgres-1 psql -U cybersentinel -d cybersentinel -c "ALTER USER cybersentinel WITH PASSWORD '$NEW_POSTGRES_PASSWORD';"

echo "Updated PostgreSQL password"
echo ""

# Restart services
docker-compose restart postgres backend

echo "Restarted services"
echo ""
echo "=== Credential Rotation Complete ==="
```

---

## 📅 **Rotation Schedule**

### **Recommended Rotation Frequency:**

| Credential | Frequency | Priority |
|------------|-----------|----------|
| Database Password | Quarterly | High |
| Admin Password | Quarterly | High |
| Secret Key | Quarterly | High |
| Protocol Shared Secret | Quarterly | Medium |
| Cloudflare Tunnel Token | Annually | Medium |
| SMTP Credentials | Annually | Medium |
| Honeypot Credentials | Monthly | Low |

---

## ✅ **Rotation Checklist**

- [ ] Generate new strong passwords
- [ ] Update `.env` file
- [ ] Update PostgreSQL password
- [ ] Update Cloudflare tunnel token
- [ ] Update SMTP credentials
- [ ] Update honeypot credentials
- [ ] Restart all affected services
- [ ] Test application functionality
- [ ] Verify email sending
- [ ] Verify tunnel connectivity
- [ ] Document rotation date
- [ ] Store new credentials securely

---

## 🔒 **Best Practices**

1. **Never commit `.env` to version control**
2. **Use password managers** to store credentials
3. **Use strong, unique passwords** for each service
4. **Rotate credentials regularly**
5. **Monitor for unauthorized access**
6. **Use environment-specific secrets** (dev, staging, prod)
7. **Implement secret management** (AWS Secrets Manager, HashiCorp Vault)
8. **Enable audit logging** for credential changes
9. **Use multi-factor authentication** where possible
10. **Document rotation procedures**

---

## 🚨 **Immediate Action Required**

**Rotate all credentials in `.env` file NOW!**

Current credentials are exposed and need to be rotated immediately.

---

**Bottom Line**: Credential rotation is critical for security. Rotate all credentials immediately and implement a regular rotation schedule.
