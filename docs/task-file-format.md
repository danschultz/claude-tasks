# Task File Format

Tasks are defined as Markdown files with YAML frontmatter. The frontmatter holds
configuration options for the task, and the Markdown body contains the natural
language instructions that will be passed to the `query` function of the Claude
TypeScript SDK.

## Format

```
---
<frontmatter configuration>
---

<task instructions>
```

## Top-Level Fields

### `name`

**Type:** `string` — **Required**

A unique identifier for the task. Used in logs and output paths.

```yaml
name: my-task
```

### `tags`

**Type:** `string | string[]` — **Required**

One or more tags used to select which tasks to run. When running tasks, you
specify a tag (or tags) to filter the tasks that will be executed.

```yaml
# Single tag
tags: daily

# Multiple tags
tags:
  - daily
  - reporting
```

### `claude_options`

**Type:** `object` — **Optional**

Options passed directly to the `query` function. See the
[`claude_options` reference](#claude_options-reference) below.

```yaml
claude_options:
  model: claude-opus-4-6
  maxTurns: 5
```

## `claude_options` Reference

| Option              | Type                          | Default     | Description |
|---------------------|-------------------------------|-------------|-------------|
| `allowedTools`      | `string[]`                    | `undefined` | Whitelist of tool names the model is permitted to call. All other tools are blocked. |
| `permissionMode`    | `"default" \| "acceptEdits" \| "bypassPermissions" \| "plan"` | `"default"` | Controls how the agent handles permission prompts. |
| `debug`             | `boolean`                     | `false`     | Enable verbose debug logging for the query execution. |
| `disallowedTools`   | `string[]`                    | `undefined` | Blacklist of tool names the model is not permitted to call. |
| `effort`            | `"low" \| "medium" \| "high"` | `"medium"`  | Controls the reasoning effort level applied to the task. |
| `maxBudgetUsd`      | `number`                      | `undefined` | Maximum spend cap in USD. The query will stop if this limit is reached. |
| `maxThinkingTokens` | `number`                      | `undefined` | Maximum number of tokens to allocate for model reasoning/thinking. |
| `maxTurns`          | `number`                      | `undefined` | Maximum number of agentic turns before the query stops. |
| `mcpServers`        | `object[]`                    | `undefined` | MCP server configurations to make available to the task. |
| `model`             | `string`                      | `undefined` | Model ID to use. Defaults to the SDK's configured default when not set. |
| `tools`             | `ToolDefinition[]`            | `undefined` | Custom tool definitions to provide to the model. |

## Examples

### Minimal Task

A task with only the required fields:

```markdown
---
name: hello-world
tags: test
---

Write "Hello, world!" to a file named `hello.txt`.
```

### Task with `claude_options`

A task using a specific model, capped turns, and a restricted set of tools:

```markdown
---
name: list-open-prs
tags:
  - daily
  - github
claude_options:
  model: claude-opus-4-6
  maxTurns: 10
  effort: high
  allowedTools:
    - mcp__github__get_me
    - mcp__github__search_pull_requests
---

Use the GitHub MCP to find all open pull requests assigned to me.
Write a summary of each PR (title, URL, age, and review status) to `open-prs.md`.
```

### Task with MCP Servers

A task that configures an MCP server inline:

```markdown
---
name: fetch-data
tags: etl
claude_options:
  maxBudgetUsd: 0.50
  mcpServers:
    - name: my-server
      command: npx
      args:
        - my-mcp-server
---

Use the my-server MCP to fetch the latest dataset and summarize it.
```
