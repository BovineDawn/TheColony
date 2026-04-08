import litellm
import os
from typing import AsyncGenerator

MODEL_MAP = {
    "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
    "gpt-4o":            "gpt-4o",
    "gemini-1.5-pro":    "gemini/gemini-1.5-pro",
}

def build_system_prompt(agent: dict) -> str:
    skills_str = ", ".join([f"{s['name']} ({s['level']})" for s in agent.get("skills", [])])
    return f"""You are {agent['name']}, {agent['role']} in the {agent['department']} department of The Colony.

Personality: {agent.get('personality_note', '')}
Your expertise: {skills_str}
Memory: {agent.get('memory_context', '') or 'No prior context.'}

RULES:
- You are an expert in your domain. Never pretend to be a generalist.
- Always respond professionally and concisely.
- When given a task, complete it. Never say you "cannot" do something — always propose a solution.
- If blocked by something outside your control, escalate with a specific proposed solution.
- Keep responses focused and actionable.
- You are Employee #{str(agent.get('employee_id', 0)).zfill(4)} — you take your role seriously.
"""

async def call_agent(agent: dict, messages: list[dict], stream: bool = False):
    model = MODEL_MAP.get(agent.get("model", "claude-3-5-sonnet"), "claude-3-5-sonnet-20241022")
    system = build_system_prompt(agent)
    full_messages = [{"role": "system", "content": system}] + messages

    response = await litellm.acompletion(
        model=model,
        messages=full_messages,
        stream=stream,
    )
    return response

async def stream_agent(agent: dict, messages: list[dict]) -> AsyncGenerator[str, None]:
    model = MODEL_MAP.get(agent.get("model", "claude-3-5-sonnet"), "claude-3-5-sonnet-20241022")
    system = build_system_prompt(agent)
    full_messages = [{"role": "system", "content": system}] + messages

    response = await litellm.acompletion(
        model=model,
        messages=full_messages,
        stream=True,
    )

    async for chunk in response:
        delta = chunk.choices[0].delta
        if delta and delta.content:
            yield delta.content
