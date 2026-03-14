declare module "@modelcontextprotocol/sdk/server/mcp.js" {
    export class McpServer {
        constructor(...args: any[]);
        connect(...args: any[]): Promise<void>;
        registerTool(...args: any[]): void;
        registerResource(...args: any[]): void;
    }
}

declare module "@modelcontextprotocol/sdk/server/stdio.js" {
    export class StdioServerTransport {
        constructor(...args: any[]);
    }
}
