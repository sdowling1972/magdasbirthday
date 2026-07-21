from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "postgresql+psycopg2://sean@localhost:5432/magdasbirthday"
    admin_password: str = "magda-admin"
    secret_key: str = "change-me-to-a-long-random-string"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    upload_dir: str = "uploads"
    party_name: str = "Magda's Big Birthday"
    party_date: str = "2026-08-15"
    party_location: str = "38 Bowcott Cres., London"
    party_description: str = "Join us to celebrate Magda!"
    access_token_expire_minutes: int = 60 * 24

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
