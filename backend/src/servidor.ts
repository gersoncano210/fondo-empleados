import 'dotenv/config';
import { crearApp } from './app.js';

const puerto = Number(process.env.PORT) || 3000;
const app = crearApp();

app.listen(puerto, () => {
  console.log(`API escuchando en http://localhost:${puerto}`);
});