import express from 'express';
import { globalErrorHandler } from './middleware/error.middleware.js';
import { addRequestId } from './middleware/request-id.middleware.js';
import { router } from './modules/events/events.routes.js';
import { AppError } from './shared/app-error.js';

export const app = express();
app.use(addRequestId);
app.use(express.json());
app.use('/api/events', router);

app.use((req, res) => {
  throw AppError.notFound(
    'Route',
    `Cannot ${req.method} the requested endpoint ${req.originalUrl}`
  );
});

app.use(globalErrorHandler);
