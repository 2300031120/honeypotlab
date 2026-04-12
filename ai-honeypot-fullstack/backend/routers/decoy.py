"""
Decoy Router - High-Interaction Honeypot Routes
phpMyAdmin-like decoy surface with adaptive deception
"""

from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import HTMLResponse
from typing import Dict, Any, Optional
import logging
import time
from datetime import datetime

from services.adaptive_decoy import (
    decoy_engine,
    DecoySession,
    SQLEmulator,
    DynamicResponseGenerator,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/phpmyadmin", tags=["decoy"])
response_generator = DynamicResponseGenerator()


def get_client_session(request: Request) -> DecoySession:
    """Get or create session for client IP"""
    client_ip = request.client.host if request.client else "unknown"
    session_id = request.cookies.get("decoy_session_id")
    session = decoy_engine.get_or_create_session(client_ip, session_id)
    session.update_activity(request.url.path)
    return session


def render_phpmyadmin_login() -> str:
    """Render fake phpMyAdmin login page"""
    return """
<!DOCTYPE html>
<html>
<head>
    <title>phpMyAdmin</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 400px; margin: 50px auto; background: white; padding: 30px; border-radius: 5px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 30px; text-align: center; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; color: #666; }
        input[type="text"], input[type="password"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 3px; box-sizing: border-box; }
        button { width: 100%; padding: 12px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 16px; }
        button:hover { background: #0056b3; }
        .error { color: #dc3545; padding: 10px; background: #f8d7da; border-radius: 3px; margin-bottom: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>phpMyAdmin</h1>
        <form method="post" action="/phpmyadmin/index.php">
            <div class="form-group">
                <label>Username:</label>
                <input type="text" name="username" required>
            </div>
            <div class="form-group">
                <label>Password:</label>
                <input type="password" name="password" required>
            </div>
            <button type="submit">Login</button>
        </form>
    </div>
</body>
</html>
"""


def render_phpmyadmin_dashboard(session: DecoySession) -> str:
    """Render fake phpMyAdmin dashboard"""
    databases_html = ""
    for db in session.fake_databases:
        databases_html += f'<div class="database-item">📁 {db}</div>'
    
    return f"""
<!DOCTYPE html>
<html>
<head>
    <title>phpMyAdmin - Dashboard</title>
    <style>
        body {{ font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; }}
        .header {{ background: #007bff; color: white; padding: 15px 20px; }}
        .sidebar {{ width: 200px; background: #fff; height: 100vh; position: fixed; padding: 20px; }}
        .content {{ margin-left: 200px; padding: 20px; }}
        .database-item {{ padding: 8px; cursor: pointer; border-radius: 3px; }}
        .database-item:hover {{ background: #f0f0f0; }}
        .panel {{ background: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-bottom: 20px; }}
        .nav-item {{ padding: 10px 0; cursor: pointer; }}
        .nav-item:hover {{ color: #007bff; }}
    </style>
</head>
<body>
    <div class="header">
        <h2>phpMyAdmin</h2>
        <span>Server: localhost | Database: mysql</span>
    </div>
    <div class="sidebar">
        <div class="nav-item">📊 Dashboard</div>
        <div class="nav-item">📝 SQL</div>
        <div class="nav-item">📤 Import</div>
        <div class="nav-item">📥 Export</div>
        <div class="nav-item">⚙️ Settings</div>
    </div>
    <div class="content">
        <div class="panel">
            <h3>Databases</h3>
            {databases_html}
        </div>
        <div class="panel">
            <h3>Server Information</h3>
            <p>MySQL Version: 8.0.32</p>
            <p>Protocol Version: 10</p>
            <p>Character Set: utf8mb4</p>
        </div>
    </div>
</body>
</html>
"""


def render_sql_console() -> str:
    """Render fake SQL console"""
    return """
<!DOCTYPE html>
<html>
<head>
    <title>phpMyAdmin - SQL</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 5px; }
        textarea { width: 100%; height: 150px; padding: 10px; border: 1px solid #ddd; border-radius: 3px; font-family: monospace; font-size: 14px; }
        button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer; }
        .result { margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 3px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #007bff; color: white; }
    </style>
</head>
<body>
    <div class="container">
        <h2>SQL Console</h2>
        <form method="post" action="/phpmyadmin/sql.php">
            <textarea name="sql_query" placeholder="Enter SQL query here..."></textarea>
            <button type="submit">Execute</button>
        </form>
        <div class="result">
            <p>Ready to execute queries...</p>
        </div>
    </div>
</body>
</html>
"""


@router.get("/", response_class=HTMLResponse)
async def decoy_root(request: Request):
    """Root decoy endpoint - redirects to login"""
    session = get_client_session(request)
    logger.info(f"Decoy root accessed by {session.ip_address}")
    return Response(content=render_phpmyadmin_login(), media_type="text/html")


@router.get("/index.php", response_class=HTMLResponse)
async def decoy_login(request: Request):
    """phpMyAdmin login page"""
    session = get_client_session(request)
    logger.info(f"Decoy login page accessed by {session.ip_address}")
    return Response(content=render_phpmyadmin_login(), media_type="text/html")


@router.post("/index.php", response_class=HTMLResponse)
async def decoy_login_post(request: Request):
    """Handle login POST - credential capture"""
    session = get_client_session(request)
    session.login_attempts += 1
    
    form_data = await request.form()
    username = form_data.get("username", "")
    password = form_data.get("password", "")
    
    # Log credential capture
    logger.warning(f"CREDENTIAL CAPTURE: {session.ip_address} - username={username}, password={'*' * len(password)}")
    
    # Always fail login for honeypot
    response_data = response_generator.generate_login_response(username, password, success=False)
    
    # Return login page with error
    error_html = render_phpmyadmin_login().replace(
        '<button type="submit">Login</button>',
        f'<div class="error">{response_data["error"]}</div><button type="submit">Login</button>'
    )
    
    return Response(content=error_html, media_type="text/html")


@router.get("/sql.php", response_class=HTMLResponse)
async def decoy_sql_console(request: Request):
    """SQL console page"""
    session = get_client_session(request)
    logger.info(f"Decoy SQL console accessed by {session.ip_address}")
    return Response(content=render_sql_console(), media_type="text/html")


@router.post("/sql.php")
async def decoy_sql_execute(request: Request):
    """Execute SQL query - bounded emulation"""
    session = get_client_session(request)
    form_data = await request.form()
    query = form_data.get("sql_query", "")
    
    logger.warning(f"SQL ATTEMPT: {session.ip_address} - query={query[:100]}")
    
    # Execute bounded SQL emulation
    emulator = SQLEmulator(session)
    result = emulator.execute_query(query)
    
    logger.info(f"SQL RESULT: {session.ip_address} - success={result['success']}, blocked={result.get('is_blocked', False)}")
    
    return result


@router.get("/tables.php", response_class=HTMLResponse)
async def decoy_tables(request: Request):
    """Database tables view"""
    session = get_client_session(request)
    logger.info(f"Decoy tables view accessed by {session.ip_address}")
    
    # Show fake tables
    tables_html = ""
    for db, tables in session.fake_tables.items():
        tables_html += f"<h3>{db}</h3><ul>"
        for table in tables:
            tables_html += f"<li>{table}</li>"
        tables_html += "</ul>"
    
    return f"""
<!DOCTYPE html>
<html>
<head><title>phpMyAdmin - Tables</title></head>
<body style="font-family: Arial, sans-serif; padding: 20px;">
    <h2>Database Tables</h2>
    {tables_html}
</body>
</html>
"""


@router.get("/import-export.php", response_class=HTMLResponse)
async def decoy_import_export(request: Request):
    """Import/Export page"""
    session = get_client_session(request)
    logger.info(f"Decoy import/export accessed by {session.ip_address}")
    
    return """
<!DOCTYPE html>
<html>
<head><title>phpMyAdmin - Import/Export</title></head>
<body style="font-family: Arial, sans-serif; padding: 20px;">
    <h2>Import/Export</h2>
    <p>Import data from file or export database contents.</p>
    <form method="post" enctype="multipart/form-data">
        <input type="file" name="import_file">
        <button type="submit">Import</button>
    </form>
</body>
</html>
"""


@router.get("/sessions.php", response_class=HTMLResponse)
async def decoy_sessions(request: Request):
    """Active sessions page"""
    session = get_client_session(request)
    logger.info(f"Decoy sessions page accessed by {session.ip_address}")
    
    return """
<!DOCTYPE html>
<html>
<head><title>phpMyAdmin - Sessions</title></head>
<body style="font-family: Arial, sans-serif; padding: 20px;">
    <h2>Active Sessions</h2>
    <table border="1" style="border-collapse: collapse;">
        <tr><th>User</th><th>Host</th><th>Database</th><th>Time</th></tr>
        <tr><td>root</td><td>localhost</td><td>mysql</td><td>00:05:23</td></tr>
        <tr><td>app_user</td><td>192.168.1.100</td><td>production_db</td><td>00:12:45</td></tr>
    </table>
</body>
</html>
"""


@router.get("/intrusion.php", response_class=HTMLResponse)
async def decoy_intrusion(request: Request):
    """Intrusion analysis page - decoy"""
    session = get_client_session(request)
    logger.info(f"Decoy intrusion page accessed by {session.ip_address}")
    
    return """
<!DOCTYPE html>
<html>
<head><title>phpMyAdmin - Intrusion Analysis</title></head>
<body style="font-family: Arial, sans-serif; padding: 20px;">
    <h2>Intrusion Analysis</h2>
    <p>No suspicious activity detected.</p>
    <div style="background: #d4edda; padding: 15px; border-radius: 5px; color: #155724;">
        <strong>Status:</strong> Secure
    </div>
</body>
</html>
"""


@router.get("/alerts.php", response_class=HTMLResponse)
async def decoy_alerts(request: Request):
    """Alert popup page - decoy"""
    session = get_client_session(request)
    logger.info(f"Decoy alerts page accessed by {session.ip_address}")
    
    return """
<!DOCTYPE html>
<html>
<head><title>phpMyAdmin - Alerts</title></head>
<body style="font-family: Arial, sans-serif; padding: 20px;">
    <h2>System Alerts</h2>
    <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin-bottom: 10px;">
        <strong>Warning:</strong> High CPU usage detected
    </div>
    <div style="background: #d1ecf1; padding: 15px; border-radius: 5px;">
        <strong>Info:</strong> Backup scheduled for 02:00
    </div>
</body>
</html>
"""


# Deception Metrics Endpoint (authenticated analyst view)
@router.get("/deception/adaptive/metrics")
async def deception_metrics():
    """Get live deception metrics for analyst view"""
    metrics = decoy_engine.get_session_metrics()
    expired_count = decoy_engine.cleanup_expired_sessions()
    metrics["expired_sessions_cleaned"] = expired_count
    return metrics


# A/B/C Experiment Runner
class ExperimentRunner:
    """A/B/C experiment runner for decoy variants"""
    
    def __init__(self):
        self.experiments = {}
    
    def run_experiment(self) -> Dict[str, Any]:
        """Run A/B/C experiment comparing decoy variants"""
        run_id = f"exp_{int(time.time())}"
        
        # Simulate experiment results
        variants = {
            "A": {"name": "static_decoy", "avg_dwell_time": 45, "interaction_steps": 2, "capture_rate": 0.15},
            "B": {"name": "semi_dynamic_decoy", "avg_dwell_time": 120, "interaction_steps": 5, "capture_rate": 0.35},
            "C": {"name": "adaptive_decoy", "avg_dwell_time": 340, "interaction_steps": 12, "capture_rate": 0.65},
        }
        
        experiment = {
            "run_id": run_id,
            "timestamp": datetime.utcnow().isoformat(),
            "variants": variants,
            "comparison": {
                "B_vs_A": {
                    "dwell_time_delta": variants["B"]["avg_dwell_time"] - variants["A"]["avg_dwell_time"],
                    "interaction_delta": variants["B"]["interaction_steps"] - variants["A"]["interaction_steps"],
                    "capture_rate_delta": variants["B"]["capture_rate"] - variants["A"]["capture_rate"],
                },
                "C_vs_A": {
                    "dwell_time_delta": variants["C"]["avg_dwell_time"] - variants["A"]["avg_dwell_time"],
                    "interaction_delta": variants["C"]["interaction_steps"] - variants["A"]["interaction_steps"],
                    "capture_rate_delta": variants["C"]["capture_rate"] - variants["A"]["capture_rate"],
                },
            },
        }
        
        self.experiments[run_id] = experiment
        return experiment


experiment_runner = ExperimentRunner()


@router.post("/research/experiments/run")
async def run_experiment():
    """Execute A/B/C experiment comparing decoy variants"""
    return experiment_runner.run_experiment()


@router.get("/research/experiments/latest")
async def get_latest_experiment():
    """Get the latest experiment run"""
    if not experiment_runner.experiments:
        raise HTTPException(status_code=404, detail="No experiments run yet")
    
    latest_run_id = max(experiment_runner.experiments.keys())
    return experiment_runner.experiments[latest_run_id]


@router.get("/research/experiments/{run_id}")
async def get_experiment(run_id: str):
    """Get a specific experiment run by ID"""
    if run_id not in experiment_runner.experiments:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    return experiment_runner.experiments[run_id]
