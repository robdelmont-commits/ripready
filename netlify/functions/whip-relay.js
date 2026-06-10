export default async (request, context) => {
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

    // Log what we received for debugging
    console.log('RELAY: whipUrl =', whipUrl);
    console.log('RELAY: auth present =', !!authorization);
    console.log('RELAY: auth length =', authorization?.length);
    console.log('RELAY: sdp length =', sdpBody?.length);

    // Step 1: probe for redirect without sending body
    const probe = await fetch(whipUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        'Authorization': authorization,
      },
      body: sdpBody,
      redirect: 'manual',
    });

    console.log('RELAY: probe status =', probe.status);

    let targetUrl = whipUrl;
    if (probe.status === 307 || probe.status === 301 || probe.status === 302) {
      const location = probe.headers.get('location') || probe.headers.get('Location');
      console.log('RELAY: redirect location =', location);
      if (location) {
        targetUrl = location;
      }
    } else if (probe.ok) {
      // No redirect needed, probe response IS the answer
      const responseBody = await probe.text();
      console.log('RELAY: direct response, status =', probe.status);
      return new Response(responseBody, {
        status: probe.status,
        headers: {
          'Content-Type': probe.headers.get('Content-Type') || 'application/sdp',
          'Access-Control-Allow-Origin': '*',
        }
      });
    } else {
      // Error on first attempt
      const errorBody = await probe.text();
      console.log('RELAY: probe error body =', errorBody);
      return new Response(errorBody, {
        status: probe.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // Step 2: POST directly to the resolved URL
    console.log('RELAY: posting to resolved URL =', targetUrl);
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
    console.log('RELAY: final status =', response.status);
    console.log('RELAY: final body =', responseBody.substring(0, 200));

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
    console.error('RELAY error:', err);
    return new Response(`Relay error: ${err.message}`, { status: 500 });
  }
};

export const config = { path: '/api/whip-relay' };
