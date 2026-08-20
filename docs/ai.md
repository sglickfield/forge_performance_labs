# AI Execution Protocol

## 1. Code Modification Workflow
Whenever you are asked to implement a feature, refactor code, or fix a bug, you must strictly follow this 4-step loop:
1. **Plan**: Write a brief technical plan explaining which files you will modify.
2. **Execute**: Write the complete, production-ready code blocks. Do not use placeholders like `// TODO: implement later`.
3. **Validate**: Automatically run the local validation harness command: `bash bin/validate.sh`.
4. **Iterate**: If the script returns an error code (non-zero), analyze the CLI output, rewrite the code to fix the failure, and re-run the harness.

## 2. Definition of Done
You may only report a task as complete to the user if:
- `bash bin/validate.sh` passes completely with an exit code of 0.
- No new console warnings or typescript compilation errors were introduced.

Read `docs/AGENTS.md` and `docs/DECISIONS.md` before changing product behavior.
