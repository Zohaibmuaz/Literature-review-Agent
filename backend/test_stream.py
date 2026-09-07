import requests
import json
import time

url = "http://127.0.0.1:8000/stream-review"
payload = {
    "topic": "Quantum Machine Learning",
    "author": "Test Author",
    "institution": "Test Lab",
    "citation_style": "IEEE"
}

def run_test():
    print("Testing SSE stream... Make sure backend is running on 8000!")
    try:
        with requests.post(url, json=payload, stream=True) as response:
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    if decoded_line.startswith("data: "):
                        data = json.loads(decoded_line[6:])
                        if data["type"] == "status":
                            print(f"\n[STATUS] {data['agent']}: {data['message']}")
                        elif data["type"] == "token":
                            print(data["content"], end="", flush=True)
                        elif data["type"] == "done":
                            print("\n\n[DONE] Stream completed.")
                            break
                        elif data["type"] == "error":
                            print(f"\n[ERROR] {data['message']}")
                            break
    except Exception as e:
        print(f"Error connecting to backend: {e}")

if __name__ == "__main__":
    run_test()
