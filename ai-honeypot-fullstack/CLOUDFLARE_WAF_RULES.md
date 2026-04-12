# Cloudflare WAF Rules for CyberSentil

## Overview
This document provides recommended Cloudflare WAF (Web Application Firewall) rules to enhance security for the CyberSentil honeypot platform.

## Current Backend Protections
- AI/Bot protection middleware (blocks 30+ known AI user-agents)
- Request fingerprinting (detects bot behavior patterns)
- Rate limiting (per endpoint)
- Honeypot decoy endpoints (traps scanners)
- IP whitelisting for admin access
- Security headers (HSTS, CSP, etc.)

## Cloudflare WAF Configuration

### 1. Bot Fight Mode
**Status**: Recommended (Free)

Enable Cloudflare Bot Fight Mode to automatically detect and block sophisticated bots.

**How to enable**:
1. Go to Cloudflare Dashboard > Security > Bots
2. Enable "Bot Fight Mode"
3. Configure action: "Managed Challenge" or "Block"

### 2. WAF Custom Rules

#### Rule 1: Block Known AI Crawlers
**Expression**:
```
(http.user_agent contains "GPTBot" or
http.user_agent contains "ChatGPT" or
http.user_agent contains "Claude" or
http.user_agent contains "GoogleOther" or
http.user_agent contains "Anthropic" or
http.user_agent contains "PerplexityBot" or
http.user_agent contains "CCBot" or
http.user_agent contains "Bytespider")
```
**Action**: Block
**Status**: High Priority

#### Rule 2: Block SQL Injection Attempts
**Expression**:
```
(http.request.uri contains "union select" or
http.request.uri contains "or 1=1" or
http.request.uri contains "drop table" or
http.request.uri contains "delete from" or
http.request.uri contains "insert into" or
http.request.uri contains "script alert")
```
**Action**: Block
**Status**: Critical

#### Rule 3: Block XSS Attempts
**Expression**:
```
(http.request.uri contains "<script" or
http.request.uri contains "javascript:" or
http.request.uri contains "onerror=" or
http.request.uri contains "onload=" or
http.request.uri contains "eval(")
```
**Action**: Block
**Status**: Critical

#### Rule 4: Block Path Traversal
**Expression**:
```
(http.request.uri contains "../" or
http.request.uri contains "..%2F" or
http.request.uri contains "%2e%2e%2f" or
http.request.uri contains "etc/passwd" or
http.request.uri contains "windows/system32")
```
**Action**: Block
**Status**: Critical

#### Rule 5: Rate Limiting - Aggressive
**Expression**:
```
(cf.threat_score > 10)
```
**Action**: Rate Limit
**Rate Limit**: 100 requests per 10 minutes
**Status**: High Priority

#### Rule 6: Block Empty User-Agent
**Expression**:
```
(http.user_agent eq "" or
http.user_agent eq "-")
```
**Action**: Managed Challenge
**Status**: Medium Priority

#### Rule 7: Block Common Scanner Patterns
**Expression**:
```
(http.user_agent contains "Nmap" or
http.user_agent contains "sqlmap" or
http.user_agent contains "nikto" or
http.user_agent contains "Burp" or
http.user_agent contains "Metasploit" or
http.user_agent contains "w3af" or
http.user_agent contains "arachni")
```
**Action**: Block
**Status**: High Priority

#### Rule 8: Protect Admin Endpoints
**Expression**:
```
(http.request.uri.path contains "/admin" or
http.request.uri.path contains "/administrator" or
http.request.uri.path contains "/wp-admin" or
http.request.uri.path contains "/phpmyadmin")
```
**Action**: Managed Challenge
**Status**: High Priority

#### Rule 9: Block Suspicious File Extensions
**Expression**:
```
(http.request.uri.path contains ".php" or
http.request.uri.path contains ".jsp" or
http.request.uri.path contains ".asp" or
http.request.uri.path contains ".exe" or
http.request.uri.path contains ".sh" or
http.request.uri.path contains ".cgi")
```
**Action**: Block
**Status**: Medium Priority

#### Rule 10: Geographic Blocking (Optional)
**Expression**:
```
(ip.geoip.country ne "IN" and
ip.geoip.country ne "US" and
ip.geoip.country ne "GB")
```
**Action**: Managed Challenge
**Status**: Low Priority (Optional - customize based on your needs)

