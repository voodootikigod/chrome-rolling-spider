var searchTimer;


function buffer(array) {
  var ab = new ArrayBuffer(array.length);
  var ua = new Uint8Array(ab);
  for (var i = 0; i < array.length; i++) {
    ua[i] = array[i];
  }
  return ab;
}

function log() {
  logNode = ((typeof logNode !== 'undefined') ? logNode : document.querySelector('#log'));
  var args = [];
  for (var i = 0;i<arguments.length; i++) {
    var item = arguments[i];
    args.push((typeof item == 'string' ? item : JSON.stringify(item)));
  }
  var li = document.createElement('li');
  li.innerText = args.join(' ');
  logNode.appendChild(li);
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


function stopDiscovery() {
  try {
    if (searchTimer) { clearTimeout(searchTimer); }
    chrome.bluetooth.stopDiscovery();
  } catch (e) {
    console.error('Issue with ending discovery');
  }
}