import { config } from './config/env.js';
import { startDashboardApi } from './modules/dashboard/api.js';

const server = startDashboardApi();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close((error) => {
      if (error) {
        console.error(
          'No se pudo cerrar el Dashboard API correctamente:',
          error
        );
        process.exitCode = 1;
      }
    });
  });
}

if (!config.dashboardApiToken) {
  console.error(
    'DASHBOARD_API_TOKEN está vacío. Configura un secreto antes de exponer el API.'
  );
}
