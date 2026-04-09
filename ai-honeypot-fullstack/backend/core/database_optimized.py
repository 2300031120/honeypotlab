"""
OPTIMIZED DATABASE MODULE - Performance & Memory Fixes
Addresses N+1 queries, memory leaks, and transaction issues
"""

import sqlite3
import threading
import time
import logging
from contextlib import contextmanager
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union
from dataclasses import dataclass

import asyncpg
from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, DateTime, Text, Float
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool

logger = logging.getLogger(__name__)

# Connection pool configuration
DATABASE_POOL_SIZE = 20
DATABASE_MAX_OVERFLOW = 30
DATABASE_POOL_TIMEOUT = 30
DATABASE_POOL_RECYCLE = 3600

@dataclass
class QueryMetrics:
    """Track query performance metrics"""
    query: str
    execution_time: float
    rows_affected: int
    timestamp: datetime

class DatabaseMetrics:
    """Track database performance"""
    def __init__(self):
        self.queries: List[QueryMetrics] = []
        self.slow_queries: List[QueryMetrics] = []
        self.connection_errors: int = 0
        self.lock = threading.Lock()
    
    def record_query(self, query: str, execution_time: float, rows_affected: int = 0):
        with self.lock:
            metric = QueryMetrics(
                query=query[:100],  # Truncate for storage
                execution_time=execution_time,
                rows_affected=rows_affected,
                timestamp=datetime.utcnow()
            )
            self.queries.append(metric)
            
            # Track slow queries (> 100ms)
            if execution_time > 0.1:
                self.slow_queries.append(metric)
                logger.warning(f"Slow query detected: {query[:50]}... took {execution_time:.3f}s")
            
            # Keep only last 1000 queries
            if len(self.queries) > 1000:
                self.queries = self.queries[-1000:]
                self.slow_queries = [q for q in self.slow_queries if q in self.queries]
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        with self.lock:
            if not self.queries:
                return {"total_queries": 0}
            
            total_time = sum(q.execution_time for q in self.queries)
            avg_time = total_time / len(self.queries)
            max_time = max(q.execution_time for q in self.queries)
            
            return {
                "total_queries": len(self.queries),
                "slow_queries": len(self.slow_queries),
                "avg_execution_time": round(avg_time, 3),
                "max_execution_time": round(max_time, 3),
                "connection_errors": self.connection_errors,
                "last_updated": datetime.utcnow().isoformat()
            }

# Global metrics instance
db_metrics = DatabaseMetrics()

class OptimizedConnectionAdapter:
    """Enhanced connection adapter with performance tracking"""
    
    def __init__(self, connection, connection_type: str = "sqlite"):
        self.connection = connection
        self.connection_type = connection_type
        self.created_at = datetime.utcnow()
        
    def execute(self, query: str, params: Tuple = ()) -> Any:
        start_time = time.time()
        try:
            result = self.connection.execute(query, params)
            execution_time = time.time() - start_time
            
            # Record metrics
            rows_affected = result.rowcount if hasattr(result, 'rowcount') else 0
            db_metrics.record_query(query, execution_time, rows_affected)
            
            return result
        except Exception as e:
            db_metrics.connection_errors += 1
            logger.error(f"Database error in {self.connection_type}: {e}")
            raise
    
    def fetchall(self) -> List[Dict[str, Any]]:
        try:
            rows = self.connection.fetchall()
            return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Fetch error in {self.connection_type}: {e}")
            raise
    
    def fetchone(self) -> Optional[Dict[str, Any]]:
        try:
            row = self.connection.fetchone()
            return dict(row) if row else None
        except Exception as e:
            logger.error(f"Fetch one error in {self.connection_type}: {e}")
            raise
    
    def commit(self):
        try:
            self.connection.commit()
        except Exception as e:
            logger.error(f"Commit error in {self.connection_type}: {e}")
            raise
    
    def rollback(self):
        try:
            self.connection.rollback()
        except Exception as e:
            logger.error(f"Rollback error in {self.connection_type}: {e}")
            raise
    
    def close(self):
        try:
            self.connection.close()
        except Exception as e:
            logger.error(f"Close error in {self.connection_type}: {e}")

