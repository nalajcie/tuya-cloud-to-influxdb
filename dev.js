/**
 * Dev environment
 * vim:ts=2:sw=2:expandtab
 */
const fs = require('fs');
const Cloud = require('@tuyapi/cloud');
const Influx = require('influx');
const {apiKeys, credentials, influxdb} = require('./keys.json');

const api = new Cloud({
  key: apiKeys.key,
  secret: apiKeys.secret,
  secret2: apiKeys.secret2,
  certSign: apiKeys.certSign,
  apiEtVersion: '0.0.1',
  region: 'EU'});

const influxDb = new Influx.InfluxDB(influxdb.uri);

function sleep(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function printDev(dev, schema) {
  const dpsDefDict = {};

  const ss = JSON.parse(schema.schemaInfo.schema);
  for (const def of ss) {
    dpsDefDict[def.id] = def;
  }

  console.log('Device: %s', dev.name);

  Object.keys(dev.dps).forEach(dps => {
    const def = dpsDefDict[dps];

    let val = dev.dps[dps];
    let unit = '';
    if (def.property.type === 'value') {
      val /= 10 ** def.property.scale;
      unit = def.property.unit;
    } else if (def.property.type === 'bool') {
      val = (val) ? 'true' : 'false';
    }

    console.log('[%s] {%d} %s:\t%s %s', def.mode, dps, def.code, val, unit);
  });
}

function getDataPoint(group, dev, schema) {
  const dpsDefDict = {};
  const dynFields = {};

  const ss = JSON.parse(schema.schemaInfo.schema);
  for (const def of ss) {
    dpsDefDict[def.id] = def;
  }

  Object.keys(dev.dps).forEach(dps => {
    const def = dpsDefDict[dps];

    let val = dev.dps[dps];
    if (def.property.type === 'value') {
      val /= 10 ** def.property.scale;
    } else if (def.property.type === 'bool') {
      val = (val) ? 1 : 0;
    }

    dynFields[def.code] = val;
  });

  dynFields.ip = dev.ip;

  return {
    measurement: 'tuya',
    tags: {
      group_name: group.name,
      group_id: group.id,
      dev_name: dev.name,
      dev_id: dev.devId
    },
    fields: dynFields
  };
}

const SESS_CACHE = 'sess.json';

async function getSession(forceLogin = false) {
  if (!forceLogin) {
    try {
      const sess = JSON.parse(fs.readFileSync(SESS_CACHE));
      api.sid = sess.sid;
      api.region = sess.region;
      api.endpoint = sess.endpoint;
      return;
    } catch {}
  }

  // No session or forceLogin
  const sidVal = await api.loginEx({email: credentials.email, password: credentials.pass});
  const sess = {sid: sidVal, region: api.region, endpoint: api.endpoint};

  fs.writeFileSync(SESS_CACHE, JSON.stringify(sess));
}

async function initInflux() {
  influxDb.getDatabaseNames()
    .then(names => {
      console.log('InfluxDB databases:', names);
    });
}

async function init() {
  await getSession();
  await initInflux();
}

// TODO: cache most of the values gathered here
async function test() {
  // Get location list to obtain some GID
  let groups = {};
  try {
    groups = await api.request({action: 'tuya.m.location.list'});
  } catch {
    getSession(true);
    groups = await api.request({action: 'tuya.m.location.list'});
  }

  console.log(groups);

  if (groups.length === 0) {
    console.log('No device groups, exiting');
    return;
  }

  const group = groups[0];
  console.log('getting devices for group', group.name, '(gid=', group.groupId, ')');
  const gidId = group.groupId;

  // X let devRelation = await api.request({action: 'tuya.m.my.group.device.relation.list', gid: gid});
  // X console.log(devRelation);

  // TODO: for each GID
  // get device schema list
  const schemaArr = await api.request({action: 'tuya.m.device.ref.info.my.list', gid: gidId});
  const schemaDict = {};
  for (const schema of schemaArr) {
    schemaDict[schema.id] = schema;
  }
  // X console.log(schemaDict);

  // get device list
  const devicesArr = await api.request({action: 'tuya.m.my.group.device.list', gid: gidId});
  // X console.log(devices);

  // X let devId = '';
  const dataPoints = [];
  for (const device of devicesArr) {
    printDev(device, schemaDict[device.productId]);
    dataPoints.push(getDataPoint(group, device, schemaDict[device.productId]));
    // X devId = device.devId;
  }

  influxDb.writePoints(dataPoints);

  /* X
  let statMonth = await api.request({action: 'tuya.m.dp.stat.month.list', gid: gid,
                                     data: {devId: devId,
                                            gwId: devId,
                                            dpId: 17,
                                            type: 'sum'}});
  console.log(statMonth);

  let statDays = await api.request({action: 'tuya.m.dp.stat.days.list', gid: gid,
                                     data: {devId: devId,
                                            gwId: devId,
                                            dpId: 17,
                                            startDay: '20190301',
                                            endDay: '20190330',
                                            type: 'sum'}});
  console.log(statDays);

  let changeDevStatus = await api.request({action: 'tuya.m.device.dp.publish', gid: gid,
                                           data: { devId: devId,
                                                   gwId: devId,
                                                   dps: { '1': false }
                                           }});

  console.log(changeDevStatus);
  */

  sleep(0);
}

function pushInstantenousMeasurements() {
  console.log('------ new measurements ------');
  test();
}

init();
pushInstantenousMeasurements();

setInterval(pushInstantenousMeasurements, 60 * 1000);
