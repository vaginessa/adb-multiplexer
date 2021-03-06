"use strict";

var colors = require('colors');
var ArgumentParser = require('argparse').ArgumentParser;
var DeviceDetector = require('./modules/DeviceDetector');


//==============================
// set up argument parsing
//==============================

var args = new ArgumentParser({
  version: '1.0',
  addHelp: true,
  description: 'Executes ADB commands on all connected devices.',
  epilog: 'Example usage: node adb-multiplexer.js "adb install myApp.apk"'
});

args.addArgument([ 'command' ], {
  help: 'ADB command to execute, for example "adb install <path to apk>". Use quotation marks for multiword commands. The "adb" prefix is optional.'
});

args.addArgument([ '-c', '--continue' ], {
  action: 'storeTrue',
  required: false,
  dest: 'continue',
  help: 'Continues to execute the given command on every device that will be connected for as long as this tool is running.'
});

args.addArgument([ '--no-color' ], {
  action: 'storeTrue',
  required: false,
  help: 'Disables coloring of adb command output.'
});


//==============================
// parse arguments and init
//==============================

var params = args.parseArgs();
var deviceDetector = new DeviceDetector();

try {
  // always execute for all currently connected devices
  executeForOnlineDevices(deviceDetector.getDevices(), params.command);
} catch (error) {
  // in case of error exit script
  console.error(error.red);
  process.exit(1);
}

if (params.continue) {
  // additionally execute for devices conneted in the future
  executeForFutureDevices(deviceDetector, params.command);
}


//==============================
// helper functions
//==============================

/**
 * Tries to execute the command on newly added online devices.
 * @param  {Device[]} devices  list of new or changed devices
 */
function newOrChangedDevicesListener(devices) {
  try {
    executeForOnlineDevices(devices, params.command);
  } catch (error) {
    console.error(error.red);
    deviceDetector.unwatch();
  }
}

/**
 * Executes the given adb command on all devices that will be
 * connected in the future.
 * @param  {DeviceDetector} deviceDetector
 * @param  {string}         command          adb command to execute,
 *                                           leading "adb" keyword is optional
 */
function executeForFutureDevices(deviceDetector, command) {
  deviceDetector.on('devicesAdded', newOrChangedDevicesListener);
  deviceDetector.on('devicesChanged', newOrChangedDevicesListener);
  deviceDetector.watch();
}

/**
 * Executes the given adb command on the given devices if online.
 * @param  {Device[]}       devices          devices to execute the command on
 * @param  {string}         command          adb command to execute,
 *                                           leading "adb" keyword is optional
 * @throws {String}                          error message when adb command was invalid,
 *                                           could not be executed or timed out
 */
function executeForOnlineDevices(devices, command) {
  var onlineDevices = devices.filter(function (device) {
    return device.isOnline();
  });
  var offlineDevices = devices.filter(function (device) {
    return !device.isOnline();
  });

  if (onlineDevices.length > 0) {
    console.log('devices detected:\n' + formatDeviceList(onlineDevices).green);
    executeCommandOnDevices(onlineDevices, command);
  } else if (offlineDevices.length > 0) {
    console.log('offline devices detected:\n' + formatDeviceList(offlineDevices).red);
  } else {
    console.error('no devices detected\n'.red);
  }
}

/**
 * Executes the given adb command on all devices with the given ids.
 * @param  {Device[]} devices   array of Device instances
 * @param  {string}   command   sanitized adb command to execute
 */
function executeCommandOnDevices(devices, command) {
  devices.forEach(function (device) {
    console.log();
    console.log('========================================');
    console.log('Result for', device.id, '(' + device.model + ')');
    console.log('========================================');

    var result = device.executeCommandSync(command);
    console.log(result.cyan);
  });
}

/**
 * Takes a list of Device instances and transforms it into a nice
 * string output.
 * @param  {Device[]} deviceList  array of Device instances
 * @return {string}               string with the most important device infos
 *                                in list form
 */
function formatDeviceList(deviceList) {
  return deviceList.reduce(function (previousValue, device) {
    return previousValue + '- ' + device.toStatusString() + '\n';
  }, '');
}
