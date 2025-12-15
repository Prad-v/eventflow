"""Application configuration."""
from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment."""
    
    # API
    api_title: str = "Status Page API"
    api_version: str = "1.0.0"
    debug: bool = False
    
    # Database
    database_url: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/statuspage"
    db_pool_size: int = 5
    db_max_overflow: int = 10
    
    # Authentication
    oidc_issuer: str = ""
    oidc_audience: str = ""
    oidc_jwks_url: str = ""
    
    # CORS
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    # Redis (optional)
    redis_url: str = ""
    
    # Slack webhook (optional)
    # Slack webhook (optional)
    slack_webhook_url: str = ""

    # OIDC / Logto
    LOGTO_ENDPOINT: str = "https://your-tenant.logto.app/"
    LOGTO_APP_ID: str = "your_app_id"
    LOGTO_AUDIENCE: str = "your_api_resource"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings."""
    return Settings()

settings = get_settings()
