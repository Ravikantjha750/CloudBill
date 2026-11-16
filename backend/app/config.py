import os
from pathlib import Path
from dotenv import load_dotenv

# Load the .env file from the backend directory
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_FILE)


class Config:
    SECRET_KEY = os.getenv(
        "SECRET_KEY",
        "development-only-change-this-secret"
    )

    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = int(os.getenv("DB_PORT", "3306"))
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_NAME = os.getenv("DB_NAME", "cloud_retail_billing")

    DEBUG = os.getenv("FLASK_DEBUG", "False").lower() == "true"