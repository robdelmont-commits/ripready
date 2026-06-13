export default async (req, context) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Whip-Url',
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const whipUrl = req.headers.get('X-Whip-Url');
    const authorization = req.headers.get('Authorization');
    const sdpBody = await req.text();

    console.log('[whip-relay] whipUrl:', whipUrl);
    console.log('[whip-relay] auth present:', !!authorization);
    console.log('[whip-relay] auth length:', authorization?.length);
    console.log('[whip-relay] sdp length:', sdpBody?.length);

    if (!whipUrl) {
      return new Response(JSON.stringify({ error: 'Missing X-Whip-Url header' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    if (!authorization) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // POST directly to the WHIP URL — no probe, no redirect handling
    console.log('[whip-relay] POSTing directly to:', whipUrl);
    const response = await fetch(whipUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        'Authorization': authorization,
      },
      body: sdpBody,
      redirect: 'follow',
    });

    const responseBody = await response.text();
    console.log('[whip-relay] response status:', response.status);
    console.log('[whip-relay] response body:', responseBody.substring(0, 500));

    return new Response(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'application/sdp',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Location, Link',
        'Location': response.headers.get('Location') || '',
        'Link': response.headers.get('Link') || '',
      }
    });

  } catch (err) {
    console.error('[whip-relay] caught error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
};

export const config = { path: '/api/whip-relay' };
