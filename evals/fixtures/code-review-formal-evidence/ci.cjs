'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const checker = path.join(__dirname, 'check-model.cjs');

const positive = spawnSync(process.execPath, [checker, 'atomic'], { encoding: 'utf8' });
process.stdout.write(positive.stdout);
if (positive.status !== 0) process.exit(1);

const negative = spawnSync(process.execPath, [checker, 'splti'], { encoding: 'utf8' });
process.stdout.write(negative.stdout);
process.stderr.write(negative.stderr);
if (negative.status === 0) process.exit(1);
console.log('PASS: production writer verified; legacy variant rejected.');
