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

    // Step 1: POST to global endpoint with redirect:manual to catch 307
    console.log('[whip-relay] Step 1: probing', whipUrl);
    const probe = await fetch(whipUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        'Authorization': authorization,
      },
      body: sdpBody,
      redirect: 'manual',
    });

    console.log('[whip-relay] probe status:', probe.status);

    // If we got a success directly (no redirect needed)
    if (probe.status >= 200 && probe.status < 300) {
      const responseBody = await probe.text();
      console.log('[whip-relay] direct success, body length:', responseBody.length);
      return new Response(responseBody, {
        status: probe.status,
        headers: {
          'Content-Type': probe.headers.get('Content-Type') || 'application/sdp',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Location, Link',
          'Location': probe.headers.get('Location') || '',
          'Link': probe.headers.get('Link') || '',
        }
      });
    }

    // Handle redirect
    let targetUrl = whipUrl;
    if (probe.status === 307 || probe.status === 301 || probe.status === 302) {
      // Try both lowercase and uppercase Location header
      const location = probe.headers.get('location') || probe.headers.get('Location');
      console.log('[whip-relay] redirect to:', location);
      if (location) {
        targetUrl = location;
      } else {
        // Log all headers for debugging
        const headerEntries = [];
        probe.headers.forEach((v, k) => headerEntries.push(`${k}: ${v}`));
        console.log('[whip-relay] all response headers:', headerEntries.join(', '));
        return new Response(JSON.stringify({ error: 'Redirect with no Location header', headers: headerEntries }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }
    } else {
      // Non-redirect error from probe
      const errorBody = await probe.text();
      console.log('[whip-relay] probe error:', probe.status, errorBody);
      return new Response(errorBody, {
        status: probe.status,
        headers: {
          'Content-Type': probe.headers.get('Content-Type') || 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    // Step 2: POST directly to resolved regional URL
    console.log('[whip-relay] Step 2: posting to resolved URL:', targetUrl);
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
    console.log('[whip-relay] final status:', response.status);
    console.log('[whip-relay] final body:', responseBody.substring(0, 300));

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
