from pydantic_settings import SettingsConfigDict, BaseSettings
from pathlib import Path

ENV_PATH = Path("C:\Users\LENOVO\Codes\TaxIQ\TaxIQ\FastAPI_AI\.env")

class Settings(BaseSettings):

    GEMINI_API_KEY:str

    JWT_SECRET:str
    ALGORITHM:str

    model_config = SettingsConfigDict(
    env_file=ENV_PATH,
    env_file_encoding="utf-8",
    extra="ignore"
    )


Config = Settings()