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
