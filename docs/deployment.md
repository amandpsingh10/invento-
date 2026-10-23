# Deployment

## Local / staging via Docker Compose

`docker compose up --build` from the repo root builds and runs everything (see `docker-compose.yml`): Postgres, a one-shot `migrate` job (`prisma migrate deploy` + seed), the backend API, and the frontend behind nginx (which also reverse-proxies `/api/*` to the backend container so the browser only ever talks to one origin — no CORS to configure in this mode).

## Production — recommended AWS architecture

```
Route 53 (DNS)
   |
ACM (TLS) + CloudFront  ->  S3 (frontend static build)
   |
Application Load Balancer  ->  ECS Fargate service (backend container)
                                        |
                                   RDS PostgreSQL (Multi-AZ)
                                        |
                                   S3 (uploaded Excel files, generated reports)

Secrets Manager   -> injected as ECS task environment variables (DATABASE_URL, JWT secrets, etc.)
CloudWatch        -> ECS/RDS logs & metrics
```

Nothing in the application code is AWS-specific — `backend/src/lib/storage.ts` defines a small `StorageDriver` interface (`put`/`get`) that the rest of the app depends on; swap the local-disk implementation for one backed by `@aws-sdk/client-s3` when `STORAGE_DRIVER=s3`, and nothing else changes. Same idea for any other provider (Azure Blob, GCS) — implement the interface, flip the env var.

### Suggested service mapping

| Concern | Service |
|---|---|
| Frontend static hosting | S3 + CloudFront (build output of `frontend/Dockerfile`'s nginx image can also run on ECS/App Runner if you'd rather not manage a CDN bucket separately) |
| Backend API | ECS Fargate (or App Runner for a simpler single-container deploy) |
| Database | RDS for PostgreSQL, Multi-AZ for production |
| File storage | S3 (`AWS_S3_BUCKET`) |
| DNS | Route 53 |
| TLS | AWS Certificate Manager, terminated at the ALB/CloudFront |
| Secrets | Secrets Manager, injected as ECS task-definition environment variables — never baked into the image |
| Monitoring | CloudWatch Logs + Alarms (ECS service, RDS) |
| Optional cache | ElastiCache for Redis (`REDIS_URL` is wired into env config as a placeholder; no caching logic depends on it yet) |

### Deploy sequence

1. Build & push the backend image (`backend/Dockerfile`) to ECR.
2. Run `prisma migrate deploy` against the production database as a one-off ECS task (same image, overridden command) — **before** rolling the new service revision, so the schema is always ahead of or equal to the code that expects it.
3. Update the ECS service to the new task definition (rolling deployment).
4. Build the frontend (`frontend/Dockerfile`, `VITE_API_URL` pointed at the real API origin) and publish to S3/CloudFront, or deploy the nginx image if serving it from ECS instead.

The CI workflow (`.github/workflows/ci.yml`) builds both Docker images and stops there — the `deploy` job is a placeholder with no cloud credentials wired in; connect it to whichever of the above you provision (e.g. `aws-actions/amazon-ecs-deploy-task-definition`).

## Environment variables

See `.env.example` at the repo root for the full list with descriptions. Never commit a real `.env`. In ECS/Fargate, inject secrets via task-definition `secrets` (pulling from Secrets Manager), not plain `environment` blocks, for anything sensitive (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`, `DATABASE_URL`, AWS credentials if not using an IAM task role).

## Database migrations in production

Always `prisma migrate deploy`, never `prisma migrate dev` (which can prompt interactively and is meant for local schema iteration) or `prisma db push` (which bypasses the migration history). Run it as a discrete step before the new application revision goes live, exactly as the `migrate` service does in `docker-compose.yml`.
