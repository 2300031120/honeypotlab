"""
Real-time Threat Detection Alerts Module
Provides alerting system for critical security events
"""

import logging
from typing import Any, Callable, Optional
from datetime import datetime, timedelta
from core.database import db
from core.time_utils import utc_now, iso_now

logger = logging.getLogger(__name__)


class ThreatAlert:
    """Represents a security threat alert"""
    
    def __init__(
        self,
        alert_type: str,
        severity: str,
        title: str,
        description: str,
        source_ip: Optional[str] = None,
        site_id: Optional[int] = None,
        user_id: Optional[int] = None,
        metadata: Optional[dict[str, Any]] = None,
    ):
        self.alert_type = alert_type
        self.severity = severity
        self.title = title
        self.description = description
        self.source_ip = source_ip
        self.site_id = site_id
        self.user_id = user_id
        self.metadata = metadata or {}
        self.created_at = utc_now()
    
    def to_dict(self) -> dict[str, Any]:
        """Convert alert to dictionary"""
        return {
            "alert_type": self.alert_type,
            "severity": self.severity,
            "title": self.title,
            "description": self.description,
            "source_ip": self.source_ip,
            "site_id": self.site_id,
            "user_id": self.user_id,
            "metadata": self.metadata,
            "created_at": iso_now(self.created_at),
        }


class ThreatAlertManager:
    """Manages threat detection and alerting"""
    
    def __init__(self):
        self.alert_handlers: list[Callable[[ThreatAlert], None]] = []
        self.alert_history: list[ThreatAlert] = []
        self.max_history = 1000
    
    def register_handler(self, handler: Callable[[ThreatAlert], None]) -> None:
        """Register a handler for threat alerts"""
        self.alert_handlers.append(handler)
    
    def emit_alert(self, alert: ThreatAlert) -> None:
        """Emit a threat alert to all registered handlers"""
        # Add to history
        self.alert_history.append(alert)
        if len(self.alert_history) > self.max_history:
            self.alert_history.pop(0)
        
        # Log the alert
        logger.warning(
            f"THREAT ALERT [{alert.severity}] {alert.title}: {alert.description} "
            f"(IP: {alert.source_ip}, Site: {alert.site_id})"
        )
        
        # Call all handlers
        for handler in self.alert_handlers:
            try:
                handler(alert)
            except Exception as e:
                logger.exception("Alert handler failed: %s", e)
    
    def get_recent_alerts(self, hours: int = 24, severity: Optional[str] = None) -> list[dict[str, Any]]:
        """Get recent alerts from history"""
        cutoff = utc_now() - timedelta(hours=hours)
        alerts = [
            alert.to_dict()
            for alert in self.alert_history
            if alert.created_at >= cutoff and (severity is None or alert.severity == severity)
        ]
        return alerts
    
    def clear_history(self) -> None:
        """Clear alert history"""
        self.alert_history.clear()


# Global alert manager
alert_manager = ThreatAlertManager()


def check_critical_event_thresholds(event: dict[str, Any]) -> Optional[ThreatAlert]:
    """
    Check if an event meets threshold criteria for alerting
    
    Args:
        event: Event dictionary
    
    Returns:
        ThreatAlert if threshold met, None otherwise
    """
    severity = event.get("severity", "").lower()
    score = event.get("score", 0)
    ip = event.get("ip")
    site_id = event.get("site_id")
    user_id = event.get("user_id")
    
    # Critical severity always triggers alert
    if severity == "critical" or score >= 90:
        return ThreatAlert(
            alert_type="critical_event",
            severity="critical",
            title=f"Critical Security Event Detected",
            description=f"High-severity event (score: {score}) detected from IP {ip}",
            source_ip=ip,
            site_id=site_id,
            user_id=user_id,
            metadata={"event_id": event.get("id"), "score": score, "event_type": event.get("event_type")},
        )
    
    # High severity events trigger alert
    if severity == "high" or score >= 75:
        return ThreatAlert(
            alert_type="high_severity_event",
            severity="high",
            title=f"High Severity Event Detected",
            description=f"High-severity event (score: {score}) detected from IP {ip}",
            source_ip=ip,
            site_id=site_id,
            user_id=user_id,
            metadata={"event_id": event.get("id"), "score": score, "event_type": event.get("event_type")},
        )
    
    return None


