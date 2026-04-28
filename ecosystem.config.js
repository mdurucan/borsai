module.exports = {
  apps: [
    {
      name: "borsa-backend",
      cwd: "/Users/mdurucan/Desktop/mdurucan/LabDorado_Works/borsa/backend",
      interpreter: "/Users/mdurucan/Desktop/mdurucan/LabDorado_Works/borsa/venv/bin/python",
      script: "/Users/mdurucan/Desktop/mdurucan/LabDorado_Works/borsa/venv/bin/uvicorn",
      args: "main:app --port 8000 --log-level info",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        PYTHONPATH: "/Users/mdurucan/Desktop/mdurucan/LabDorado_Works/borsa/backend",
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/Users/mdurucan/Desktop/mdurucan/LabDorado_Works/borsa/logs/backend-error.log",
      out_file: "/Users/mdurucan/Desktop/mdurucan/LabDorado_Works/borsa/logs/backend-out.log",
    },
    {
      name: "borsa-frontend",
      cwd: "/Users/mdurucan/Desktop/mdurucan/LabDorado_Works/borsa/frontend",
      script: "pnpm",
      args: "start",
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/Users/mdurucan/Desktop/mdurucan/LabDorado_Works/borsa/logs/frontend-error.log",
      out_file: "/Users/mdurucan/Desktop/mdurucan/LabDorado_Works/borsa/logs/frontend-out.log",
    },
  ],
};
