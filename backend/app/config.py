from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    database_url: str = "sqlite:///./colony.db"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    google_api_key: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
