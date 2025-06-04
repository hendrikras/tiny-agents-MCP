const express = require('express');
const { Agent } = require('@huggingface/tiny-agents');
require('dotenv').config();

const app = express();
const port = 3000;


const agent = new Agent({
    provider: process.env.PROVIDER ?? "nebius",
    model: process.env.MODEL_ID ?? "Qwen/Qwen2.5-72B-Instruct",
    apiKey: process.env.HF_TOKEN,
    servers: [
        // ... existing servers ...
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

// File: /Users/hendrik/projects/njsDoctool/app.js
async function connectAgent() {
    try {
        // The Agent class might not have a connect method directly
        // Instead, we'll check if the agent is ready by accessing a property or method that exists
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
    }
    finally {
        await agent.loadTools();
    }
}

// Connect immediately
connectAgent();

app.get('/', (req, res) => {
    res.send('Hello from Express!');
});

app.get('/sentiment/:phrase', async (req, res) => {
    try {
        // Check if agent is connected
        if (!agentConnected) {
            return res.status(503).send('MCP server connection not established');
        }

// File: /Users/hendrik/projects/njsDoctool/app.js
// Call factorial service on MCP server
// Note: The API might be different depending on how your MCP server exposes the factorial function
let fullResponse = '';
// Use the Agent
for await (const chunk of agent.run(`What is the sentiment of ${req.params.phrase}?`)) {
    if ("choices" in chunk) {
        const delta = chunk.choices[0]?.delta;
        if (delta.content) {
            // console.log(delta.content);
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

app.listen(port, () => {
    console.log(`Express app listening at http://localhost:${port}`);
});
