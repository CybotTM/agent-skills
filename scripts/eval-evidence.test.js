const assert = require('node:assert/strict');
const test = require('node:test');
const { inspectExecution, parseGrading, fingerprintFiles } = require('./eval-evidence');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const trace = (...events) => events.map((e) => JSON.stringify(e)).join('\n');

test('prose claiming a tool ran is not an observed tool call', () => {
  const r = inspectExecution(trace(
    { type: 'assistant', message: { content: [{ type: 'text', text: 'I ran Bash and all tests passed' }] } },
    { type: 'result', subtype: 'success', is_error: false, usage: { input_tokens: 4, output_tokens: 7 } },
  ));
  assert.equal(r.status, 'completed');
  assert.equal(r.tool_calls, 0);
  assert.equal(r.usage.output_tokens, 7);
});

test('execution errors and incomplete streams cannot count as completed', () => {
  assert.equal(inspectExecution(trace({ type: 'assistant', message: { content: [] } })).status, 'error');
  assert.equal(inspectExecution(trace({ type: 'result', subtype: 'error_max_turns', is_error: true })).status, 'error');
  assert.equal(inspectExecution('', { code: 'ETIMEDOUT' }).status, 'timeout');
  assert.equal(inspectExecution('not json').status, 'error');
});

test('permission denials stay blocked even when the process returns success', () => {
  assert.equal(inspectExecution(trace({ type: 'result', subtype: 'success', is_error: false,
    permission_denials: [{ tool_name: 'Bash' }] })).status, 'blocked');
});

test('real tool events and actual resolved models are retained', () => {
  const r = inspectExecution(trace(
    { type: 'assistant', message: { model: 'example-model', content: [{ type: 'tool_use', name: 'Read', id: '1', input: { file_path: '/src/a' } }] } },
    { type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.02 },
  ));
  assert.equal(r.tool_calls, 1);
  assert.deepEqual(r.models, ['example-model']);
  assert.equal(r.total_cost_usd, 0.02);
});

test('a grader cannot pass by omitting failed expectations or inventing its total', () => {
  const good = { expectations: [{ text: 'one', passed: true, evidence: 'observed one' }, { text: 'two', passed: false, evidence: 'two absent' }],
    summary: { passed: 1, failed: 1, total: 2, pass_rate: 0.5 } };
  assert.ok(parseGrading(JSON.stringify(good), ['one', 'two']));
  assert.equal(parseGrading(JSON.stringify(good), ['one', 'two', 'three']), null);
  good.summary = { passed: 2, failed: 0, total: 2, pass_rate: 1 };
  assert.equal(parseGrading(JSON.stringify(good), ['one', 'two']), null);
});

test('duplicate, substituted and unevidenced grading criteria never pass', () => {
  const good = { expectations: [{ text: 'easy', passed: true, evidence: 'observed' }, { text: 'easy', passed: true, evidence: 'observed' }],
    summary: { passed: 2, failed: 0, total: 2, pass_rate: 1 } };
  assert.equal(parseGrading(JSON.stringify(good), ['easy', 'hard']), null);
  good.expectations[1].text = 'other';
  assert.equal(parseGrading(JSON.stringify(good), ['easy', 'hard']), null);
  good.expectations[1].text = 'hard';
  good.expectations[1].evidence = '';
  assert.equal(parseGrading(JSON.stringify(good), ['easy', 'hard']), null);
});

test('package fingerprint changes when only a supporting policy changes', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eval-fingerprint-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'SKILL.md'), 'Use policy.');
  fs.writeFileSync(path.join(root, 'policy.md'), 'old policy');
  const before = fingerprintFiles(root);
  fs.writeFileSync(path.join(root, 'policy.md'), 'new policy');
  const after = fingerprintFiles(root);
  assert.equal(before.files['SKILL.md'], after.files['SKILL.md']);
  assert.notEqual(before.sha256, after.sha256);
  assert.notEqual(before.files['policy.md'], after.files['policy.md']);
});
