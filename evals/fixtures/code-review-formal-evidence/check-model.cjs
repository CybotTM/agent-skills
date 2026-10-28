'use strict';

// A self-contained finite-state checker, not a production implementation proof.
const fs = require('node:fs');
const crypto = require('node:crypto');

function next(mode, state) {
  const crashed = { ...state, pc: 'crashed' };
  if (state.pc === 'start') {
    return [mode === 'atomic'
      ? { pc: 'committed', secret: 1, audit: 1 }
      : { pc: 'written', secret: 1, audit: 0 }, crashed];
  }
  if (state.pc === 'written') return [{ pc: 'committed', secret: 1, audit: 1 }, crashed];
  if (state.pc === 'committed') return [crashed];
  return [];
}

function check(mode) {
  if (!['atomic', 'split'].includes(mode)) throw new SyntaxError(`Unknown model input: ${mode}`);
  const queue = [[{ pc: 'start', secret: 0, audit: 0 }]];
  const seen = new Set();
  while (queue.length) {
    const trace = queue.shift();
    const state = trace[trace.length - 1];
    const key = JSON.stringify(state);
    if (seen.has(key)) continue;
    seen.add(key);
    if (['committed', 'crashed'].includes(state.pc) && state.secret !== state.audit) {
      return { code: 12, checkedStates: seen.size, invariant: 'SettledAudit', trace };
    }
    for (const successor of next(mode, state)) queue.push([...trace, successor]);
  }
  return { code: 0, checkedStates: seen.size };
}

function main() {
  let result;
  try {
    result = check(process.argv[2]);
  } catch (error) {
    console.error(`Model input error: ${error.message}`);
    process.exitCode = 75;
    return;
  }
  console.log('Property: SettledAudit (terminal secret and audit tokens match)');
  console.log('Bounds: one writer, one write, process loss; no concurrency, restart or retry');
  console.log(`Model artifact SHA-256: ${crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex')}`);
  console.log(`States explored: ${result.checkedStates}`);
  if (result.code === 12) {
    console.log(`Invariant ${result.invariant} is violated.`);
    console.log(`Trace: ${JSON.stringify(result.trace)}`);
  } else {
    console.log('Complete finite search: no invariant violation.');
  }
  process.exitCode = result.code;
}

if (require.main === module) main();
module.exports = { check, next };
