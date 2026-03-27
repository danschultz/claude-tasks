---
name: docker-mcp-test
tags: docker-test
claudeOptions:
  maxTurns: 5
  mcpServers:
    - name: filesystem
      command: npx
      args:
        - --yes
        - '@modelcontextprotocol/server-filesystem'
        - /tasks
  allowedTools:
    - mcp__filesystem__list_directory
    - mcp__filesystem__read_file
---

Use the filesystem MCP server to list the files in /tasks and report the names of the files you find.
