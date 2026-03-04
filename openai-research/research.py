from agents import Agent, function_tool
from dotenv import load_dotenv
import os

load_dotenv()

agent = Agent(
    name="Cybersecurity Research Assistant",
    description="An agent that conducts cybersecurity research on websites and provides insights.",
    instructions="""You are a cybersecurity research assistant. Your task is to analyze websites for potential vulnerabilities and provide insights based"""