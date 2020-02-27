# tuya-cloud-to-influxdb
Using Tuya cloud API to push data from device to influxdb. As a side effect it's possible to get various device information from the tuya cloud using CLI.

This is a work-in-progress, so expect breaking changes :).

Note: this was only tested with branded sockets with power metering. The sole purpose was to get the metering data and push it to influxdb and visualise using grafana.

## Available commands
```
Usage: cli [options] [command]

Options:
  -V, --version                        output the version number
  -v, --verbose                        Increase verbosity, may be appied multiple times
  -h, --help                           output usage information

Commands:
  auth <user> <pass>                   Authorize the Tuya client (this will save only the session ID in the config, no password will be saved)
  list                                 list all devices
  show [options] [devName]             show current values available on the devices (optionally filter by group/device name)
  switch [options] <on|off> [devName]  switch state of the device (optionally filter by group/device name)
  stats-monthly [options] [devName]    retrieve monthly cumulative stats [works for power monitoring]
  stats-daily [options] [devName]      retrieve daily cumulative stats [works for power monitoring]
  time                                 get unix time from the tuya servers (use it to test session validity)
  config-tuya [options]                manipulate Tuya API configuration
  config-influx [options]              manipulate InfluxDB connection configuration
```
  
## Basic usage
1. First You need to set-up the authentication keys to be used with the CLI. The keys are per-application (eg. Tuya, SmartLife or other branded ones). On details regarding how to get them - check [tuya-sign-hacking]https://github.com/nalajcie/tuya-sign-hacking repo. The below example configures the keys being used in **Tuya** app
```
./cli.js config-tuya --api-key 3fjrekuxank9eaej3gcx
./cli.js config-tuya --api-secret2 vay9g59g9g99qf3rtqptmc3emhkanwkx
./cli.js config-tuya --api-cert-sign "93:21:9F:C2:73:E2:20:0F:4A:DE:E5:F7:19:1D:C6:56:BA:2A:2D:7B:2F:F5:D2:4C:D5:5C:4B:61:55:00:1E:40"
```
2. After the configuration you need to open session (authorize) with Tuya cloud.
**Note**: username and password will not be stored in the config file - only the resulting session ID

```
./cli.js auth username password
```
3. Verify if everything works by getting time from the Tuya Cloud:
```
./cli.js time
✔ getting time
{ validTime: 1800, time: 1582799524 }
```
4. Get device list from the cloud
```
./cli.js list
✔ getting device list
group: RR       device: Pralka (devId: 462683xxxxxxxxxxxxxx groupId: 2xxxxxx)
group: RR       device: Biurko (devId: 462683xxxxxxxxxxxxxx groupId: 2xxxxxx)
```
5. Get device data from the cloud
```
./cli.js show
✔ getting device list
✔ getting device schemas
Device: Pralka
[rw] {1} switch_1:      true
[rw] {9} countdown_1:   0 s
[rw] {17} add_ele:      0.001
[ro] {18} cur_current:  0 mA
[ro] {19} cur_power:    0 W
[ro] {20} cur_voltage:  230.2 V
[ro] {21} test_bit:     1
[ro] {22} voltage_coe:  652
[ro] {23} electric_coe: 30909
[ro] {24} power_coe:    17875
[ro] {25} electricity_coe:      1165
[ro] {26} fault:        0
Device: Biurko
[rw] {1} switch_1:      true
[rw] {9} countdown_1:   0 s
[rw] {17} add_ele:      0.019
[ro] {18} cur_current:  304 mA
[ro] {19} cur_power:    44.7 W
[ro] {20} cur_voltage:  229.6 V
[ro] {21} test_bit:     1
[ro] {22} voltage_coe:  617
[ro] {23} electric_coe: 30029
[ro] {24} power_coe:    17084
[ro] {25} electricity_coe:      1220
[ro] {26} fault:        0
```

You can use `-v` option to list all retrived values (eg. `localKey` if You want to control the devices locally). `-vv` will give You even more verbose output.

### Advanced usage
1. Configure influxDB:
```bash
./cli.js config-influx --measurement tuya
./cli.js config-influx --uri http://example.com/database
```
2. Upload the instantenous data at a given interval:
```bash
screen
while :; do date; ./cli.js show -u; sleep $((5*60)); done
```
3. Setup cron to upload daily stats (for the previous day at 2:00 am every day)
```
0 2 * * * /path/to/tuya-cloud-to-influxdb/cli.js stats-daily --yesterday -u
```
Additionaly: push manually previus stats using cli.

4. Create nice graphs in Grafana :)
TODO: image/json?
