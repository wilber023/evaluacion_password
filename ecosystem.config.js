// Configuración de PM2 para Password Evaluator API
module.exports = {
  apps: [{
    name: 'password-evaluator-api',
    script: './src/server.js',

    // Modo de ejecución
    instances: 'max', // Usar todos los núcleos disponibles
    exec_mode: 'cluster', // Modo cluster para balanceo de carga

    // Variables de entorno
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },

    // Auto-restart
    watch: false, // No observar cambios en producción
    max_memory_restart: '500M', // Reiniciar si usa más de 500MB

    // Logs
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,

    // Control de reintentos
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000,

    // Manejo de señales
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,

    // Configuración avanzada
    exp_backoff_restart_delay: 100,

    // Métricas y monitoreo
    instance_var: 'INSTANCE_ID'
  }]
};
