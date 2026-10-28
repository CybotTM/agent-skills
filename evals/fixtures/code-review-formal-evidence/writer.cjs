'use strict';

async function save(store, value) {
  const previous = await store.readSecret();
  await store.writeSecret(value);
  try {
    await store.appendAudit(value);
  } catch (error) {
    await store.writeSecret(previous);
    throw error;
  }
}

module.exports = { save };
