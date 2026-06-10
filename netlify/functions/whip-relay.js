export default async (request, context) => {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Whip-Url',
      }
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const whipUrl = request.headers.get('X-Whip-Url');
    const authorization = request.headers.get('Authorization');
    const sdpBody = await request.text();

    if (!whipUrl) {
      return new Response('Missing X-Whip-Url header', { status: 400 });
    }

    // Step 1: POST to global endpoint, follow redirect manually
    let targetUrl = whipUrl;
    const probe = await fetch(whipUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        'Authorization': authorization,
      },
      body: sdpBody,
      redirect: 'manual',
    });

    // If redirected, re-POST to the Location URL
    if (probe.status === 307 || probe.status === 301 || probe.status === 302) {
      targetUrl = probe.headers.get('Location');
      if (!targetUrl) {
        return new Response('Redirect with no Location', { status: 502 });
      }
    }

    // Final POST to the real endpoint
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        'Authorization': authorization,
      },
      body: sdpBody,
      redirect: 'follow',
    });

    const responseBody = await response.text();

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
    return new Response(`Relay error: ${err.message}`, { status: 500 });
  }
};

export const config = { path: '/api/whip-relay' };
