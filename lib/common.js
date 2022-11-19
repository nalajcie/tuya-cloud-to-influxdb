/**
 * Common routines
 * vim:ts=2:sw=2:expandtab
 */

const is = require('is');
const chalk = require('chalk');
const Influx = require('influx');

const config = require('./config');

function getDeviceMeasurement(dev, schemaDict, measurementName, print = false) {
  const schema = schemaDict[dev.productId];
  const dpsDefDict = {};
  const dynFields = {};

  const ss = JSON.parse(schema.schemaInfo.schema);
  for (const def of ss) {
    dpsDefDict[def.id] = def;
  }

  if (print) {
    console.log(chalk`Device: {green ${dev.name}}`); // `
  }

  Object.keys(dev.dps).forEach(dps => {
    const def = dpsDefDict[dps];

    let val = dev.dps[dps];
    let val_printable = val;
    if (def.property.type === 'value') {
      val /= 10 ** def.property.scale;
      val_printable = `${val} ${def.property.unit}`; // `
    } else if (def.property.type === 'bool') {
      val_printable = (val) ? 'true' : 'false';
      val = (val) ? 1 : 0;
    }

    dynFields[def.code] = val;

    if (print) {
      console.log(chalk`[{magenta ${def.mode}}] \{{yellow ${dps}}\} {cyan ${def.code}}:\t{green ${val_printable}}`); // `
    }
  });

  dynFields.ip = dev.ip;

  return {
    measurement: measurementName,
    tags: {
      group_name: dev.group_name,
      group_id: dev.gid,
      dev_name: dev.name,
      dev_id: dev.devId
    },
    fields: dynFields
  };
}

function filterDevices(responses, groupName, devName) {
  if (!is.undefined(groupName)) {
    responses = responses.filter(resp => resp.group.name === groupName);
  }

  const devices = [];
  const gids = [];

  for (const resp of responses) {
    gids.push(resp.group.id);

    // Extend each device with gid for simplicity
    for (const dev of resp.data) {
      dev.gid = resp.group.id;
      dev.group_name = resp.group.name;
    }

    if (is.undefined(devName)) {
      devices.push(...resp.data);
    } else {
      devices.push(...resp.data.filter(dev => dev.name === devName));
    }
  }

  return {devices, gids};
}

function initInflux() {
  const uri = config.get('influx');

  if (is.undef(uri)) {
    return undefined;
  }

  return new Influx.InfluxDB(uri);
}

module.exports = {getDeviceMeasurement, filterDevices, initInflux};
