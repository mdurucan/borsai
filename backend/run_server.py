import multiprocessing
import os
import sys

# PyInstaller + macOS spawn fix
if getattr(sys, "frozen", False):
    multiprocessing.freeze_support()
    os.chdir(os.path.dirname(sys.executable))

from dotenv import load_dotenv
load_dotenv()

import main as app_module  # noqa: F401

import uvicorn

port = int(os.getenv("PORT", os.getenv("BACKEND_PORT", "8000")))

uvicorn.run(
    app_module.app,
    host="127.0.0.1",
    port=port,
    log_level="info",
    loop="asyncio",
    workers=1,
)
