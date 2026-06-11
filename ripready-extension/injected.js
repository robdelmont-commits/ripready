// RipReady Chrome Extension — injected.js
// Patches WebSocket constructor in Whatnot page context (MAIN world)
// Rewrites ws://127.0.0.1:4455 → wss://lomcfdnjyoujtwbuvexb.supabase.co/functions/v1/obs-relay

(function () {
  const RELAY_URL = "wss://lomcfdnjyoujtwbuvexb.supabase.co/functions/v1/obs-relay";
  const TARGET = "ws://127.0.0.1:4455";

  const OriginalWebSocket = window.WebSocket;

  class PatchedWebSocket extends OriginalWebSocket {
    constructor(url, protocols) {
      const finalUrl = url === TARGET ? RELAY_URL : url;
      if (url === TARGET) {
        console.log("[RipReady] Intercepted OBS WebSocket — redirecting to relay");
      }
      super(finalUrl, protocols);
    }
  }

  PatchedWebSocket.CONNECTING = OriginalWebSocket.CONNECTING;
  PatchedWebSocket.OPEN = OriginalWebSocket.OPEN;
  PatchedWebSocket.CLOSING = OriginalWebSocket.CLOSING;
  PatchedWebSocket.CLOSED = OriginalWebSocket.CLOSED;

  window.WebSocket = PatchedWebSocket;
  console.log("[RipReady] WebSocket patch active");
})();