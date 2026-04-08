"""
Agent memory management.
Each agent has a rolling memory_context string that gets compressed over time.
"""
import litellm

MAX_MEMORY_CHARS = 2000

async def compress_memory(existing_context: str, new_conversation: list[dict]) -> str:
    """Compress conversation into a summary to keep memory lean."""
    if not new_conversation:
        return existing_context

    convo_text = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in new_conversation])

    prompt = f"""You are a memory compression system. Given an agent's existing memory context and a new conversation, 
produce a concise updated memory summary (max 500 words) that captures key facts, decisions, and context.

EXISTING MEMORY:
{existing_context or 'None'}

NEW CONVERSATION:
{convo_text}

OUTPUT: A concise memory summary capturing what this agent should remember going forward."""

    try:
        response = await litellm.acompletion(
            model="claude-3-5-haiku-20241022",
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or existing_context
    except Exception:
        # Fallback: just append and truncate
        combined = f"{existing_context}\n\n[RECENT]\n{convo_text}"
        return combined[-MAX_MEMORY_CHARS:]

def inject_memory(agent: dict, messages: list[dict]) -> list[dict]:
    """Inject relevant memory context into message list if not already present."""
    memory = agent.get("memory_context", "") or ""
    if not memory.strip():
        return messages
    memory_msg = {"role": "system", "content": f"[MEMORY] {memory}"}
    return [memory_msg] + list(messages)
