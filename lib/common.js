/**
 * Common routines
 * vim:ts=2:sw=2:expandtab
 */

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

module.exports = {printDevice};
