import { createVisionProvider, SYSTEM_PROMPT } from './provider.ts';
import { assert, equal } from '../../../eval/support.ts';
const config = {
  provider: 'anthropic',
  model: 'test-model',
  apiKey: 'test-secret',
};
Deno.test(
  'vision adapter sends image and configured model, rejects truncated and fenced JSON',
  async () => {
    let payload: Record<string, unknown> = {};
    const transport = ((_url: unknown, init: RequestInit) => {
      payload = JSON.parse(String(init.body));
      return Promise.resolve(
        Response.json({
          stop_reason: 'end_turn',
          content: [
            { type: 'text', text: '{"place":null,"reason":"no_place"}' },
          ],
        }),
      );
    }) as typeof fetch;
    equal(
      await createVisionProvider(config, transport)(
        new Uint8Array([1, 2]),
        'image/png',
      ),
      { place: null, reason: 'no_place' },
    );
    equal(payload.model, 'test-model');
    equal(payload.system, SYSTEM_PROMPT);
    assert(JSON.stringify(payload.messages).includes('AQI='));
    assert(!JSON.stringify(payload).includes('test-secret'));
    for (const body of [
      { stop_reason: 'max_tokens', content: [] },
      {
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: '```json {} ```' }],
      },
    ]) {
      let thrown = false;
      try {
        await createVisionProvider(config, (() =>
          Promise.resolve(Response.json(body))) as typeof fetch)(
          new Uint8Array([1]),
          'image/png',
        );
      } catch {
        thrown = true;
      }
      assert(thrown);
    }
  },
);
Deno.test('unsupported provider fails closed', () => {
  let thrown = false;
  try {
    createVisionProvider({ ...config, provider: 'mock' });
  } catch {
    thrown = true;
  }
  assert(thrown);
});

Deno.test(
  'DashScope uses authenticated image chat and strict JSON output',
  async () => {
    const cfg = {
      provider: 'dashscope',
      model: 'qwen3-vl-flash',
      apiKey: 'test-secret',
    };
    const transport = ((url: unknown, init: RequestInit) => {
      equal(
        url,
        'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
      );
      equal(
        new Headers(init.headers).get('Authorization'),
        'Bearer test-secret',
      );
      equal(init.redirect, 'error');
      const payload = JSON.parse(String(init.body));
      equal(payload.model, cfg.model);
      equal(payload.messages[0].content, SYSTEM_PROMPT);
      equal(
        payload.messages[1].content[0].image_url.url,
        'data:image/png;base64,AQI=',
      );
      equal(payload.enable_thinking, false);
      assert(!String(init.body).includes('test-secret'));
      return Promise.resolve(
        Response.json({
          choices: [
            {
              finish_reason: 'stop',
              message: { content: '{"place":null,"reason":"no_place"}' },
            },
          ],
        }),
      );
    }) as typeof fetch;
    equal(
      await createVisionProvider(cfg, transport)(
        new Uint8Array([1, 2]),
        'image/png',
      ),
      { place: null, reason: 'no_place' },
    );
    for (const body of [
      { choices: [{ finish_reason: 'length', message: { content: '{}' } }] },
      {
        choices: [
          { finish_reason: 'stop', message: { content: '```json {} ```' } },
        ],
      },
      {
        choices: [
          {
            finish_reason: 'stop',
            message: { content: '{}', refusal: 'refused' },
          },
        ],
      },
      { choices: [] },
    ]) {
      let thrown = false;
      try {
        await createVisionProvider(cfg, (() =>
          Promise.resolve(Response.json(body))) as typeof fetch)(
          new Uint8Array([1]),
          'image/png',
        );
      } catch {
        thrown = true;
      }
      assert(thrown);
    }
  },
);

Deno.test('DashScope rejects credential egress to arbitrary endpoints', () => {
  for (const baseUrl of [
    'https://evil.example/compatible-mode/v1',
    'http://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    'https://dashscope-intl.aliyuncs.com/other',
    'https://dashscope-intl.aliyuncs.com/compatible-mode/v1?redirect=evil',
  ]) {
    let thrown = false;
    try {
      createVisionProvider({
        provider: 'dashscope',
        model: 'qwen3-vl-flash',
        apiKey: 'test-secret',
        baseUrl,
      });
    } catch {
      thrown = true;
    }
    assert(thrown);
  }
  createVisionProvider({
    provider: 'dashscope',
    model: 'qwen3-vl-flash',
    apiKey: 'test-secret',
    baseUrl:
      'https://workspace-123.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1',
  });
});
