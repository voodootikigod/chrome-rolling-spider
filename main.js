
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
    if (searchTimer) { clearTimeout(searchTimer); }
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
      that.address = device.address;
      if (callback)
        callback(null, that);
    }
  });
};

Drone.prototype.connect = function(callback) {


  var deviceFound = (function (device) {
    if (device.name === "RS_W008267") {
      console.log('skipping '+"RS_W008267");
    } else if (device.address === this.address) {
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


function discoverAllServicesAndCharacteristics(address, callback) { // callback(error, services, characteristics);
  chrome.bluetoothLowEnergy.getServices(address, function (services) {
    var characteristics = [];
    var end = (function (max) {
      var count = 0;
      return function (chrcs) {
        if (chrome.runtime.lastError) {
          console.log(chrome.runtime.lastError.message);
          callback(chrome.runtime.lastError);
          return;
        }

        // Make sure that the same service is still selected.
        //if (service.instanceId != self.service_.instanceId) {
        //  return;
        //}

        if (!chrcs.length) {
          log('Service has no characteristics: ' + service.instanceId);
          return;
        }
        count += 1;
        characteristics = characteristics.concat(chrcs || []);
        if (count === max && callback) {
          callback(null, services, characteristics);
        }
      };
    })(services.length);

    services.forEach(function(service) {
      chrome.bluetoothLowEnergy.getCharacteristics(service.instanceId, end);
    });
  });

  
}


Drone.prototype.setup = function(callback) {
  var that = this;

  discoverAllServicesAndCharacteristics(that.peripheral.address, function (error, services, characteristics) {
    that.services = services;
    that.characteristics = characteristics;
    if (callback)
      callback();
  });
  
};


Drone.prototype.handshake = function(callback) {
  var characteristicNotificationHandler = function (drone, characteristic) {
    return function () {
      if (chrome.runtime.lastError) {
        if (chrome.runtime.lastError.message === 'In progress') {
          //silent
        } else {
          console.log('err: ' + chrome.runtime.lastError.message);
        }
      } else {
        console.log('characteristic update', characteristic);
      }
    };
  };
  
  var listening = [ 'fb8f', 'fb8e', 'fb1b', 'fb1c', 'fd22', 'fd23', 'fd24', 
                    'fd52', 'fd53', 'fd54' ];
  //register all notifications 
  listening.forEach(function(key) {
    var characteristic = this.getCharacteristic(key);
    if (!characteristic) {
      console.log('Not found ', key);
    } else {
      chrome.bluetoothLowEnergy.startCharacteristicNotifications(characteristic.instanceId, characteristicNotificationHandler(this, characteristic));
    }
  }.bind(this));


  setTimeout(function() {
    var key = 'fa0b';
    this.steps[key] = (this.steps[key] || 0) + 1;
    var characteristic = this.getCharacteristic(key);
    
    
    var msg = buffer([ 0x04, this.steps['fa0a'], 0x00, 0x04, 0x01, 0x00, 0x32, 
                       0x30, 0x31, 0x34, 0x2D, 0x31, 0x30, 0x2D, 0x32, 0x38, 0x00]);
    
    console.log(characteristic);
    chrome.bluetoothLowEnergy.writeCharacteristicValue(characteristic.instanceId,
        msg,
        function() {
          if (chrome.runtime.lastError) {
            console.log('err: ' + chrome.runtime.lastError.message);
            
          }
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




function buffer(array) {
  var ab = new ArrayBuffer(array.length);
  var ua = new Uint8Array(ab);
  for (var i = 0; i < array.length; i++) {
    ua[i] = array[i];
  }
  return ab;
}






var powered = false;
chrome.bluetooth.getAdapterState(function(adapter) {
  if (!adapter.powered) {
    alert('Please enable bluetooth on the device');
  }
});



window.onload = function() {
  document.querySelector('#greeting').innerText =
    'Finding Bluetooth Devices';


  var drone = new Drone();
  drone.connect(function (error) {
    if (error) {
      console.error(error);
    } else {
      drone.setup(function (error) {
        if (error) {
          console.error(error);
        } else {
          drone.handshake(function (error) {
            console.log(drone);  
          });
        }
      });
    }
  });

};
