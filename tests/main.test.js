// @ts-check

import { test } from 'uvu';
import * as assert from 'uvu/assert';
import { Readable, Writable, PassThrough } from 'stream';

import { ChromeNativeBridge } from '..';

function asyncTest(testFn, options = {}) {
  const { timeout } = Object.assign({}, { timeout: 3 }, options);

  return new Promise((resolve) => {
    function done(bridge) {
      if (bridge) {
        bridge.close();
      }

      resolve();
    }

    if (timeout > 0) {
      setTimeout(async () => {
        throw new Error(`async test timed out after ${timeout} seconds`);
      }, timeout * 1000);
    }

    testFn(done);
  });
}

function chromeMessage(data) {
  const message = Buffer.from(data);

  const length = Buffer.alloc(4);
  length.writeUInt32LE(message.length);

  return Buffer.concat([length, message]);
}

function unreachable(message) {
  return () => {
    assert.unreachable(message);
  };
}

test('parses origin and parent window', async () => {
  await asyncTest((done) => {
    const bridge = new ChromeNativeBridge(
      ['', '', 'chrome-extension://id'],
      Readable.from([]),
      new Writable(),
      {
        onError: unreachable('should not error'),
        onMessage: unreachable('should not get a message'),
        onEnd() {},
      }
    );

    assert.is(bridge.origin, 'chrome-extension://id');
    assert.is(bridge.parentWindow, undefined);

    done(bridge);
  });

  await asyncTest((done) => {
    const bridge = new ChromeNativeBridge(
      ['', '', 'chrome-extension://id', 'invalid-parent-window'],
      Readable.from([]),
      new Writable(),
      {
        onError() {},
        onMessage() {},
        onEnd() {},
      }
    );

    assert.is(bridge.origin, 'chrome-extension://id');
    assert.is(bridge.parentWindow, undefined);

    done(bridge);
  });

  await asyncTest((done) => {
    const bridge = new ChromeNativeBridge(
      ['', '', 'chrome-extension://id', '--parent-window=67200'],
      Readable.from([]),
      new Writable(),
      {
        onError() {},
        onMessage() {},
        onEnd() {},
      }
    );

    assert.is(bridge.origin, 'chrome-extension://id');
    assert.is(bridge.parentWindow, 67200);

    done(bridge);
  });
});

test("calls onError() when there's an error receiving a message", async () => {
  await asyncTest((done) => {
    const input = Readable.from([chromeMessage('{')]); // stream with malformed JSON
    const bridge = new ChromeNativeBridge([], input, new Writable(), {
      onError(err, message) {
        assert.is(err.type, 'RECEIVE_ERROR');
        assert.is(message, '{');
        done(bridge);
      },
      onMessage: unreachable('should not get a message'),
      onEnd() {},
    });
  });
});

test('calls onEnd() when the input stream is ended', async () => {
  await asyncTest((done) => {
    const input = Readable.from(['ok', 'boomer']);

    // Pause the input stream so it isn't consumed and automatically ended
    input.pause();

    const bridge = new ChromeNativeBridge([], input, new Writable(), {
      onError: unreachable('should not error'),
      onMessage: unreachable('should not get a message'),
      onEnd() {
        done(bridge);
      },
    });

    // Manually trigger the end event
    input.emit('end');
  });
});

test.only('can mirror input and output to other streams', async () => {
  // test mirroring of the input
  await asyncTest((done) => {
    const inputData = chromeMessage(JSON.stringify({ ok: 'boomer' }));

    const input = Readable.from([inputData]);

    const inputMirror = new PassThrough();

    inputMirror.on('data', (data) => {
      assert.equal(data, inputData);
      done(bridge);
    });

    const bridge = new ChromeNativeBridge([], input, new Writable(), {
      mirrorInputTo: inputMirror,
      onError: unreachable('should not error'),
      onMessage() {},
      onEnd() {},
    });
  });

  // test mirroring of the output
  await asyncTest((done) => {
    function parseMessage(buffer) {
      const lengthBuffer = buffer.slice(0, 4);
      const length = lengthBuffer.readUInt32LE(0);

      const messageBuffer = buffer.slice(4, 4 + length);
      const message = JSON.parse(messageBuffer.toString());

      return message;
    }

    const output = new PassThrough();
    const outputMirror = new PassThrough();

    outputMirror.on('data', (chunk) => {
      const message = parseMessage(chunk);
      assert.equal(message, { ok: 'boomer' });
      done(bridge);
    });

    const bridge = new ChromeNativeBridge([], Readable.from([]), output, {
      mirrorOutputTo: outputMirror,
      onError: unreachable('should not error'),
      onMessage: unreachable('should not get a message'),
      onEnd() {},
    });

    bridge.emit({ ok: 'boomer' });
  });
});

