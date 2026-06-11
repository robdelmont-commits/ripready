// RipReady OBS WebSocket Relay
// Node.js WebSocket server
// Intercepts Whatnot's OBS connection and extracts bearer token

const { WebSocketServer } = require("ws");
const https = require("https");

const PORT = process.env.PORT || 4455;
const SUPABASE_URL = "https://lomcfdnjyoujtwbuvexb.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const wss = new WebSocketServer({ port: PORT });
console.log(`[RipReady] Relay server running on port ${PORT}`);

wss.on("connection", (ws) => {
  console.log("[RipReady] Whatnot connected");

  // Step 1: Send Hello (OBS WebSocket v5 op:0)
  ws.send(JSON.stringify({
    op: 0,
    d: {
      obsWebSocketVersion: "5.3.0",
      rpcVersion: 1
    }
  }));

  ws.on("message", async (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    const op = msg?.op;
    const d = msg?.d;

    // op:1 = Identify — reply with Identified (op:2)
    if (op === 1) {
      ws.send(JSON.stringify({ op: 2, d: { negotiatedRpcVersion: 1 } }));
      return;
    }

    // op:6 = Request
    if (op === 6) {
      const { requestType, requestId, requestData } = d;

      // Always acknowledge the request
      ws.send(JSON.stringify({
        op: 7,
        d: {
          requestType,
          requestId,
          requestStatus: { result: true, code: 100 }
        }
      }));

      // Extract bearer token from SetStreamServiceSettings
      if (requestType === "SetStreamServiceSettings") {
        const token = requestData?.streamServiceSettings?.bearer_token;
        if (token) {
          console.log("[RipReady] Bearer token received — saving to Supabase");
          await saveToken(token);
        }
      }
    }
  });

  ws.on("close", () => console.log("[RipReady] Whatnot disconnected"));
  ws.on("error", (e) => console.error("[RipReady] Error:", e.message));
});

async function saveToken(token) {
  const body = JSON.stringify({ bearer_token: token });
  const url = new URL(`${SUPABASE_URL}/rest/v1/tokens`);

  return new Promise((resolve) => {
    const req = https.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "return=minimal"
      }
    }, (res) => {
      console.log("[RipReady] Supabase response:", res.statusCode);
      resolve();
    });
    req.on("error", (e) => console.error("[RipReady] Supabase error:", e.message));
    req.write(body);
    req.end();
  });
}
