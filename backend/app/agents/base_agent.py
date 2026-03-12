class BaseAgent:
    def __init__(self, name: str):
        self.name = name

    def process(self, message: dict) -> dict:
        raise NotImplementedError("Each agent must implement process()")