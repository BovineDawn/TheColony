"""
Quality monitoring service — scores agent responses and flags poor quality.
"""
import litellm
import re


async def score_response(agent_name: str, agent_role: str, task: str, response: str) -> float:
    """Score an agent response 0-100 for quality. Returns float."""
    prompt = f"""Rate this AI agent response on quality (0-100). Consider: relevance to task, coherence, professionalism, actionability.

AGENT: {agent_name} ({agent_role})
TASK: {task[:500]}
RESPONSE: {response[:1000]}

Return ONLY a number 0-100. No explanation."""
    try:
        resp = await litellm.acompletion(
            model='claude-3-5-haiku-20241022',
            messages=[{'role': 'user', 'content': prompt}]
        )
        text = resp.choices[0].message.content.strip()
        score = float(re.findall(r'\d+\.?\d*', text)[0])
        return min(100.0, max(0.0, score))
    except Exception:
        return 75.0  # default if scoring fails


def should_flag_for_strike(score: float, existing_score: float) -> bool:
    """Flag for strike review if quality drops below threshold."""
    return score < 50.0


def update_rolling_score(existing: float, new_score: float, weight: float = 0.3) -> float:
    """Exponential moving average of quality score."""
    return (1 - weight) * existing + weight * new_score
