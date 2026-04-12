"""
Adaptive Web Decoy Engine
High-interaction honeypot with dynamic deception capabilities
"""

import hashlib
import random
import re
import time
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
import json


class ActorType(Enum):
    """Classification of attacker behavior"""
    SCANNER = "scanner"
    BRUTE_FORCER = "brute_forcer"
    MANUAL_OPERATOR = "manual_operator"
    EXPLORATORY_USER = "exploratory_user"


class DeceptionProfile(Enum):
    """Deception profiles for different actor types"""
    MINIMAL_SURFACE = "minimal_surface"
    CREDENTIAL_SINK = "credential_sink"
    DEEP_INTERACTION = "deep_interaction"
    BOUNDED_EXECUTION = "bounded_execution"


class StoryboardStage(Enum):
    """Story progression stages for attacker engagement"""
    SURFACE_RECON = "surface_recon"
    CREDENTIAL_GATE = "credential_gate"
    METADATA_DISCOVERY = "metadata_discovery"
    SQL_INTERACTION = "sql_interaction"
    BOUNDED_EXECUTION_GUARD = "bounded_execution_guard"


class DecoySession:
    """Session state for tracking attacker interactions"""
    
    def __init__(self, session_id: str, ip_address: str):
        self.session_id = session_id
        self.ip_address = ip_address
        self.created_at = datetime.utcnow()
        self.last_activity = datetime.utcnow()
        self.request_count = 0
        self.login_attempts = 0
        self.sql_attempts = 0
        self.visited_paths: List[str] = []
        self.actor_type = ActorType.SCANNER
        self.deception_profile = DeceptionProfile.MINIMAL_SURFACE
        self.current_stage = StoryboardStage.SURFACE_RECON
        self.fake_databases = self._generate_fake_databases()
        self.fake_tables = self._generate_fake_tables()
        self.fake_users = self._generate_fake_users()
        
    def _generate_fake_databases(self) -> List[str]:
        """Generate deterministic fake database names per session"""
        seed = int(hashlib.md5(self.session_id.encode()).hexdigest()[:8], 16)
        base_dbs = ["information_schema", "mysql", "performance_schema", "sys"]
        custom_dbs = [
            f"production_db_{seed % 100}",
            f"app_data_{(seed * 2) % 100}",
            f"legacy_{(seed * 3) % 100}",
        ]
        return base_dbs + custom_dbs
    
    def _generate_fake_tables(self) -> Dict[str, List[str]]:
        """Generate deterministic fake table names per database"""
        seed = int(hashlib.md5(self.session_id.encode()).hexdigest()[:8], 16)
        tables = {
            "information_schema": ["columns", "tables", "views", "routines"],
            "mysql": ["user", "db", "host", "tables_priv"],
        }
        custom_tables = [
            f"users_{seed % 50}",
            f"orders_{(seed * 2) % 50}",
            f"products_{(seed * 3) % 50}",
            f"transactions_{(seed * 5) % 50}",
        ]
        for db in self.fake_databases[4:]:  # Custom databases
            tables[db] = custom_tables
        return tables
    
    def _generate_fake_users(self) -> List[Dict[str, str]]:
        """Generate deterministic fake user accounts"""
        seed = int(hashlib.md5(self.session_id.encode()).hexdigest()[:8], 16)
        users = [
            {"username": "admin", "host": "localhost", "privileges": "ALL PRIVILEGES"},
            {"username": "app_user", "host": "%", "privileges": "SELECT, INSERT, UPDATE"},
            {"username": f"readonly_{seed % 100}", "host": "%", "privileges": "SELECT"},
        ]
        return users
    
    def update_activity(self, path: str):
        """Update session activity and classify actor"""
        self.last_activity = datetime.utcnow()
        self.request_count += 1
        if path not in self.visited_paths:
            self.visited_paths.append(path)
        
        self._classify_actor()
        self._update_deception_profile()
        self._advance_storyboard()
    
    def _classify_actor(self):
        """Classify actor based on behavior patterns"""
        if self.request_count < 3:
            self.actor_type = ActorType.SCANNER
        elif self.login_attempts > 5:
            self.actor_type = ActorType.BRUTE_FORCER
        elif self.sql_attempts > 0 and len(self.visited_paths) > 3:
            self.actor_type = ActorType.MANUAL_OPERATOR
        else:
            self.actor_type = ActorType.EXPLORATORY_USER
    
    def _update_deception_profile(self):
        """Select deception profile based on actor type"""
        profile_map = {
            ActorType.SCANNER: DeceptionProfile.MINIMAL_SURFACE,
            ActorType.BRUTE_FORCER: DeceptionProfile.CREDENTIAL_SINK,
            ActorType.MANUAL_OPERATOR: DeceptionProfile.DEEP_INTERACTION,
            ActorType.EXPLORATORY_USER: DeceptionProfile.BOUNDED_EXECUTION,
        }
        self.deception_profile = profile_map.get(self.actor_type, DeceptionProfile.MINIMAL_SURFACE)
    
    def _advance_storyboard(self):
        """Advance through storyboard stages based on engagement"""
        stage_progression = [
            StoryboardStage.SURFACE_RECON,
            StoryboardStage.CREDENTIAL_GATE,
            StoryboardStage.METADATA_DISCOVERY,
            StoryboardStage.SQL_INTERACTION,
            StoryboardStage.BOUNDED_EXECUTION_GUARD,
        ]
        
        current_index = stage_progression.index(self.current_stage)
        
        # Advance based on interaction depth
        if self.login_attempts > 0 and current_index < 1:
            self.current_stage = stage_progression[1]
        if len(self.visited_paths) > 2 and current_index < 2:
            self.current_stage = stage_progression[2]
        if self.sql_attempts > 0 and current_index < 3:
            self.current_stage = stage_progression[3]
        if self.sql_attempts > 5 and current_index < 4:
            self.current_stage = stage_progression[4]
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize session to dictionary"""
        return {
            "session_id": self.session_id,
            "ip_address": self.ip_address,
            "created_at": self.created_at.isoformat(),
            "last_activity": self.last_activity.isoformat(),
            "request_count": self.request_count,
            "login_attempts": self.login_attempts,
            "sql_attempts": self.sql_attempts,
            "visited_paths": self.visited_paths,
            "actor_type": self.actor_type.value,
            "deception_profile": self.deception_profile.value,
            "current_stage": self.current_stage.value,
            "dwell_time_seconds": (datetime.utcnow() - self.created_at).total_seconds(),
        }


class AdaptiveDecoyEngine:
    """Main engine for adaptive deception and high-interaction honeypot"""
    
    def __init__(self):
        self.sessions: Dict[str, DecoySession] = {}
        self.session_ttl_hours = 24
        
    def get_or_create_session(self, ip_address: str, session_id: Optional[str] = None) -> DecoySession:
        """Get existing session or create new one"""
        if session_id and session_id in self.sessions:
            session = self.sessions[session_id]
            # Check if session is expired
            if datetime.utcnow() - session.last_activity > timedelta(hours=self.session_ttl_hours):
                del self.sessions[session_id]
                return self._create_new_session(ip_address)
            return session
        
        return self._create_new_session(ip_address)
    
    def _create_new_session(self, ip_address: str) -> DecoySession:
        """Create a new decoy session"""
        session_id = hashlib.sha256(f"{ip_address}:{time.time()}:{random.random()}".encode()).hexdigest()[:16]
        session = DecoySession(session_id, ip_address)
        self.sessions[session_id] = session
        return session
    
    def cleanup_expired_sessions(self):
        """Remove expired sessions"""
        cutoff = datetime.utcnow() - timedelta(hours=self.session_ttl_hours)
        expired = [sid for sid, sess in self.sessions.items() if sess.last_activity < cutoff]
        for sid in expired:
            del self.sessions[sid]
        return len(expired)
    
    def get_session_metrics(self) -> Dict[str, Any]:
        """Get aggregate metrics across all sessions"""
        if not self.sessions:
            return {
                "total_sessions": 0,
                "active_sessions": 0,
                "actor_distribution": {},
                "stage_distribution": {},
                "avg_dwell_time": 0,
                "avg_requests": 0,
                "total_sql_attempts": 0,
            }
        
        actor_counts = {}
        stage_counts = {}
        total_dwell_time = 0
        total_requests = 0
        total_sql = 0
        active_count = 0
        
        cutoff = datetime.utcnow() - timedelta(minutes=5)
        
        for session in self.sessions.values():
            # Actor distribution
            actor = session.actor_type.value
            actor_counts[actor] = actor_counts.get(actor, 0) + 1
            
            # Stage distribution
            stage = session.current_stage.value
            stage_counts[stage] = stage_counts.get(stage, 0) + 1
            
            # Metrics
            dwell_time = (datetime.utcnow() - session.created_at).total_seconds()
            total_dwell_time += dwell_time
            total_requests += session.request_count
            total_sql += session.sql_attempts
            
            # Active sessions (last 5 minutes)
            if session.last_activity > cutoff:
                active_count += 1
        
        return {
            "total_sessions": len(self.sessions),
            "active_sessions": active_count,
            "actor_distribution": actor_counts,
            "stage_distribution": stage_counts,
            "avg_dwell_time": total_dwell_time / len(self.sessions) if self.sessions else 0,
            "avg_requests": total_requests / len(self.sessions) if self.sessions else 0,
            "total_sql_attempts": total_sql,
        }


class SQLEmulator:
    """Bounded SQL emulation for high-interaction honeypot"""
    
    DESTRUCTIVE_PATTERNS = [
        r'\bDROP\b',
        r'\bDELETE\b',
        r'\bTRUNCATE\b',
        r'\bALTER\b',
        r'\bCREATE\b',
        r'\bINSERT\b',
        r'\bUPDATE\b',
        r'\bGRANT\b',
        r'\bREVOKE\b',
        r'\bEXEC\b',
        r'\bEXECUTE\b',
    ]
    
    def __init__(self, session: DecoySession):
        self.session = session
    
    def execute_query(self, query: str) -> Dict[str, Any]:
        """Execute a bounded SQL query"""
        query_upper = query.upper().strip()
        self.session.sql_attempts += 1
        
        # Check for destructive patterns
        for pattern in self.DESTRUCTIVE_PATTERNS:
            if re.search(pattern, query_upper, re.IGNORECASE):
                return {
                    "success": False,
                    "error": "ERROR 1142 (42000): SELECT command denied to user",
                    "is_blocked": True,
                    "reason": "destructive_pattern",
                }
        
        # Handle SHOW DATABASES
        if query_upper.startswith('SHOW DATABASES'):
            return {
                "success": True,
                "columns": ["Database"],
                "rows": [[db] for db in self.session.fake_databases],
                "row_count": len(self.session.fake_databases),
            }
        
        # Handle SHOW TABLES
        if query_upper.startswith('SHOW TABLES'):
            current_db = self._extract_database_from_query(query)
            tables = self.session.fake_tables.get(current_db, [])
            return {
                "success": True,
                "columns": ["Tables_in_" + (current_db or "mysql")],
                "rows": [[table] for table in tables],
                "row_count": len(tables),
            }
        
        # Handle DESCRIBE
        if query_upper.startswith('DESCRIBE') or query_upper.startswith('DESC'):
            table_name = query_upper.split()[1].rstrip(';')
            return self._describe_table(table_name)
        
        # Handle SELECT
        if query_upper.startswith('SELECT'):
            return self._execute_select(query)
        
        # Handle USE
        if query_upper.startswith('USE'):
            db_name = query_upper.split()[1].rstrip(';')
            if db_name in self.session.fake_databases:
                return {
                    "success": True,
                    "message": f"Database changed",
                    "current_database": db_name,
                }
            else:
                return {
                    "success": False,
                    "error": f"ERROR 1049 (42000): Unknown database '{db_name}'",
                }
        
        # Default response for unsupported queries
        return {
            "success": False,
            "error": "ERROR 1064 (42000): You have an error in your SQL syntax",
            "is_blocked": True,
            "reason": "unsupported_query",
        }
    
    def _extract_database_from_query(self, query: str) -> Optional[str]:
        """Extract database name from query if specified"""
        # Simple extraction - in production, use proper SQL parser
        match = re.search(r'FROM\s+`?(\w+)`?', query, re.IGNORECASE)
        if match:
            return match.group(1)
        return None
    
    def _describe_table(self, table_name: str) -> Dict[str, Any]:
        """Generate fake table description"""
        columns = [
            {"Field": "id", "Type": "int(11)", "Null": "NO", "Key": "PRI", "Default": None},
            {"Field": "name", "Type": "varchar(255)", "Null": "NO", "Key": "", "Default": None},
            {"Field": "created_at", "Type": "timestamp", "Null": "NO", "Key": "", "Default": "CURRENT_TIMESTAMP"},
            {"Field": "updated_at", "Type": "timestamp", "Null": "YES", "Key": "", "Default": None},
        ]
        return {
            "success": True,
            "columns": ["Field", "Type", "Null", "Key", "Default"],
            "rows": [[col[k] for k in ["Field", "Type", "Null", "Key", "Default"]] for col in columns],
            "row_count": len(columns),
            "table_name": table_name,
        }
    
    def _execute_select(self, query: str) -> Dict[str, Any]:
        """Execute a SELECT query with fake data"""
        # Limit results to prevent resource exhaustion
        limit = 10
        
        # Generate fake rows
        seed = int(hashlib.md5(self.session.session_id.encode()).hexdigest()[:8], 16)
        rows = []
        for i in range(limit):
            rows.append([
                (seed + i) % 1000,
                f"item_{(seed * i) % 100}",
                datetime.utcnow().isoformat(),
            ])
        
        return {
            "success": True,
            "columns": ["id", "name", "created_at"],
            "rows": rows,
            "row_count": len(rows),
            "limit_applied": limit,
        }


class DynamicResponseGenerator:
    """AI-powered dynamic response generation"""
    
    def __init__(self):
        self.error_templates = {
            "login_failed": [
                "Access denied for user '{username}'@'{host}'",
                "ERROR 1045 (28000): Access denied for user '{username}'@'{host}' (using password: YES)",
            ],
            "sql_error": [
                "ERROR 1064 (42000): You have an error in your SQL syntax",
                "ERROR 1142 (42000): SELECT command denied to user",
                "ERROR 1044 (42000): Access denied for user",
            ],
            "permission_denied": [
                "ERROR 1227 (42000): Access denied; you need (at least one of) the",
            ],
        }
    
    def generate_login_response(self, username: str, password: str, success: bool = False) -> Dict[str, Any]:
        """Generate dynamic login response"""
        if success:
            return {
                "success": True,
                "message": "Login successful",
                "session_token": hashlib.sha256(f"{username}:{time.time()}".encode()).hexdigest()[:32],
            }
        
        template = random.choice(self.error_templates["login_failed"])
        error_msg = template.format(username=username, host="localhost")
        
        return {
            "success": False,
            "error": error_msg,
            "delay_ms": random.randint(500, 1500),  # Simulate processing time
        }
    
    def generate_error_response(self, error_type: str, context: Dict[str, Any] = None) -> str:
        """Generate dynamic error response"""
        templates = self.error_templates.get(error_type, self.error_templates["sql_error"])
        return random.choice(templates)


# Global engine instance
decoy_engine = AdaptiveDecoyEngine()
