// @ts-check

const readline = require('readline');
const { Server } = require('@josephuspaye/pipe-emitter');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer);
    });
  });
}

let questionPromise;

async function startChat() {
  if (questionPromise) {
    questionPromise.cancel();
  }

  while (true) {
    const answer = await ask('[native] ');
    server.emit('message', { from: 'native', text: answer });
  }
}

const server = new Server('chrome-native-bridge-chat', {
  onError(err) {
    console.log('\nserver error', err);
  },
  onConnect() {
    console.log('\nconnected to host\n');
    startChat();
  },
  onDisconnect() {
    console.log('\ndisconnected from host');
    process.exit();
  },
});

server.on('message', (message) => {
  console.log(`\n[${message.from}] ${message.text}`);
  process.stdout.write('[native] ');
});

console.log('waiting for host to connect...');
