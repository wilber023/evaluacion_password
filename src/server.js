require('dotenv').config();
const createApp = require('./app');

const startServer = () => {
  const app = createApp();
  const PORT = process.env.PORT || 3000;

  const server = app.listen(PORT, () => {
    console.log(`Password Evaluator API running on port: ${PORT}`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`Endpoint: POST http://localhost:${PORT}/api/v1/password/evaluate`);
  });

  const gracefulShutdown = (signal) => {
    console.log(`Signal ${signal} received. Closing server...`);
    
    server.close((err) => {
      if (err) {
        console.error('Error closing server:', err);
        process.exit(1);
      }
      
      console.log('Server closed successfully');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('Forcing server shutdown...');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection:', reason);
    gracefulShutdown('unhandledRejection');
  });

  return server;
};

if (require.main === module) {
  startServer();
}

module.exports = startServer;