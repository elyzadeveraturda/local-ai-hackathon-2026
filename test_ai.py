from ollama import chat

response = chat(
    model="qwen2.5:3b",
    messages=[
        {
            "role": "user",
            "content": "Hello! Are you running locally?"
        }
    ],
)

print(response.message.content)