test('calls onMessage() when a message is received', async () => {
  // test single message
  await asyncTest((done) => {
    const input = Readable.from([
      chromeMessage(JSON.stringify({ ok: 'boomer' })),
    ]);

    const bridge = new ChromeNativeBridge([], input, new Writable(), {
      onError: unreachable('should not error'),
      onMessage(message) {
        assert.equal(message, { ok: 'boomer' });
        done(bridge);
      },
      onEnd() {},
    });
  });

  // test multiple messages
  await asyncTest((done) => {
    const input = Readable.from([
      chromeMessage(JSON.stringify({ greeting: 'oh hai' })),
      chromeMessage(JSON.stringify({ farewell: 'bye' })),
    ]);

    let messagesReceived = 0;

    const bridge = new ChromeNativeBridge([], input, new Writable(), {
      onError: unreachable('should not error'),
      onMessage(message) {
        messagesReceived++;

        if (messagesReceived === 1) {
          assert.equal(message, { greeting: 'oh hai' });
        } else if (messagesReceived === 2) {
          assert.equal(message, { farewell: 'bye' });
          done(bridge);
        }
      },
      onEnd() {},
    });
  });

  // test a message in chunks
  await asyncTest((done) => {
    const buffer = chromeMessage(
      JSON.stringify({ greeting: 'oh hai', farewell: 'bye' })
    );

    const input = Readable.from([
      buffer.slice(0, 3),
      buffer.slice(3, 6),
      buffer.slice(6),
    ]);

    const bridge = new ChromeNativeBridge([], input, new Writable(), {
      onError: unreachable('should not error'),
      onMessage(message) {
        assert.equal(message, { greeting: 'oh hai', farewell: 'bye' });
        done(bridge);
      },
      onEnd() {},
    });
  });
});

test("emit() throws when there's an error sending a message", async () => {
  await asyncTest((done) => {
    const bridge = new ChromeNativeBridge(
      [],
      Readable.from([]),
      new PassThrough(),
      {
        onError: unreachable('should not error'),
        onMessage: unreachable('should not get a message'),
        onEnd() {},
      }
    );

    const cyclic = {};
    cyclic.a = cyclic;

    try {
      bridge.emit(cyclic);
      assert.unreachable('did not throw');
    } catch (err) {
      assert.is(err.type, 'SEND_ERROR');
      done(bridge);
    }
  });
});

test('emit() sends a message', async () => {
  function parseMessage(buffer) {
    const lengthBuffer = buffer.slice(0, 4);
    const length = lengthBuffer.readUInt32LE(0);

    const messageBuffer = buffer.slice(4, 4 + length);
    const message = JSON.parse(messageBuffer.toString());

    return message;
  }

  await asyncTest((done) => {
    const output = new PassThrough();

    output.on('data', (chunk) => {
      const message = parseMessage(chunk);
      assert.equal(message, { ok: 'boomer' });
      done();
    });

    const bridge = new ChromeNativeBridge([], Readable.from([]), output, {
      onError: unreachable('should not error'),
      onMessage: unreachable('should not get a message'),
      onEnd() {},
    });

    bridge.emit({ ok: 'boomer' });
  });
});

test('close() closes the bridge and clears listeners', async () => {
  await asyncTest((done) => {
    const input = new PassThrough();

    let messagesReceived = 0;

    const bridge = new ChromeNativeBridge([], input, new Writable(), {
      onError: unreachable('should not error'),
      onMessage(message) {
        messagesReceived++;

        if (messagesReceived === 1) {
          // Check the first message
          assert.equal(message, { ok: 'boomer' });

          // Close the bridge
          bridge.close();

          // Wait a second and end the test
          setTimeout(() => {
            done();
          }, 1000);

          // Send a second message, which should not be received, as the bridge is closed
          input.write(
            chromeMessage(JSON.stringify({ khaled: 'another one!' }))
          );
        } else if (messagesReceived === 2) {
          assert.unreachable('should only receive one message');
        }
      },
      onEnd() {},
    });

    // Send the first message
    input.write(chromeMessage(JSON.stringify({ ok: 'boomer' })));
  });
});

test.run();
