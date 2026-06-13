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

    if (!whipUrl || !authorization) {
      return new Response(JSON.stringify({ error: 'Missing required headers' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Step 1: POST to WHIP URL with redirect:manual so we can handle 307 ourselves
    // This is critical — fetch() strips Authorization on redirects, so we must do it manually
    console.log('[whip-relay] Step 1: POST to', whipUrl);
    const step1 = await fetch(whipUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        'Authorization': authorization,
      },
      body: sdpBody,
      redirect: 'manual',
    });

    console.log('[whip-relay] Step 1 status:', step1.status);

    // If success directly (no redirect needed)
    if (step1.status >= 200 && step1.status < 300) {
      const body = await step1.text();
      console.log('[whip-relay] Direct success, body length:', body.length);
      return new Response(body, {
        status: step1.status,
        headers: {
          'Content-Type': step1.headers.get('Content-Type') || 'application/sdp',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Location, Link',
          'Location': step1.headers.get('Location') || '',
          'Link': step1.headers.get('Link') || '',
        }
      });
    }

    // Handle 307 redirect — must re-POST to Location with auth header preserved
    if (step1.status === 307 || step1.status === 301 || step1.status === 302) {
      const location = step1.headers.get('location') || step1.headers.get('Location');
      console.log('[whip-relay] Redirect to:', location);

      if (!location) {
        const allHeaders = [];
        step1.headers.forEach((v, k) => allHeaders.push(`${k}: ${v}`));
        console.log('[whip-relay] All headers:', allHeaders.join(' | '));
        return new Response(JSON.stringify({ error: 'Redirect with no Location', headers: allHeaders }), {
          status: 502,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      // Step 2: Re-POST to the regional URL with Authorization header explicitly included
      console.log('[whip-relay] Step 2: Re-POSTing to regional URL:', location);
      const step2 = await fetch(location, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/sdp',
          'Authorization': authorization,  // explicitly re-attach — don't rely on redirect follow
        },
        body: sdpBody,
        redirect: 'follow',
      });

      const body = await step2.text();
      console.log('[whip-relay] Step 2 status:', step2.status);
      console.log('[whip-relay] Step 2 body:', body.substring(0, 500));

      return new Response(body, {
        status: step2.status,
        headers: {
          'Content-Type': step2.headers.get('Content-Type') || 'application/sdp',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Location, Link',
          'Location': step2.headers.get('Location') || '',
          'Link': step2.headers.get('Link') || '',
        }
      });
    }

    // Any other error from step 1
    const errorBody = await step1.text();
    console.log('[whip-relay] Step 1 error:', step1.status, errorBody);
    return new Response(errorBody, {
      status: step1.status,
      headers: {
        'Content-Type': step1.headers.get('Content-Type') || 'text/plain',
        'Access-Control-Allow-Origin': '*',
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
