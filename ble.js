var BLE = function (options) {
  this.listeners = {};
};




// Valid keys:
//  * warning
//  * discover
//  * stateChange

ble.prototype.on = function (key, handler) {
  if (!this.listeners[key])  {
    this.listeners[key] = [];
  }
  this.listeners[key].push(handler);
  return;
};

ble.prototype.deviceFound = function (device) {
  // decorate device with 'additives'
  if (this.listeners.discover) {
    this.listeners.discover.forEach(function (listener) {
      listener(device);
    });
  }
}



ble.prototype.startScanning = function (callback) {
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

ble.prototype.stopScanning = function () {
  try {
    chrome.bluetooth.stopDiscovery();
  } catch (e) {
    console.error('Issue with ending discovery');
  }
};

ble.prototype.removeAllListeners = function () {

};


ble.prototype.connect = function (device, callback) {
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
