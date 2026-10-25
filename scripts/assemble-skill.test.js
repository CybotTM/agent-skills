const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { assembleSkill } = require('./assemble-skill');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'assemble-skill-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const root = path.join(dir, 'repo');
  fs.mkdirSync(path.join(root, 'skills', 'review'), { recursive: true });
  fs.mkdirSync(path.join(root, 'references'));
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  return { root, write, destination: path.join(dir, 'review') };
}

test('a standalone copy retains shared references and rewrites paths', (t) => {
  const f = fixture(t);
  f.write('skills/review/SKILL.md', 'Read [policy](../../references/policy.md) and `references/done.md`.');
  f.write('references/policy.md', 'Policy. Also read `references/done.md`.');
  f.write('references/done.md', 'Done means observed outcome.');
  assembleSkill({ root: f.root, skill: 'review', destination: f.destination });
  assert.equal(fs.readFileSync(path.join(f.destination, 'SKILL.md'), 'utf8'),
    'Read [policy](references/policy.md) and `references/done.md`.');
  assert.equal(fs.readFileSync(path.join(f.destination, 'references/policy.md'), 'utf8'),
    'Policy. Also read `done.md`.');
  assert.ok(fs.existsSync(path.join(f.destination, 'references/done.md')));
  fs.rmSync(f.root, { recursive: true });
  assert.equal(fs.readFileSync(path.join(f.destination, 'references/done.md'), 'utf8'),
    'Done means observed outcome.');
});

test('missing required shared reference fails before creating output', (t) => {
  const f = fixture(t);
  f.write('skills/review/SKILL.md', 'See `references/absent.md`.');
  assert.throws(() => assembleSkill({ root: f.root, skill: 'review', destination: f.destination }), /absent/);
  assert.equal(fs.existsSync(f.destination), false);
});

test('existing output is never overwritten', (t) => {
  const f = fixture(t);
  f.write('skills/review/SKILL.md', 'Review.');
  fs.mkdirSync(f.destination);
  fs.writeFileSync(path.join(f.destination, 'keep.txt'), 'user content');
  assert.throws(() => assembleSkill({ root: f.root, skill: 'review', destination: f.destination }), /exists/);
  assert.equal(fs.readFileSync(path.join(f.destination, 'keep.txt'), 'utf8'), 'user content');
});

test('a resource symlink cannot read outside the source tree', (t) => {
  const f = fixture(t);
  f.write('skills/review/SKILL.md', 'See `references/policy.md`.');
  const outside = path.join(path.dirname(f.root), 'private.md');
  fs.writeFileSync(outside, 'do not copy');
  fs.symlinkSync(outside, path.join(f.root, 'references/policy.md'));
  assert.throws(() => assembleSkill({ root: f.root, skill: 'review', destination: f.destination }), /symbolic link/);
  assert.equal(fs.existsSync(f.destination), false);
});

test('reference traversal and skill-name traversal are refused', (t) => {
  const f = fixture(t);
  f.write('skills/review/SKILL.md', 'Read `references/../private.md`.');
  f.write('private.md', 'do not copy');
  assert.throws(() => assembleSkill({ root: f.root, skill: 'review', destination: f.destination }), /traversal/);
  assert.throws(() => assembleSkill({ root: f.root, skill: '../review', destination: f.destination }), /skill name/);
});

test('remote URLs are not treated as local resources; skill-local files survive', (t) => {
  const f = fixture(t);
  f.write('skills/review/SKILL.md', 'Read https://example.org/references/remote.md and [local](guide.md).');
  f.write('skills/review/guide.md', 'Local guide.');
  assembleSkill({ root: f.root, skill: 'review', destination: f.destination });
  assert.ok(fs.existsSync(path.join(f.destination, 'guide.md')));
  assert.equal(fs.existsSync(path.join(f.destination, 'references/remote.md')), false);
});

test('recursive shared references terminate and keep valid relative paths', (t) => {
  const f = fixture(t);
  f.write('skills/review/SKILL.md', 'Read `references/a.md`.');
  f.write('references/a.md', 'Read `references/b.md`.');
  f.write('references/b.md', 'Read `references/a.md`.');
  assembleSkill({ root: f.root, skill: 'review', destination: f.destination });
  assert.equal(fs.readFileSync(path.join(f.destination, 'references/b.md'), 'utf8'), 'Read `a.md`.');
});

test('a symlinked output parent cannot write into source', (t) => {
  const f = fixture(t);
  f.write('skills/review/SKILL.md', 'Review.');
  const alias = path.join(path.dirname(f.root), 'alias');
  fs.symlinkSync(path.join(f.root, 'skills/review'), alias);
  assert.throws(() => assembleSkill({ root: f.root, skill: 'review', destination: path.join(alias, 'nested') }), /symbolic link/);
  assert.equal(fs.existsSync(path.join(f.root, 'skills/review/nested')), false);
});
