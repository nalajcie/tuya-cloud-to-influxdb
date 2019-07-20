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

debug.inspectOpts.depth = 5;

const pkg = require('./package.json');
const config = require('./lib/config');
const api = require('./lib/api');

program
  .command('auth <user> <pass>')
  .description('Authorize the client (this will save only the session ID in the config, no password will be saved)')
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
          console.log('group:', resp.group.name, '\tdevice:', device.name, '(devId:', device.devId, ')');
        }
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
  .command('config-global')
  .description('manipulate common configuration')
  .option('--api-key [apiKey]', 'your tuya.com API key')
  .option('--api-secret [apiSecret]', 'your tuya.com API secret')
  .option('--api-secret2 [apiSecret2]', 'your tuya.com API secret')
  .option('--api-cert-sign [apiCertSign]', 'your mobile app certificate signature')
  .action(parser => {
    const opts = parser.opts();
    const anyOptProvided = Object.keys(opts).some(optname => !is.undef(opts[optname]));

    if (anyOptProvided) {
      config.save(opts);
    } else {
      config.dump();
    }
  });

program
  .command('config-device [dev name]')
  .description('manipulate per-device configuration')
  .action(() => {
    console.log('TODO');
  });

function increaseVerbosity(v, currentVerbosity) {
  switch (currentVerbosity) {
    case 0:
      debugCtl.enable('cli');
      break;
    case 1:
      debugCtl.enable('api');
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
