
import crypto from 'crypto';
import cookie from 'cookie';

export default function handler(req, res) {
    const { shop } = req.query;

    if (!shop) {
        return res.status(400).send('Missing shop parameter');
    }

    const { SHOPIFY_API_KEY, SHOPIFY_SCOPES, SHOPIFY_APP_URL } = process.env;
    const state = crypto.randomBytes(16).toString('hex');
    const redirectUri = `${SHOPIFY_APP_URL}/api/auth/callback`;

    // Set a cookie for the state to verify on callback
    res.setHeader('Set-Cookie', cookie.serialize('shopify_auth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 5, // 5 minutes
        sameSite: 'lax',
        path: '/',
    }));

    const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${SHOPIFY_API_KEY}&scope=${SHOPIFY_SCOPES}&redirect_uri=${redirectUri}&state=${state}`;

    res.redirect(installUrl);
}
