from core.database import db

with db() as conn:
    tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    print("Database tables:")
    for table in tables:
        print(f"  - {table['name']}")
