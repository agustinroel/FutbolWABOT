module.exports = {
  apps: [{
    name: 'montemar-whatsapp-bot',
    script: 'dist/index.js',
    cwd: __dirname,
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    restart_delay: 5000,
    exp_backoff_restart_delay: 100,
    max_memory_restart: '512M',
    time: true,
    merge_logs: true,
    out_file: 'logs/bot-out.log',
    error_file: 'logs/bot-error.log',
    env: {
      NODE_ENV: 'production',
      DASHBOARD_API_HOST: '127.0.0.1'
    }
  }]
};
