/**
 * User config abstraction
 * vim:ts=2:sw=2:expandtab
 */

const is = require('is');
const Configstore = require('configstore');
const pkg = require('../package.json');

const CONF_MANDATORY = ['api.apiKey', 'api.apiSecret', 'api.apiSecret2', 'api.apiCertSign'];

const conf = new Configstore(pkg.name);

function dump(key = '') {
  console.log('PATH:', conf.path);
  if (is.empty(key)) {
    console.log('CONTENTS:', conf.all);
  } else {
    console.log('CONTENTS:', conf.get(key));
  }
}

function get(opt) {
  return conf.get(opt);
}

function set(opts, globalKey = '') {
  if (is.empty(globalKey)) {
    conf.set(opts);
  } else {
    const currConf = conf.get(globalKey) || {};

    Object.keys(opts).forEach(optName => {
      currConf[optName] = opts[optName];
    });

    conf.set(globalKey, currConf);
  }

  console.log('Saved new config file');
}

function isValid() {
  const optNames = Object.keys(conf.all);
  if (!optNames || optNames.length === 0) {
    return false;
  }

  const anyUnset = CONF_MANDATORY.some(optName => !conf.has(optName) || conf.get(optName).length === 0);

  return !anyUnset;
}

module.exports = {dump, get, set, isValid};
