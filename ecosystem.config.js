module.exports = {
  apps: [
    {
      name: 'hausmeister-ticket-system',
      script: './src/server.js',
      instances: 1, // Must remain 1 due to SQLite single-writer lock constraints
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 5585
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5585
      }
    }
  ]
};
