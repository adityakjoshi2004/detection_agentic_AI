import uuid
from datetime import datetime


def create_message(sender: str, receiver: str, payload: dict, event_id: str = None) -> dict:
    """
    Create a standardized inter-agent message.

    Args:
        sender:   Name of the sending agent.
        receiver: Name of the intended receiving agent.
        payload:  Arbitrary data dict to pass between agents.
        event_id: Optional event ID to correlate messages in the same pipeline run.

    Returns:
        A dict following the common message schema used by all agents.
    """
    return {
        "message_id": str(uuid.uuid4()),
        "event_id": event_id or str(uuid.uuid4()),
        "timestamp": datetime.utcnow().isoformat(),
        "sender": sender,
        "receiver": receiver,
        "payload": payload,
    }
