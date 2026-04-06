import { buildApp } from './app.js';
import { env } from './env.js';

const app = await buildApp();
await app.listen({ port: env.PORT, host: '0.0.0.0' });
console.log(`API running on http://localhost:${env.PORT}`);
