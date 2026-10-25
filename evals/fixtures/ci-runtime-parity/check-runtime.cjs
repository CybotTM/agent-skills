'use strict';
const [major, minor, patch] = process.versions.node.split('.').map(Number);
const supported = major > 22 || (major === 22 && (minor > 23 || (minor === 23 && patch >= 4)));
console.log(`Build runtime: Node ${process.versions.node}; required >=22.23.4`);
if (!supported) throw new Error('The deployment runtime is below the locked engine requirement');
