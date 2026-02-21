# TSFSYSTEM Deployment Guide

This guide explains how to deploy the **TSFSYSTEM ERP Suite** to a new server using Docker.

## Prerequisites

- **Docker** and **Docker Compose** installed.
- **Git** installed.
- Access to the GitHub repository.

## Deployment Steps

### 1. Clone the Repository
On your target server, run:
```bash
git clone https://github.com/MahdiChalhoub/TSFSYSTEM.git
cd TSFSYSTEM
```

### 2. Configure Environment Variables
Copy the example environment file and update it with your credentials:
```bash
chmod +x scripts/generate_prod_env.sh
./scripts/generate_prod_env.sh
nano .env # Update DB_PASSWORD, DB_NAME, etc.
```

### 3. Run the Setup Script
The `setup_server.sh` script automates the build and initial database setup:
```bash
chmod +x setup_server.sh
./setup_server.sh
```

> [!IMPORTANT]
> - Ensure **Docker** and **Docker Compose** are already running on the server.
> - The setup script will ask if you want to wipe the database. Use **'y'** for a fresh installation.

### 4. Access the System
Once finished, you can access the system at:
`http://<your-server-ip>:80/saas/login` (Standard HTTP)
or your domain if SSL is configured.

## Troubleshooting

### Port 80 Conflicts
If Port 80 is occupied, the `setup_server.sh` script will attempt to stop common services like Apache or Nginx. If it fails, manually stop them before running the script.

### Backend Logs
To check the backend logs for errors:
```bash
docker logs tsf_backend
```

### SSL Configuration
The project includes **Certbot** for SSL. Ensure your domain is correctly pointed to the server IP and update the `nginx.conf` and `docker-compose.yml` if you intend to use HTTPS in production.
