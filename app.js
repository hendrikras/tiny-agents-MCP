const express = require('express');
const { connect } = require('tinyagents');

const app = express();
const port = 3000;

// MCP server configuration
const mcpConfig = {
    host: 'localhost',
    port: 8080
};

// Connect to MCP server
const mcpClient = connect(mcpConfig);

app.get('/', (req, res) => {
    res.send('Hello from Express!');
});

app.get('/factorial/:number', async (req, res) => {
    try {
        const number = parseInt(req.params.number);
        if (isNaN(number) || number < 0) {
            return res.status(400).send('Please provide a valid non-negative number');
        }

        // Call factorial service on MCP server
        const result = await mcpClient.call('factorial', { n: number });
        res.send(`Factorial of ${number} is ${result}`);
    } catch (error) {
        res.status(500).send(`Error calling MCP server: ${error.message}`);
    }
});

app.listen(port, () => {
    console.log(`Express app listening at http://localhost:${port}`);
});
