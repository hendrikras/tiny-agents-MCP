// File: /Users/hendrik/projects/njsDoctool/app.js
const express = require('express');
const { createRequestHandler } = require('@remix-run/express');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the public directory
app.use(express.static('public'));

// Redirect root to the index route
app.get('/', (req, res) => {
    res.redirect('/index');
});

// Set up Remix handler
const BUILD_DIR = path.join(process.cwd(), "build");
const isProduction = process.env.NODE_ENV === 'production';

// Handle all non-API routes with Remix
app.all("*", (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
        return next();
    }

    // For development mode, purge require cache on each request
    if (!isProduction) {
        purgeRequireCache();
    }

    // Create and use the Remix handler
    try {
        const build = require(BUILD_DIR);
        const handler = createRequestHandler({
            build,
            mode: isProduction ? "production" : "development",
            getLoadContext: () => ({})
        });

        return handler(req, res, next);
    } catch (error) {
        console.error("Error handling Remix request:", error);

        // Provide a helpful error message
        res.status(500).send(`
            <html>
                <head>
                    <title>Remix Error</title>
                    <style>
                        body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 2rem; }
                        pre { background: #f4f4f4; padding: 1rem; overflow: auto; }
                    </style>
                </head>
                <body>
                    <h1>Remix Error</h1>
                    <p>There was an error loading the Remix application:</p>
                    <pre>${error.message}</pre>
                    <p>Make sure you've built the application with:</p>
                    <pre>npm run build</pre>
                    <p>And that your routes are properly configured.</p>
                </body>
            </html>
        `);
    }
});

// Helper function to purge require cache in development
function purgeRequireCache() {
    for (const key in require.cache) {
        if (key.startsWith(BUILD_DIR)) {
            delete require.cache[key];
        }
    }
}

// Only listen on a port when running directly (not when imported by Vercel)
if (require.main === module) {
    app.listen(port, () => {
        console.log(`Express app listening at http://localhost:${port}`);
    });
}

// Export the Express app for Vercel
module.exports = app;