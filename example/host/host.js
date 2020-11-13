// @ts-check

const fs = require('fs');
const path = require('path');
const { Client } = require('@josephuspaye/pipe-emitter');

const { ChromeNativeBridge } = require('..');

const fd = fs.openSync(path.join(__dirname, 'log.txt'), 'a');
const logFile = fs.createWriteStream(null, { fd });

function log(data) {
  logFile.write(JSON.stringify(data, null, '  '));
  logFile.write('\n');
}

const bridge = new ChromeNativeBridge(
  process.argv,
  process.stdin,
  process.stdout,
  {
    onMessage(message) {
      log(message);

      if (pipe) {
        pipe.emit('message', message);
      }
    },

    onError(err) {
      log(['bridge error', err]);
    },
  }
);

const pipe = new Client('chrome-native-bridge-chat', {
  onError(err) {
    log(['pipe error', err]);
  },
});

pipe.on('message', (message) => {
  bridge.emit(message);
});