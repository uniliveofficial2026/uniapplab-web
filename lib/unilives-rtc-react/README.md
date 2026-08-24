# @unilives/rtc-react

Provider-neutral React hooks for UniLive RTC. No LiveKit types leak into your app.

## Install

```bash
pnpm add @unilives/rtc-react @unilives/rtc-client react
```

## Usage

```jsx
import { createUniLiveRTC } from '@unilives/rtc-client';
import { createFakeRTCProvider } from '@unilives/rtc-fake';
import {
  UniLiveRTCProvider,
  useRoom,
  useParticipants,
  useNetworkQuality,
  useLocalMedia,
} from '@unilives/rtc-react';

const rtc = createUniLiveRTC({ provider: createFakeRTCProvider({ identity: 'u1' }) });

function LiveRoom() {
  const { room, connection } = useRoom({
    roomId: 'room-1',
    token: 't',
    url: 'fake://',
    canonicalUserId: 'u1',
  });
  const participants = useParticipants(room);
  const qoe = useNetworkQuality(room);
  const { enableCamera } = useLocalMedia(room);

  return (
    <div>
      <p>Connection: {connection}</p>
      <p>Participants: {participants.length}</p>
      <button onClick={() => enableCamera()}>Camera</button>
      <pre>{JSON.stringify(qoe)}</pre>
    </div>
  );
}

export function App() {
  return (
    <UniLiveRTCProvider rtc={rtc}>
      <LiveRoom />
    </UniLiveRTCProvider>
  );
}
```

## Hooks

- `useUniLiveRTC()` — access the RTC client from context
- `useRoom(config)` — join/leave room session
- `useParticipants(room)` — participant list
- `useNetworkQuality(room)` — QoE polling via provider-neutral API
- `useLocalMedia(room)` — camera/mic publish helpers
