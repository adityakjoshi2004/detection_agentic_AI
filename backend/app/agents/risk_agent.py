from .base_agent import BaseAgent
from .message_schema import create_message


class RiskAgent(BaseAgent):

    def __init__(self):
        super().__init__("risk_agent")

    def process(self, message: dict) -> dict:

        data = message["payload"]

        weapons = data.get("weapons_detected", {})

        # Default values
        risk_level = "LOW"
        action = "Monitor only"

        if not weapons:
            risk_level = "LOW"
            action = "No weapon detected"
        else:
            max_confidence = max(weapons.values())

            # Optional: Weapon severity priority
            high_severity_weapons = {"Gun", "Rifle", "Pistol"}
            medium_severity_weapons = {"Knife"}

            detected_weapon_types = set(weapons.keys())

            if detected_weapon_types & high_severity_weapons:
                if max_confidence > 0.7:
                    risk_level = "HIGH"
                    action = "Immediate lockdown"
                else:
                    risk_level = "MEDIUM"
                    action = "Security inspection required"

            elif detected_weapon_types & medium_severity_weapons:
                if max_confidence > 0.6:
                    risk_level = "MEDIUM"
                    action = "Security inspection required"
                else:
                    risk_level = "LOW"
                    action = "Monitor closely"

            else:
                # Fallback generic rule
                if max_confidence > 0.8:
                    risk_level = "HIGH"
                    action = "Immediate lockdown"
                elif max_confidence > 0.5:
                    risk_level = "MEDIUM"
                    action = "Security inspection required"
                else:
                    risk_level = "LOW"
                    action = "Monitor only"

        payload = {
            "risk_level": risk_level,
            "recommended_action": action,
            "weapons_detected": weapons,
            "location": data.get("location"),
            "timestamp": data.get("timestamp")
        }

        return create_message(
            sender=self.name,
            receiver="sop_agent",
            payload=payload,
            event_id=message["event_id"]
        )