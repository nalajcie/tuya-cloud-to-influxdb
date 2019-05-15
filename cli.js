#!/usr/bin/env node
/**
 * Main entry point
 * vim:ts=2:sw=2:expandtab
 */

const program = require('commander');

const pkg = require('./package.json');

const config = require('./lib/config');

program
  .command('list')
  .description('list all devices')
  .action(() => {
    console.log('TODO');
    if (!config.isValid()) {
      console.log('Global config is not vaild. Please use the \'config-global\' command first.');
      process.exit(1);
    }
  });

program
  .command('config-global')
  .description('manipulate common configuration')
  .option('--api-key [apiKey]', 'your tuya.com API key')
  .option('--api-secret [apiSecret]', 'your tuya.com API secret')
  .option('--api-secret2 [apiSecret2]', 'your tuya.com API secret')
  .option('--api-cert-sign [apiCertSign]', 'your mobile app certificate signature')
//  .option('--email [email]', 'Login credentials: email')
//  .option('--pass [pass]', 'Login credentials: poassword')
  .action(parser => {
    const opts = parser.opts();
    const anyOptProvided = Object.keys(opts).some(optname => typeof opts[optname] !== 'undefined');

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

// Global options
program.version(pkg.version);

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
