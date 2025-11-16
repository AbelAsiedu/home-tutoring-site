const request = require('supertest');
const app = require('../server');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data.db');

describe('Lessons API', () => {
  let agent;
  beforeAll(()=>{
    agent = request.agent(app);
  });

  test('tutor can login and post a report for their lesson', async () => {
    // login as tutor seeded during init
    const login = await agent.post('/login').type('form').send({ email: 'tutor@example.com', password: 'password' });
    expect([302,200]).toContain(login.status);

    // get a lesson where tutor_id = 'tutor-1'
    const lessons = await agent.get('/api/lessons?user_id=tutor-1');
    expect(lessons.status).toBe(200);
    const list = lessons.body;
    expect(Array.isArray(list)).toBe(true);
    if (list.length === 0) return;
    const lessonId = list[0].id;

    const res = await agent.post(`/api/lessons/${lessonId}/report`).send({ summary: 'Test report', homework: 'Do x', progress_score: 8 });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
  });

  test('non-matching tutor cannot post report', async () => {
    // login as a different user (student)
    const agent2 = request.agent(app);
    await agent2.post('/login').type('form').send({ email: 'student@example.com', password: 'password' });
    const lessons = await agent.get('/api/lessons?user_id=tutor-1');
    if (!lessons.body || lessons.body.length === 0) return;
    const lessonId = lessons.body[0].id;
    const res = await agent2.post(`/api/lessons/${lessonId}/report`).send({ summary: 'Bad report' });
    expect([403,401]).toContain(res.status);
  });
});
