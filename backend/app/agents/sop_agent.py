from .base_agent import BaseAgent
from .message_schema import create_message


class SOPAgent(BaseAgent):

    def __init__(self):
        super().__init__("sop_agent")

    def process(self, message: dict) -> dict:

        risk_level = message["payload"]["risk_level"]

        if risk_level == "HIGH":
            sop_steps = [
                "Lockdown all gates",
                "Notify authorities",
                "Activate emergency alarm"
            ]
        elif risk_level == "MEDIUM":
            sop_steps = [
                "Send security personnel",
                "Monitor CCTV closely"
            ]
        else:
            sop_steps = [
                "Log event",
                "Continue monitoring"
            ]

        payload = {
            "risk_level": risk_level,
            "sop_steps": sop_steps,
            "weapons_detected": message["payload"].get("weapons_detected", {}),
            "location": message["payload"].get("location"),
            "timestamp": message["payload"].get("timestamp")
        }

        return create_message(
            sender=self.name,
            receiver="report_agent",
            payload=payload,
            event_id=message["event_id"]
        )