#!/usr/bin/env node
'use strict';

// Materialize one skill plus the shared references it names. Repository-root
// references stay canonical in source; a standalone installation is self-contained.
const fs = require('node:fs');
const path = require('node:path');

function assembleSkill({ root, skill, destination }) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill)) throw new Error('invalid skill name');
  root = fs.realpathSync(root);
  destination = path.resolve(destination);
  let outputParent = path.dirname(destination);
  while (outputParent !== path.dirname(outputParent)) {
    if (fs.existsSync(outputParent) && fs.lstatSync(outputParent).isSymbolicLink()) {
      throw new Error(`symbolic link in output path: ${outputParent}`);
    }
    outputParent = path.dirname(outputParent);
  }
  if (fs.existsSync(destination)) throw new Error(`output already exists: ${destination}`);
  const source = path.join(root, 'skills', skill);
  if (destination === source || destination.startsWith(source + path.sep)) {
    throw new Error('output must not be inside the source skill');
  }
  const plan = new Map();

  function regular(input) {
    const rel = path.relative(root, input);
    if (rel.startsWith('..' + path.sep) || rel === '..' || path.isAbsolute(rel)) {
      throw new Error(`resource escapes repository: ${input}`);
    }
    let cursor = root;
    for (const part of rel.split(path.sep)) {
      cursor = path.join(cursor, part);
      if (fs.lstatSync(cursor).isSymbolicLink()) throw new Error(`symbolic link: ${cursor}`);
    }
    return fs.statSync(input);
  }

  function collect(input, output) {
    const stat = regular(input);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(input)) collect(path.join(input, name), path.join(output, name));
      return;
    }
    if (!stat.isFile()) throw new Error(`resource is not a regular file: ${input}`);
    if (plan.has(output)) {
      if (plan.get(output).input !== input) throw new Error(`resource collision: ${output}`);
      return;
    }
    const entry = { input, content: fs.readFileSync(input) };
    plan.set(output, entry); // register before following references, allowing cycles
    if (!input.endsWith('.md')) return;
    const reference = /(^|[\s`(<])((?:\.\.\/)*references\/[A-Za-z0-9._][A-Za-z0-9._/-]*\.md)(?=[\s`)>#]|$)/gm;
    entry.content = entry.content.toString('utf8').replace(reference, (match, prefix, ref) => {
      const name = ref.replace(/^(?:\.\.\/)*references\//, '');
      if (name.split('/').includes('..')) throw new Error(`reference traversal: ${ref}`);
      const target = path.join(root, 'references', name);
      const outputRef = path.join('references', name);
      collect(target, outputRef);
      return prefix + path.relative(path.dirname(output), outputRef).split(path.sep).join('/');
    });
  }

  collect(source, '.');
  if (!plan.has('SKILL.md')) throw new Error('source skill has no SKILL.md');
  // All dependencies are checked before any output is written.
  fs.mkdirSync(destination, { recursive: true });
  for (const [rel, entry] of plan) {
    const target = path.join(destination, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entry.content, { mode: fs.statSync(entry.input).mode });
  }
  return { skill, destination, files: [...plan.keys()].sort() };
}

module.exports = { assembleSkill };
if (require.main === module) {
  const [skill, destination] = process.argv.slice(2);
  if (!skill || !destination) {
    console.error('Usage: node scripts/assemble-skill.js <skill-name> <new-output-directory>');
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(assembleSkill({ root: path.join(__dirname, '..'), skill, destination })));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
