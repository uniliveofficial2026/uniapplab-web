import { createUniLiveMcpServer } from '@unilives/mcp';
const mcp = createUniLiveMcpServer({ requireAuth: false });
const tools = mcp.listTools();
const projects = await mcp.tools.list_projects({});
console.log(JSON.stringify({ ok: true, tools: tools.length, projects: projects.ok }));
