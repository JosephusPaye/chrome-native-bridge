# chrome-native-bridge

A utility for building [Chrome native messaging](https://developer.chrome.com/extensions/nativeMessaging) hosts with Node.js. Allows you to write Node scripts that can communicate bi-directionally with extensions and apps in Chrome.

This project is part of [#CreateWeekly](https://twitter.com/JosephusPaye/status/1214853295023411200), my attempt to create something new publicly every week in 2020.

## Installation

```
npm install @josephuspaye/chrome-native-bridge --save
```

## Usage

The following example shows a Node script that echoes all messages sent to it from Chrome. Note that it doesn't use `console.log()`, as that writes to stdout, which Chrome reads for messages.

```js
import { ChromeNativeBridge } from '@josephuspaye/chrome-native-bridge';

const bridge = new ChromeNativeBridge(
  process.argv, // The arguments to the current process
  process.stdin, // The input stream that Chrome writes to
  process.stdout, // The output stream that Chrome reads from
  {
    onMessage(message) {
      // A message has been received, echo it
      // by sending it back
      bridge.emit(message);
    },

    onError(err) {
      // There's been an error parsing a received message.
      // Do something to handle it here...
    },
  }
);

// This is the origin of the caller, usually chrome-extension://[ID of allowed extension]
const origin = bridge.origin;

// This is the decimal handle value of the calling Chrome window. Available on Windows only.
const parentWindow = bridge.parentWindow;
```

## Example

There is an example native host script and a corresponding Chrome extension at [example/host](example/host) and [example/extension](example/extension) respectively. Together they implement a basic text chat to demonstrate communication over the native bridge.

You can [view a demonstration GIF (2MB) here](demo.gif?raw=true).

### Get it

- Clone this repo: `git clone https://github.com/JosephusPaye/chrome-native-bridge.git`
- Change into the cloned directory: `cd chrome-native-bridge`
- Install dependencies: `yarn` (or `npm install`)

### Install it

Open the **Extensions** page in Chrome (navigate to [chrome://extensions](chrome://extensions)), enable developer mode, click "Load unpacked", and then select the [example/extension](example/extension) folder in the repo.

When the extension is loaded, copy the generated ID, change it to the form `chrome-extension://EXTENSION_ID_HERE/`, and paste it into the [example/host/manifest.json](example/host/manifest.json) file, in the `allowed_origins` array.

Next, install the host manifest by running the following in a Command Prompt, from the repo root directory:

```
example\host\install.bat
```

Similarly, you can uninstall the host manifest by running `example\host\uninstall.bat`.

Note: the install and uninstall scripts are Windows only, but similar scripts [can be written for Linux or macOS](https://developer.chrome.com/extensions/nativeMessaging#native-messaging-host).

### Run it

Start the [example/host/chat.js](example/host/chat.js) script in Node, by running the following from the repo root directory.

```
node example/host/chat.js
```

This will start the native chat client and wait for a connection from the host script, which will be launched by Chrome when it connects.

In Chrome, navigate to [chrome://apps](chrome://apps) and launch the **Chrome Native Bridge example** app, then click "Connect to chat". If the host manifest was installed correctly, Chrome will connect to the host, and a chat interface will be shown.

You can now exchanges messages between the Chrome app and the native `chat.js` script by typing in the input in Chrome, or the terminal running the `chat.js` script.

## API

### `ChromeNativeBridge` class

Implements the Chrome Native Messaging protocol and provides a nicer interface over stdin/stdout for communicating with a Chrome extension from a native Node script.

```ts
class ChromeNativeBridge<TSend = any, TReceive = any> {
  /**
   * Origin of the caller, usually chrome-extension://[ID of allowed extension]
   */
  origin: string;

  /**
   * The decimal handle value of the calling Chrome window. Available on Windows only.
   */
  parentWindow?: number;

  /**
   * Create a new bridge with the given input and output.
   *
   * @param args The arguments to the script. Use `process.argv`.
   * @param input A readable stream for getting messages from Chrome. Use `process.stdin`.
   * @param output A writable stream for sending message to Chrome. Use `process.stdout`.
   */
  constructor(
    args: string[],
    input: NodeJS.ReadableStream,
    output: NodeJS.WritableStream,
    options: {
      onMessage: OnMessageHandler<TReceive>;
      onError: OnErrorHandler;
    }
  );

  /**
   * Send the given data to the output. The data will be passed to
   * `JSON.stringify()` for serialisation, and will throw an error
   * [if `JSON.stringify()` throws](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Exceptions).
   */
  emit(data: TSend): void;

  /**
   * Close the bridge.
   */
  close(): void;
}
```

### Types

The following additional types are used by the ChromeNativeBridge class:

```ts
/**
 * An error that occurs while sending or receiving messages.
 */
type ChromeNativeBridgeError = Error & {
  type: 'SEND_ERROR' | 'RECEIVE_ERROR';
};

/**
 * Handle a new message.
 */
type OnMessageHandler<T> = (message: T) => void;

/**
 * Handle an error receiving data. The second parameter
 * is the raw string of the message that caused the error.
 */
type OnErrorHandler = (err: ChromeNativeBridgeError, data: string) => void;
```

## Related

- [jdiamond/chrome-native-messaging](https://github.com/jdiamond/chrome-native-messaging): similar project that solves the same problem with a lower-level stream API
- [JosephusPaye/pipe-emitter](https://github.com/JosephusPaye/pipe-emitter): inter-process event emitter that allows for communicating with the native messaging host from another process

## Licence

[MIT](LICENCE)
