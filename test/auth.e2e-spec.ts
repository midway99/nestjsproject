import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureSession } from './../src/auth/session.config.js';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureSession(app);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('registers a user and logs in with the same credentials', async () => {
    const credentials = {
      email: 'User@Example.com',
      name: 'Test User',
      password: 'password123',
    };

    const registration = await request(app.getHttpServer())
      .post('/auth/register')
      .send(credentials)
      .expect(201);

    expect(registration.body).toMatchObject({
      email: 'user@example.com',
      name: credentials.name,
    });
    expect(registration.body.id).toEqual(expect.any(String));
    expect(registration.body).not.toHaveProperty('password');
    expect(registration.body).not.toHaveProperty('passwordHash');

    const agent = request.agent(app.getHttpServer());
    const login = await agent
      .post('/auth/login')
      .send({
        email: credentials.email,
        password: credentials.password,
      })
      .expect(200);

    expect(login.body).toEqual(registration.body);

    await agent.get('/auth/me').expect(200).expect(registration.body);
    await agent.post('/auth/logout').expect(200);
    await agent.get('/auth/me').expect(401);
  });

  it('rejects registration with an invalid email and short password', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'not-an-email',
        name: 'A',
        password: 'short',
      })
      .expect(400);

    expect(response.body.message).toEqual(
      expect.arrayContaining([
        'email must be an email',
        'name must be longer than or equal to 2 characters',
        'password must be longer than or equal to 8 characters',
      ]),
    );
  });

  it('rejects a duplicate email', async () => {
    const user = {
      email: 'user@example.com',
      name: 'Test User',
      password: 'password123',
    };

    await request(app.getHttpServer()).post('/auth/register').send(user).expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(user)
      .expect(409);

    expect(response.body.message).toBe(
      'Пользователь с таким email уже существует',
    );
  });

  it('rejects login with an incorrect password', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'user@example.com',
        name: 'Test User',
        password: 'password123',
      })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'user@example.com',
        password: 'wrong-password',
      })
      .expect(401);

    expect(response.body.message).toBe('Неверный email или пароль');
  });
});
