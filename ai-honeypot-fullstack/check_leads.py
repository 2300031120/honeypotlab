from core.database import db

with db() as conn:
    rows = conn.execute('SELECT id, email, notification_channel_status, notification_error FROM leads ORDER BY id DESC LIMIT 5').fetchall()
    for row in rows:
        print(f'ID: {row["id"]}, Email: {row["email"]}, Status: {row["notification_channel_status"]}, Error: {row["notification_error"]}')
