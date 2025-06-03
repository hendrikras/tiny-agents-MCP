const express = require('express');
const { Agent } = require('@huggingface/tiny-agents');

const app = express();
const port = 3000;

// MCP server configuration
// const mcpConfig = {
//     endpoint: 'http://localhost:8080/mcp',
//     capabilities: ['factorial'] // Specify the capabilities you need
// };

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
                "http://localhost:7860/gradio_api/mcp/sse"  // Your Gradio MCP server
            ]
        }
    ],
});

// Connect to MCP server when the app starts
let agentConnected = false;

async function connectAgent() {
    try {
        await agent.connect();
        console.log('Successfully connected to MCP server');
        agentConnected = true;
    } catch (error) {
        console.error('Failed to connect to MCP server:', error);
    }
}

// Connect immediately
connectAgent();

app.get('/', (req, res) => {
    res.send('Hello from Express!');
});

app.get('/factorial/:number', async (req, res) => {
    try {
        // Check if agent is connected
        if (!agentConnected) {
            return res.status(503).send('MCP server connection not established');
        }

        const number = parseInt(req.params.number);
        if (isNaN(number) || number < 0) {
            return res.status(400).send('Please provide a valid non-negative number');
        }

        // Call factorial service on MCP server
        // Note: The API might be different depending on how your MCP server exposes the factorial function
        const response = await agent.call('factorial', { n: number });
        res.send(`Factorial of ${number} is ${response.result}`);
    } catch (error) {
        res.status(500).send(`Error calling MCP server: ${error.message}`);
    }
});

app.listen(port, () => {
    console.log(`Express app listening at http://localhost:${port}`);
});
