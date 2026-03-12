from .base_agent import BaseAgent


class NotificationAgent(BaseAgent):

    def __init__(self):
        super().__init__("notification_agent")

    def process(self, message: dict) -> dict:

        report = message["payload"]

        risk = report["risk_level"]

        if risk == "HIGH":
            print(" HIGH ALERT: Sending Email + SMS")
        elif risk == "MEDIUM":
            print(" MEDIUM ALERT: Sending Email")
        else:
            print("LOW ALERT: Logging only")

        print("Incident Report:", report)

        return report