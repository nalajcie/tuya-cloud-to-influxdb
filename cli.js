#!/usr/bin/env node
/**
 * Main entry point
 * vim:ts=2:sw=2:expandtab
 */

const program = require('commander');
const ora = require('ora');
const is = require('is');
const debugCtl = require('debug');
const debug = require('debug')('cli');
const chalk = require('chalk');

debug.inspectOpts.depth = 5;

const pkg = require('./package.json');
const config = require('./lib/config');
const api = require('./lib/api');
const common = require('./lib/common');

const influxDb = common.initInflux();

program
  .command('auth <user> <pass>')
  .description('Authorize the Tuya client (this will save only the session ID in the config, no password will be saved)')
  .action((user, pass) => {
    const reqPromise = api.auth(user, pass);
    ora.promise(reqPromise, 'Logging in');

    reqPromise.catch(error => console.error(error.message));
  });

program
  .command('list')
  .description('list all devices')
  .action(() => {
    const reqPromise = api.getDevices();
    ora.promise(reqPromise, 'getting device list');

    reqPromise.then(responses => {
      for (const resp of responses) {
        debug(resp.group);
        for (const device of resp.data) {
          debug(device);
          console.log(chalk`group: {green ${resp.group.name}}\tdevice: {green ${device.name}} (devId: {yellow ${device.devId}} groupId: {yellow ${resp.group.id}})`); // `
        }
      }
    });

    reqPromise.catch(error => console.error(error.message));
  });

program
  .command('show [devName]')
  .description('show current values available on the devices (optionally filter by group/device name)')
  .option('--group [groupName]', 'Search device only in single group')
  .action((devName, parser) => {
    const opts = parser.opts();
    const reqPromise = api.getDevices();
    ora.promise(reqPromise, 'getting device list');

    reqPromise.then(responses => {
      const {devices, gids} = common.filterDevices(responses, opts.group, devName);

      debug(devices);
      const schemaPromise = api.getSchemas(gids);
      ora.promise(schemaPromise, 'getting device schemas');
      schemaPromise.then(schemaDict => {
        debug(schemaDict);
        for (const dev of devices) {
          common.printDevice(dev, schemaDict);
        }
      });
    });
    reqPromise.catch(error => console.error(error.message));
  });

program
  .command('switch <on|off> [devName]')
  .description('switch state of the device (optionally filter by group/device name)')
  .option('--group [groupName]', 'Search device only in single group')
  .action((onOff, devName, parser) => {
    const opts = parser.opts();
    const reqPromise = api.getDevices();
    const newState = onOff === 'on';
    ora.promise(reqPromise, 'getting device list');

    reqPromise.then(responses => {
      const {devices} = common.filterDevices(responses, opts.group, devName);
      debug(devices);

      for (const dev of devices) {
        ora.promise(api.switchState(dev.gid, dev.devId, newState),
          'changing state of device "' + dev.name + '" to ' + newState);
      }
    });
    reqPromise.catch(error => console.error(error.message));
  });

program
  .command('stats-monthly [devName]')
  .description('retrieve monthly cumulative stats [works for power monitoring]')
  .option('--group [groupName]', 'Search device only in single group')
  .option('--dpId [int]', 'Custom stat to be requested [17]', 17)
  .option('-u,--upload', 'Upload requested data to influxDB')
  .option('--measurement [name]', 'Measurement name to upload [tuya-stats-monthly]', 'tuya-stats-monthly')
  .action((devName, parser) => {
    const opts = parser.opts();
    const reqPromise = api.getDevices();

    ora.promise(reqPromise, 'getting device list');
    reqPromise.then(responses => {
      const {devices} = common.filterDevices(responses, opts.group, devName);

      for (const dev of devices) {
        const statsPromise = api.getMonthlyStats(dev.gid, dev.devId, opts.dpId);
        ora.promise(statsPromise, 'getting stats for device "' + dev.name + '"');

        statsPromise.then(stats => {
          debug(stats);

          const dataPoints = [];
          console.log(chalk`today: {green ${stats.thisDay}}`); // `
          console.log(chalk`sum: {green ${stats.sum}}`); // `
          for (const [year, months] of Object.entries(stats.years)) {
            for (const [month, value] of Object.entries(months)) {
              console.log(chalk`{yellow ${year}-${month}}: {green ${value}}`); // `

              // WARN: will not work if from and to have different year part
              const dayAsDate = new Date(`${year}-${month}-01`);

              dataPoints.push({
                measurement: opts.measurement,
                timestamp: dayAsDate.getTime() / 1000, // Converting ms to s
                tags: {
                  group_name: dev.group_name,
                  group_id: dev.gid,
                  dev_name: dev.name,
                  dev_id: dev.devId
                },
                fields: {['sum_' + opts.dpId]: Number(value)}
              });
            }
          }

          if (opts.upload && is.defined(influxDb)) {
            debug(dataPoints);
            const influxPromise = influxDb.writePoints(dataPoints, {precision: 's'});
            ora.promise(influxPromise, `uploading data to influxdb for device ${dev.name}`); // `
          }
        });
      }
    });
    reqPromise.catch(error => console.error(error.message));
  });

