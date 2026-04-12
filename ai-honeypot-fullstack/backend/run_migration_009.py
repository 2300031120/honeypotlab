#!/usr/bin/env python3
"""Run database migration 009: Add indexes for query optimization"""

from core.database import db

def run_migration():
    """Execute the index migration"""
    with open('migrations/009_database_indexes.sql', 'r') as f:
        sql = f.read()
    
    with db() as conn:
        # Split by semicolon and execute each statement
        statements = [s.strip() for s in sql.split(';') if s.strip()]
        
        for statement in statements:
            try:
                conn.execute(statement)
                print(f"Executed: {statement[:50]}...")
            except Exception as e:
                print(f"Error executing statement: {e}")
                print(f"Statement: {statement[:100]}...")
        
        conn.commit()
        print("Migration 009 completed successfully")

if __name__ == "__main__":
    run_migration()
