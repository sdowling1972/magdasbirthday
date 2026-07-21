from __future__ import annotations

from pathlib import Path

import boto3
from botocore.exceptions import ClientError

from app.config import settings


class Storage:
    def save(self, filename: str, data: bytes, content_type: str) -> None:
        raise NotImplementedError

    def delete(self, filename: str) -> None:
        raise NotImplementedError

    def open(self, filename: str) -> tuple[bytes, str] | None:
        raise NotImplementedError

    def public_url(self, filename: str) -> str:
        """URL path or absolute URL for the browser."""
        return f"/api/photos/files/{filename}"


class LocalStorage(Storage):
    def __init__(self, root: Path) -> None:
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, filename: str, data: bytes, content_type: str) -> None:
        dest = self.root / filename
        dest.write_bytes(data)

    def delete(self, filename: str) -> None:
        path = self.root / filename
        if path.exists():
            path.unlink()

    def open(self, filename: str) -> tuple[bytes, str] | None:
        path = self.root / filename
        if not path.exists():
            return None
        # content type inferred by caller from DB
        return path.read_bytes(), "application/octet-stream"


class S3Storage(Storage):
    def __init__(self, bucket: str, prefix: str = "photos/") -> None:
        self.bucket = bucket
        self.prefix = prefix.lstrip("/")
        if self.prefix and not self.prefix.endswith("/"):
            self.prefix += "/"
        self.client = boto3.client("s3", region_name=settings.aws_region or None)

    def _key(self, filename: str) -> str:
        return f"{self.prefix}{filename}"

    def save(self, filename: str, data: bytes, content_type: str) -> None:
        self.client.put_object(
            Bucket=self.bucket,
            Key=self._key(filename),
            Body=data,
            ContentType=content_type,
        )

    def delete(self, filename: str) -> None:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=self._key(filename))
        except ClientError:
            pass

    def open(self, filename: str) -> tuple[bytes, str] | None:
        try:
            obj = self.client.get_object(Bucket=self.bucket, Key=self._key(filename))
            body = obj["Body"].read()
            content_type = obj.get("ContentType") or "application/octet-stream"
            return body, content_type
        except ClientError:
            return None


def get_storage() -> Storage:
    if settings.s3_bucket:
        return S3Storage(settings.s3_bucket, settings.s3_prefix)
    upload = Path(settings.upload_dir)
    if not upload.is_absolute():
        upload = Path(__file__).resolve().parent.parent / upload
    return LocalStorage(upload)
