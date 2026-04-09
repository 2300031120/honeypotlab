#!/bin/bash
cat > /opt/ai-honeypot/docker-compose.yml << 'EOF'
services:
  db:
    image: mariadb:10.11
    environment:
      MARIADB_ROOT_PASSWORD: rootpassword
      MARIADB_DATABASE: honeypot_db
      MARIADB_USER: user
      MARIADB_PASSWORD: password
    volumes:
      - mariadb_data:/var/lib/mysql
  backend:
    build: ./backend
    ports:
      - "5000:5000"
    environment:
      - APP_ENV=production
      - DATABASE_URL=mysql+pymysql://user:password@db:3306/honeypot_db
      - SECRET_KEY=your-secret-key-min-32-chars-long
      - CORS_ORIGINS=*
      - SPLUNK_HEC_URL=http://localhost:8000/services/collector/event
      - SPLUNK_HEC_TOKEN=a26a2b2a-29c6-4e4d-b4cf-72a9ef570307
      - SPLUNK_HEC_VERIFY_TLS=false
    depends_on:
      - db
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "80:80"
    depends_on:
      - backend
volumes:
  mariadb_data:
EOF
