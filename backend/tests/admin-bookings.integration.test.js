process.env.NODE_ENV = 'test';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const auth = require('../services/auth.service');
const bookingService = require('../services/admin-bookings.service');
const dashboardService = require('../services/admin-dashboard.service');
const { config } = require('../config/env');
const { signAccessToken } = require('../utils/jwt');
const { closePool } = require('../config/db');

let server, base;
let originalAuth, originalList, originalDetail, originalDashboard;

before(async () => {
  originalAuth = auth.findUserById;
  originalList = bookingService.listBookings;
  originalDetail = bookingService.getBookingById;
  originalDashboard = dashboardService.getDashboardSummary;
  auth.findUserById = async (id) => id === 991
    ? { id, name: 'Booking Admin', email: 'admin@example.com', role: 'ADMIN' }
    : id === 992 ? { id, name: 'Regular User', email: 'user@example.com', role: 'USER' } : null;
  bookingService.listBookings = async (filters) => ({ bookings: [], pagination: { ...filters, total: 0, total_pages: 0 } });
  bookingService.getBookingById = async (id) => id === 7 ? { id, booking_ref: 'BMS-TEST', status: 'CONFIRMED' } : null;
  dashboardService.getDashboardSummary = async () => ({ metrics: { total_bookings: 0 }, recent_bookings: [], upcoming_shows: [] });
  server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  base = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
  auth.findUserById = originalAuth;
  bookingService.listBookings = originalList;
  bookingService.getBookingById = originalDetail;
  dashboardService.getDashboardSummary = originalDashboard;
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await closePool();
});

function cookie(id) {
  const role = id === 991 ? 'ADMIN' : 'USER';
  return 'bms_token=' + signAccessToken({ id, role });
}
async function request(path, id) {
  const headers = {};
  if (id) headers.cookie = cookie(id);
  return fetch(base + path, { headers });
}

describe('Phase 8 Stage 6 administrator booking and dashboard routes', { skip: !config.jwt.secret }, () => {
  it('rejects unauthenticated booking list access', async () => {
    assert.equal((await request('/api/admin/bookings')).status, 401);
  });
  it('rejects USER accounts from booking management', async () => {
    assert.equal((await request('/api/admin/bookings', 992)).status, 403);
  });
  it('allows ADMIN to list bookings with validated filters', async () => {
    const response = await request('/api/admin/bookings?status=CONFIRMED&page=2&limit=10', 991);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.pagination.page, 2);
    assert.equal(body.data.pagination.status, 'CONFIRMED');
  });
  it('rejects invalid booking status filters', async () => {
    assert.equal((await request('/api/admin/bookings?status=REFUNDED', 991)).status, 400);
  });
  it('allows ADMIN to view a booking detail', async () => {
    const response = await request('/api/admin/bookings/7', 991);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.booking.booking_ref, 'BMS-TEST');
  });
  it('returns 404 for an unknown booking', async () => {
    assert.equal((await request('/api/admin/bookings/999', 991)).status, 404);
  });
  it('rejects USER accounts from the dashboard', async () => {
    assert.equal((await request('/api/admin/dashboard', 992)).status, 403);
  });
  it('allows ADMIN to load dashboard summary', async () => {
    const response = await request('/api/admin/dashboard', 991);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.metrics.total_bookings, 0);
  });
});
