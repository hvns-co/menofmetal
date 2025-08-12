
import crypto from 'crypto';
import cookie from 'cookie';

export default async function handler(req, res) {
    const { shop, hmac, code, state } = req.query;
    const { SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SHOPIFY_APP_URL } = process.env;

    const cookies = cookie.parse(req.headers.cookie || '');
    const savedState = cookies.shopify_auth_state;

    // 1. Verify state
    if (state !== savedState) {
        return res.status(403).send('Request origin cannot be verified');
    }

    // 2. Verify HMAC
    if (typeof hmac !== 'string' || typeof shop !== 'string') {
        return res.status(400).send('Invalid request parameters');
    }

    const map = { ...req.query };
    delete map.hmac;
    const message = new URLSearchParams(map).toString();
    const generatedHmac = crypto.createHmac('sha256', SHOPIFY_API_SECRET).update(message).digest('hex');

    if (generatedHmac !== hmac) {
        return res.status(400).send('HMAC validation failed');
    }

    // 3. Exchange authorization code for access token
    const accessTokenRequestUrl = `https://${shop}/admin/oauth/access_token`;
    const accessTokenPayload = {
        client_id: SHOPIFY_API_KEY,
        client_secret: SHOPIFY_API_SECRET,
        code,
    };

    try {
        const response = await fetch(accessTokenRequestUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(accessTokenPayload),
        });

        const responseBody = await response.json();

        if (response.ok && responseBody.access_token) {
            // For this simple app, we'll set a simple session cookie.
            // In a real-world app, you should store the token securely, e.g., in a database.
            res.setHeader('Set-Cookie', cookie.serialize('shopify_app_session', responseBody.access_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 60 * 60 * 24 * 7, // 1 week
                sameSite: 'lax',
                path: '/',
            }));
            
            // Redirect to the app home page
            res.redirect(`${SHOPIFY_APP_URL}?shop=${shop}`);
        } else {
            res.status(400).send('Failed to get access token');
        }
    } catch (error) {
        console.error('Error fetching access token:', error);
        res.status(500).send('Internal Server Error');
    }
}