class AsyncDatabaseManager:
    """Async database manager with connection pooling"""
    
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.engine = None
        self.session_factory = None
        self._initialize_engine()
    
    def _initialize_engine(self):
        """Initialize async engine with optimized settings"""
        self.engine = create_async_engine(
            self.database_url,
            pool_size=DATABASE_POOL_SIZE,
            max_overflow=DATABASE_MAX_OVERFLOW,
            pool_pre_ping=True,
            pool_recycle=DATABASE_POOL_RECYCLE,
            echo=False,  # Set to True for SQL logging in development
        )
        
        self.session_factory = async_sessionmaker(
            self.engine,
            class_=AsyncSession,
            expire_on_commit=False
        )
    
    @contextmanager
    async def get_session(self):
        """Get database session with automatic cleanup"""
        async with self.session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception as e:
                await session.rollback()
                logger.error(f"Async database session error: {e}")
                raise
    
    async def execute_query(self, query: str, params: Tuple = ()) -> List[Dict[str, Any]]:
        """Execute query with performance tracking"""
        start_time = time.time()
        try:
            async with self.get_session() as session:
                result = await session.execute(query, params)
                rows = result.fetchall()
                execution_time = time.time() - start_time
                
                # Convert to list of dicts
                dict_rows = [dict(row) for row in rows]
                
                # Record metrics
                db_metrics.record_query(query, execution_time, len(dict_rows))
                
                return dict_rows
        except Exception as e:
            db_metrics.connection_errors += 1
            logger.error(f"Async query error: {e}")
            raise
    
    async def execute_paginated_query(
        self, 
        base_query: str, 
        page: int = 1, 
        page_size: int = 50,
        params: Tuple = ()
    ) -> Dict[str, Any]:
        """Execute paginated query efficiently"""
        offset = (page - 1) * page_size
        
        # Add pagination to query
        paginated_query = f"{base_query} LIMIT {page_size} OFFSET {offset}"
        
        start_time = time.time()
        try:
            # Get total count
            count_query = f"SELECT COUNT(*) FROM ({base_query}) as count_query"
            async with self.get_session() as session:
                count_result = await session.execute(count_query, params)
                total_count = count_result.scalar()
                
                # Get paginated results
                result = await session.execute(paginated_query, params)
                rows = result.fetchall()
                execution_time = time.time() - start_time
                
                dict_rows = [dict(row) for row in rows]
                
                # Record metrics
                db_metrics.record_query(paginated_query, execution_time, len(dict_rows))
                
                return {
                    "data": dict_rows,
                    "total": total_count,
                    "page": page,
                    "page_size": page_size,
                    "total_pages": (total_count + page_size - 1) // page_size,
                    "execution_time": round(execution_time, 3)
                }
        except Exception as e:
            db_metrics.connection_errors += 1
            logger.error(f"Paginated query error: {e}")
            raise

