import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
import {
  ReadableStream as NodeReadableStream,
  TransformStream as NodeTransformStream,
  WritableStream as NodeWritableStream,
} from 'node:stream/web';
import {
  MessageChannel as NodeMessageChannel,
  MessagePort as NodeMessagePort,
} from 'node:worker_threads';

if (typeof globalThis.ReadableStream === 'undefined') {
  globalThis.ReadableStream = NodeReadableStream;
}

if (typeof globalThis.WritableStream === 'undefined') {
  globalThis.WritableStream = NodeWritableStream;
}

if (typeof globalThis.TransformStream === 'undefined') {
  globalThis.TransformStream = NodeTransformStream;
}

if (typeof globalThis.MessageChannel === 'undefined') {
  globalThis.MessageChannel = NodeMessageChannel;
}

if (typeof globalThis.MessagePort === 'undefined') {
  globalThis.MessagePort = NodeMessagePort;
}

setupZoneTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});
