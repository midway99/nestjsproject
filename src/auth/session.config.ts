import type { INestApplication } from '@nestjs/common';
import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

export function configureSession(app: INestApplication) {
  const secret =
    process.env.SESSION_SECRET ?? 'development-only-change-this-secret';

  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is required in production');
  }

  const store =
    process.env.NODE_ENV === 'test'
      ? undefined
      : new (connectPgSimple(session))({
          conString:
            process.env.DATABASE_URL ??
            'postgresql://postgres:postgres@localhost:5432/nest_app',
          createTableIfMissing: true,
        });

  app.use(
    session({
      name: 'household.sid',
      secret,
      store,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.COOKIE_SECURE === 'true',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }),
  );
}
