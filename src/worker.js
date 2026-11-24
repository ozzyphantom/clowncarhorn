export default {
    async fetch(request, env, ctx) {
        // If the request makes it here, it didn't match a static asset.
        // For a single page app we might return index.html, but here we just return 404.
        // public/_headers does not reach a response built here, so the 404
        // carries the HSTS header itself. Keep the value in step with that file.
        return new Response('Not Found', {
            status: 404,
            headers: { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' },
        });
    },
};
