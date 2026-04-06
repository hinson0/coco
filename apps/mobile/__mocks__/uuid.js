/**
 * Jest mock for uuid — provides a simple unique-id generator
 * that works in the Node.js (CJS) test environment.
 */
let counter = 0;

function v4() {
  counter += 1;
  return `mock-uuid-${counter}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

module.exports = { v4 };
