const { test } = require('node:test');
const assert = require('node:assert');
const { repoVisibility } = require('../dist/repo.js');

const execOk = (file, args, opts, cb) => cb(null, '{"visibility":"PUBLIC"}\n', '');
const execPrivate = (file, args, opts, cb) => cb(null, '{"visibility":"PRIVATE"}\n', '');
const execFails = (file, args, opts, cb) => cb(new Error('gh: not logged in'), '', 'err');

test('public repo', async () => assert.strictEqual(await repoVisibility('/p', execOk), 'PUBLIC'));
test('private repo', async () => assert.strictEqual(await repoVisibility('/p', execPrivate), 'PRIVATE'));
test('gh failure is UNKNOWN, not a throw', async () => assert.strictEqual(await repoVisibility('/p', execFails), 'UNKNOWN'));
