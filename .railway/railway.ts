import { defineRailway, project, service, postgres, redis, github, image, preserve } from "railway/iac";

export default defineRailway(() => {
  const db = postgres("postgres");
  const cache = redis("redis");

  // Evolution API (WhatsApp via QR Code) — banco e cache próprios, isolados
  // do CRM. Ver docs/03-fluxos-whatsapp.md e evolution-whatsapp.provider.ts.
  const evolutionDb = postgres("evolution-postgres");
  const evolutionCache = redis("evolution-redis");

  const evolution = service("evolution", {
    source: image("evoapicloud/evolution-api:v2.3.7"),
    env: {
      // Precisa ser o mesmo valor de EVOLUTION_API_KEY no serviço "backend"
      // abaixo — configure os dois manualmente no painel do Railway.
      AUTHENTICATION_API_KEY: preserve(),
      DATABASE_ENABLED: "true",
      DATABASE_PROVIDER: "postgresql",
      DATABASE_CONNECTION_URI: evolutionDb.env.DATABASE_URL,
      DATABASE_SAVE_DATA_INSTANCE: "true",
      DATABASE_SAVE_DATA_NEW_MESSAGE: "true",
      DATABASE_SAVE_MESSAGE_UPDATE: "true",
      DATABASE_SAVE_DATA_CONTACTS: "true",
      DATABASE_SAVE_DATA_CHATS: "true",
      CACHE_REDIS_ENABLED: "true",
      CACHE_REDIS_URI: evolutionCache.env.REDIS_URL,
      CACHE_REDIS_PREFIX_KEY: "evolution_v2",
      // Fingerprint mais discreto que o padrão "Evolution API" (não resolveu
      // sozinho o bloqueio de IP em teste, mas não custa manter).
      CONFIG_SESSION_PHONE_CLIENT: "Chrome",
    },
  });

  const backend = service("backend", {
    source: github("laitartlucas/CRM_Luana", { branch: "main", rootDirectory: "backend" }),
    env: {
      NODE_ENV: "production",
      PORT: "3000",
      DATABASE_URL: db.env.DATABASE_URL,
      REDIS_URL: cache.env.REDIS_URL,
      // O backend (app.module.ts) lê REDIS_HOST/PORT/PASSWORD, não REDIS_URL
      // — precisam estar declaradas aqui também, senão `apply` as remove.
      REDIS_HOST: cache.env.REDISHOST,
      REDIS_PORT: cache.env.REDISPORT,
      REDIS_PASSWORD: cache.env.REDISPASSWORD,
      WHATSAPP_PROVIDER: preserve(),
      WHATSAPP_META_PHONE_NUMBER_ID: preserve(),
      WHATSAPP_META_ACCESS_TOKEN: preserve(),
      WHATSAPP_META_VERIFY_TOKEN: preserve(),
      WHATSAPP_META_APP_SECRET: preserve(),
      // Evolution API — mesma AUTHENTICATION_API_KEY configurada no serviço
      // "evolution" acima; EVOLUTION_WEBHOOK_SECRET é gerado por você (não
      // vem da Evolution), usado só pra proteger a rota de webhook.
      // Sintaxe nativa de referência do Railway — usar `evolution.env.X` num
      // template literal do JS não funciona aqui (vira "[object Object]").
      EVOLUTION_API_URL: 'http://${{evolution.RAILWAY_PRIVATE_DOMAIN}}:8080',
      EVOLUTION_API_KEY: preserve(),
      EVOLUTION_INSTANCE_NAME: preserve(),
      EVOLUTION_WEBHOOK_SECRET: preserve(),
      // Proxy residencial/móvel — necessário em produção (IP do Railway é
      // bloqueado pelo WhatsApp para pareamento por QR, confirmado em teste).
      EVOLUTION_PROXY_HOST: preserve(),
      EVOLUTION_PROXY_PORT: preserve(),
      EVOLUTION_PROXY_PROTOCOL: preserve(),
      EVOLUTION_PROXY_USERNAME: preserve(),
      EVOLUTION_PROXY_PASSWORD: preserve(),
      // Google Calendar — criar credenciais OAuth2 em console.cloud.google.com
      // (ativar "Google Calendar API"). Redirect URI a cadastrar lá (precisa
      // ser exatamente esta, passando pelo proxy /api do frontend — "connect"
      // exige o cookie de sessão/login, que só existe no domínio do frontend,
      // e o cookie de estado do OAuth precisa da mesma origem nas duas pontas):
      // https://frontend-production-b7629.up.railway.app/api/calendar-sync/oauth/callback
      GOOGLE_CALENDAR_CLIENT_ID: preserve(),
      GOOGLE_CALENDAR_CLIENT_SECRET: preserve(),
      GOOGLE_CALENDAR_REDIRECT_URI: "https://frontend-production-b7629.up.railway.app/api/calendar-sync/oauth/callback",
      // Webhook é server-to-server (Google chamando a gente) — sem cookie
      // envolvido, então esse continua batendo direto no backend.
      GOOGLE_CALENDAR_WEBHOOK_URL: "https://backend-production-2a762.up.railway.app/calendar-sync/webhook",
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
    resources: [db, cache, evolutionDb, evolutionCache, evolution, backend, frontend],
  });
});
