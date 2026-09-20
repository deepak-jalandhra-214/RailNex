@echo off
set "PROJECT_ROOT=%~dp0"
set "BACKEND_PATH=%PROJECT_ROOT%backend"
set "VENV_PYTHON=%BACKEND_PATH%\venv\Scripts\python.exe"

if exist "%VENV_PYTHON%" (
    set "PYTHON=%VENV_PYTHON%"
) else (
    where python >nul 2>&1
    if errorlevel 1 (
        echo Python was not found. Install Python or create backend\venv first.
        exit /b 1
    )
    set "PYTHON=python"
)

cd /d "%BACKEND_PATH%"
"%PYTHON%" -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload