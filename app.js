const express = require('express');
const { Agent } = require('@huggingface/tiny-agents');
const { createRequestHandler } = require('@remix-run/express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = 3000;

// MCP agent configuration remains the same
const agent = new Agent({
    provider: process.env.PROVIDER ?? "nebius",
    model: process.env.MODEL_ID ?? "Qwen/Qwen2.5-72B-Instruct",
    apiKey: process.env.HF_TOKEN,
    servers: [
        {
            command: "npx",
            args: [
                "mcp-remote",
                process.env.MCP_ENDPOINT
            ]
        }
    ],
    capabilities: process.env.MCP_CAPABILITIES ? process.env.MCP_CAPABILITIES.split(',') : ['factorial']
});

// Connect to MCP server when the app starts
let agentConnected = false;

async function connectAgent() {
    try {
        // Check if agent is connected
        if (agent.status) {
            console.log('Successfully connected to MCP server');
            agentConnected = true;
        } else {
            // Initialize the agent if needed
            await agent.init?.();
            console.log('Successfully initialized and connected to MCP server');
            agentConnected = true;
        }
    } catch (error) {
        console.error('Failed to connect to MCP server:', error);
    } finally {
        await agent.loadTools();
    }
}

// Connect immediately
connectAgent();

// Serve static files from the public directory
app.use(express.static('public'));

// Redirect root to the index route
app.get('/', (req, res) => {
    res.redirect('/index');
});

// API routes
app.get('/api/sentiment/:phrase', async (req, res) => {
    try {
        // Check if agent is connected
        if (!agentConnected) {
            return res.status(503).send('MCP server connection not established');
        }

        let fullResponse = '';
        // Use the Agent
        for await (const chunk of agent.run(`What is the sentiment of ${req.params.phrase}?`)) {
            if ("choices" in chunk) {
                const delta = chunk.choices[0]?.delta;
                if (delta.content) {
                    fullResponse += delta.content;
                }
            }
        }

        // Extract the polarity score from the response
        let polarityScore = null;
        const polarityMatch = fullResponse.match(/polarity\s+score\s+of\s+(-?\d+(\.\d+)?)/i);
        if (polarityMatch && polarityMatch[1]) {
            polarityScore = parseFloat(polarityMatch[1]);
        }

        // Determine sentiment based on the full response
        let sentiment = 'neutral';
        if (fullResponse.toLowerCase().includes('positive')) {
            sentiment = 'positive';
        } else if (fullResponse.toLowerCase().includes('negative')) {
            sentiment = 'negative';
        }

        // Send the response with the extracted information
        res.send({
            input: req.params.phrase,
            sentiment: sentiment,
            polarityScore: polarityScore,
            fullResponse: fullResponse
        });
    } catch (error) {
        res.status(500).send(`Error calling MCP server: ${error.message}`);
    }
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
            getLoadContext: () => ({ agent, agentConnected })
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

app.listen(port, () => {
    console.log(`Express app listening at http://localhost:${port}`);
});
