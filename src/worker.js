export default {
    async fetch(request, env, ctx) {
        // If the request makes it here, it didn't match a static asset.
        // For a single page app we might return index.html, but here we just return 404.
        return new Response('Not Found', { status: 404 });
    },
};
