# Idea: Claude Desktop Integration via MCP Server

## Summary

Expose task-running capabilities as an MCP server so Claude Desktop users can list and trigger tasks directly from conversation.

## What Would Change

**`package.json`**

- Add `@modelcontextprotocol/sdk` as a dependency

**New file: `src/mcp-server.ts`**

- Implement an MCP server using `@modelcontextprotocol/sdk/server`
- Transport: `StdioServerTransport` (required for Claude Desktop)
- Register tools:
  - `list_tasks` — calls `discoverTasks()`, returns task names, tags, and descriptions
  - `run_task` — runs a named task via the existing `runTask()` function
  - `get_task_runs` — reads `task-runs.json`, returns recent run history
- Reuse existing `discoverTasks()`, `filterTasksByTags()`, and `runTask()` from `runner.ts` — no changes to core runner needed

**`package.json` scripts**

- Add `"mcp": "tsx src/mcp-server.ts"`

**Claude Desktop configuration** (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "claude-tasks": {
      "command": "npx",
      "args": ["tsx", "/path/to/claude-tasks/src/mcp-server.ts"],
      "env": {
        "TASK_DIR": "/path/to/tasks",
        "OUTPUT_DIR": "/path/to/output"
      }
    }
  }
}
```

## Complexity: Medium

Self-contained new file. All existing runner logic is reused. No core changes needed.

## Verification

- Run `npm run mcp` — server starts without errors
- Add server to Claude Desktop config — tools appear in Claude Desktop
- Call `list_tasks` from Claude Desktop — task names returned
- Call `run_task` from Claude Desktop — task executes, `task-runs.json` updated
