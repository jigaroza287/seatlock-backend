import { app } from './app.js';
import { prisma } from './db/prisma.js';

const PORT = process.env.PORT ?? 8000;

async function disconnectAndExit(code: number) {
  try {
    // Disconnect from Prisma safely
    console.log('Disconnecting Prisma Client...');
    await prisma.$disconnect();
    console.log('Prisma disconnected successfully.');
    process.exit(code);
  } catch (error) {
    console.error('Error during Prisma disconnection:', error);
    process.exit(1);
  }
}

async function startServer() {
  try {
    // 1. Verify database connection before starting the server
    console.log('Connecting to database...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database connection successful.');

    // 2. Start the Express server
    const server = app.listen(PORT, (error?: Error) => {
      if (error) {
        console.error('Can not start server:', error);
        void disconnectAndExit(1);
        return;
      }
      console.log(`Server is running on port ${PORT}`);
    });

    // 3. Graceful shutdown handler
    const gracefulShutdown = (signal: string) => {
      console.log(`\nReceived ${signal}. Starting graceful shutdown...`);

      // Stop accepting new HTTP requests
      server.close((err) => {
        if (err) {
          console.error('Error closing Express server:', err);
          void disconnectAndExit(1);
          return;
        }

        void disconnectAndExit(0);
      });
    };

    // Listen for system termination signals
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (error) {
    console.error('Database connection failed. Server shutting down.', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

void startServer();
