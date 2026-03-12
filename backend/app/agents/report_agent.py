from .base_agent import BaseAgent
from .message_schema import create_message


class ReportAgent(BaseAgent):

    def __init__(self):
        super().__init__("report_agent")

    def process(self, message: dict) -> dict:

        data = message["payload"]

        report = {
            "incident_id": message["event_id"],
            "weapons_detected": data.get("weapons_detected", {}),
            "location": data.get("location"),
            "timestamp": data.get("timestamp"),
            "risk_level": data["risk_level"],
            "sop_steps": data["sop_steps"]
        }

        return create_message(
            sender=self.name,
            receiver="notification_agent",
            payload=report,
            event_id=message["event_id"]
        )