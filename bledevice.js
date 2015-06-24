
/*
{ _noble:
   { state: 'poweredOn',
     _bindings:
      { _xpcConnection: [Object],
        _peripherals: [Object],
        _events: [Object],
        sendCBMsg: [Function],
        init: [Function],
        startScanning: [Function],
        stopScanning: [Function],
        connect: [Function],
        disconnect: [Function],
        updateRssi: [Function],
        discoverServices: [Function],
        discoverIncludedServices: [Function],
        discoverCharacteristics: [Function],
        read: [Function],
        write: [Function],
        broadcast: [Function],
        notify: [Function],
        discoverDescriptors: [Function],
        readValue: [Function],
        writeValue: [Function],
        readHandle: [Function],
        writeHandle: [Function],
        timer: [Object] },
     _peripherals: { '04f48c15fbd44457a4cefe527caf3ab1': [Circular] },
     _services: { '04f48c15fbd44457a4cefe527caf3ab1': {} },
     _characteristics: { '04f48c15fbd44457a4cefe527caf3ab1': {} },
     _descriptors: { '04f48c15fbd44457a4cefe527caf3ab1': {} },
     _discoveredPeripheralUUids: [ '04f48c15fbd44457a4cefe527caf3ab1' ],
     _allowDuplicates: undefined,
     _events: { discover: [Function] } },
  uuid: '04f48c15fbd44457a4cefe527caf3ab1',
  address: '70:56:81:dd:71:5c',
  advertisement:
   { localName: 'Apple TV',
     txPowerLevel: undefined,
     manufacturerData: <Buffer 4c 00 09 06 02 06 0a 00 00 08>,
     serviceData: [],
     serviceUuids: [] },
  rssi: -61,
  services: null,
  state: 'disconnected' }
*/


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