"""Initialize the catalog once before starting multiple Gunicorn workers."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import app

print("MicroInvest investment catalog initialized.")
