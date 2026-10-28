'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const fixture = path.join(__dirname, '..', 'evals', 'fixtures', 'code-review-formal-evidence');
const { check, next } = require(path.join(fixture, 'check-model.cjs'));

test('the finite atomic model completes while the split model has a reachable crash counterexample', () => {
  const atomic = check('atomic');
  assert.equal(atomic.code, 0);
  assert.ok(atomic.checkedStates > 1, 'the success case must explore work and failure states');
  const split = check('split');
  assert.equal(split.code, 12);
  assert.equal(split.invariant, 'SettledAudit');
  for (let i = 1; i < split.trace.length; i++) {
    assert.ok(next('split', split.trace[i - 1]).some(state =>
      JSON.stringify(state) === JSON.stringify(split.trace[i])), 'each reported transition must be reachable');
  }
  assert.deepEqual(split.trace.at(-1), { pc: 'crashed', secret: 1, audit: 0 });
});

test('the green CI wrapper accepts a parser failure without a counterexample', () => {
  const invalid = spawnSync(process.execPath, [path.join(fixture, 'check-model.cjs'), 'splti'], { encoding: 'utf8' });
  assert.equal(invalid.status, 75);
  assert.match(invalid.stderr, /Model input error/);
  assert.doesNotMatch(invalid.stdout, /Invariant .* is violated|Trace:/);
  const wrapper = spawnSync(process.execPath, [path.join(fixture, 'ci.cjs')], { encoding: 'utf8' });
  assert.equal(wrapper.status, 0);
  assert.match(wrapper.stderr, /Model input error/);
  assert.match(wrapper.stdout, /PASS:/);
});
