/** JSON-RPC 2.0 with LSP-style `Content-Length` framing. No dependencies: shared by `ledger serve` and the VS Code extension. */
import type { Readable, Writable } from 'node:stream';

export interface Message {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code: number; message: string };
}

export const frame = (m: Message): string => {
  const body = JSON.stringify(m);
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`;
};

/** Returns a chunk handler that emits each complete message. */
export function reader(onMessage: (m: Message) => void): (chunk: Buffer) => void {
  let buf = Buffer.alloc(0);
  return (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      const end = buf.indexOf('\r\n\r\n');
      if (end < 0) return;
      const len = Number(/content-length:\s*(\d+)/i.exec(buf.subarray(0, end).toString('ascii'))?.[1]);
      if (!Number.isFinite(len)) throw new Error('JSON-RPC frame without Content-Length');
      if (buf.length < end + 4 + len) return;
      const body = buf.subarray(end + 4, end + 4 + len).toString('utf8');
      buf = buf.subarray(end + 4 + len);
      onMessage(JSON.parse(body) as Message);
    }
  };
}

/** Client side: request/response by id, notifications to `onNotify`. */
export function connect(input: Readable, output: Writable, onNotify: (method: string, params: unknown) => void = () => {}) {
  let next = 1;
  const pending = new Map<number | string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  input.on(
    'data',
    reader((m) => {
      if (m.id !== undefined && pending.has(m.id)) {
        const p = pending.get(m.id);
        pending.delete(m.id);
        if (m.error) p?.reject(new Error(m.error.message));
        else p?.resolve(m.result);
      } else if (m.method) onNotify(m.method, m.params);
    }),
  );
  const fail = (): void => {
    for (const p of pending.values()) p.reject(new Error('ledger engine exited'));
    pending.clear();
  };
  input.on('close', fail);
  return {
    request<T>(method: string, params: unknown = {}): Promise<T> {
      const id = next++;
      return new Promise<T>((resolve, reject) => {
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
        output.write(frame({ jsonrpc: '2.0', id, method, params }));
      });
    },
  };
}
