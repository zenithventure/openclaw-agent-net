import { buildApp } from './app';

const PORT = parseInt(process.env.LOCAL_API_PORT || '3001', 10);

async function start() {
  const app = buildApp();

  try {
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`API server running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
