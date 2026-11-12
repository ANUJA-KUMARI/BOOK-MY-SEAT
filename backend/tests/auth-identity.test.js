process.env.NODE_ENV = 'test';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const authController = require('../controllers/auth.controller');
const authService = require('../services/auth.service');

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

describe('Stage 4 — current-user identity endpoint', () => {
  it('reloads the account by verified user id and returns a safe profile', async () => {
    const original = authService.findUserById;
    let requestedId;
    authService.findUserById = async (id) => {
      requestedId = id;
      return { id: 42, name: 'Test User', email: 'test@example.com', role: 'USER' };
    };

    try {
      const res = responseRecorder();
      await authController.currentUser({ auth: { id: 42, role: 'USER' } }, res);

      assert.equal(requestedId, 42);
      assert.equal(res.statusCode, 200);
      assert.deepEqual(res.body, {
        success: true,
        data: {
          user: { id: 42, name: 'Test User', email: 'test@example.com', role: 'USER' },
        },
      });
      assert.equal(JSON.stringify(res.body).includes('password_hash'), false);
    } finally {
      authService.findUserById = original;
    }
  });

  it('rejects a token identity whose account no longer exists', async () => {
    const original = authService.findUserById;
    authService.findUserById = async () => null;

    try {
      await assert.rejects(
        authController.currentUser({ auth: { id: 42, role: 'USER' } }, responseRecorder()),
        (error) => error.status === 401 && /account is no longer available/i.test(error.message),
      );
    } finally {
      authService.findUserById = original;
    }
  });
});
