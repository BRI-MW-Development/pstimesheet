// PM2 process config for PS TimeSheet.
// Start:   pm2 start ecosystem.config.js
// Reload:  pm2 reload ps-timesheet
// Logs:    pm2 logs ps-timesheet
// Monitor: pm2 monit

module.exports = {
  apps: [
    {
      name: 'ps-timesheet',
      script: 'dist/main.js',
      cwd: './backend',

      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',

      // Keep logs tidy
      out_file: './logs/app.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,

      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
