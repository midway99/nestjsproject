import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { configureSession } from './../src/auth/session.config.js';

describe('FinanceController (e2e)', () => {
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

  it('creates, updates and deletes categories and expenses', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/register')
      .send({
        email: 'finance@example.com',
        name: 'Finance User',
        password: 'password123',
      })
      .expect(201);
    await agent
      .post('/auth/login')
      .send({
        email: 'finance@example.com',
        password: 'password123',
      })
      .expect(200);

    const categoryResponse = await agent
      .post('/finance/categories')
      .send({ name: 'Продукты' })
      .expect(201);
    const categoryId = categoryResponse.body.id as string;

    const expenseResponse = await agent
      .post('/finance/expenses')
      .send({
        type: 'expense',
        amount: 1250.5,
        description: 'Покупки на неделю',
        spentAt: '2026-09-04',
        categoryId,
      })
      .expect(201);
    const expenseId = expenseResponse.body.id as string;

    expect(expenseResponse.body).toMatchObject({
      amount: 1250.5,
      description: 'Покупки на неделю',
      category: { name: 'Продукты' },
    });

    await agent
      .patch(`/finance/expenses/${expenseId}`)
      .send({ amount: 1300 })
      .expect(200)
      .expect(({ body }) => expect(body.amount).toBe(1300));

    await agent
      .delete(`/finance/categories/${categoryId}`)
      .expect(409);

    await agent
      .delete(`/finance/expenses/${expenseId}`)
      .expect(200);

    await agent
      .delete(`/finance/categories/${categoryId}`)
      .expect(200);
  });

  it('rejects finance requests without a session', async () => {
    await request(app.getHttpServer()).get('/finance/expenses').expect(401);
  });
});
