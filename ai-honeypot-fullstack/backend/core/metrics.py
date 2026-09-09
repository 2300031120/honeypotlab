"""
Prometheus Metrics Module
Provides metrics collection for monitoring and alerting
"""

import time
import logging
from typing import Dict, Any, Optional
from collections import defaultdict
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from threading import Lock

logger = logging.getLogger(__name__)


@dataclass
class Metric:
    """Represents a single metric"""
    name: str
    value: float
    labels: Dict[str, str] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)


class PrometheusMetrics:
    """Prometheus-compatible metrics collector"""
    
    def __init__(self):
        self.metrics: Dict[str, list[Metric]] = defaultdict(list)
        self.counters: Dict[str, int] = defaultdict(int)
        self.gauges: Dict[str, float] = defaultdict(float)
        self.histograms: Dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()
    
    def increment_counter(self, name: str, labels: Dict[str, str] = None, value: int = 1):
        """Increment a counter metric"""
        with self._lock:
            key = self._make_key(name, labels)
            self.counters[key] += value
    
    def set_gauge(self, name: str, value: float, labels: Dict[str, str] = None):
        """Set a gauge metric"""
        with self._lock:
            key = self._make_key(name, labels)
            self.gauges[key] = value
    
    def observe_histogram(self, name: str, value: float, labels: Dict[str, str] = None):
        """Observe a histogram metric"""
        with self._lock:
            key = self._make_key(name, labels)
            self.histograms[key].append(value)
            # Keep only last 1000 observations
            if len(self.histograms[key]) > 1000:
                self.histograms[key] = self.histograms[key][-1000:]
    
    def _make_key(self, name: str, labels: Dict[str, str] = None) -> str:
        """Create a unique key for the metric"""
        if not labels:
            return name
        label_str = ",".join(f'{k}="{v}"' for k, v in sorted(labels.items()))
        return f"{name}{{{label_str}}}"
    
    def get_counter(self, name: str, labels: Dict[str, str] = None) -> int:
        """Get counter value"""
        key = self._make_key(name, labels)
        return self.counters.get(key, 0)
    
    def get_gauge(self, name: str, labels: Dict[str, str] = None) -> float:
        """Get gauge value"""
        key = self._make_key(name, labels)
        return self.gauges.get(key, 0.0)
    
    def get_histogram_stats(self, name: str, labels: Dict[str, str] = None) -> Dict[str, float]:
        """Get histogram statistics"""
        key = self._make_key(name, labels)
        values = self.histograms.get(key, [])
        
        if not values:
            return {"count": 0, "sum": 0, "avg": 0, "min": 0, "max": 0}
        
        return {
            "count": len(values),
            "sum": sum(values),
            "avg": sum(values) / len(values),
            "min": min(values),
            "max": max(values),
        }
    
    def export_prometheus_format(self) -> str:
        """Export metrics in Prometheus text format"""
        lines = []
        
        # Export counters
        for key, value in self.counters.items():
            lines.append(f"{key} {value}")
        
        # Export gauges
        for key, value in self.gauges.items():
            lines.append(f"{key} {value}")
        
        # Export histograms
        for key, values in self.histograms.items():
            if values:
                lines.append(f"{key}_count {len(values)}")
                lines.append(f"{key}_sum {sum(values)}")
        
        return "\n".join(lines)
    
    def export_json(self) -> Dict[str, Any]:
        """Export metrics as JSON"""
        with self._lock:
            return {
                "counters": dict(self.counters),
                "gauges": dict(self.gauges),
                "histograms": {
                    k: self.get_histogram_stats(k.split("{")[0])
                    for k in self.histograms.keys()
                },
            }


class MetricsCollector:
    """High-level metrics collector for the application"""
    
    def __init__(self):
        self.prometheus = PrometheusMetrics()
        self._start_time = time.time()
    
    def record_request(self, method: str, path: str, status_code: int, duration_ms: float):
        """Record an HTTP request"""
        labels = {
            "method": method,
            "path": path,
            "status": str(status_code),
        }
        
        self.prometheus.increment_counter("http_requests_total", labels)
        self.prometheus.observe_histogram("http_request_duration_ms", duration_ms, labels)
        
        if status_code >= 400:
            self.prometheus.increment_counter("http_errors_total", labels)
    
    def record_event(self, event_type: str, severity: str):
        """Record a security event"""
        labels = {
            "event_type": event_type,
            "severity": severity,
        }
        self.prometheus.increment_counter("security_events_total", labels)
    
    def record_database_query(self, duration_ms: float, success: bool = True):
        """Record a database query"""
        labels = {"success": str(success).lower()}
        self.prometheus.observe_histogram("database_query_duration_ms", duration_ms, labels)
        self.prometheus.increment_counter("database_queries_total", labels)
    
    def set_active_connections(self, count: int):
        """Set the number of active connections"""
        self.prometheus.set_gauge("active_connections", count)
    
    def set_queue_size(self, queue_name: str, size: int):
        """Set queue size"""
        self.prometheus.set_gauge("queue_size", size, {"queue": queue_name})
    
    def get_uptime_seconds(self) -> float:
        """Get application uptime in seconds"""
        return time.time() - self._start_time
    
    def export_metrics(self) -> str:
        """Export all metrics in Prometheus format"""
        self.prometheus.set_gauge("uptime_seconds", self.get_uptime_seconds())
        return self.prometheus.export_prometheus_format()
    
    def export_json(self) -> Dict[str, Any]:
        """Export all metrics as JSON"""
        return self.prometheus.export_json()


# Global metrics collector instance
metrics_collector = MetricsCollector()
