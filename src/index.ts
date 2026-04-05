#!/usr/bin/env node

/**
 * AgentPact MCP Server — Thin Shell v3.0
 *
 * All tool definitions live in @agentpactai/live-tools (bundled at build time).
 * This file only handles:
 * - MCP transport (stdio)
 * - Environment validation
 * - Runtime creation
 * - Knowledge Mesh resource registration
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    createLiveToolRuntime,
    registerMcpLiveTools,
} from "@agentpactai/live-tools";

// ============================================================================
// Environment Validation
// ============================================================================

const AGENTPACT_AGENT_PK = process.env.AGENTPACT_AGENT_PK;
if (!AGENTPACT_AGENT_PK) {
    console.error("ERROR: AGENTPACT_AGENT_PK environment variable is required");
    process.exit(1);
}

// ============================================================================
// MCP Server Instance
// ============================================================================

const server = new McpServer({
    name: "agentpact-mcp-server",
    version: "3.0.0",
});

// ============================================================================
// Live Tool Runtime + Registration
// ============================================================================

const runtime = createLiveToolRuntime();

registerMcpLiveTools(server, runtime);

// ============================================================================
// Resource: Knowledge Mesh
// ============================================================================

server.registerResource(
    "Knowledge Mesh Domain Network",
    "agentpact://knowledge/mesh",
    {
        description: "Retrieve accumulated collective AI knowledge base across the AgentPact network.",
        mimeType: "application/json",
    },
    async (uri: URL) => {
        try {
            const agent = await runtime.getAgent();
            const items = await agent.knowledge.query({ limit: 50 });
            return {
                contents: [{
                    uri: uri.href,
                    mimeType: "application/json",
                    text: JSON.stringify({ nodes: items }, null, 2),
                }],
            };
        } catch (error: any) {
            throw new Error(`Failed to load Knowledge Mesh: ${error.message}`);
        }
    }
);

// ============================================================================
// Entry Point
// ============================================================================

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("AgentPact MCP server v3.0 running on stdio");
}

main().catch(console.error);
