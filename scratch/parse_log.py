import json

log_path = "/Users/howichok/.gemini/antigravity/brain/ea35dee1-d933-491f-aa5a-21921f84e2a1/.system_generated/logs/transcript.jsonl"

with open(log_path, "r") as f:
    for line in f:
        try:
            step = json.loads(line)
            tool_calls = step.get("tool_calls")
            if not tool_calls:
                continue
            for tc in tool_calls:
                name = tc.get("name")
                if name in ["write_to_file", "replace_file_content", "multi_replace_file_content"]:
                    args = tc.get("args", {})
                    if isinstance(args, str):
                        args = json.loads(args)
                    target = args.get("TargetFile", "")
                    if "hero-section" in target or "dashboard-client" in target or "page.tsx" in target:
                        print(f"Step {step.get('step_index')} ({step.get('created_at')}): {name} -> {target}")
                        desc = args.get("Description", "") or args.get("Instruction", "")
                        print(f"  Desc: {desc}")
        except Exception as e:
            pass
