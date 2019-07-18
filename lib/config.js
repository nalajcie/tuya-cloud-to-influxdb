/**
 * User config abstraction
 * vim:ts=2:sw=2:expandtab
 */

const is = require('is');
const Configstore = require('configstore');
const pkg = require('../package.json');

const CONF_MANDATORY = ['apiKey', 'apiSecret', 'apiSecret2', 'apiCertSign'];

const SUFFIX_GLOBAL = '-global';
const confGlobal = new Configstore(pkg.name + SUFFIX_GLOBAL);

const SUFFIX_USER = '-user';
const confUser = new Configstore(pkg.name + SUFFIX_USER);

function dump() {
  console.log('PATH:', confGlobal.path);
  console.log('CONTENTS:', confGlobal.all);
}

function get(opt) {
  return confGlobal.get(opt);
}

function getUser(opt) {
  return confUser.get(opt);
}

function setUser(opt, val) {
  return confUser.set(opt, val);
}

function save(opts) {
  Object.keys(opts).forEach(optName => {
    if (!confGlobal.has(optName)) {
      confGlobal.set(optName, opts[optName] || '');
    } else if (!is.undef(opts[optName])) {
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

module.exports = {dump, get, save, isValid, getUser, setUser};
