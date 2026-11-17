export function createVocalMixer(audio) {
  let context,
    split,
    backing,
    vocals,
    narration,
    output,
    mediaSource,
    backingBus,
    vocalBus,
    primingSource,
    read = false,
    volume = 1,
    primed = false,
    resuming = null,
    disposed = false;
  const assertActive = () => {
    if (disposed) throw new DOMException('Audio mixer disposed', 'InvalidStateError');
  };
  const disconnect = (node) => {
    try {
      node?.disconnect();
    } catch {}
  };
  function gains(smooth = false) {
    if (!context) return;
    const now = context.currentTime;
    // Separation and AAC reconstruction can exceed full scale. Keep linear
    // headroom after summing the stems, rather than clipping musical peaks.
    for (const [node, value] of [
      [backing, read ? 0 : 2],
      [vocals, read ? 0 : 2 * volume],
      [narration, read ? 1 : 0],
      [output, read ? 1 : 0.45],
    ]) {
      if (smooth) {
        if (node.gain.cancelAndHoldAtTime) node.gain.cancelAndHoldAtTime(now);
        else {
          const current = node.gain.value;
          node.gain.cancelScheduledValues(now);
          node.gain.setValueAtTime(current, now);
        }
        node.gain.linearRampToValueAtTime(value, now + 0.02);
      } else {
        node.gain.cancelScheduledValues(now);
        node.gain.setValueAtTime(value, now);
      }
    }
  }
  function initialize() {
    assertActive();
    if (!context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) throw new Error('Web Audio unavailable');
      context = new Context();
      try {
        mediaSource = context.createMediaElementSource(audio);
        split = context.createChannelSplitter(4);
        backingBus = context.createChannelMerger(2);
        vocalBus = context.createChannelMerger(2);
        mediaSource.connect(split);
        split.connect(backingBus, 0, 0);
        split.connect(backingBus, 1, 1);
        split.connect(vocalBus, 2, 0);
        split.connect(vocalBus, 3, 1);
        backing = context.createGain();
        vocals = context.createGain();
        narration = context.createGain();
        output = context.createGain();
        output.channelCount = 2;
        output.channelCountMode = 'explicit';
        output.channelInterpretation = 'speakers';
        backingBus.connect(backing);
        vocalBus.connect(vocals);
        backing.connect(output);
        vocals.connect(output);
        mediaSource.connect(narration);
        narration.connect(output);
        output.connect(context.destination);
        gains();
      } catch (error) {
        const failedContext = context;
        for (const node of [
          mediaSource,
          split,
          backingBus,
          vocalBus,
          backing,
          vocals,
          narration,
          output,
        ])
          disconnect(node);
        mediaSource = split = backingBus = vocalBus = backing = vocals = narration = output = null;
        context = null;
        if (failedContext) {
          try {
            Promise.resolve(failedContext.close()).catch(() => {});
          } catch {}
        }
        throw error;
      }
    }
  }
  return {
    setRead(value) {
      assertActive();
      read = value;
      gains();
    },
    setVolume(value) {
      assertActive();
      volume = Math.max(0, Math.min(1, Number(value) || 0));
      gains(true);
    },
    getContext() {
      initialize();
      return context;
    },
    connectSource(node) {
      initialize();
      node.connect(split);
      node.connect(narration);
    },
    async resume() {
      initialize();
      // PCM playback should use the same media session category as a song played
      // through <audio>, including on iPhones with the silent switch enabled.
      try {
        if (window.navigator?.audioSession) window.navigator.audioSession.type = 'playback';
      } catch {}
      // Both calls happen synchronously in the play gesture, before any fetch,
      // decode, or promise continuation can consume that gesture on WebKit.
      if (!resuming && context.state !== 'running') {
        resuming = new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Audio activation timed out')), 4000);
          Promise.resolve(context.resume()).then(
            () => {
              clearTimeout(timer);
              if (context.state !== 'running') reject(new Error('Audio output is not running'));
              else resolve();
            },
            (error) => {
              clearTimeout(timer);
              reject(error);
            },
          );
        })
          .catch((error) => {
            primed = false;
            throw error;
          })
          .finally(() => {
            resuming = null;
          });
      }
      if (!primed) {
        const source = context.createBufferSource();
        source.buffer = context.createBuffer(1, 1, context.sampleRate);
        source.connect(context.destination);
        primingSource = source;
        source.onended = () => {
          disconnect(source);
          if (primingSource === source) primingSource = null;
        };
        source.start(0);
        primed = true;
      }
      return resuming || Promise.resolve();
    },
    dispose() {
      if (disposed) return Promise.resolve();
      disposed = true;
      const activeContext = context;
      if (primingSource) {
        const source = primingSource;
        primingSource = null;
        source.onended = null;
        try {
          source.stop();
        } catch {}
        disconnect(source);
      }
      for (const node of [
        mediaSource,
        split,
        backingBus,
        vocalBus,
        backing,
        vocals,
        narration,
        output,
      ])
        disconnect(node);
      mediaSource = split = backingBus = vocalBus = backing = vocals = narration = output = null;
      context = null;
      if (!activeContext || activeContext.state === 'closed') return Promise.resolve();
      try {
        return Promise.resolve(activeContext.close()).then(
          () => undefined,
          () => undefined,
        );
      } catch {
        return Promise.resolve();
      }
    },
  };
}
