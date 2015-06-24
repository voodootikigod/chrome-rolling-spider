/* global chrome */



// BLE Characteristic 
var BLECharacteristic = function (rawCharacteristic) {
  this.characteristic = rawCharacteristic;
  this.uuid = rawCharacteristic.uuid;
}

BLECharacteristic.prototype.write = function (buffer, response, callback) {
  chrome.bluetoothLowEnergy.writeCharacteristicValue(this.characteristic.id, buffer, callback);
};



// BLE Device
var BLEDevice = function (rawDevice) {
  this.advertisement = {
    localName: rawDevice.name,
    manufacturerData: null,
    txPowerLevel: undefined,
    serviceData: [],
    serviceUuids: []
  };
  this.listeners = {};
  this.address = rawDevice.address;
  this.rssi = undefined;
  this.services = undefined;
  this.state = 'disconnected';
  this.uuid = (rawDevice.uuids[0] || '').replace(/[^a-f0-9]/g, '');
}


BLEDevice.prototype.connect = function (callback) {
  chrome.bluetoothLowEnergy.connect(this.address, function () {
    if (chrome.runtime.lastError) {
      console.error('Failed to connect ' + this.uuid + ': ' + chrome.runtime.lastError.message);
      if (callback)
        callback(chrome.runtime.lastError);
    } else {
      if (typeof callback === 'function') {
        callback(null, this);
      }
    }
  }.bind(this));
};

BLEDevice.prototype.on = function (key, handler) {
  if (!this.listeners[key]) {
    this.listeners[key] = [];
  }
  this.listeners[key].push(handler);
  return;
};

BLEDevice.prototype.updateRssi = function (callback) {
  callback(null);
};


BLEDevice.prototype.disconnect = function (callback) {
  chrome.bluetoothLowEnergy.disconnect(this.address, callback);
};

BLEDevice.prototype.discoverAllServicesAndCharacteristics = function (callback) {
  chrome.bluetoothLowEnergy.getServices(this.address, function (services) {
    var characteristics = [];
    var end = (function (max) {
      var count = 0;
      return function (chrcs) {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
          callback(chrome.runtime.lastError);
          return;
        }
        if (!chrcs.length) {
          console.log('Service with no characteristics!');
          return;
        }
        count += 1;
        for (var idx = 0, l = chrcs.length; idx < l; idx++) {
          characteristics.push(new BLECharacteristic(chrcs[idx]));
        }
        if (count === max && callback) {
          callback(null, services, characteristics);
        }
      };
    })(services.length);

    services.forEach(function (service) {
      chrome.bluetoothLowEnergy.getCharacteristics(service.instanceId, end);
    });
  });
};











// BLE 
var BLE = function (options) {
  this.listeners = {};
};

// Valid keys:
//  * warning
//  * discover
//  * stateChange

BLE.prototype.on = function (key, handler) {
  if (!this.listeners[key]) {
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
  chrome.bluetooth.getDevices(function (devices) {
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
      log('Failed to connect ' + device.name + ': ' + chrome.runtime.lastError.message);
      if (callback)
        callback(chrome.runtime.lastError);
    } else {
      if (callback)
        callback(null, that);
    }
  });
};


var ble = new BLE();