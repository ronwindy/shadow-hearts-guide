@echo off
REM scripts/run-py.cmd - Cross-machine Python runner
REM Priority order:
REM 1. Local workspace .venv (works inside sandboxed terminal on any machine)
REM 2. PATH python
REM 3. Windows py launcher
REM 4. Conda / Miniconda
REM 5. Local AppData Python (current user, any version)
REM 6. Fallback user profiles (Admin, etc.)
REM 7. Program Files

set SCRIPT_DIR=%~dp0
set WORKSPACE_ROOT=%SCRIPT_DIR%..

REM 1. Local workspace venv
if exist "%WORKSPACE_ROOT%\.venv\Scripts\python.exe" (
    "%WORKSPACE_ROOT%\.venv\Scripts\python.exe" %*
    exit /b %ERRORLEVEL%
)

REM 2. Python in PATH
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    python %*
    exit /b %ERRORLEVEL%
)

REM 3. Windows Python launcher (py)
where py >nul 2>nul
if %ERRORLEVEL% equ 0 (
    py %*
    exit /b %ERRORLEVEL%
)

REM 4. Conda installations
if exist "C:\Miniconda3\python.exe" (
    "C:\Miniconda3\python.exe" %*
    exit /b %ERRORLEVEL%
)
if exist "%USERPROFILE%\miniconda3\python.exe" (
    "%USERPROFILE%\miniconda3\python.exe" %*
    exit /b %ERRORLEVEL%
)
if exist "%USERPROFILE%\anaconda3\python.exe" (
    "%USERPROFILE%\anaconda3\python.exe" %*
    exit /b %ERRORLEVEL%
)

REM 5. Current user AppData
for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python*") do (
    if exist "%%D\python.exe" (
        "%%D\python.exe" %*
        exit /b %ERRORLEVEL%
    )
)

REM 6. Legacy/alternate user AppData profiles (e.g. Admin)
for /d %%D in ("C:\Users\Admin\AppData\Local\Programs\Python\Python*") do (
    if exist "%%D\python.exe" (
        "%%D\python.exe" %*
        exit /b %ERRORLEVEL%
    )
)

REM 7. Program Files
for /d %%D in ("C:\Program Files\Python*") do (
    if exist "%%D\python.exe" (
        "%%D\python.exe" %*
        exit /b %ERRORLEVEL%
    )
)

echo [ERROR] Python not found. Checked .venv, PATH, py, Miniconda, and AppData.
exit /b 1
