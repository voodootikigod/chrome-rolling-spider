const PING_INTERVAL = 50;
const DRIVE_KEY = 'fa0b';


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
    that.steps[DRIVE_KEY] = (that.steps[DRIVE_KEY] || 0) + 1;
    var msg = buffer([ 0x04, that.steps[DRIVE_KEY], 0x00, 0x04, 0x01, 0x00, 0x32, 
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


// Operational Functions
// Multiple use cases provided to support initial build API as well as
// NodeCopter API and parity with the ar-drone library.

function takeOff() {
  this.steps[DRIVE_KEY] = (this.steps[DRIVE_KEY] || 0) + 1;
  this.writeTo(
      DRIVE_KEY,
      buffer([0x02,this.steps[DRIVE_KEY] & 0xFF,0x02,0x00,0x01,0x00])
      );
}

function land(){
  this.steps[DRIVE_KEY] = (this.steps[DRIVE_KEY] || 0) + 1;
  this.writeTo(
      DRIVE_KEY,
      buffer([0x02,this.steps[DRIVE_KEY] & 0xFF,0x02,0x00,0x03,0x00])
      );
}

function cutOff()  {
  this.steps[DRIVE_KEY] = (this.steps[DRIVE_KEY] || 0) + 1;
  this.writeTo(
      DRIVE_KEY,
      buffer([0x02,this.steps[DRIVE_KEY] & 0xFF,0x02,0x00,0x04,0x00])
      );
}

function flatTrim () {
  this.steps[DRIVE_KEY] = (this.steps[DRIVE_KEY] || 0) + 1;
  this.writeTo(
      DRIVE_KEY,
      buffer([0x02,this.steps[DRIVE_KEY] & 0xFF,0x02,0x00,0x00,0x00])
      );
}

function frontFlip() {
  this.steps[DRIVE_KEY] = (this.steps[DRIVE_KEY] || 0) + 1;
  this.writeTo(
      DRIVE_KEY,
      new Buffer([0x02,this.steps[DRIVE_KEY] & 0xFF,0x02,0x04,0x00,0x00,0x00,0x00,0x00,0x00])
      );
}

function backFlip() {
  this.steps[DRIVE_KEY] = (this.steps[DRIVE_KEY] || 0) + 1;
  this.writeTo(
      DRIVE_KEY,
      new Buffer([0x02,this.steps[DRIVE_KEY] & 0xFF,0x02,0x04,0x00,0x00,0x00,0x00,0x00,0x01])
      );
}

function rightFlip() {
  this.steps[DRIVE_KEY] = (this.steps[DRIVE_KEY] || 0) + 1;

  this.writeTo(
      DRIVE_KEY,
      new Buffer([0x02,this.steps[DRIVE_KEY] & 0xFF,0x02,0x04,0x00,0x00,0x00,0x00,0x00,0x02])
      );
}

function leftFlip() {
  this.steps[DRIVE_KEY] = (this.steps[DRIVE_KEY] || 0) + 1;

  this.writeTo(
      DRIVE_KEY,
      new Buffer([0x02,this.steps[DRIVE_KEY] & 0xFF,0x02,0x04,0x00,0x00,0x00,0x00,0x00,0x03])
      );
}

function up(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(0, 0, 0, speed, steps);
}

function down(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(0, 0, 0, speed * -1, steps);
}
function forward(options) {
 options = options || {};
 var speed = options.speed || 50;
 var steps = options.steps || 50;

 this.drive(0, speed, 0, 0, steps);
}

function backward(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(0, speed * -1, 0, 0, steps);
}
function turnRight(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(0, 0, speed, 0, steps);
}


function turnLeft(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(0, 0, speed * -1, 0, steps);
}

function tiltRight(options) {
 options = options || {};
 var speed = options.speed || 50;
 var steps = options.steps || 50;

 this.drive(speed, 0, 0, 0, steps);
}


function tiltLeft(options) {
  options = options || {};
  var speed = options.speed || 50;
  var steps = options.steps || 50;

  this.drive(speed * -1, 0, 0, 0, steps);
}

// provide options for use case
Drone.prototype.takeoff = takeOff;
Drone.prototype.takeOff = takeOff;
Drone.prototype.land = land;
Drone.prototype.emergency = cutOff;
Drone.prototype.emergancy = cutOff;
Drone.prototype.flatTrim = flatTrim;
Drone.prototype.calibrate = flatTrim;
Drone.prototype.up = up;
Drone.prototype.down = down;
// animation
Drone.prototype.frontFlip = frontFlip;
Drone.prototype.backFlip = backFlip;
Drone.prototype.rightFlip = rightFlip;
Drone.prototype.leftFlip = leftFlip;

// rotational
Drone.prototype.turnRight = turnRight;
Drone.prototype.clockwise = turnRight;
Drone.prototype.turnLeft = turnLeft;
Drone.prototype.counterClockwise = turnLeft;

// directional
Drone.prototype.forward = forward;
Drone.prototype.backward = backward;
Drone.prototype.tiltRight = tiltRight;
Drone.prototype.tiltLeft = tiltLeft;
Drone.prototype.right = tiltRight;
Drone.prototype.left = tiltLeft;


