const { cpSync, existsSync, mkdirSync } = require('node:fs');
const path = require('node:path');

/**
 * electron-builder extraResources skips nested node_modules. Copy the Next
 * standalone modules after pack so the packaged UI can `require('next')`.
 */
exports.default = async function afterPack(context) {
  const standaloneModules = path.join(__dirname, '../frontend/.next/standalone/node_modules');
  const destination = path.join(context.appOutDir, 'resources', 'frontend', 'node_modules');
  if (!existsSync(standaloneModules)) {
    throw new Error('Next standalone node_modules were not found');
  }
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(standaloneModules, destination, { recursive: true });
};
