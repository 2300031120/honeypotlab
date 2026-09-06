# Post-Deployment Verification Checklist

## Pre-Deployment Checks ✅

### Configuration Validation
- [ ] Run `python scripts/validate_config.py` - all checks should pass
- [ ] Verify `.env` file has no placeholder values
- [ ] Confirm `APP_ENV` is set correctly (development/production)
- [ ] Check database connection string is valid
- [ ] Verify all critical secrets are set (SECRET_KEY, DATABASE_URL, etc.)

### Code Quality
- [ ] Run backend tests: `python -m pytest backend/tests -q`
- [ ] Run frontend lint: `npm run lint`
- [ ] Run frontend build: `npm run build`
- [ ] Verify no TypeScript errors: `npm run type-check`

## Deployment Verification

### Infrastructure Health
- [ ] All Docker containers are running: `docker compose ps`
- [ ] Database container is healthy: `docker compose ps postgres`
- [ ] Redis container is healthy: `docker compose ps redis`
- [ ] Backend container is healthy: `docker compose ps backend`
- [ ] Frontend container is healthy: `docker compose ps frontend`

### Service Connectivity
- [ ] Frontend is accessible: `curl http://localhost/`
- [ ] Backend health endpoint: `curl http://localhost/api/health`
- [ ] Detailed health check: `curl http://localhost/api/health/detailed`
- [ ] Database connection is working (check detailed health)
- [ ] Redis connection is working (if configured)

### Application Functionality
- [ ] Login page loads correctly
- [ ] Admin login works with bootstrap credentials
- [ ] Dashboard loads after login
- [ ] Sites management page works
- [ ] API key generation works
- [ ] Event ingestion endpoint accepts requests
- [ ] AI protection middleware is functioning
- [ ] Rate limiting is working

### Security Verification
- [ ] HTTPS redirect is enabled (production)
- [ ] Security headers are present
- [ ] CORS is properly configured
- [ ] Trusted hosts are set correctly
- [ ] AI protection middleware blocks known bots
- [ ] IP whitelist works for admin paths
- [ ] Secret keys are not placeholder values

### Performance Checks
- [ ] Page load time < 3 seconds
- [ ] API response time < 500ms
- [ ] Database queries are efficient
- [ ] No memory leaks in containers
- [ ] CPU usage is normal
- [ ] Disk space is sufficient

### Monitoring & Logging
- [ ] Application logs are being generated
- [ ] Error logs are accessible
- [ ] Request logging is working
- [ ] Health checks are scheduled
- [ ] Alerts are configured (if using monitoring service)

### Integration Testing
- [ ] Event ingestion works with API key
- [ ] AI analysis processes events correctly
- [ ] Email notifications work (if configured)
- [ ] Webhook notifications work (if configured)
- [ ] SIEM integrations work (if configured)
- [ ] SSH decoy is accessible on configured port
- [ ] Terminal sandbox is working

## Post-Deployment Monitoring

### First 24 Hours
- [ ] Monitor error rates
- [ ] Check database performance
- [ ] Verify user registrations (if enabled)
- [ ] Monitor event ingestion volume
- [ ] Check AI service performance
- [ ] Review security logs for attacks

### First Week
- [ ] Analyze traffic patterns
- [ ] Check resource utilization trends
- [ ] Review blocked IPs effectiveness
- [ ] Monitor false positive rates
- [ ] Verify backup processes
- [ ] Check certificate renewal (if using TLS)

## Rollback Plan

### If Critical Issues Found
1. Stop new deployments: `docker compose stop`
2. Revert to previous working version
3. Restore database from backup if needed
4. Restart services: `docker compose start`
5. Verify rollback was successful

### Emergency Contacts
- DevOps Lead: [Contact]
- Security Lead: [Contact]
- Database Admin: [Contact]

## Maintenance Schedule

### Daily
- [ ] Check container health
- [ ] Review error logs
- [ ] Monitor disk space

### Weekly
- [ ] Review security logs
- [ ] Check backup integrity
- [ ] Analyze performance metrics
- [ ] Review blocked IPs

### Monthly
- [ ] Update dependencies
- [ ] Review and rotate secrets
- [ ] Analyze cost optimization
- [ ] Update documentation

## Performance Benchmarks

### Target Metrics
- Frontend Load Time: < 3 seconds
- API Response Time: < 500ms
- Database Query Time: < 100ms
- Error Rate: < 0.1%
- Uptime: > 99.9%

### Alert Thresholds
- Error rate > 1%: Immediate alert
- Response time > 2s: Warning
- CPU usage > 80%: Warning
- Memory usage > 90%: Critical
- Disk space < 10%: Critical

## Security Checklist

### Continuous Security
- [ ] Regular security scans
- [ ] Dependency vulnerability checks
- [ ] Access log reviews
- [ ] Secret rotation schedule
- [ ] Firewall rule reviews

### Incident Response
- [ ] Incident response plan documented
- [ ] Team trained on procedures
- [ ] Emergency communication channels
- [ ] Backup restoration tested
- [ ] Forensic analysis tools ready

## Documentation Updates

### After Deployment
- [ ] Update deployment notes
- [ ] Document any issues found
- [ ] Update configuration changes
- [ ] Record performance baselines
- [ ] Update runbooks if needed

## Success Criteria

Deployment is considered successful when:
- ✅ All health checks pass
- ✅ Core functionality works
- ✅ Security measures are active
- ✅ Performance meets benchmarks
- ✅ Monitoring is operational
- ✅ Team is trained on new features
