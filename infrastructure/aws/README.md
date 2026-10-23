# AWS infrastructure notes

This directory documents the intended production topology (see [../../docs/deployment.md](../../docs/deployment.md) for the full write-up). No Terraform/CDK/CloudFormation is checked in yet — the application is infrastructure-agnostic by design (see `backend/src/lib/storage.ts` for the storage abstraction), so provisioning can be done with whichever IaC tool your team standardizes on.

## Minimum resources to provision

- VPC with public + private subnets across 2+ AZs
- RDS PostgreSQL 16, private subnet, Multi-AZ for production
- ECS Fargate cluster + service for the backend (`backend/Dockerfile`), private subnet, behind an ALB in the public subnet
- S3 bucket for uploaded Excel files / generated reports (private, versioned)
- S3 bucket + CloudFront distribution for the frontend static build (`frontend/Dockerfile`'s build stage output, or serve the nginx image directly on ECS if you'd rather not split it out)
- ACM certificate for the custom domain, attached to the ALB and/or CloudFront
- Route 53 hosted zone + records
- Secrets Manager entries for `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `COOKIE_SECRET`
- CloudWatch log groups for the ECS service and RDS

## IAM

The backend task role needs least-privilege access to:
- `s3:PutObject`, `s3:GetObject` on the uploads bucket only
- `secretsmanager:GetSecretValue` on the specific secret ARNs it's granted, not `*`

No AWS credentials are hardcoded anywhere in the app — in production, prefer an ECS task IAM role over `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` env vars entirely.
