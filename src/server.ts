import { app } from './app.js';

const port = process.env.PORT ?? 8000;

app.listen(port, (error?: Error) => {
  if (error) {
    console.log(`Can not start server due to error: ${error.message}`);
  } else {
    console.log(`Server started on port ${port}`);
  }
});
