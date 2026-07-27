import { defineRailway, project, service, postgres, redis, github, preserve } from "railway/iac";

export default defineRailway(() => {
  const db = postgres("postgres");
  const cache = redis("redis");

  const backend = service("backend", {
    source: github("laitartlucas/CRM_Luana", { branch: "main", rootDirectory: "backend" }),
    env: {
      NODE_ENV: "production",
      PORT: "3000",
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      WHATSAPP_PROVIDER: "mock",
      DEFAULT_TIMEZONE: "America/Sao_Paulo",
      LATE_CANCEL_HOURS: "12",
      REMINDER_HOURS_BEFORE: "24,1",
      JWT_ACCESS_SECRET: preserve(),
      JWT_ACCESS_TTL: "15m",
      JWT_REFRESH_SECRET: preserve(),
      JWT_REFRESH_TTL: "7d",
      ENCRYPTION_KEY: preserve(),
      WEB_APP_URL: preserve(),
      API_PUBLIC_URL: preserve(),
    },
  });

  const frontend = service("frontend", {
    source: github("laitartlucas/CRM_Luana", { branch: "main", rootDirectory: "frontend" }),
    env: {
      VITE_API_URL: preserve(),
    },
  });

  return project("CRM-Luana", {
    resources: [db, cache, backend, frontend],
  });
});
