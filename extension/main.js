let port = null;

function log(text) {
  document.getElementById('log').innerHTML += text + '\n';
}

function appendMessage(message) {
  document.getElementById(
    'messages'
  ).innerHTML += `<p class="message"><b>${message.from}</b>: ${message.text}</p>`;
}

function updateUiState() {
  if (port) {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('chat-screen').style.display = 'flex';
    log('connected\n');
  } else {
    document.getElementById('start-screen').style.display = 'block';
    document.getElementById('chat-screen').style.display = 'none';
  }
}

function sendNativeMessage() {
  message = {
    from: 'chrome',
    text: document.getElementById('message-input').value,
  };
  port.postMessage(message);
  appendMessage(message);
  log('sent:\n' + JSON.stringify(message) + '\n');
  document.getElementById('message-input').value = '';
  document.getElementById('message-input').focus();
}

function onNativeMessage(message) {
  appendMessage(message);
  log('received:\n' + JSON.stringify(message) + '\n');
}

function onDisconnected() {
  log('failed to connect: ' + chrome.runtime.lastError.message);
  port = null;
  updateUiState();
}

function connect() {
  const hostName = 'io.github.josephuspaye.chromenativebridge';

  log('connecting to native messaging host ' + hostName + '');

  port = chrome.runtime.connectNative(hostName);
  port.onMessage.addListener(onNativeMessage);
  port.onDisconnect.addListener(onDisconnected);

  updateUiState();
}

document.getElementById('connect-button').addEventListener('click', connect);

document
  .getElementById('send-button')
  .addEventListener('click', sendNativeMessage);

updateUiState();
