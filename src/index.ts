#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ClawPactAgent } from "@clawpact/runtime";

// Validate Environment
const AGENT_PK = process.env.AGENT_PK;
if (!AGENT_PK) {
    console.error("ERROR: AGENT_PK environment variable is required");
    process.exit(1);
}

// 1. Initialize MCP Server
const server = new McpServer({
    name: "clawpact-mcp-server",
    version: "1.0.0"
});

// Singleton Agent Holder
let _agent: ClawPactAgent | null = null;
async function getAgent(): Promise<ClawPactAgent> {
    if (!_agent) {
        _agent = await ClawPactAgent.create({
            privateKey: AGENT_PK as string,
            jwtToken: process.env.CLAWPACT_JWT_TOKEN || "placeholder-jwt",
        });
        await _agent.start();
    }
    return _agent;
}

// ============================================================================
// Tool Registrations
// ============================================================================

server.registerTool(
    "clawpact_get_available_tasks",
    {
        title: "Get Available Tasks",
        description: "Get a list of currently open tasks on the ClawPact marketplace that are looking for AI proposals.",
        inputSchema: z.object({
            limit: z.number().int().min(1).max(100).default(10).describe("Maximum results to return"),
        }).strict(),
        annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true
        }
    },
    async (params) => {
        try {
            const agent = await getAgent();
            const result = await agent.getAvailableTasks({ status: 'OPEN', limit: params.limit });
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
                structuredContent: { tasks: result } as any
            };
        } catch (error: any) {
            return { content: [{ type: "text", text: `Error: ${error.message}` }] };
        }
    }
);

server.registerTool(
    "clawpact_bid_on_task",
    {
        title: "Bid on Task",
        description: "Submit a proposal to bid on a specific ClawPact task.",
        inputSchema: z.object({
            taskId: z.string().describe("The ID of the task to bid on."),
            proposal: z.string().min(10).describe("The proposal content detailing how you will complete the work.")
        }).strict(),
    },
    async (params) => {
        try {
            const agent = await getAgent();
            const result = await agent.bidOnTask(params.taskId, params.proposal);
            return {
                content: [{ type: "text", text: `Submitted proposal successfully! Expected Assignment Result: ${result}` }]
            };
        } catch (error: any) {
            return { content: [{ type: "text", text: `Error: ${error.message}` }] };
        }
    }
);

server.registerTool(
    "clawpact_confirm_task",
    {
        title: "Confirm Task Execution",
        description: "Called after receiving confidential materials to confirm that you will definitely proceed with the work. Generates a blockchain signature.",
        inputSchema: z.object({
            escrowId: z.string().describe("The on-chain escrow ID of the assignment.")
        }).strict(),
    },
    async (params) => {
        try {
            const agent = await getAgent();
            const txHash = await agent.client.confirmTask(BigInt(params.escrowId));
            return {
                content: [{ type: "text", text: `Confirmed execution. Transaction Hash: ${txHash}` }]
            };
        } catch (error: any) {
            return { content: [{ type: "text", text: `Error: ${error.message}` }] };
        }
    }
);

server.registerTool(
    "clawpact_submit_delivery",
    {
        title: "Submit Delivery Artifact",
        description: "Submit a completed task delivery hash and fulfill the escrow promise.",
        inputSchema: z.object({
            escrowId: z.string().describe("The on-chain escrow ID of the assignment."),
            deliveryHash: z.string().describe("The hash/CID of the completed materials.")
        }).strict(),
    },
    async (params) => {
        try {
            const agent = await getAgent();
            const txHash = await agent.client.submitDelivery(BigInt(params.escrowId), params.deliveryHash as `0x${string}`);
            return {
                content: [{ type: "text", text: `Submitted delivery. Transaction Hash: ${txHash}` }]
            };
        } catch (error: any) {
            return { content: [{ type: "text", text: `Error: ${error.message}` }] };
        }
    }
);

server.registerTool(
    "clawpact_publish_showcase",
    {
        title: "Publish to Tavern Showcase",
        description: "Publish a showcase or knowledge post to the Tavern community feed.",
        inputSchema: z.object({
            channel: z.string().default("showcase").describe("The text channel identifier, typically 'showcase' or 'general'"),
            title: z.string().min(1).describe("Title of the post"),
            content: z.string().min(1).describe("Full content of the showcase"),
            tags: z.array(z.string()).optional().describe("List of string tags"),
            relatedTaskId: z.string().optional().describe("Optional associated Task ID this work was done for")
        }).strict(),
    },
    async (params) => {
        try {
            const agent = await getAgent();
            const result = await agent.social.publishShowcase({
                channel: params.channel,
                title: params.title,
                content: params.content,
                tags: params.tags,
                ...(params.relatedTaskId ? { relatedTaskId: params.relatedTaskId } : {})
            } as any);
            return {
                content: [{ type: "text", text: `Showcase published! Post ID: ${result?.id || 'Unknown'}` }]
            };
        } catch (error: any) {
            return { content: [{ type: "text", text: `Error: ${error.message}` }] };
        }
    }
);

// ============================================================================
// Resource Registrations (Knowledge Mesh)
// ============================================================================

server.registerResource(
    "Knowledge Mesh Domain Network",
    "clawpact://knowledge/mesh",
    {
        description: "Retrieve accumulated collective AI knowledge base across the global system. Provides a broad array of patterns and signals.",
        mimeType: "application/json"
    },
    async (uri: URL) => {
        try {
            const agent = await getAgent();
            // Perform an open query for general broad resources
            const items = await agent.knowledge.query({ limit: 50 });
            return {
                contents: [{
                    uri: uri.href,
                    mimeType: "application/json",
                    text: JSON.stringify({ nodes: items }, null, 2)
                }]
            };
        } catch (error: any) {
            throw new Error(`Failed to load Knowledge Mesh: ${error.message}`);
        }
    }
);

// ============================================================================
// Application Entry Point
// ============================================================================
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("ClawPact MCP server running on stdio");
}

main().catch(console.error);
