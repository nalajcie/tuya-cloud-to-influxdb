/**
 * User config abstraction
 * vim:ts=2:sw=2:expandtab
 */

const Configstore = require('configstore');
const pkg = require('../package.json');

const CONF_MANDATORY = ['apiKey', 'apiSecret', 'apiSecret2', 'apiCertSign'];

const SUFFIX_GLOBAL = '-global';
const confGlobal = new Configstore(pkg.name + SUFFIX_GLOBAL);

function dump() {
  console.log('PATH:', confGlobal.path);
  console.log('CONTENTS:', confGlobal.all);
}

function save(opts) {
  Object.keys(opts).forEach(optName => {
    if (!confGlobal.has(optName)) {
      confGlobal.set(optName, opts[optName] || '');
    } else if (typeof opts[optName] !== 'undefined') {
      confGlobal.set(optName, opts[optName]);
    }
  });

  console.log('Saved new config file');
  dump();
}

function isValid() {
  const optNames = Object.keys(confGlobal.all);
  if (!optNames || optNames.length === 0) {
    return false;
  }

  const anyUnset = CONF_MANDATORY.some(optName => !confGlobal.has(optName) || confGlobal.get(optName).length === 0);

  return !anyUnset;
}

module.exports = {dump, save, isValid};

