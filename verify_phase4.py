import time
from pathlib import Path
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

video_path = Path("d:/clip/multiscene_video.mp4")
with open(video_path, "rb") as f:
    upload_res = client.post("/api/media/upload", files={"file": ("multiscene_video.mp4", f, "video/mp4")})

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

# Fetch scenes
s_res = client.get(f"/api/media/{media_id}/scenes")
print("Scenes endpoint status:", s_res.status_code)
if s_res.status_code == 200:
    s_data = s_res.json()
    print("Total detected scenes:", s_data.get("total_scenes"))
    for sc in s_data.get("scenes", []):
        thumb_exists = Path(sc["thumbnail_path"]).exists() if sc.get("thumbnail_path") else False
        print(
            f"  Scene #{sc['scene_index'] + 1}: [{sc['start_time']:.2f}s -> {sc['end_time']:.2f}s] "
            f"duration={sc['duration']:.2f}s thumb={sc.get('thumbnail_path')} (exists={thumb_exists})"
        )
