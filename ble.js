/* global chrome */

var BLE = function (options) {
  this.listeners = {};
};




// Valid keys:
//  * warning
//  * discover
//  * stateChange

BLE.prototype.on = function (key, handler) {
  if (!this.listeners[key])  {
    this.listeners[key] = [];
  }
  this.listeners[key].push(handler);
  return;
};

BLE.prototype.decoratePeripheral = function (peripheral) {
  return {};
};




BLE.prototype.deviceFound = function (device) {
  // decorate device with 'additives'
  if (this.listeners.discover) {
    var peripheral = new BLEDevice(device);
    this.listeners.discover.forEach(function (listener) {
      listener(peripheral);
    });
  }
}





BLE.prototype.startScanning = function (callback) {
  var that = this;
  chrome.bluetooth.onDeviceAdded.addListener(that.deviceFound);
  chrome.bluetooth.getDevices(function(devices) {
    for (var i = 0; i < devices.length; i++) {
      that.deviceFound(devices[i]);
    }
  });
  chrome.bluetooth.startDiscovery(function () {
    if (typeof callback === 'function') {
      callback();
    }
  });
};

BLE.prototype.stopScanning = function () {
  try {
    chrome.bluetooth.stopDiscovery();
  } catch (e) {
    console.error('Issue with ending discovery');
  }
};

BLE.prototype.removeAllListeners = function () {
  for (var i in this.listeners) {
    delete this.listeners[i];
  } 
};


BLE.prototype.connect = function (device, callback) {
  var that = this;
  chrome.bluetoothLowEnergy.connect(device.address, function () {
    if (chrome.runtime.lastError) {
      log('Failed to connect '+device.name+': ' + chrome.runtime.lastError.message);
      if (callback)
        callback(chrome.runtime.lastError);
    } else {
      if (callback)
        callback(null, that);
    }
  });
};


var ble = new BLE();