
var Drone = function(options) {
  this.address = (options ? options.address : undefined);
  this.connected = false;
  this.steps = {};
  this.characteristics = [];
};


// create client helper function to match ar-drone
Drone.createClient = function (options) {
  return new Drone(options);
};


var searchTimer;

function stopDiscovery() {
  try {
    if (searchTimer) { clearTimeout(searchTimer) }
    chrome.bluetooth.stopDiscovery();
  } catch (e) {
    console.error('Issue with ending discovery');
  }
}

Drone.prototype.bleConnect = function (device, callback) {
  var that = this;
  chrome.bluetoothLowEnergy.connect(device.address, function () {
    if (chrome.runtime.lastError) {
      console.log('Failed to connect: ' + chrome.runtime.lastError.message);
      if (callback)
        callback(chrome.runtime.lastError);
    } else {
      console.log('Connected to rolling spider');
      that.peripheral = device;
      that.connected = true;
      if (callback)
        callback(null, that);
    }
  });
};

Drone.prototype.connect = function(callback) {


  var deviceFound = (function (device) {
    if (device.address === this.address) {
      this.bleConnect(device, callback);
    } else if ((typeof this.address) === 'undefined' &&
      device.name.indexOf('RS_') === 0) {
      this.bleConnect(device, callback);
    }
  }).bind(this);

  chrome.bluetooth.onDeviceAdded.addListener(deviceFound);
  chrome.bluetooth.getDevices(function(devices) {
    for (var i = 0; i < devices.length; i++) {
      deviceFound(devices[i]);
    }
  });
  chrome.bluetooth.startDiscovery(function () {
    searchTimer = setTimeout(function () {
      stopDiscovery();
      if (callback)
        callback(new Error('No Rolling Spider was found.'));
    }, 30000);
  });
};



Drone.prototype.setup = function(callback) {
  var that = this;
  chrome.bluetoothLowEnergy.getServices(that.peripheral.address, function (services) {
    that.services = services;
    console.log('Services', services);
    services.forEach(function(service) {
      chrome.bluetoothLowEnergy.getCharacteristics(service.instanceId, function (characteristics) {
        console.log(characteristics);
        that.characteristics = characteristics;
      });
    });
  });
};


Drone.prototype.handshake = function(callback) {
  this.getCharacteristic('fb0f').notify(true);
  this.getCharacteristic('fb0e').notify(true);
  this.getCharacteristic('fb1b').notify(true);
  this.getCharacteristic('fb1c').notify(true);
  this.getCharacteristic('fd22').notify(true);
  this.getCharacteristic('fd23').notify(true);
  this.getCharacteristic('fd24').notify(true);
  this.getCharacteristic('fd52').notify(true);
  this.getCharacteristic('fd53').notify(true);
  this.getCharacteristic('fd54').notify(true);


  setTimeout(function() {
    this.steps['fa0b'] = (this.steps['fa0b'] || 0) + 1;

    this.getCharacteristic('fa0b').write(
        new Buffer([0x04,this.steps['fa0a'],0x00,0x04,0x01,0x00,0x32,0x30,0x31,0x34,0x2D,0x31,0x30,0x2D,0x32,0x38,0x00]),
        true,
        function(error) {
          setTimeout(function() {
            if (callback)
              callback();
          }, 100);
        }
        );
  }.bind(this), 100);
};





Drone.prototype.getCharacteristic = function(unique_uuid_segment) {
  var filtered = this.characteristics.filter(function(c) {
    return c.uuid.search(new RegExp(unique_uuid_segment)) !== -1;
  });

  return filtered[0];
};








var powered = false;
chrome.bluetooth.getAdapterState(function(adapter) {
  if (!adapter.powered) {
    alert('Please enable bluetooth on the device');
  };
});



window.onload = function() {
  document.querySelector('#greeting').innerText =
    'Finding Bluetooth Devices';


  var drone = new Drone();
  drone.connect(function (error) {
    if (error) {
      console.error(error);
    } else {
      drone.setup();
    }
  });

};
