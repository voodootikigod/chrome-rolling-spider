var drone,
    searchTimer;


window.onload = function() {
  chrome.bluetooth.getAdapterState(function(adapter) {
    if (!adapter.powered) {
      alert('Please enable bluetooth on the device');
    }
  });
  log('Finding Bluetooth Devices');

  drone = new Drone({
    name: "RS_B141278",
    logger: console.log.bind(console),
    forceConnect: true
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
