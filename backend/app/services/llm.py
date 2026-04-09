import litellm
import os
import logging
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

MODEL_MAP = {
    "claude-3-5-sonnet": "anthropic/claude-3-5-sonnet-20241022",
    "gpt-4o":            "openai/gpt-4o",
    "gemini-1.5-pro":    "gemini/gemini-2.5-flash",
}

# Default: OpenAI first, Gemini as backup
_DEFAULT_MODEL = "openai/gpt-4o"
_BACKUP_MODEL  = "gemini/gemini-2.5-flash"

def build_system_prompt(agent: dict) -> str:
    skills_str = ", ".join([f"{s['name']} ({s['level']})" for s in agent.get("skills", [])])
    memory = agent.get('memory_context', '') or 'No prior context.'
    return f"""You are {agent['name']}, {agent['role']} in the {agent['department']} department of The Colony.
Employee #{str(agent.get('employee_id', 0)).zfill(4)}.

Personality: {agent.get('personality_note', '')}
Expertise: {skills_str}
Memory: {memory}

RULES — follow these without exception:
1. You are a domain expert. Deliver expert-level output every time.
2. When given a task, COMPLETE IT. Never ask clarifying questions. Never say you need more information.
3. If context is missing, make reasonable professional assumptions and clearly label them.
4. Never say "I cannot", "I would need", or "please provide". These phrases are not allowed.
5. Be concise. Say what needs to be said, nothing more. No preamble, no filler, no restating the question.
6. Length guide: analysis/plans = 150–250 words max. Documents/letters/code = as long as needed, no padding.
7. Your output must be actionable — concrete deliverables, decisions, or analysis.
8. You take your role seriously. Every response reflects on The Colony.
"""

async def call_agent(agent: dict, messages: list[dict], stream: bool = False):
    model = MODEL_MAP.get(agent.get("model", "gpt-4o"), _DEFAULT_MODEL)
    system = build_system_prompt(agent)
    full_messages = [{"role": "system", "content": system}] + messages

    try:
        response = await litellm.acompletion(
            model=model,
            messages=full_messages,
            stream=stream,
        )
    except Exception as e:
        logger.warning(f"Primary model {model} failed ({e}), falling back to {_BACKUP_MODEL}")
        response = await litellm.acompletion(
            model=_BACKUP_MODEL,
            messages=full_messages,
            stream=stream,
        )
    return response

async def stream_agent(agent: dict, messages: list[dict]) -> AsyncGenerator[str, None]:
    model = MODEL_MAP.get(agent.get("model", "gpt-4o"), _DEFAULT_MODEL)
    system = build_system_prompt(agent)
    full_messages = [{"role": "system", "content": system}] + messages

    try:
        response = await litellm.acompletion(
            model=model,
            messages=full_messages,
            stream=True,
        )
        async for chunk in response:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield delta.content
    except Exception as e:
        logger.warning(f"Primary stream model {model} failed ({e}), falling back to {_BACKUP_MODEL}")
        response = await litellm.acompletion(
            model=_BACKUP_MODEL,
            messages=full_messages,
            stream=True,
        )
        async for chunk in response:
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield delta.content
