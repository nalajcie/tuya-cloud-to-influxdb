/**
 * Api queries
 * vim:ts=2:sw=2:expandtab
 */
const Cloud = require('@tuyapi/cloud');
const is = require('is');
const debug = require('debug')('api');
const config = require('./config');

let api;

function init(opts = {needsSession: true}) {
  if (api) {
    return;
  }

  const apiConf = config.get('api');
  if (!config.isValid() || is.undef(apiConf) || is.empty(apiConf)) {
    throw new Error('Global config is not valid. Please use the \'config-tuya\' command first.');
  }

  api = new Cloud({
    key: apiConf.apiKey,
    secret: apiConf.apiSecret,
    secret2: apiConf.apiSecret2,
    certSign: apiConf.apiCertSign,
    apiEtVersion: '0.0.1',
    region: 'EU'});

  if (opts.needsSession) {
    loadSession();
  }
}

function loadSession() {
  if (!is.undefined(api.sid)) {
    return;
  }

  const sess = config.get('sess');

  if (is.undef(sess) || is.empty(sess)) {
    throw new Error('No valid session found. Please authorize first');
  }

  api.sid = sess.sid;
  api.region = sess.region;
  api.endpoint = sess.endpoint;

  // TODO: get time to verify if session is valid?
}

async function auth(email, password) {
  init({needsSession: false});

  return api.loginEx({email, password})
    .then(sidVal => {
      const sess = {sid: sidVal, region: api.region, endpoint: api.endpoint};
      config.set(sess, 'sess');
      loadSession();
    })
    .catch(error => {
      config.set('', 'sess');
      throw new Error('Invalid credentials', error);
    });
}

async function getTime() {
  init();

  const timeResp = await api.request({action: 'tuya.p.time.get'});
  return timeResp;
}

async function getDevices() {
  init();

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

async function getMonthlyStats(gid, devId, dpId) {
  init();

  return api.request({
    action: 'tuya.m.dp.stat.month.list',
    gid,
    data: {
      devId,
      gwId: devId,
      dpId,
      type: 'sum'
    }
  });
}

async function getDailyStats(gid, devId, dpId, startDay, endDay) {
  init();

  return api.request({
    action: 'tuya.m.dp.stat.days.list',
    gid,
    data: {
      devId,
      gwId: devId,
      dpId,
      startDay,
      endDay,
      type: 'sum'
    }
  });
}

module.exports = {getDevices, auth, getTime, getSchemas, switchState, getMonthlyStats, getDailyStats};
