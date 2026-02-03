# Docker Deployment Guide (Linux)

This guide documents how to deploy the TSF ERP Engine using Docker Compose on a Linux server.

## Architecture
The system is divided into three isolated containers:
1.  **db**: PostgreSQL 15 database.
2.  **backend**: Django API server.
3.  **frontend**: Next.js user interface.

## Prerequisites
- Docker installed on your Linux server.
- Docker Compose installed.

## Deployment Steps

1.  **Clone the Repository**:
    ```bash
    git clone -b engine-stable https://github.com/MahdiChalhoub/TSFSYSTEM.git
    cd TSFSYSTEM
    ```

2.  **Verify Environment**:
    The `docker-compose.yml` uses default values, but you can override them by creating a `.env` file in the root:
    ```env
    DB_NAME=tsfdb
    DB_USER=postgres
    DB_PASSWORD=your_secure_password
    ```

3.  **Build and Start Containers**:
    ```bash
    docker-compose up -d --build
    ```

4.  **Initial Database Setup**:
    Once the containers are running, you need to run migrations and seed the core data:
    ```bash
    docker exec -it tsf_backend python manage.py migrate
    docker exec -it tsf_backend python manage.py shell -c "from erp.module_manager import ModuleManager; ModuleManager.sync()"
    ```

5.  **Access the System**:
    - **Frontend**: http://your-server-ip:3000
    - **Backend API**: http://your-server-ip:8000

## Managing Modules
To install your exported modules on the server:
1.  Upload your `.modpkg.zip` to the server (using SCP or the SaaS UI).
2.  The UI will handle the upload to the `backend` container and the `ModuleManager` will extract it into the persistent `apps/` volume.

## Logs and Troubleshooting
- View all logs: `docker-compose logs -f`
- Backend logs: `docker logs -f tsf_backend`
- Restart system: `docker-compose restart`
