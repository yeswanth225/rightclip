import time
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

video_path = Path("d:/clip/jfk_video.mp4")
with open(video_path, "rb") as f:
    upload_res = client.post("/api/media/upload", files={"file": ("jfk_speech.mp4", f, "video/mp4")})

print("Upload Response:", upload_res.status_code, upload_res.json())
media_id = upload_res.json()["id"]

# Poll media status
for i in range(25):
    time.sleep(1)
    m_res = client.get(f"/api/media/{media_id}")
    status = m_res.json().get("status")
    print(f"Poll {i+1}: Media status = {status}")
    if status in ("ready", "failed"):
        break

t_res = client.get(f"/api/media/{media_id}/transcript")
print("Transcript endpoint status:", t_res.status_code)
if t_res.status_code == 200:
    t_data = t_res.json()
    print("Transcript status:", t_data.get("status"))
    print("Language:", t_data.get("language"))
    print("Full text:", t_data.get("full_text"))
    print("Segment count:", len(t_data.get("segments", [])))
    for s in t_data.get("segments", []):
        print(f"  [{s['start_time']:.2f}s -> {s['end_time']:.2f}s]: {s['text']}")