# SQLite optimized functions
class OptimizedSQLiteAdapter:
    """Enhanced SQLite adapter with performance optimizations"""
    
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.connection = None
        self._connect()
    
    def _connect(self):
        """Connect with optimized SQLite settings"""
        self.connection = sqlite3.connect(
            self.db_path,
            timeout=30.0,
            check_same_thread=False,
            isolation_level=None,  # Autocommit mode for better performance
            cached_statements=100  # Enable statement cache
        )
        
        # Performance optimizations
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute("PRAGMA synchronous=NORMAL")
        self.connection.execute("PRAGMA cache_size=10000")
        self.connection.execute("PRAGMA temp_store=MEMORY")
        self.connection.execute("PRAGMA mmap_size=268435456")  # 256MB
        
        # Enable foreign key constraints
        self.connection.execute("PRAGMA foreign_keys=ON")
    
    @contextmanager
    def get_connection(self):
        """Get connection with automatic cleanup"""
        try:
            yield OptimizedConnectionAdapter(self.connection, "sqlite")
        finally:
            # Connection is managed externally, just ensure it's in good state
            try:
                self.connection.execute("PRAGMA wal_checkpoint(TRUNCATE)")
            except Exception as e:
                logger.warning(f"WAL checkpoint error: {e}")
    
    def execute_optimized_query(
        self, 
        query: str, 
        params: Tuple = (), 
        use_transaction: bool = False
    ) -> List[Dict[str, Any]]:
        """Execute query with optimizations"""
        start_time = time.time()
        
        try:
            if use_transaction:
                self.connection.execute("BEGIN IMMEDIATE")
            
            cursor = self.connection.execute(query, params)
            rows = cursor.fetchall()
            
            if use_transaction:
                self.connection.commit()
            
            execution_time = time.time() - start_time
            dict_rows = [dict(row) for row in rows]
            
            # Record metrics
            db_metrics.record_query(query, execution_time, len(dict_rows))
            
            return dict_rows
            
        except Exception as e:
            if use_transaction:
                try:
                    self.connection.rollback()
                except:
                    pass
            
            db_metrics.connection_errors += 1
            logger.error(f"SQLite query error: {e}")
            raise
    
    def execute_batch_insert(self, table: str, data: List[Dict[str, Any]]) -> int:
        """Efficient batch insert operation"""
        if not data:
            return 0
        
        start_time = time.time()
        
        try:
            # Build batch insert query
            columns = list(data[0].keys())
            placeholders = ', '.join(['?' for _ in columns])
            query = f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({placeholders})"
            
            # Flatten data for executemany
            values = [tuple(row[col] for col in columns) for row in data]
            
            cursor = self.connection.executemany(query, values)
            self.connection.commit()
            
            execution_time = time.time() - start_time
            db_metrics.record_query(f"BATCH INSERT INTO {table}", execution_time, len(data))
            
            return cursor.rowcount
            
        except Exception as e:
            try:
                self.connection.rollback()
            except:
                pass
            
            db_metrics.connection_errors += 1
            logger.error(f"Batch insert error: {e}")
            raise

# Global instances
_async_db_manager: Optional[AsyncDatabaseManager] = None
_sqlite_adapter: Optional[OptimizedSQLiteAdapter] = None

def initialize_database(database_url: str) -> None:
    """Initialize the appropriate database manager"""
    global _async_db_manager, _sqlite_adapter
    
    if database_url.startswith(('postgresql://', 'postgres://')):
        _async_db_manager = AsyncDatabaseManager(database_url)
        logger.info("Initialized PostgreSQL async database manager")
    else:
        # SQLite path extraction
        if database_url.startswith('sqlite:///'):
            db_path = database_url[10:]  # Remove 'sqlite:///'
        else:
            db_path = database_url
        
        _sqlite_adapter = OptimizedSQLiteAdapter(db_path)
        logger.info(f"Initialized SQLite adapter: {db_path}")

@contextmanager
def db():
    """Get database connection (backward compatibility)"""
    global _async_db_manager, _sqlite_adapter
    
    if _async_db_manager:
        # For async usage, this should be awaited
        raise RuntimeError("Use async_db() for async operations")
    
    if _sqlite_adapter:
        with _sqlite_adapter.get_connection() as conn:
            yield conn
    else:
        raise RuntimeError("Database not initialized")

@contextmanager
async def async_db():
    """Get async database connection"""
    global _async_db_manager
    
    if not _async_db_manager:
        raise RuntimeError("Async database manager not initialized")
    
    async with _async_db_manager.get_session() as session:
        yield session

# Optimized query functions
async def get_events_paginated(
    page: int = 1,
    page_size: int = 50,
    site_ids: Optional[List[int]] = None,
    severity_filter: Optional[str] = None
) -> Dict[str, Any]:
    """Get paginated events with optimized query"""
    global _async_db_manager
    
    if not _async_db_manager:
        raise RuntimeError("Async database manager not initialized")
    
    # Build optimized query
    base_query = "SELECT * FROM events"
    conditions = []
    params = []
    
    if site_ids:
        placeholders = ', '.join(['?' for _ in site_ids])
        conditions.append(f"site_id IN ({placeholders})")
        params.extend(site_ids)
    
    if severity_filter:
        conditions.append("severity = ?")
        params.append(severity_filter)
    
    if conditions:
        base_query += f" WHERE {' AND '.join(conditions)}"
    
    base_query += " ORDER BY created_at DESC"
    
    return await _async_db_manager.execute_paginated_query(
        base_query, page, page_size, tuple(params)
    )

