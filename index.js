const express = require("express");
const cors = require("cors");
const http = require("http");
const { WebSocketServer } = require("ws");

const app = express();

app.use(cors({ origin: ["https://res-front-sable.vercel.app", "*"] }));
app.use(express.json());


const express = require("express");
const cors = require("cors");
const http = require("http");
const { WebSocketServer, WebSocket } = require("ws");

const app = express();

const server = http.createServer(app);

const wss = new WebSocketServer({
    server,
    path: "/print-agent"
});

// ======================================================
// Connected Print Agents
// ======================================================

const agents = new Map();


// ======================================================
// WebSocket Connection
// ======================================================

wss.on("connection", (ws) => {

    console.log("=================================");
    console.log("Print Agent connected");
    console.log("=================================");

    let agentId = null;

    // --------------------------------------------------
    // Message received from agent
    // --------------------------------------------------

    ws.on("message", (message) => {

        try {

            const data = JSON.parse(
                message.toString()
            );

            console.log(
                "Agent message:",
                data
            );


            // ==========================================
            // REGISTER
            // ==========================================

            if (data.type === "REGISTER") {

                if (!data.agentId) {

                    ws.send(
                        JSON.stringify({
                            type: "ERROR",
                            message: "agentId required"
                        })
                    );

                    return;
                }

                agentId = data.agentId;

                // If same agent was already connected,
                // remove old connection
                const oldAgent = agents.get(agentId);

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

                agents.set(
                    agentId,
                    ws
                );

                console.log(
                    `Agent registered: ${agentId}`
                );

                console.log(
                    `Online agents:`,
                    [...agents.keys()]
                );


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

                console.log(
                    "================================="
                );

                console.log(
                    "PRINT RESULT"
                );

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

                console.log(
                    "================================="
                );

                return;
            }


            // ==========================================
            // PING
            // ==========================================

            if (data.type === "PONG") {

                console.log(
                    `Agent ${agentId} is alive`
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


    // --------------------------------------------------
    // Agent disconnected
    // --------------------------------------------------

    ws.on("close", () => {

        if (agentId) {

            // Only delete if this is the current
            // connection for this agent
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
        }

    });


    ws.on("error", (error) => {

        console.error(
            `Agent WebSocket error (${agentId}):`,
            error.message
        );

    });

});


// ======================================================
// Health
// ======================================================

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            success: true,
            service: "FoodFlow Print Backend",
            agents: [...agents.keys()]
        });

    }
);


// ======================================================
// Agent Status
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
                    ws.readyState === WebSocket.OPEN
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


            // ------------------------------------------
            // Validate agent
            // ------------------------------------------

            if (!agentId) {

                return res.status(400).json({

                    success: false,

                    message:
                        "agentId is required"

                });

            }


            // ------------------------------------------
            // Validate print data
            // ------------------------------------------

            if (!printData) {

                return res.status(400).json({

                    success: false,

                    message:
                        "printData is required"

                });

            }


            // ------------------------------------------
            // Find agent
            // ------------------------------------------

            const agent =
                agents.get(agentId);


            if (!agent) {

                return res.status(503).json({

                    success: false,

                    message:
                        `Print Agent ${agentId} is offline`

                });

            }


            // ------------------------------------------
            // Check connection
            // ------------------------------------------

            if (
                agent.readyState !==
                WebSocket.OPEN
            ) {

                return res.status(503).json({

                    success: false,

                    message:
                        `Print Agent ${agentId} is not connected`

                });

            }


            // ------------------------------------------
            // Create Job ID
            // ------------------------------------------

            const jobId =
                `JOB-${Date.now()}`;


            // ------------------------------------------
            // Send print command
            // ------------------------------------------

            agent.send(
                JSON.stringify({

                    type: "PRINT",

                    jobId,

                    printData

                })
            );


            console.log(
                `Print job ${jobId} sent to ${agentId}`
            );


            // ------------------------------------------
            // Response
            // ------------------------------------------

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
// Server
// ======================================================

server.listen(
    PORT,
    () => {

        console.log(
            "================================="
        );

        console.log(
            `FoodFlow Backend running on port ${PORT}`
        );

        console.log(
            `WebSocket: ws://localhost:${PORT}/print-agent`
        );

        console.log(
            "================================="
        );

    }
);
