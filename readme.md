
![alt text](image.png)
# VaultPay 🏦

*Cloud-Native Architecture for VaultPay Deployment*

VaultPay is a modern, single-container two-tier banking web application. The platform leverages a Node.js (Express) backend and a React (Vite/TypeScript) frontend, seamlessly backed by a PostgreSQL database. It is designed with cloud-native principles, featuring a fully containerized deployment strategy optimized for Kubernetes (K3s).

## 🏗️ Cloud-Native Architecture

The infrastructure is designed for high availability, security, and scalability within a Kubernetes environment:

* **Networking & Access:** The VaultPay application is exposed externally using a Kubernetes **NodePort** Service, allowing direct access to the application via the cluster's node IP addresses.
* **Application Workload:** The VaultPay application (Frontend + Backend packaged in a single Docker image) runs as a **Kubernetes Deployment** with **3 replicas** to ensure high availability.
* **Stateful Database:** **PostgreSQL** runs as an internal **StatefulSet**, utilizing a `PersistentVolumeClaim` (PVC) for durable data storage. The database is strictly isolated from public access and is reachable only within the internal cluster network.
* **Configuration & Security:** Database credentials and environment variables are securely injected using Kubernetes **Secrets** and **ConfigMaps**.
* **CI/CD Pipeline (Planned):** Automated builds, Trivy security scanning, and pushes to Docker Hub (`hamza844/vaultpay`) using **GitHub Actions**.

## 🛠️ Tech Stack

* **Frontend:** React, TypeScript, Vite
* **Backend:** Node.js, Express, `pg` (node-postgres)
* **Database:** PostgreSQL 13+
* **Infrastructure:** Docker, Kubernetes (K3s)
* **CI/CD:** GitHub Actions, Docker Hub

## 📂 Repository Structure

Our directory structure follows production-grade engineering standards, separating application code from infrastructure manifests:

```text
vaultpay/
├── .github/workflows/   # CI/CD pipeline definitions
├── k8s/                 # Kubernetes Manifests
│   ├── deployment.yaml  # Application Deployment (3 replicas)
│   ├── service.yaml     # Networking (NodePort Service)
│   └── secrets.yaml     # Encrypted credentials & env vars
├── server/              # Node.js backend logic
├── src/                 # React frontend source code
├── sql/                 # Idempotent database schemas
├── Dockerfile           # Multi-stage container build
└── vite.config.ts       # Vite proxy and build configuration
```

## 🚀 Local Development

1. **Database Setup:** Start any PostgreSQL 13+ instance and create the database/user referenced in `.env.example`.

2. **Environment Variables:**
   ```bash
   cp .env.example .env
   ```
   *(Export these variables to your local shell, or pass them to your container/Pod).*

3. **Build & Run:**
   ```bash
   npm install
   npm run build
   npm start
   ```
   The application will be available at `http://localhost:3000`.
   * **Dev Mode:** Run `npm run dev` for hot-reloading (Vite runs on `:5173` and proxies `/api` requests to `:3000`).

## ⚙️ Configuration (Environment Variables)

| Variable | Description | Default / Example |
|---|---|---|
| `PORT` | Application server port | `3000` |
| `JWT_SECRET` | Secret key for JWT auth signing | *Required* |
| `AUTO_INIT_DB` | Automatically apply SQL schemas on startup | `true` |
| `DATABASE_URL` | Full connection string (optional) | `postgres://user:pass@host:5432/db` |
| `PGHOST` | Database host (if not using URL) | `localhost` or `postgres-svc` |
| `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | DB connection parameters | - |

**Database Initialization:**
The schema lives in `sql/*.sql` and is idempotent. The app automatically applies it on startup unless `AUTO_INIT_DB=false`. You can also manually initialize it via `npm run db:init` or by mounting the `sql/` directory into Postgres' standard init directory.
*Note: The app includes retry logic for DB connections (~60s tolerance) to smoothly handle delayed PostgreSQL pod startups in Kubernetes.*

## ☸️ Kubernetes Deployment

To deploy VaultPay to your K3s cluster:

1. Apply your configuration and secrets:
   ```bash
   kubectl apply -f k8s/secrets.yaml
   ```

2. Deploy the application and services:
   ```bash
   kubectl apply -f k8s/deployment.yaml
   kubectl apply -f k8s/service.yaml
   ```

3. Verify the deployment:
   ```bash
   kubectl get pods -n bankapp
   kubectl get svc -n bankapp
   ```

## 📡 API Reference

* **Auth:**
  * `POST /api/auth/register`
  * `POST /api/auth/login`
* **User:**
  * `GET /api/profile`
  * `PUT /api/profile`
  * `GET /api/dashboard`
* **Transactions:**
  * `GET /api/transactions[?direction=&q=]`
  * `GET /api/transactions/:id`
  * `POST /api/transfers`
* **System:**
  * `GET /api/health` *(Used for Kubernetes Liveness/Readiness probes)*

---

## 🤝 Connect & Learn Together

I am actively sharing my journey and learnings in DevOps, Cloud Native Architecture, and Kubernetes. For more guidance, to discuss technical architecture, or just to network, feel free to reach out!

* 💼 **LinkedIn:** [Hamza Ejaz](https://www.linkedin.com/in/hamza-ejaz-619764292/)
* 🐦 **Twitter / X:** [@Ops34Dev69068](https://x.com/Ops34Dev69068)