### 3. Security Level Settings

**Firewall Rules**:
- Security Level: **Medium** or **High** (under Attack)
- Bot Check Mode: **On**
- Challenge Passage: **Off**

### 4. Page Rules

#### Rule 1: Always HTTPS
**URL Pattern**: `cybersentil.online/*`
**Settings**:
- Always Use HTTPS: On
- Auto Minify: CSS, JS, HTML

#### Rule 2: Cache Static Assets
**URL Pattern**: `cybersentil.online/static/*`
**Settings**:
- Cache Level: Standard
- Browser Cache TTL: 1 year

### 5. Rate Limiting Rules

#### Rule 1: API Endpoints
**URL Pattern**: `cybersentil.online/api/*`
**Rate Limit**: 100 requests per minute
**Action**: Challenge

#### Rule 2: Login Attempts
**URL Pattern**: `cybersentil.online/api/auth/login`
**Rate Limit**: 10 requests per 5 minutes
**Action**: Block

#### Rule 3: Demo Request Form
**URL Pattern**: `cybersentil.online/api/leads`
**Rate Limit**: 5 requests per 5 minutes
**Action**: Challenge

### 6. DDoS Protection

**Settings**:
- HTTP DDoS Protection: **On**
- Layer 3/4 DDoS Protection: **On**
- Under Attack Mode: Enable during active attacks

### 7. SSL/TLS Configuration

**Settings**:
- SSL/TLS Mode: **Full (Strict)**
- Minimum TLS Version: **TLS 1.2**
- Opportunistic Encryption: **On**
- TLS 1.3: **Enabled**

### 8. Authentication

**Settings**:
- Two-Factor Authentication: **Enabled** for Cloudflare account
- API Tokens: Use scoped API tokens for automation

### 9. Email Protection

**Settings**:
- Email Obfuscation: **On**
- Email Routing: Configure for lead notifications

### 10. Additional Recommendations

#### Enable Cloudflare Analytics
- Monitor traffic patterns
- Set up alerts for suspicious activity
- Review top attacked endpoints weekly

#### Configure Firewall Events
- Set up notifications for blocked requests
- Integrate with Slack/email for alerts
- Review logs regularly

#### IP Access Rules
- Add known malicious IPs to block list
- Whitelist your office/home IPs for admin access
- Regularly review and update lists

#### Turnstile CAPTCHA
- Enable Turnstile on public forms
- Add to demo request form
- Configure difficulty level

## Implementation Steps

1. **Enable Bot Fight Mode** (Free, immediate impact)
2. **Add Critical WAF Rules** (SQLi, XSS, Path Traversal)
3. **Configure Rate Limiting** (API endpoints, login)
4. **Enable DDoS Protection** (Already enabled by default)
5. **Set Up Analytics and Alerts**
6. **Test Rules** (Ensure legitimate traffic not blocked)
7. **Monitor and Adjust** (Review weekly)

## Monitoring

### Key Metrics to Monitor
- Blocked requests by rule
- Top attacked endpoints
- Geographic distribution of attacks
- Request patterns over time
- False positive rate

### Alerts Configuration
- High threat score spikes
- Sudden increase in blocked requests
- New attack patterns detected
- API endpoint abuse

## Troubleshooting

### Legitimate Traffic Blocked
1. Check WAF event logs
2. Identify blocking rule
3. Add exception or adjust rule
4. Whitelist legitimate IPs

### High False Positive Rate
1. Review rule expressions
2. Adjust from "Block" to "Challenge"
3. Add whitelisted paths
4. Monitor and refine rules

## Maintenance

### Weekly Tasks
- Review WAF event logs
- Check for new attack patterns
- Update IP block/whitelist lists
- Review rate limit effectiveness

### Monthly Tasks
- Audit all WAF rules
- Update threat intelligence
- Review geographic blocking
- Test CAPTCHA effectiveness

### Quarterly Tasks
- Full security audit
- Update WAF rule documentation
- Review and update security policies
- Train team on new threats

## References

- [Cloudflare WAF Documentation](https://developers.cloudflare.com/waf/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Cloudflare Security Best Practices](https://developers.cloudflare.com/security/)
