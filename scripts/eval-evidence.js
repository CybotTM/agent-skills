'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function traceFault(events) {
  const conversation = events.filter((event) => ['assistant', 'user', 'result'].includes(event.type));
  if (conversation.at(-1)?.type !== 'result') return 'missing final conversation result';
  const pending = new Set();
  for (const event of conversation) {
    const content = event.message?.content;
    if (!Array.isArray(content)) continue;
    for (const item of content) {
      if (!item || typeof item !== 'object') return 'invalid message content';
      if (event.type === 'assistant' && item.type === 'tool_use') {
        if (typeof item.id !== 'string' || !item.id || pending.has(item.id)) return 'invalid tool call';
        pending.add(item.id);
      }
      if (event.type === 'user' && item.type === 'tool_result') {
        if (!pending.delete(item.tool_use_id)) return 'unmatched tool observation';
      }
    }
  }
  return pending.size ? 'missing tool observation' : null;
}

function inspectExecution(trace, error) {
  let events;
  try {
    events = trace.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line));
  } catch {
    return { status: error?.code === 'ETIMEDOUT' ? 'timeout' : 'error', reason: 'invalid execution trace' };
  }
  if (events.some((event) => !event || typeof event !== 'object' || Array.isArray(event))) {
    return { status: 'error', reason: 'invalid execution event' };
  }
  const result = events.findLast((event) => event.type === 'result');
  const messages = events.filter((event) => event.type === 'assistant').map((event) => event.message || {});
  const observed = {
    tool_calls: messages.flatMap((message) => message.content || []).filter((item) => item?.type === 'tool_use').length,
    tool_error_count: events.filter((event) => event.type === 'user')
      .flatMap((event) => event.message?.content || [])
      .filter((item) => item?.type === 'tool_result' && item.is_error).length,
    models: [...new Set(messages.map((message) => message.model).filter(Boolean))],
    usage: result?.usage || null,
    total_cost_usd: result?.total_cost_usd ?? null,
    duration_ms: result?.duration_ms ?? null,
    permission_denials: result?.permission_denials || [],
  };
  if (error) return { ...observed, status: error.code === 'ETIMEDOUT' ? 'timeout' : 'error', reason: error.code || 'process failed' };
  if (!result || result.is_error || result.subtype !== 'success') {
    return { ...observed, status: 'error', reason: result?.subtype || 'missing terminal result' };
  }
  if (result.permission_denials?.length) return { ...observed, status: 'blocked', reason: 'permission denied' };
  const fault = traceFault(events);
  if (fault) return { ...observed, status: 'error', reason: fault };
  return { ...observed, status: 'completed' };
}

function parseGrading(raw, expectations) {
  if (!Array.isArray(expectations) || !expectations.length || new Set(expectations).size !== expectations.length) return null;
  const expectedCount = expectations.length;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  let grade;
  try { grade = JSON.parse(match[0]); } catch { return null; }
  if (!Array.isArray(grade.expectations) || grade.expectations.length !== expectedCount ||
      !grade.expectations.every((e) => e && expectations.includes(e.text) && typeof e.passed === 'boolean' &&
        typeof e.evidence === 'string' && e.evidence.trim()) ||
      new Set(grade.expectations.map((e) => e.text)).size !== expectedCount) return null;
  const passed = grade.expectations.filter((e) => e.passed).length;
  const summary = grade.summary;
  if (!summary || summary.total !== expectedCount || summary.passed !== passed ||
      summary.failed !== expectedCount - passed || typeof summary.pass_rate !== 'number' ||
      Math.abs(summary.pass_rate - passed / expectedCount) > 0.000001) return null;
  return grade;
}

function fingerprintFiles(root, names = fs.readdirSync(root)) {
  const files = {};
  function add(name) {
    const full = path.join(root, name);
    const stat = fs.lstatSync(full);
    if (stat.isSymbolicLink()) throw new Error(`cannot fingerprint symbolic link: ${name}`);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(full).sort()) add(path.join(name, child));
    } else if (stat.isFile()) {
      files[name.split(path.sep).join('/')] = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
    } else throw new Error(`not a regular file: ${name}`);
  }
  for (const name of [...names].sort()) add(name);
  return { files, sha256: crypto.createHash('sha256').update(JSON.stringify(files)).digest('hex') };
}

module.exports = { inspectExecution, parseGrading, fingerprintFiles };
