import jwt from 'jsonwebtoken';
import assert from 'assert';

// Load the module under test
import * as supabaseAuth from '../supabaseAuth';

async function runMiddlewareWithToken(token: string) {
  const req: any = { headers: { authorization: `Bearer ${token}` }, method: 'GET', originalUrl: '/test' };
  let called = false;
  const next = () => { called = true; };
  const res: any = {
    _status: null,
    _json: null,
    status(code: number) { this._status = code; return this; },
    json(obj: any) { this._json = obj; return this; }
  };

  await supabaseAuth.SupabaseAuthMiddleware(req, res, next);
  return { called, status: res._status, json: res._json, req };
}

(async () => {
  console.log('\n🧪 Running SupabaseAuth middleware tests...');

  // Test 1: Supabase token (string secret)
  process.env.JWT_SECRET = 'test-secret-string-change-me-please-very-long';
  // Note: supabaseAuth module reads JWT_SECRET at import time. If you change env after import, re-import might be necessary in more complex setups.
  const supToken = supabaseAuth.generateSupabaseToken('user123', '0xabc');
  assert.ok(supToken, 'Expected Supabase token to be generated');

  const r1 = await runMiddlewareWithToken(supToken as string);
  console.log('Test 1 result:', r1.called ? 'next() called' : `status ${r1.status}`);
  assert.ok(r1.called, 'Supabase token should call next()');
  assert.equal(r1.req.user.id, 'user123');

  // Test 2: Privy DID token should be rejected with clear 401
  const privyToken = jwt.sign({ sub: 'did:privy:abc123', aud: 'authenticated' }, 'other-secret', { algorithm: 'HS256', expiresIn: '1h' });
  const r2 = await runMiddlewareWithToken(privyToken);
  console.log('Test 2 result:', r2.status, r2.json);
  assert.ok(!r2.called, 'Privy token should not call next()');
  assert.equal(r2.status, 401);
  assert.ok(r2.json && /Privy/i.test(JSON.stringify(r2.json)), 'Response should mention Privy token detection');

  // Test 3: Missing Authorization header
  const reqNoAuth: any = { headers: {}, method: 'GET', originalUrl: '/test' };
  let called3 = false;
  const next3 = () => { called3 = true; };
  const res3: any = { _status: null, _json: null, status(code: number) { this._status = code; return this; }, json(obj: any) { this._json = obj; return this; } };

  await supabaseAuth.SupabaseAuthMiddleware(reqNoAuth, res3, next3);
  console.log('Test 3 result:', res3._status, res3._json);
  assert.equal(res3._status, 401);

  console.log('\n✅ All SupabaseAuth middleware tests passed');
  process.exit(0);
})().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
