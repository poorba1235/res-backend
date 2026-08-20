const express = require("express");
const cors = require("cors");
const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");

const app = express();

const PORT = process.env.PORT || 4000;

// ======================================================
// Middleware
// ======================================================

app.use(cors({ origin: ["https://res-front-sable.vercel.app", "*"] }));


app.use(
    express.json({
        limit: "10mb"
    })
);

// ======================================================
// HTTP Server
// ======================================================

const server = http.createServer(app);

// ======================================================
// WebSocket Server
// /print-agent
// ======================================================

const wss = new WebSocketServer({
    server,
    path: "/print-agent"
});

// ======================================================
// Connected Print Agents
//
// POS-001 -> Computer 1
// POS-002 -> Computer 2
// ======================================================

const agents = new Map();

// ======================================================
// WebSocket Connection
// ======================================================

wss.on("connection", (ws) => {

    console.log("--------------------------------");
    console.log("Print Agent connected");
    console.log("--------------------------------");

    let agentId = null;

    // ==================================================
    // Message from Agent
    // ==================================================

    ws.on("message", (message) => {

        try {

            const data = JSON.parse(
                message.toString()
            );

            // ==========================================
            // REGISTER AGENT
            // ==========================================

            if (data.type === "REGISTER") {

                if (!data.agentId) {

                    ws.send(
                        JSON.stringify({
                            type: "ERROR",
                            message: "agentId is required"
                        })
                    );

                    return;
                }

                agentId = String(
                    data.agentId
                ).trim();

                // --------------------------------------
                // Close old connection if same agent
                // --------------------------------------

                const oldAgent =
                    agents.get(agentId);

                if (
                    oldAgent &&
                    oldAgent !== ws &&
                    oldAgent.readyState === WebSocket.OPEN
                ) {

                    console.log(
                        `Closing old connection for ${agentId}`
                    );

                    oldAgent.close();

                }

                // --------------------------------------
                // Save agent
                // --------------------------------------

                agents.set(
                    agentId,
                    ws
                );

                console.log(
                    `Agent registered: ${agentId}`
                );

                console.log(
                    "Online agents:",
                    [...agents.keys()]
                );

                // --------------------------------------
                // Registration response
                // --------------------------------------

                ws.send(
                    JSON.stringify({
                        type: "REGISTERED",
                        agentId
                    })
                );

                return;
            }

            // ==========================================
            // PRINT RESULT
            // ==========================================

            if (data.type === "PRINT_RESULT") {

                console.log("--------------------------------");
                console.log("PRINT RESULT");
                console.log("--------------------------------");

                console.log(
                    "Agent:",
                    agentId
                );

                console.log(
                    "Job:",
                    data.jobId
                );

                console.log(
                    "Success:",
                    data.success
                );

                console.log(
                    "Results:",
                    data.results
                );

                console.log("--------------------------------");

                return;
            }

            // ==========================================
            // PONG
            // ==========================================

            if (data.type === "PONG") {

                console.log(
                    `Agent alive: ${agentId}`
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

    // ==================================================
    // Agent disconnected
    // ==================================================

    ws.on("close", () => {

        if (!agentId) {
            return;
        }

        // Only remove this connection if it is still
        // the current connection for this agent.
        if (agents.get(agentId) === ws) {

            agents.delete(agentId);

        }

        console.log(
            `Agent disconnected: ${agentId}`
        );

        console.log(
            "Online agents:",
            [...agents.keys()]
        );

    });

    // ==================================================
    // WebSocket error
    // ==================================================

    ws.on("error", (error) => {

        console.error(
            `WebSocket error (${agentId || "unknown"}):`,
            error.message
        );

    });

});

// ======================================================
// Health Check
// ======================================================

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            service:
                "FoodFlow Print Backend",

            agents:
                [...agents.keys()]

        });

    }
);

// ======================================================
// Print Agent Status
// ======================================================

app.get(
    "/api/print-agents",
    (req, res) => {

        const result = [];

        for (
            const [agentId, ws]
            of agents.entries()
        ) {

            result.push({

                agentId,

                online:
                    ws.readyState ===
                    WebSocket.OPEN

            });

        }

        res.json({

            success: true,

            agents: result

        });

    }
);

// ======================================================
// PRINT
// ======================================================

app.post(
    "/api/print",
    (req, res) => {

        try {

            const {
                agentId,
                printData
            } = req.body;

            // ==========================================
            // Validate Agent ID
            // ==========================================

            if (!agentId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "agentId is required"

                });

            }

            // ==========================================
            // Validate Print Data
            // ==========================================

            if (!printData) {

                return res.status(400).json({

                    success: false,

                    message:
                        "printData is required"

                });

            }

            // ==========================================
            // Find Agent
            // ==========================================

            const agent =
                agents.get(agentId);

            if (!agent) {

                return res.status(503).json({

                    success: false,

                    message:
                        `Print Agent ${agentId} is offline`

                });

            }

            // ==========================================
            // Check WebSocket
            // ==========================================

            if (
                agent.readyState !==
                WebSocket.OPEN
            ) {

                agents.delete(agentId);

                return res.status(503).json({

                    success: false,

                    message:
                        `Print Agent ${agentId} is not connected`

                });

            }

            // ==========================================
            // Generate Job ID
            // ==========================================

            const jobId =
                `JOB-${Date.now()}-${Math.random()
                    .toString(36)
                    .substring(2, 7)}`;

            // ==========================================
            // Send Print Job
            // ==========================================

            const printJob = {

                type: "PRINT",

                jobId,

                agentId,

                printData

            };

            agent.send(
                JSON.stringify(printJob)
            );

            console.log("--------------------------------");
            console.log("PRINT JOB SENT");
            console.log("--------------------------------");

            console.log(
                "Job ID:",
                jobId
            );

            console.log(
                "Agent:",
                agentId
            );

            console.log("--------------------------------");

            // ==========================================
            // API Response
            // ==========================================

            return res.json({

                success: true,

                jobId,

                agentId,

                message:
                    "Print job sent to agent"

            });

        } catch (error) {

            console.error(
                "Print API error:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    error.message

            });

        }

    }
);

// ======================================================
// Start Server
// ======================================================

server.listen(
    PORT,
    () => {

        console.log("");
        console.log("=================================");
        console.log(" FoodFlow Print Backend");
        console.log("=================================");

        console.log(
            `HTTP: http://localhost:${PORT}`
        );

        console.log(
            `WebSocket: ws://localhost:${PORT}/print-agent`
        );

        console.log(
            "=================================");
        console.log("");

    }
);
