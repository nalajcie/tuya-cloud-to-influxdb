/**
 * Api queries
 * vim:ts=2:sw=2:expandtab
 */
const Cloud = require('@tuyapi/cloud');
const is = require('is');
const cacheManager = require('cache-manager');
const fsStore = require('cache-manager-fs');
const cache = cacheManager.caching({store: fsStore, options: {ttl: 0 /* seconds */, path: 'sess-cache'}});

const config = require('./config');

let api;

const SESS_CACHE = 'sess.json';

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

  try {
    const sidVal = await api.loginEx({email, password: pass});
    const sess = {sid: sidVal, region: api.region, endpoint: api.endpoint};

    config.setUser('sess', sess);
  } catch (error) {
    config.setUser('sess', '');
    throw new Error('Invalid credentials', error);
  }
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
  const groups = await api.request({action: 'tuya.m.location.list'});

  if (groups.length === 0) {
    throw new Error('No device groups');
  }

  const results = [];

  for (const group of groups) {
    //console.log(group);
    //console.log('getting devices for group', group.name, '(gid=', group.groupId, ')');
    //console.log(group.name);

    results.push(api.request({action: 'tuya.m.my.group.device.list', gid: group.groupId}).then(data => ({group, data}) ));
  }

  return Promise.all(results);

  // X let devRelation = await api.request({action: 'tuya.m.my.group.device.relation.list', gid: gid});
  // X console.log(devRelation);

  // TODO: for each GID
  // get device schema list
  //  const schemaArr = await api.request({action: 'tuya.m.device.ref.info.my.list', gid: groups[0].groupId});
  //  const schemaDict = {};
  //  for (const schema of schemaArr) {
  //    schemaDict[schema.id] = schema;
  //  }
  // X console.log(schemaDict);

  // get device list
  //const devicesArr = await api.request({action: 'tuya.m.my.group.device.list', gid: gidId});
  // X console.log(devices);
}

module.exports = {getDevices, auth, getTime};