async def get_dashboard_summary_optimized(user_id: int) -> Dict[str, Any]:
    """Get dashboard summary with single optimized query"""
    global _async_db_manager
    
    if not _async_db_manager:
        raise RuntimeError("Async database manager not initialized")
    
    # Single complex query instead of N+1
    optimized_query = """
        SELECT 
            COUNT(*) as total_events,
            SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as critical_events,
            COUNT(DISTINCT ip) as unique_ips,
            COUNT(DISTINCT session_id) as live_sessions,
            COUNT(DISTINCT CASE WHEN url_path IS NOT NULL THEN url_path ELSE event_type END) as trap_types
        FROM events 
        WHERE site_id IN (SELECT id FROM sites WHERE user_id = ?)
        AND created_at >= datetime('now', '-24 hours')
    """
    
    start_time = time.time()
    
    try:
        async with async_db() as session:
            result = await session.execute(optimized_query, (user_id,))
            row = result.fetchone()
            
            # Get trap distribution in same query
            trap_query = """
                SELECT 
                    CASE WHEN url_path IS NOT NULL THEN url_path ELSE event_type END as trap_type,
                    COUNT(*) as count
                FROM events 
                WHERE site_id IN (SELECT id FROM sites WHERE user_id = ?)
                AND created_at >= datetime('now', '-24 hours')
                GROUP BY CASE WHEN url_path IS NOT NULL THEN url_path ELSE event_type END
                ORDER BY count DESC
                LIMIT 10
            """
            
            trap_result = await session.execute(trap_query, (user_id,))
            trap_rows = trap_result.fetchall()
            
            execution_time = time.time() - start_time
            db_metrics.record_query("DASHBOARD_SUMMARY", execution_time)
            
            return {
                "summary": {
                    "total": row.total_events if row else 0,
                    "critical": row.critical_events if row else 0,
                    "unique_ips": row.unique_ips if row else 0,
                    "live_sessions": row.live_sessions if row else 0,
                    "trap_types": row.trap_types if row else 0
                },
                "trap_distribution": {
                    dict(row)[0]: dict(row)[1] for row in trap_rows
                },
                "execution_time": round(execution_time, 3)
            }
            
    except Exception as e:
        db_metrics.connection_errors += 1
        logger.error(f"Dashboard summary error: {e}")
        raise

def get_database_metrics() -> Dict[str, Any]:
    """Get comprehensive database metrics"""
    return db_metrics.get_metrics_summary()

def cleanup_old_sessions() -> int:
    """Clean up old sessions efficiently"""
    global _sqlite_adapter
    
    if not _sqlite_adapter:
        return 0
    
    try:
        with _sqlite_adapter.get_connection() as conn:
            # Single query to delete old sessions
            cutoff_time = (datetime.utcnow() - timedelta(hours=24)).isoformat()
            cursor = conn.execute(
                "DELETE FROM sessions WHERE last_seen < ?", 
                (cutoff_time,)
            )
            deleted_count = cursor.rowcount
            
            # Optimize database
            conn.execute("VACUUM")
            
            logger.info(f"Cleaned up {deleted_count} old sessions")
            return deleted_count
            
    except Exception as e:
        logger.error(f"Session cleanup error: {e}")
        return 0

# Export functions
__all__ = [
    'initialize_database',
    'db',
    'async_db', 
    'get_events_paginated',
    'get_dashboard_summary_optimized',
    'get_database_metrics',
    'cleanup_old_sessions',
    'OptimizedConnectionAdapter',
    'AsyncDatabaseManager',
    'OptimizedSQLiteAdapter'
]
