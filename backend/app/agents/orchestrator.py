from .risk_agent import RiskAgent
from .sop_agent import SOPAgent
from .report_agent import ReportAgent
from .notification_agent import NotificationAgent
from .message_schema import create_message


risk_agent = RiskAgent()
sop_agent = SOPAgent()
report_agent = ReportAgent()
notification_agent = NotificationAgent()


def handle_detection(detection_data: dict):

    # Step 1: Create initial message
    msg = create_message(
        sender="detector",
        receiver="risk_agent",
        payload=detection_data
    )

    # Step 2: Risk Agent
    msg = risk_agent.process(msg)

    # Step 3: SOP Agent
    msg = sop_agent.process(msg)

    # Step 4: Report Agent
    msg = report_agent.process(msg)

    # Step 5: Notification Agent
    notification_agent.process(msg)