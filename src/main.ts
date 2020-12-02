import { PassThrough, Readable, Writable } from 'stream';

/**
 * An error that occurs while sending or receiving messages.
 */
export type ChromeNativeBridgeError = Error & {
  type: 'SEND_ERROR' | 'RECEIVE_ERROR';
};

/**
 * Handle a new message.
 */
export type OnMessageHandler<T> = (message: T) => void;

/**
 * Handle an error receiving data. The second parameter
 * is the raw string of the message that caused the error.
 */
export type OnErrorHandler = (
  err: ChromeNativeBridgeError,
  data: string
) => void;

/**
 * Handle the end of the input stream. This can be used to know when
 * to exit the native host process, since it seems like when Chrome
 * wants to end the process, it closes stdin, triggering its 'end'
 * event (at least from every case I've observed so far).
 */
export type OnEndHandler = () => void;

/**
 * Implements the Chrome Native Messaging protocol and provides
 * a nicer interface over stdin/stdout for communicating with
 * a Chrome extension from a native Node.js script.
 */
export class ChromeNativeBridge<TSend = any, TReceive = any> {
  private input: Readable;
  private output: Writable;

  private onMessage: OnMessageHandler<TReceive>;
  private onError: OnErrorHandler;
  private onEnd: OnEndHandler;

  private hasNextMessageLength = false;
  private nextMessageLength = 0;
  private nextMessageBuffer = Buffer.alloc(0);

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
    input: Readable,
    output: Writable,
    options: {
      onMessage: OnMessageHandler<TReceive>;
      onError: OnErrorHandler;
      onEnd: OnEndHandler;
      mirrorInputTo?: Writable;
      mirrorOutputTo?: Writable;
    }
  ) {
    this.origin = '';
    this.parseAndAssignArgs(args);

    this.input = input;

    if (options.mirrorInputTo) {
      input.pipe(options.mirrorInputTo);
    }

    if (options.mirrorOutputTo) {
      const outputProxy = new PassThrough();
      outputProxy.pipe(output);
      outputProxy.pipe(options.mirrorOutputTo);

      this.output = outputProxy;
    } else {
      this.output = output;
    }

    this.onMessage = options.onMessage;
    this.onError = options.onError;
    this.onEnd = options.onEnd;

    this.onDataChunk = this.onDataChunk.bind(this);
    this.input.on('data', this.onDataChunk);

    this.input.on('end', () => {
      this.onEnd();
    });
  }

  /**
   * Parse the given args and set them.
   */
  private parseAndAssignArgs(args: string[]) {
    // args from Chrome look like this: (node exe path, current script path, origin, chrome window hwnd)
    // last item is only available on Windows
    this.origin = args[2];

    if (args[3] && args[3].includes('--parent-window=')) {
      const [, parentWindow] = args[3].split('=');

      if (parentWindow) {
        this.parentWindow = Number(parentWindow);
      }
    }
  }

  /**
   * Process a new input data chunk.
   */
  private onDataChunk(chunk: Buffer) {
    // Append the chunk to the next message buffer
    this.nextMessageBuffer = Buffer.concat([this.nextMessageBuffer, chunk]);

    // Attempt to parse the next message buffer
    this.parseNextMessage();
  }

  /**
   * Attempt to parse a message from the next message buffer.
   */
  private parseNextMessage() {
    // If we don't have the length of the next message yet...
    if (!this.hasNextMessageLength) {
      // but we have enough data in the buffer to parse the length...
      if (this.nextMessageBuffer.length >= 4) {
        // parse the first 4 bytes in the buffer as the length
        this.nextMessageLength = this.nextMessageBuffer.readUInt32LE(0);
        this.hasNextMessageLength = true;

        // remove the bytes just parsed
        this.nextMessageBuffer = this.nextMessageBuffer.slice(4);
      }
    }

    // If we have the length of the next message (may have just parsed it above)...
    if (this.hasNextMessageLength) {
      // and there is enough data in the buffer to parse the message
      if (this.nextMessageBuffer.length >= this.nextMessageLength) {
        // slice off the bytes needed for the message
        const messageBuffer = this.nextMessageBuffer.slice(
          0,
          this.nextMessageLength
        );

        // remove the bytes just sliced off
        this.nextMessageBuffer = this.nextMessageBuffer.slice(
          this.nextMessageLength
        );

        // clear the length flag to parse the next message's length
        this.hasNextMessageLength = false;

        const messageData = messageBuffer.toString();
        let message: TReceive;

        try {
          message = JSON.parse(messageData);
        } catch (err) {
          err.type = 'RECEIVE_ERROR';
          this.onError(err, messageData);

          // parse any additional messages in the buffer
          this.parseNextMessage();
          return;
        }

        // return the parsed message
        this.onMessage(message);

        // parse any additional messages in the buffer
        this.parseNextMessage();
      }
    }
  }

  /**
   * Send the given data to the output. The data will be passed to
   * `JSON.stringify()` for serialisation, and will throw an error
   * [if `JSON.stringify()` throws](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Exceptions).
   */
  emit(data: TSend) {
    let message;

    try {
      message = Buffer.from(JSON.stringify(data));
    } catch (err) {
      err.type = 'SEND_ERROR';
      throw err;
    }

    const length = Buffer.alloc(4);
    length.writeUInt32LE(message.length);

    this.output.write(Buffer.concat([length, message]), 'binary');
  }

  /**
   * Close the bridge.
   */
  close() {
    this.input.off('data', this.onDataChunk);
    this.hasNextMessageLength = false;
    this.nextMessageLength = 0;
    this.nextMessageBuffer = Buffer.alloc(0);
  }
}
