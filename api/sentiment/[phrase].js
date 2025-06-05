// File: /Users/hendrik/projects/njsDoctool/api/sentiment/[phrase].js
const { Agent } = require('@huggingface/tiny-agents');
require('dotenv').config();

// Initialize the agent
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

// Connect to the agent
let agentConnected = false;
let connectionPromise = null;

async function ensureConnection() {
    if (agentConnected) return true;
    
    if (!connectionPromise) {
        connectionPromise = (async () => {
            try {
                await agent.connect();
                await agent.loadTools();
                agentConnected = true;
                return true;
            } catch (error) {
                console.error('Failed to connect to MCP server:', error);
                return false;
            }
        })();
    }
    
    return connectionPromise;
}

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Handle OPTIONS request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Extract the phrase from the URL
    const { phrase } = req.query;
    
    if (!phrase) {
        return res.status(400).json({ error: 'Missing phrase parameter' });
    }

    try {
        // Ensure agent is connected
        const connected = await ensureConnection();
        if (!connected) {
            return res.status(503).json({ error: 'MCP server connection not established' });
        }

        let fullResponse = '';
        // Use the Agent
        for await (const chunk of agent.run(`What is the sentiment of ${phrase}?`)) {
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
        res.status(200).json({
            input: phrase,
            sentiment: sentiment,
            polarityScore: polarityScore,
            fullResponse: fullResponse
        });
    } catch (error) {
        console.error('Error processing sentiment analysis:', error);
        res.status(500).json({ error: `Error calling MCP server: ${error.message}` });
    }
};