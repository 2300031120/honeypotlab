# Kubernetes Auto-Scaling Setup

## Overview

This directory contains Kubernetes manifests for deploying CyberSentil with auto-scaling capabilities.

## Components

- **backend-deployment.yaml**: Backend API with Horizontal Pod Autoscaler (HPA)
- **frontend-deployment.yaml**: Frontend SPA with HPA
- **postgres-deployment.yaml**: PostgreSQL database with persistent storage
- **redis-deployment.yaml**: Redis cache with persistent storage
- **secrets.yaml**: Kubernetes secrets for sensitive configuration

## Auto-Scaling Configuration

### Backend HPA
- Min replicas: 2
- Max replicas: 10
- Scale on CPU: 70% utilization
- Scale on memory: 80% utilization

### Frontend HPA
- Min replicas: 2
- Max replicas: 8
- Scale on CPU: 70% utilization
- Scale on memory: 80% utilization

## Deployment Steps

### 1. Update Secrets
Edit `secrets.yaml` and replace `CHANGE_ME` with actual values from your `.env` file.

### 2. Apply Kubernetes Manifests
```bash
kubectl apply -f infrastructure/kubernetes/
```

### 3. Verify Deployment
```bash
kubectl get pods
kubectl get hpa
kubectl get services
```

### 4. Monitor Auto-Scaling
```bash
kubectl describe hpa cybersentil-backend-hpa
kubectl describe hpa cybersentil-frontend-hpa
```

## Storage

- PostgreSQL: 10Gi persistent volume
- Redis: 1Gi persistent volume

## Resource Limits

### Backend
- Request: 256Mi memory, 250m CPU
- Limit: 512Mi memory, 500m CPU

### Frontend
- Request: 128Mi memory, 100m CPU
- Limit: 256Mi memory, 200m CPU

### PostgreSQL
- Request: 512Mi memory, 250m CPU
- Limit: 1Gi memory, 500m CPU

### Redis
- Request: 128Mi memory, 100m CPU
- Limit: 256Mi memory, 200m CPU

## Notes

- This setup requires a Kubernetes cluster (minikube, EKS, GKE, AKS, etc.)
- Persistent volumes require a storage class configured in your cluster
- Secrets should be managed using a secret management system (e.g., AWS Secrets Manager, HashiCorp Vault) in production
- Consider using Ingress controller for external access (e.g., NGINX Ingress, Traefik)
