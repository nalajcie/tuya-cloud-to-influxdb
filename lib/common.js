/**
 * Common routines
 * vim:ts=2:sw=2:expandtab
 */

const is = require('is');

function printDevice(dev, schemaDict) {
  const schema = schemaDict[dev.productId];
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
    }

    if (is.undefined(devName)) {
      devices.push(...resp.data);
    } else {
      devices.push(...resp.data.filter(dev => dev.name === devName));
    }
  }

  return {devices, gids};
}

module.exports = {printDevice, filterDevices};
