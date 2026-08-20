const express = require("express");
const cors = require("cors");
const http = require("http");
const { WebSocketServer } = require("ws");

const app = express();

app.use(cors({origin: ["http://localhost:5173", "*"]}));
app.use(express.json());

const PORT = 4000;

const server = http.createServer(app);

const wss = new WebSocketServer({
    server,
    path: "/print-agent"
});

// Connected print agents
const agents = new Map();

wss.on("connection", (ws) => {

    console.log("Print Agent connected");

    let agentId = null;

    ws.on("message", (message) => {

        try {

            const data = JSON.parse(message.toString());

            // Agent registration
            if (data.type === "REGISTER") {

                agentId = data.agentId;

                agents.set(agentId, ws);

                console.log(
                    `Agent registered: ${agentId}`
                );

                ws.send(JSON.stringify({
                    type: "REGISTERED",
                    agentId
                }));

                return;
            }

            // Print result
            if (data.type === "PRINT_RESULT") {

                console.log(
                    "Print result:",
                    data
                );

                return;
            }

        } catch (error) {

            console.error(
                "WebSocket message error:",
                error.message
            );
        }
    });

    ws.on("close", () => {

        if (agentId) {
            agents.delete(agentId);

            console.log(
                `Agent disconnected: ${agentId}`
            );
        }
    });
});


// Test endpoint
app.get("/api/health", (req, res) => {

    res.json({
        success: true,
        service: "FoodFlow Backend"
    });

});


// Print endpoint
app.post("/api/print", (req, res) => {

    const {
        agentId,
        printData
    } = req.body;

    if (!agentId) {

        return res.status(400).json({
            success: false,
            message: "agentId required"
        });

    }

    const agent = agents.get(agentId);

    if (!agent) {

        return res.status(503).json({
            success: false,
            message: "Print Agent is offline"
        });

    }

    agent.send(JSON.stringify({
        type: "PRINT",
        jobId: `JOB-${Date.now()}`,
        printData
    }));

    res.json({
        success: true,
        message: "Print job sent to agent"
    });

});


server.listen(PORT, () => {

    console.log(
        `Backend running on port ${PORT}`
    );

});