def check_attack_pattern_detection(ip: str, site_id: Optional[int] = None) -> Optional[ThreatAlert]:
    """
    Check if IP shows attack pattern requiring alert
    
    Args:
        ip: Source IP address
        site_id: Site ID for scoping
    
    Returns:
        ThreatAlert if attack pattern detected, None otherwise
    """
    with db() as conn:
        # Check for rapid events from same IP
        query = "select count(*) as count, max(score) as max_score from events where ip = ? and created_at > ?"
        cutoff = iso_now(utc_now() - timedelta(minutes=5))
        result = conn.execute(query, (ip, cutoff)).fetchone()
        
        if result:
            event_count = result["count"]
            max_score = result["max_score"]
            
            # Rapid attack pattern (10+ events in 5 minutes)
            if event_count >= 10:
                return ThreatAlert(
                    alert_type="rapid_attack_pattern",
                    severity="high",
                    title=f"Rapid Attack Pattern Detected",
                    description=f"{event_count} events from IP {ip} in last 5 minutes (max score: {max_score})",
                    source_ip=ip,
                    site_id=site_id,
                    metadata={"event_count": event_count, "max_score": max_score, "time_window": "5 minutes"},
                )
            
            # Suspicious pattern (5+ events with high scores)
            if event_count >= 5 and max_score >= 70:
                return ThreatAlert(
                    alert_type="suspicious_pattern",
                    severity="medium",
                    title=f"Suspicious Activity Pattern Detected",
                    description=f"{event_count} events from IP {ip} with max score {max_score} in last 5 minutes",
                    source_ip=ip,
                    site_id=site_id,
                    metadata={"event_count": event_count, "max_score": max_score, "time_window": "5 minutes"},
                )
    
    return None


def check_mitre_tactic_clustering(tactic: str, site_id: Optional[int] = None) -> Optional[ThreatAlert]:
    """
    Check for clustering of specific MITRE tactics
    
    Args:
        tactic: MITRE tactic name
        site_id: Site ID for scoping
    
    Returns:
        ThreatAlert if clustering detected, None otherwise
    """
    high_risk_tactics = [
        "Credential Access",
        "Privilege Escalation",
        "Defense Evasion",
        "Lateral Movement",
        "Persistence",
    ]
    
    if tactic not in high_risk_tactics:
        return None
    
    with db() as conn:
        query = "select count(*) as count from events where mitre_tactic = ? and created_at > ?"
        cutoff = iso_now(utc_now() - timedelta(minutes=10))
        result = conn.execute(query, (tactic, cutoff)).fetchone()
        
        if result and result["count"] >= 5:
            return ThreatAlert(
                alert_type="mitre_tactic_clustering",
                severity="high",
                title=f"High-Risk MITRE Tactic Clustering",
                description=f"{result['count']} events using '{tactic}' tactic in last 10 minutes",
                site_id=site_id,
                metadata={"tactic": tactic, "event_count": result["count"], "time_window": "10 minutes"},
            )
    
    return None


def check_brute_force_detection(ip: str, site_id: Optional[int] = None) -> Optional[ThreatAlert]:
    """
    Check for brute force attack patterns
    
    Args:
        ip: Source IP address
        site_id: Site ID for scoping
    
    Returns:
        ThreatAlert if brute force detected, None otherwise
    """
    with db() as conn:
        # Check for authentication failures
        query = """
            select count(*) as count 
            from events 
            where ip = ? and event_type in ('auth_failure', 'login_failed') 
            and created_at > ?
        """
        cutoff = iso_now(utc_now() - timedelta(minutes=5))
        result = conn.execute(query, (ip, cutoff)).fetchone()
        
        if result and result["count"] >= 10:
            return ThreatAlert(
                alert_type="brute_force_attack",
                severity="critical",
                title=f"Brute Force Attack Detected",
                description=f"{result['count']} authentication failures from IP {ip} in last 5 minutes",
                source_ip=ip,
                site_id=site_id,
                metadata={"failure_count": result["count"], "time_window": "5 minutes"},
            )
    
    return None


