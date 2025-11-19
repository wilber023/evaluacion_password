// src/app.js
const express = require('express');
const passwordRoutes = require('./routes/password');

const createApp = () => {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path}`);
    next();
  });

  app.use('/api/v1/password', passwordRoutes);

  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'OK',
      message: 'Password Evaluator API is running',
      timestamp: new Date().toISOString()
    });
  });

  app.get('/', (req, res) => {
    res.status(200).json({
      name: 'Password Evaluator API',
      version: '2.0.0',
      description: 'API para evaluar la fuerza de contraseñas con MySQL',
      endpoints: {
        evaluate: 'POST /api/v1/password/evaluate',
        health: 'GET /health'
      }
    });
  });

  app.use((req, res) => {
    res.status(404).json({
      error: 'Endpoint no encontrado',
      message: `La ruta ${req.method} ${req.originalUrl} no existe`
    });
  });

  app.use((error, req, res, next) => {
    console.error('Error no manejado:', error.message);
    
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Ha ocurrido un error inesperado. Por favor intente nuevamente.'
    });
  });

  return app;
};
 
module.exports = createApp;