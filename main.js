const PING_INTERVAL = 50;

var powered = false.
    drone,
    logNode,
    searchTimer;

function buffer(array) {
  var ab = new ArrayBuffer(array.length);
  var ua = new Uint8Array(ab);
  for (var i = 0; i < array.length; i++) {
    ua[i] = array[i];
  }
  return ab;
}

function log() {
  var args = [];
  for (var i = 0;i<arguments.length; i++) {
    var item = arguments[i];
    args.push((typeof item == 'string' ? item : JSON.stringify(item)));
  }
  var li = document.createElement('li');
  li.innerText = args.join(' ');
  logNode.appendChild(li);
}

function stopDiscovery() {
  try {
    if (searchTimer) { clearTimeout(searchTimer); }
    chrome.bluetooth.stopDiscovery();
  } catch (e) {
    console.error('Issue with ending discovery');
  }
}

function discoverAllServicesAndCharacteristics(address, callback) { // callback(error, services, characteristics);
  chrome.bluetoothLowEnergy.getServices(address, function (services) {
    var characteristics = [];
    var end = (function (max) {
      var count = 0;
      return function (chrcs) {
        if (chrome.runtime.lastError) {
          log(chrome.runtime.lastError.message);
          callback(chrome.runtime.lastError);
          return;
        }
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









// Drone Object Code
var Drone = function(options) {
  
  this.name = (options ? options.name : undefined);
  this.address = (options ? options.address : undefined);
  this.connected = false;
  this.steps = {};
  this.characteristics = [];
};



// create client helper function to match ar-drone
Drone.createClient = function (options) {
  return new Drone(options);
};


Drone.prototype.bleConnect = function (device, callback) {
  var that = this;
  chrome.bluetoothLowEnergy.connect(device.address, function () {
    if (chrome.runtime.lastError) {
      log('Failed to connect '+device.name+': ' + chrome.runtime.lastError.message);
      if (callback)
        callback(chrome.runtime.lastError);
    } else {
      log('Connected to rolling spider');
      that.peripheral = device;
      that.connected = true;
      that.address = device.address;
      if (callback)
        callback(null, that);
    }
  });
};

Drone.prototype.connect = function(callback) {

  var that = this;
  var deviceFound = (function (device) {
    if (this.name) {
      if (device.name === this.name) {
        this.bleConnect(device, callback);
      }  
    } else if ( this.address) {
      if (device.address === this.address) {
        this.bleConnect(device, callback);
      }
    } else {
      if (device.name.indexOf('RS_') === 0) {
        this.bleConnect(device, callback);
      }
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
      if (callback) {
        callback((that.connected ? null : new Error('No Rolling Spider was found.')));
      }
        
    }, 30000);
  });
};

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
  var that = this;

  var listening = [ 'fb8f', 'fb8e', 'fb1b', 'fb1c', 'fd22', 'fd23', 'fd24', 
                    'fd52', 'fd53', 'fd54' ];
                    
  
  var recursivelyStartNotifications = function (array, end) {
    if (chrome.runtime.lastError) {
      log('RSN err: ' + chrome.runtime.lastError.message);
    }

    if (!array.length) {
      end();
    } else {
      var key = array.pop();
      var characteristic = that.getCharacteristic(key);
      if (!characteristic) {
        log('Characteristic not found: '+key);
        recursivelyStartNotifications(array, end);
      } else {
        chrome.bluetoothLowEnergy.startCharacteristicNotifications(characteristic.instanceId, function () {
          recursivelyStartNotifications(array, end);
        });
      }
    }
  };

  recursivelyStartNotifications(listening, function () {
    var key = 'fa0b';
    that.steps[key] = (that.steps[key] || 0) + 1;
    var msg = buffer([ 0x04, that.steps[key], 0x00, 0x04, 0x01, 0x00, 0x32, 
                       0x30, 0x31, 0x34, 0x2D, 0x31, 0x30, 0x2D, 0x32, 0x38, 0x00]);
    that.writeTo(key, msg, callback);
  });
};



Drone.prototype.writeTo = function(unique_uuid_segment, buffer, callback) {
  var characteristic = this.getCharacteristic(unique_uuid_segment);
  chrome.bluetoothLowEnergy.writeCharacteristicValue(characteristic.instanceId,
    buffer,
    function() {
      if (chrome.runtime.lastError) {
        log('wCV err: ', chrome.runtime.lastError);
      }
      if (callback)
        callback();
    });
};


Drone.prototype.ping = function (callback) {
  var key = 'fa0a';
  var that = this;
  that.steps[key] = (that.steps[key] || 0) + 1;
  that.writeTo(
    key,
    buffer([0x02,this.steps[key],0x02,0x00,0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00]),
    function () {
      if (chrome.runtime.lastError) {
        log('ping err: ', chrome.runtime.lastError);
      } 
      setTimeout(that.ping, PING_INTERVAL);
    }
  );
};


Drone.prototype.startPing = function() {
  this.ping();
};



//
// tilt [-100:100]
// forward [-100:100]
// turn [-100:100]
// up [-100:100]
//
Drone.prototype.drive = function(tilt, forward, turn, up, steps) {
  var key = 'fa0a';
  for (var i=0; i < steps; i++) {
    this.steps[key] = ((this.steps[key] || 0) + 1) %256;

    var ab = new ArrayBuffer(19);
    var ua = new DataView(ab);

    ua.setInt8(0, 0);
    ua.setInt8(1, this.steps[key]);
    ua.setInt8(2, 2);
    ua.setInt8(3, 0);
    ua.setInt8(4, 2);
    ua.setInt8(5, 0);
    ua.setInt8(6, 1);
    ua.setInt8(7, tilt);
    ua.setInt8(8, forward);
    ua.setInt8(9, turn);
    ua.setInt8(10, up);
    ua.setFloat32(11, 0, true);
    ua.setUInt32(15, 0, true);  //fill with zeros
    this.writeTo(key, buffer);
  }
};


Drone.prototype.getCharacteristic = function(unique_uuid_segment) {
  var filtered = this.characteristics.filter(function(c) {
    return c.uuid.search(new RegExp(unique_uuid_segment)) !== -1;
  });

  return filtered[0];
};



window.onload = function() {
  chrome.bluetooth.getAdapterState(function(adapter) {
    if (!adapter.powered) {
      alert('Please enable bluetooth on the device');
    }
  });

  logNode = document.querySelector('#log');
  log('Finding Bluetooth Devices');

  drone = new Drone({
    name: "RS_W008267"
  });
  drone.connect(function (error) {
    if (error) {
      log('error', error);
    } else {
      drone.setup(function (error) {
        if (error) {
          log(error);
        } else {
          drone.handshake(function (error) {
            log('Handshake complete');  
          });
        }
      });
    }
  });

};
