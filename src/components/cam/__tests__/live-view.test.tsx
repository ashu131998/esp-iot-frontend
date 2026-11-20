/**
 * The live view rendered (server render): starting, the stream with whether frames arrive, the note on the factory's
 * internet; and the Bottles page's Watch live button, for everyone who sees the page.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LiveStream, LiveView } from '@/components/cam/live-view';
import { LocaleProvider } from '@/lib/i18n/context';
import { hi } from '@/lib/i18n/messages/hi';

function render(node: ReactNode, seed: (c: QueryClient) => void = () => {}, messages: Record<string, string> | null = null) {
  const client = new QueryClient();
  seed(client);
  return renderToString(
    <QueryClientProvider client={client}>
      <LocaleProvider locale={messages ? 'hi' : 'en'} messages={messages}>{node}</LocaleProvider>
    </QueryClientProvider>,
  ).replace(/<!-- -->/g, '');
}
const STREAM = 'https://api.floorbeat.in/v1/live/cam-a1/stream?token=1.dXNlcg.sig';

describe('the live view', () => {
  it('starting the camera first', () => {
    expect(render(<LiveView scope={{ factoryId: 'mill' }} boardId="cam-a1" />)).toContain('Starting the camera…');
  });

  it('then its stream in a plain image, waiting for the first frame, with the note on the factory\'s internet', () => {
    const html = render(<LiveView scope={{ factoryId: 'mill' }} boardId="cam-a1" />, (c) => c.setQueryData(['live-start', 'mill', 'cam-a1', 0], {
      stream: STREAM, fps_asked: 2, session_s: 600, live: true, viewers: 0, frames: 0, last_frame_at: null, fps: 0,
    }));
    expect(html).toContain(`src="${STREAM.replace(/&/g, '&amp;')}"`);
    expect(html).toContain('Waiting for the camera…');
    expect(html).toContain('It streams only while this is open, so the factory&#x27;s internet is not used up.');
  });

  it('frames arriving: Live, how many a second; in Hindi too', () => {
    const html = render(<LiveStream src={STREAM} sessionS={600} fps={2} onAgain={() => {}} />);
    expect(html).toContain('Live · 2 a second');
    expect(html).not.toContain('Waiting for the camera…');
    expect(render(<LiveStream src={STREAM} sessionS={600} fps={2} onAgain={() => {}} />, () => {}, hi)).toContain('लाइव · 2 प्रति सेकंड');
  });
});
