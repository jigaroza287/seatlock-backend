import express from 'express';
import { globalErrorHandler } from './middleware/error.middleware.js';
import { addRequestId } from './middleware/request-id.middleware.js';
import { router as eventRouter } from './modules/events/events.routes.js';
import { router as screenRouter } from './modules/screens/screens.routes.js';
import { router as venueRouter } from './modules/venues/venues.routes.js';
import { AppError } from './shared/app-error.js';

export const app = express();
app.use(addRequestId);
app.use(express.json());
app.use('/api/events', eventRouter);
app.use('/api/venues', venueRouter);
app.use('/api', screenRouter);

app.use((req, _res) => {
  throw AppError.notFound(
    'Route',
    `Cannot ${req.method} the requested endpoint ${req.originalUrl}`
  );
});

app.use(globalErrorHandler);
