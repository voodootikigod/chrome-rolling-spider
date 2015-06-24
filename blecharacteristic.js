
var BLECharacteristic = function (rawCharacteristic) {
  this.characteristic = rawCharacteristic;
  this.uuid = rawCharacteristic.uuid;
}

BLECharacteristic.prototype.write = function (buffer, response, callback) {
  chrome.bluetoothLowEnergy.writeCharacteristicValue(this.characteristic.id, buffer, callback);
};
