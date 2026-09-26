import urllib.request
import json
import time

def test_full_pipeline():
    url = "http://127.0.0.1:8000/api/media/upload"
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    with open("e2e_test_video.mp4", "rb") as f:
        video_bytes = f.read()

    header = f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"e2e_test_video.mp4\"\r\nContent-Type: video/mp4\r\n\r\n".encode("utf-8")
    footer = f"\r\n--{boundary}--\r\n".encode("utf-8")
    body = header + video_bytes + footer

    req = urllib.request.Request(url, data=body)
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read().decode())
    media_id = data["id"]
    print(f"1. Upload Success! Media ID: {media_id}, Status: {data['status']}")

    for i in range(40):
        time.sleep(1)
        status_resp = urllib.request.urlopen(f"http://127.0.0.1:8000/api/media/{media_id}")
        media_data = json.loads(status_resp.read().decode())
        print(f"   [{i+1}s] Media Status: {media_data['status']}")
        if media_data["status"] in ("ready", "failed"):
            break

    print(f"2. Final Status: {media_data['status']}")
    print(f"   Proxy: {media_data['proxy_path']}")
    print(f"   Thumbnail: {media_data['thumbnail_path']}")
    print(f"   Duration: {media_data['duration']}s, Size: {media_data['width']}x{media_data['height']}")

    # 3. Test static media asset serving
    if media_data['thumbnail_path']:
        clean_thumb = media_data['thumbnail_path'].replace('\\', '/').replace('./', '')
        if clean_thumb.startswith('media/'):
            clean_thumb = clean_thumb[6:]
        thumb_url = f"http://127.0.0.1:8000/media/{clean_thumb}"
        thumb_resp = urllib.request.urlopen(thumb_url)
        print(f"3. Static Thumbnail Serving: Status {thumb_resp.status}, Bytes: {len(thumb_resp.read())}")

    if media_data['proxy_path']:
        clean_proxy = media_data['proxy_path'].replace('\\', '/').replace('./', '')
        if clean_proxy.startswith('media/'):
            clean_proxy = clean_proxy[6:]
        proxy_url = f"http://127.0.0.1:8000/media/{clean_proxy}"
        proxy_resp = urllib.request.urlopen(proxy_url)
        print(f"4. Static Proxy Streaming: Status {proxy_resp.status}, Type: {proxy_resp.headers.get('Content-Type')}")

    # 5. Check scenes and keyframes
    scenes_resp = urllib.request.urlopen(f"http://127.0.0.1:8000/api/media/{media_id}/scenes")
    scenes_data = json.loads(scenes_resp.read().decode())
    print(f"5. Scenes Generated: {scenes_data['total_scenes']}")

    kf_resp = urllib.request.urlopen(f"http://127.0.0.1:8000/api/media/{media_id}/keyframes")
    kf_data = json.loads(kf_resp.read().decode())
    print(f"6. Keyframes Indexed: {kf_data['total_keyframes']}")

    # 7. Search for newly indexed media
    search_url = f"http://127.0.0.1:8000/api/search?q=test+pattern&media_id={media_id}&mode=everything"
    search_resp = urllib.request.urlopen(search_url)
    search_data = json.loads(search_resp.read().decode())
    print(f"7. Search Results: {search_data['total_results']} moments retrieved, Latency: {search_data['latency_ms']}ms")

if __name__ == "__main__":
    test_full_pipeline()
