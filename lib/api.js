/**
 * Api queries
 * vim:ts=2:sw=2:expandtab
 */
const Cloud = require('@tuyapi/cloud');
const is = require('is');
const debug = require('debug')('api');
const config = require('./config');

let api;

function init() {
  if (api) {
    return;
  }

  if (!config.isValid()) {
    throw new Error('Global config is not valid. Please use the \'config-global\' command first.');
  }

  api = new Cloud({
    key: config.get('apiKey'),
    secret: config.get('apiSecret'),
    secret2: config.get('apiSecret2'),
    certSign: config.get('apiCertSign'),
    apiEtVersion: '0.0.1',
    region: 'EU'});
}

function getSession() {
  if (!is.undefined(api.sid)) {
    return;
  }

  const sess = config.getUser('sess');

  if (is.undef(sess) || is.empty(sess)) {
    throw new Error('No valid session found. Please authorize first');
  }

  api.sid = sess.sid;
  api.region = sess.region;
  api.endpoint = sess.endpoint;

  //TODO: get time to verify if session is valid?
}

async function auth(email, pass) {
  init();

  return api.loginEx({email, password: pass})
    .then(sidVal => {
      const sess = {sid: sidVal, region: api.region, endpoint: api.endpoint};
      config.setUser('sess', sess);
    })
    .catch(error => {
      config.setUser('sess', '');
      throw new Error('Invalid credentials', error);
    });
}

async function getTime() {
  init();
  getSession();

  const timeResp = await api.request({action: 'tuya.p.time.get'});
  return timeResp;
}

async function getDevices() {
  init();
  getSession();

  // Get location list to obtain some GID
  return api.request({action: 'tuya.m.location.list'}).then(groups => {
    if (groups.length === 0) {
      throw new Error('No device groups');
    }

    const results = [];
    for (const group of groups) {
      results.push(api.request({action: 'tuya.m.my.group.device.list', gid: group.groupId}).then(data => ({group, data})));
    }

    return Promise.all(results);
  });
}

async function getSchemas(gids) {
  init();
  getSession();
  debug('getSchemas(%o)', gids);

  const results = [];
  for (const gid of gids) {
    results.push(api.request({action: 'tuya.m.device.ref.info.my.list', gid}));
  }

  return Promise.all(results).then(schemaArrays => {
    debug(schemaArrays);
    const schemaDict = {};
    for (const schemaArr of schemaArrays) {
      for (const schema of schemaArr) {
        schemaDict[schema.id] = schema;
      }
    }

    return schemaDict;
  });
}

async function switchState(gid, devId, enabled) {
  init();
  getSession();

  return api.request({
    action: 'tuya.m.device.dp.publish',
    gid,
    data: {
      devId,
      gwId: devId,
      dps: {1: enabled}
    }
  });
}

module.exports = {getDevices, auth, getTime, getSchemas, switchState};
