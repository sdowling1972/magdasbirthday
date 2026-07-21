terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type    = string
  default = "magdasbirthday"
}

variable "domain_name" {
  type    = string
  default = "magdas-big-bday.com"
}

variable "admin_password" {
  type      = string
  sensitive = true
}

variable "db_password" {
  type      = string
  sensitive = true
  default   = ""
}

resource "random_password" "db" {
  length  = 24
  special = false
}

resource "random_password" "secret_key" {
  length  = 48
  special = false
}

locals {
  db_password = var.db_password != "" ? var.db_password : random_password.db.result
  name        = var.project
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket" "frontend" {
  bucket = "${local.name}-frontend-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${local.name}-frontend-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_s3_bucket" "photos" {
  bucket = "${local.name}-photos-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_public_access_block" "photos" {
  bucket                  = aws_s3_bucket.photos.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "photos" {
  bucket = aws_s3_bucket.photos.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_ecr_repository" "api" {
  name                 = local.name
  image_tag_mutability = "MUTABLE"
  force_delete         = true
  image_scanning_configuration { scan_on_push = false }
}

data "aws_vpc" "default" { default = true }

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_security_group" "db" {
  name        = "${local.name}-db"
  description = "Postgres for Magda birthday API"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Reachable by App Runner (short-lived party app)"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db"
  subnet_ids = data.aws_subnets.default.ids
}

resource "aws_db_instance" "main" {
  identifier              = local.name
  engine                  = "postgres"
  engine_version          = "16"
  instance_class          = "db.t4g.micro"
  allocated_storage       = 20
  storage_type            = "gp3"
  db_name                 = "magdasbirthday"
  username                = "magda"
  password                = local.db_password
  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.db.id]
  publicly_accessible     = true
  skip_final_snapshot     = true
  deletion_protection     = false
  backup_retention_period = 7
}

resource "aws_iam_role" "apprunner_ecr" {
  name = "${local.name}-apprunner-ecr"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "build.apprunner.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr" {
  role       = aws_iam_role.apprunner_ecr.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

resource "aws_iam_role" "apprunner_instance" {
  name = "${local.name}-apprunner-instance"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "tasks.apprunner.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "apprunner_s3" {
  name = "${local.name}-photos"
  role = aws_iam_role.apprunner_instance.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"]
      Resource = [aws_s3_bucket.photos.arn, "${aws_s3_bucket.photos.arn}/*"]
    }]
  })
}

resource "aws_apprunner_service" "api" {
  count        = var.enable_apprunner ? 1 : 0
  service_name = local.name

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr.arn
    }
    auto_deployments_enabled = false
    image_repository {
      image_identifier      = "${aws_ecr_repository.api.repository_url}:latest"
      image_repository_type = "ECR"
      image_configuration {
        port = "8000"
        runtime_environment_variables = {
          DATABASE_URL      = "postgresql+psycopg2://magda:${local.db_password}@${aws_db_instance.main.address}:5432/magdasbirthday"
          ADMIN_PASSWORD    = var.admin_password
          SECRET_KEY        = random_password.secret_key.result
          ENVIRONMENT       = "production"
          CORS_ORIGINS      = "https://${var.domain_name},https://www.${var.domain_name}"
          S3_BUCKET         = aws_s3_bucket.photos.bucket
          S3_PREFIX         = "photos/"
          AWS_REGION        = var.aws_region
          PARTY_NAME        = "Magda's Big Birthday"
          PARTY_DATE        = "2026-08-15"
          PARTY_LOCATION    = "38 Bowcott Cres., London"
          PARTY_DESCRIPTION = "Join us to celebrate Magda!"
        }
      }
    }
  }

  instance_configuration {
    cpu               = "256"
    memory            = "512"
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/api/health"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  depends_on = [aws_iam_role_policy_attachment.apprunner_ecr]
}

variable "enable_apprunner" {
  type    = bool
  default = false
}

variable "api_origin_domain" {
  type        = string
  default     = ""
  description = "App Runner hostname without https:// (set after first API deploy)"
}

resource "aws_cloudfront_distribution" "site" {
  count               = var.api_origin_domain != "" ? 1 : 0
  enabled             = true
  is_ipv6_enabled     = true
  comment             = local.name
  default_root_object = "index.html"
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  origin {
    domain_name = var.api_origin_domain
    origin_id   = "apprunner-api"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  ordered_cache_behavior {
    path_pattern           = "/api/*"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "apprunner-api"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Content-Type", "Origin", "Accept"]
      cookies {
        forward           = "whitelist"
        whitelisted_names = ["magda_guest", "magda_admin"]
      }
    }
    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  count  = var.api_origin_domain != "" ? 1 : 0
  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFront"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.frontend.arn}/*"
      Condition = {
        StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.site[0].arn }
      }
    }]
  })
}

resource "aws_iam_user" "deploy" {
  name = "${local.name}-deploy"
}

resource "aws_iam_access_key" "deploy" {
  user = aws_iam_user.deploy.name
}

resource "aws_iam_user_policy" "deploy" {
  name = "${local.name}-deploy"
  user = aws_iam_user.deploy.name
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:DeleteObject", "s3:ListBucket", "s3:GetObject"]
        Resource = [aws_s3_bucket.frontend.arn, "${aws_s3_bucket.frontend.arn}/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["cloudfront:CreateInvalidation", "cloudfront:ListDistributions"]
        Resource = ["*"]
      },
      {
        Effect   = "Allow"
        Action   = ["apprunner:StartDeployment", "apprunner:DescribeService", "apprunner:ListServices"]
        Resource = ["*"]
      }
    ]
  })
}

output "frontend_bucket" { value = aws_s3_bucket.frontend.bucket }
output "photos_bucket" { value = aws_s3_bucket.photos.bucket }
output "ecr_repository_url" { value = aws_ecr_repository.api.repository_url }
output "db_endpoint" { value = aws_db_instance.main.address }
output "db_password" {
  value     = local.db_password
  sensitive = true
}
output "apprunner_service_url" {
  value = try(aws_apprunner_service.api[0].service_url, "")
}
output "apprunner_service_arn" {
  value = try(aws_apprunner_service.api[0].arn, "")
}
output "cloudfront_domain_name" {
  value = try(aws_cloudfront_distribution.site[0].domain_name, "")
}
output "cloudfront_distribution_id" {
  value = try(aws_cloudfront_distribution.site[0].id, "")
}
output "deploy_access_key_id" { value = aws_iam_access_key.deploy.id }
output "deploy_secret_access_key" {
  value     = aws_iam_access_key.deploy.secret
  sensitive = true
}
output "cloudflare_dns" {
  value = <<-EOT
    Cloudflare DNS (proxied / orange cloud):
      CNAME  @    -> ${try(aws_cloudfront_distribution.site[0].domain_name, "<cloudfront-domain>")}
      CNAME  www  -> ${try(aws_cloudfront_distribution.site[0].domain_name, "<cloudfront-domain>")}
    SSL/TLS encryption mode: Full
  EOT
}