def evaluate_event_for_alerts(event: dict[str, Any]) -> list[ThreatAlert]:
    """
    Evaluate an event for all alert conditions
    
    Args:
        event: Event dictionary
    
    Returns:
        List of triggered alerts
    """
    alerts = []
    ip = event.get("ip")
    site_id = event.get("site_id")
    
    # Check critical thresholds
    critical_alert = check_critical_event_thresholds(event)
    if critical_alert:
        alerts.append(critical_alert)
    
    # Check attack patterns
    if ip:
        pattern_alert = check_attack_pattern_detection(ip, site_id)
        if pattern_alert:
            alerts.append(pattern_alert)
        
        brute_force_alert = check_brute_force_detection(ip, site_id)
        if brute_force_alert:
            alerts.append(brute_force_alert)
    
    # Check MITRE tactic clustering
    tactic = event.get("mitre_tactic")
    if tactic:
        tactic_alert = check_mitre_tactic_clustering(tactic, site_id)
        if tactic_alert:
            alerts.append(tactic_alert)
    
    return alerts


def log_alert_to_database(alert: ThreatAlert) -> None:
    """
    Log alert to database for persistence
    
    Args:
        alert: ThreatAlert instance
    """
    with db() as conn:
        conn.execute(
            """
            insert into threat_alerts (
                alert_type, severity, title, description, source_ip, 
                site_id, user_id, metadata, created_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                alert.alert_type,
                alert.severity,
                alert.title,
                alert.description,
                alert.source_ip,
                alert.site_id,
                alert.user_id,
                str(alert.metadata),
                iso_now(alert.created_at),
            ),
        )


def get_alerts_from_database(
    hours: int = 24,
    severity: Optional[str] = None,
    site_id: Optional[int] = None,
    limit: int = 100,
) -> list[dict[str, Any]]:
    """
    Get alerts from database
    
    Args:
        hours: Time window in hours
        severity: Filter by severity
        site_id: Filter by site ID
        limit: Maximum number of alerts to return
    
    Returns:
        List of alert dictionaries
    """
    with db() as conn:
        conditions = ["created_at > ?"]
        params = [iso_now(utc_now() - timedelta(hours=hours))]
        
        if severity:
            conditions.append("severity = ?")
            params.append(severity)
        
        if site_id:
            conditions.append("site_id = ?")
            params.append(site_id)
        
        where_clause = " where " + " and ".join(conditions)
        query = f"select * from threat_alerts{where_clause} order by created_at desc limit ?"
        params.append(limit)
        
        rows = conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]


# Register default alert handler
alert_manager.register_handler(log_alert_to_database)


def initialize_threat_alerts_table() -> None:
    """Initialize threat_alerts table if it doesn't exist"""
    with db() as conn:
        conn.execute(
            """
            create table if not exists threat_alerts (
                id integer primary key autoincrement,
                alert_type text not null,
                severity text not null,
                title text not null,
                description text,
                source_ip text,
                site_id integer,
                user_id integer,
                metadata text,
                created_at text not null,
                acknowledged_at text,
                acknowledged_by integer
            )
            """
        )
        
        # Create indexes
        conn.execute("create index if not exists idx_threat_alerts_severity on threat_alerts(severity)")
        conn.execute("create index if not exists idx_threat_alerts_site_id on threat_alerts(site_id)")
        conn.execute("create index if not exists idx_threat_alerts_created_at on threat_alerts(created_at)")
