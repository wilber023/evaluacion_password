// src/server.js
require('dotenv').config();
const express = require('express');
const passwordRoutes = require('./routes/password');
const databaseService = require('./services/databaseService');

const app = express();

// Middlewares
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.disable('x-powered-by');

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/v1/password', passwordRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await databaseService.healthCheck();
    
    res.status(200).json({
      status: 'OK',
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: dbHealth.status,
        message: dbHealth.message
      },
      timestamp: new Date().toISOString(),
      uptime: `${process.uptime().toFixed(2)} seconds`
    });
  } catch (error) {
    res.status(200).json({
      status: 'OK',
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: 'unknown',
        message: 'Database check failed'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Password Evaluator API',
    version: '2.0.0',
    environment: process.env.NODE_ENV || 'development',
    description: 'API para evaluar la fuerza de contraseñas con MySQL',
    endpoints: {
      evaluate: 'POST /api/v1/password/evaluate',
      similarity: 'POST /api/v1/password/similarity',
      stats: 'GET /api/v1/password/stats',
      health: 'GET /health',
      info: 'GET /api/v1/password/info'
    },
    database: 'MySQL con 961,883 contraseñas',
    performance: '1-10ms por evaluación'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint no encontrado',
    message: `La ruta ${req.method} ${req.originalUrl} no existe`,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Error no manejado:', error.message);
  
  res.status(500).json({
    error: 'Error interno del servidor',
    message: 'Ha ocurrido un error inesperado. Por favor intente nuevamente.',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Inicialización del servidor
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Verificar conexión a la base de datos
    console.log('🔍 Verificando conexión a la base de datos...');
    const health = await databaseService.healthCheck();
    
    if (health.status === 'healthy') {
      console.log('✅ Base de datos MySQL conectada correctamente');
      const stats = await databaseService.getStats();
      console.log(`📊 Contraseñas en BD: ${stats.totalPasswords}`);
    } else {
      console.warn('⚠️  Base de datos no disponible:', health.error);
      console.log('ℹ️  El servidor iniciará pero algunas funciones pueden no estar disponibles');
    }

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`\n🎉 Password Evaluator API ejecutándose:`);
      console.log(`📍 Puerto: ${PORT}`);
      console.log(`📍 Entorno: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`📊 Endpoint principal: POST http://localhost:${PORT}/api/v1/password/evaluate`);
      console.log(`💾 Base de datos: MySQL con 961,883 contraseñas`);
      console.log(`⚡ Rendimiento: 1-10ms por evaluación\n`);
    });

  } catch (error) {
    console.error('💥 Error al iniciar el servidor:', error.message);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\n📴 ${signal} recibido. Cerrando servidor...`);
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Rechazo no manejado:', reason);
});

// Iniciar servidor si es el archivo principal
if (require.main === module) {
  startServer();
}

module.exports = app;