program
  .command('stats-daily [devName]')
  .description('retrieve daily cumulative stats [works for power monitoring]')
  .option('--from [YYYYMMDD]', 'Retrieve stats from a given date (default = 30 days before "to")')
  .option('--to [YYYYMMDD]', 'Retrieve stats to a given date (default = now)')
  .option('--group [groupName]', 'Search device only in single group')
  .option('--dpId [int]', 'Custom stat to be requested [17]', 17)
  .option('-u,--upload', 'Upload requested data to influxDB')
  .option('--measurement [name]', 'Measurement name to upload [tuya-stats-daily]', 'tuya-stats-daily')
  .action((devName, parser) => {
    const opts = parser.opts();
    const reqPromise = api.getDevices();

    if (is.undefined(opts.to)) {
      opts.to = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    }

    if (is.undefined(opts.from)) {
      const toAsDate = new Date(opts.to.slice(0, 4) + '-' + opts.to.slice(4, 6) + '-' + opts.to.slice(6, 8));
      opts.from = new Date(toAsDate - (30 * 24 * 3600 * 1000)).toISOString().slice(0, 10).replace(/-/g, '');
    }

    debug(opts);

    ora.promise(reqPromise, 'getting device list');
    reqPromise.then(responses => {
      const {devices} = common.filterDevices(responses, opts.group, devName);

      for (const dev of devices) {
        const statsPromise = api.getDailyStats(dev.gid, dev.devId, opts.dpId, opts.from, opts.to);
        ora.promise(statsPromise, 'getting stats for device "' + dev.name + '"');

        statsPromise.then(stats => {
          debug(stats);
          if (is.empty(stats)) {
            console.log('no stats in the requested range');
            return;
          }

          const dataPoints = [];
          console.log(chalk`total sum: {green ${stats.total}}`); // `
          for (let i = 0; i < stats.days.length; ++i) {
            console.log(chalk`${stats.days[i]}: {green ${stats.values[i]}}`); // `

            // WARN: will not work if from and to have different year part
            const dayAsDate = new Date(opts.to.slice(0, 4) + '-' + stats.days[i]);

            dataPoints.push({
              measurement: opts.measurement,
              timestamp: dayAsDate.getTime() / 1000, // Converting ms to s
              tags: {
                group_name: dev.group_name,
                group_id: dev.gid,
                dev_name: dev.name,
                dev_id: dev.devId
              },
              fields: {['sum_' + opts.dpId]: Number(stats.values[i])}
            });
          }

          if (opts.upload && is.defined(influxDb)) {
            debug(dataPoints);
            const influxPromise = influxDb.writePoints(dataPoints, {precision: 's'});
            ora.promise(influxPromise, `uploading data to influxdb for device ${dev.name}`); // `
          }
        });
      }
    });
    reqPromise.catch(error => console.error(error.message));
  });

program
  .command('time')
  .description('get unix time from the tuya servers (use it to test session validity)')
  .action(() => {
    const reqPromise = api.getTime();
    ora.promise(reqPromise, 'getting time');

    reqPromise
      .then(response => console.log(response))
      .catch(error => console.log(error));
  });

program
  .command('config-tuya')
  .description('manipulate Tuya API configuration')
  .option('--api-key [apiKey]', 'your tuya.com API key')
  .option('--api-secret [apiSecret]', 'your tuya.com API secret')
  .option('--api-secret2 [apiSecret2]', 'your tuya.com API secret')
  .option('--api-cert-sign [apiCertSign]', 'your mobile app certificate signature')
  .action(parser => {
    const opts = parser.opts();
    const onlyProvidedOpts = Object.keys(opts)
      .filter(key => !is.undef(opts[key]))
      .reduce((obj, key) => {
        obj[key] = opts[key];
        return obj;
      }, {});

    if (!is.empty(onlyProvidedOpts)) {
      config.set(onlyProvidedOpts, 'api');
    }

    config.dump('api');
  });

program
  .command('config-influx')
  .description('manipulate InfluxDB connection configuration')
  .option('--uri [uri]', 'InfluxDB URI (usually: http://[host]:8086/[dbname])')
  .option('--measurement [name]', 'Measurement name which is to be send with every request')
  .action(parser => {
    const opts = parser.opts();
    const onlyProvidedOpts = Object.keys(opts)
      .filter(key => !is.undef(opts[key]))
      .reduce((obj, key) => {
        obj[key] = opts[key];
        return obj;
      }, {});

    if (!is.empty(onlyProvidedOpts)) {
      config.set(onlyProvidedOpts, 'influx');
    }

    config.dump('influx');
  });

function increaseVerbosity(v, currentVerbosity) {
  switch (currentVerbosity) {
    case 0:
      debugCtl.enable('cli');
      break;
    case 1:
      debugCtl.enable('cli,api');
      break;
    case 2:
      // This does not work because tuyapi uses different debug module version, use DEBUG=* env var instead
      debugCtl.enable('cli,api,@tuyapi/cloud');
      break;
    default:
      break;
  }

  return currentVerbosity + 1;
}

// Global options
program.version(pkg.version);
program.option('-v, --verbose', 'Increase verbosity, may be appied multiple times', increaseVerbosity, 0);

// Error on unknown commands
program.on('command:*', () => {
  console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
  process.exit(1);
});

// Parse arguments
program.parse(process.argv);

// Error out on empty parameters
if (!program.args || program.args.length === 0) {
  program.help();
  process.exit(1);
}
