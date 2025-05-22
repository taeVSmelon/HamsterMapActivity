import express from 'express';
import createBotClient from './bot.js';

const app = express();
createBotClient(app); // ← สำคัญมาก

app.listen(3000, () => {
  console.log('Server started on port 3000');
});
