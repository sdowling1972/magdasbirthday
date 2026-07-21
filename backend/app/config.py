from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # local | production — production disables docs and requires non-default secrets
    environment: str = "local"
    database_url: str = "postgresql+psycopg2://sean@localhost:5432/magdasbirthday"
    admin_password: str = "magda-admin"
    secret_key: str = "change-me-to-a-long-random-string"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    upload_dir: str = "uploads"
    party_name: str = "Magda's Big Birthday"
    party_date: str = "2026-08-15"
    party_location: str = "38 Bowcott Cres., London"
    party_description: str = "Join us to celebrate Magda!"
    access_token_expire_minutes: int = 60 * 12

    # When set, photos are stored in S3 instead of local disk
    s3_bucket: str = ""
    s3_prefix: str = "photos/"
    aws_region: str = "us-east-1"

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in {"production", "prod"}

    @property
    def cookie_secure(self) -> bool:
        return self.is_production

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def validate_for_runtime(self) -> None:
        if not self.is_production:
            return
        if self.secret_key in {"", "change-me-to-a-long-random-string"} or len(self.secret_key) < 32:
            raise RuntimeError("SECRET_KEY must be a long random value in production")
        if self.admin_password in {"", "magda-admin"} or len(self.admin_password) < 12:
            raise RuntimeError("ADMIN_PASSWORD must be a strong value in production")


settings = Settings()
settings.validate_for_runtime()
