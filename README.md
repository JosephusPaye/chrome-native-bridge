# pipe-emitter

A bidirectional inter-process event emitter that uses UNIX domain sockets (on Linux and macOS) and named pipes (on Windows).

This project is part of [#CreateWeekly](https://twitter.com/JosephusPaye/status/1214853295023411200), my attempt to create something new publicly every week in 2020.

## Installation

```
npm install @josephuspaye/pipe-emitter --save
```

## Usage

The following example shows how to use `pipe-emitter` to communicate between two processes:

<details>
<summary>View server.js</summary>

```js
// server.js: creates a pipe for client connections

import { Server } from '..';

const server = new Server('pipe-emitter-example', {
  onError(error) {
    // An error has occured. `error.type` has the type of error.
    console.log('server error', error.type);
  },
  onConnect() {
    console.log('client connected, sending greeting');

    // A client has connected, send them a greeting
    server.emit('greeting', 'oh hai from server');
  },
  onDisconnect() {
    console.log('client disconnected, closing server');

    // A client (the only one) has disconnected, close server pipe
    server.close();
  },
});

// Listen for a message from clients
server.on('greeting', (message) => {
  console.log('received greeting from client:', message);
});

console.log('pipe server started');
```

</details>

<details>
<summary>View client.js</summary>

```js
// client.js: connects to an open pipe

import { Client } from '..';

const client = new Client('pipe-emitter-example', {
  onError(error) {
    // An error has occured. `error.type` has the type of error.
    console.log('server error', error.type);
  },
  onConnect() {
    // Connected to the server
    console.log('connected to server');
  },
  onDisconnect() {
    // Disconnected from the server
    console.log('disconnected from server');
  },
});

// Listen for a message from the server
client.on('greeting', (message) => {
  console.log('received greeting from server:', message);

  // Send a greeting in response
  client.emit('greeting', 'oh hai from client');

  // Close and clean up the client pipe after two seconds
  setTimeout(() => {
    console.log('responded, now disconnecting');
    client.close();
  }, 2000);
});
```

</details>

Running the above `server.js` in Node followed by `client.js` yields the following output from `server.js`:

```
pipe server started
client connected, sending greeting
received greeting from client: oh hai from client
client disconnected, closing server
```

And the following from `client.js`:

```
connected to server
received greeting from server: oh hai from server
responded, now disconnecting
disconnected from server
```

## API

### `Server` class

A server for creating IPC pipes (UNIX domain pipes or named pipes on Windows). Supports bi-directional communication with clients that connect. See [Types](#types) below for additional types.

<details>
<summary>View details</summary>

```ts
class Server {
  /**
   * Create a new pipe server that clients can connect to. See [the Node.js docs](https://nodejs.org/docs/latest-v14.x/api/net.html#net_identifying_paths_for_ipc_connections) for pipe name format and valid characters.
   *
   * @param pipeName The name of the pipe, globally unique at the OS level
   * @param options
   */
  constructor(
    pipeName: string,
    options: {
      onError: ErrorListener;
      onConnect?: ConnectListener;
      onDisconnect?: CloseListener;
    }
  );

  /**
   * Get the number of clients connected to this pipe.
   */
  clientCount(): number;

  /**
   * Emit the given event and data unto the pipe. Will throw an error of type "SEND_ERROR"
   * if a client socket is not writable (e.g. not ready or already closed).
   *
   * @param {string|symbol} event The event type
   * @param {Any} [data] Any value (object is recommended), passed to each handler
   */
  emit<T = any>(event: EventType, data?: T): void;

  /**
   * Register an event handler for the given type on this pipe.
   *
   * @param {string|symbol} type Type of event to listen for, or `"*"` for all events
   * @param {Function} handler Function to call in response to given event
   */
  on<T = any>(type: EventType, handler: Handler<T>): void;

  /**
   * Remove an event handler for the given type on this pipe.
   *
   * @param {string|symbol} type Type of event to unregister `handler` from, or `"*"`
   * @param {Function} handler Handler function to remove
   */
  off<T = any>(type: EventType, handler: Handler<T>): void;

  /**
   * Remove all event listeners.
   */
  allOff(): void;

  /**
   * Close the pipe and clear event listeners.
   */
  close(): Promise<void>;
}
```

</details>

### `Client` class

A client for connecting to IPC pipes (UNIX domain pipes or named pipes on Windows). Supports bi-directional communication with the server it's connected to. See [Types](#types) below for additional types.

<details>
<summary>View details</summary>

```ts
class Client {
  /**
   * Create a new pipe client and connect it to the given pipe.
   *
   * @param pipeName The name of the pipe to connect to
   * @param options
   */
  constructor(
    pipeName: string,
    options: {
      onError: ErrorListener;
      onConnect?: ConnectListener;
      onDisconnect?: CloseListener;
    }
  );

  /**
   * Emit the given event and data unto the pipe. Will throw an error of type "SEND_ERROR"
   * if the server socket is not writable (e.g. not ready or already closed).
   *
   * @param {string|symbol} event The event type
   * @param {Any} [data] Any value (object is recommended), passed to each handler
   */
  emit<T = any>(event: EventType, data?: T): void;

  /**
   * Register an event handler for the given type on this pipe.
   *
   * @param {string|symbol} type Type of event to listen for, or `"*"` for all events
   * @param {Function} handler Function to call in response to given event
   */
  on<T = any>(type: EventType, handler: Handler<T>): void;

  /**
   * Remove an event handler for the given type on this pipe.
   *
   * @param {string|symbol} type Type of event to unregister `handler` from, or `"*"`
   * @param {Function} handler Handler function to remove
   */
  off<T = any>(type: EventType, handler: Handler<T>): void;

  /**
   * Remove all event listeners.
   */
  allOff(): void;

  /**
   * Close the pipe and clear event listeners.
   */
  close(): void;
}
```

</details>

### Types

Additional types used by the `Server` and `Client` classes.

```ts
type PipeError = Error & {
  type: 'SEND_ERROR' | 'RECEIVE_ERROR' | 'SERVER_ERROR' | 'SOCKET_ERROR';
};
type EventType = string | symbol;
type Handler<T = any> = (event?: T) => void;
type WildcardHandler = (type: EventType, event?: any) => void;
type ErrorListener = (err: PipeError) => void;
type ConnectListener = () => void;
type CloseListener = (hadError: boolean) => void;
```

## Licence

[MIT](LICENCE)
