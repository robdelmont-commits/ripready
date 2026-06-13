const http = require("http");
const https = require("https");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const SUPABASE_URL = "https://lomcfdnjyoujtwbuvexb.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("RipReady relay running");
});

server.on("upgrade", (req, socket, head) => {
  console.log("[RipReady] Whatnot connected");

  const key = req.headers["sec-websocket-key"];
  const accept = crypto
    .createHash("sha1")
    .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");

  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
    "Upgrade: websocket\r\n" +
    "Connection: Upgrade\r\n" +
    "Sec-WebSocket-Accept: " + accept + "\r\n" +
    "Sec-WebSocket-Protocol: obswebsocket.json\r\n\r\n"
  );

  sendFrame(socket, JSON.stringify({
    op: 0,
    d: { obsWebSocketVersion: "5.3.0", rpcVersion: 1 }
  }));

  socket.on("data", async (buf) => {
    const msg = parseFrame(buf);
    if (!msg) return;
    let parsed;
    try { parsed = JSON.parse(msg); } catch { return; }
    console.log("[RipReady] Message:", JSON.stringify(parsed).substring(0, 200));

    const op = parsed?.op;
    const d = parsed?.d;

    // Hello / identify
    if (op === 1) {
      sendFrame(socket, JSON.stringify({ op: 2, d: { negotiatedRpcVersion: 1 } }));
    }

    // Single request
    if (op === 6) {
      const { requestType, requestId, requestData } = d;
      const responseData = handleRequest(requestType, requestData);
      sendFrame(socket, JSON.stringify({
        op: 7,
        d: { requestType, requestId, requestStatus: { result: true, code: 100 }, responseData }
      }));
      if (requestType === "SetStreamServiceSettings") {
        const token = requestData?.streamServiceSettings?.bearer_token;
        if (token) {
          console.log("[RipReady] TOKEN RECEIVED!");
          await saveToken(token);
        }
      }
    }

    // Batch request
    if (op === 8) {
      const { requestId, requests } = d;
      const results = [];
      for (const req of requests) {
        const responseData = handleRequest(req.requestType, req.requestData);
        results.push({
          requestType: req.requestType,
          requestId: req.requestId || requestId,
          requestStatus: { result: true, code: 100 },
          responseData
        });
        if (req.requestType === "SetStreamServiceSettings") {
          const token = req.requestData?.streamServiceSettings?.bearer_token;
          if (token) {
            console.log("[RipReady] TOKEN RECEIVED (batch)!");
            await saveToken(token);
          }
        }
      }
      sendFrame(socket, JSON.stringify({
        op: 9,
        d: { requestId, results }
      }));
    }
  });

  socket.on("error", (e) => console.error("[RipReady] Socket error:", e.message));
  socket.on("close", () => console.log("[RipReady] Disconnected"));
});

function handleRequest(requestType, requestData) {
  if (requestType === "GetOutputList") {
    return {
      outputs: [{
        outputName: "simple_stream",
        outputKind: "whip_output",
        outputWidth: 1080,
        outputHeight: 1920,
        outputActive: false,
        outputFlags: { OBS_OUTPUT_AUDIO: true, OBS_OUTPUT_VIDEO: true }
      }]
    };
  }
  if (requestType === "GetStreamStatus") {
    return {
      outputActive: false,
      outputReconnecting: false,
      outputTimecode: "00:00:00.000",
      outputDuration: 0,
      outputCongestion: 0,
      outputBytes: 0,
      outputSkippedFrames: 0,
      outputTotalFrames: 0
    };
  }
  if (requestType === "GetProfileList") {
    return {
      currentProfileName: "RipReady",
      profiles: ["RipReady"]
    };
  }
  if (requestType === "GetVideoSettings") {
    return {
      fpsNumerator: 30,
      fpsDenominator: 1,
      baseWidth: 1080,
      baseHeight: 1920,
      outputWidth: 1080,
      outputHeight: 1920
    };
  }
  if (requestType === "GetStreamServiceSettings") {
    return {
      streamServiceType: "whip_custom",
      streamServiceSettings: {
        server: "https://global.whip.live-video.net",
        bearer_token: "",
        service: "WHIP"
      }
    };
  }
  // Default: return empty success for anything else including SetProfileParameter
  return {};
}

function sendFrame(socket, data) {
  const payload = Buffer.from(data);
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = len;
  } else {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

function parseFrame(buf) {
  try {
    const masked = (buf[1] & 0x80) !== 0;
    let offset = 2;
    let len = buf[1] & 0x7f;
    if (len === 126) { len = buf.readUInt16BE(2); offset = 4; }
    const mask = masked ? buf.slice(offset, offset + 4) : null;
    if (masked) offset += 4;
    const payload = buf.slice(offset, offset + len);
    if (masked) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
    return payload.toString();
  } catch { return null; }
}

async function saveToken(token) {
  const body = JSON.stringify({ bearer_token: token });
  return new Promise((resolve) => {
    const req = https.request(`${SUPABASE_URL}/rest/v1/tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "return=minimal"
      }
    }, (res) => {
      console.log("[RipReady] Supabase status:", res.statusCode);
      resolve();
    });
    req.on("error", (e) => console.error("[RipReady] Supabase error:", e.message));
    req.write(body);
    req.end();
  });
}

server.listen(PORT, () => console.log(`[RipReady] Relay running on port ${PORT}`));
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
