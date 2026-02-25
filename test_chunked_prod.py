
import requests
import os
import time

BASE_URL = "https://tsf.ci/api"
TOKEN = "72fe256019452748c839b59747de2a7adfdd49e3"

headers = {
    "Authorization": f"Token {TOKEN}",
    "X-Tenant-Id": "58ceebcb-2f0a-499e-afb5-431263a48999"
}

def test_chunked_upload():
    # 1. Init
    print("Initializing chunked upload...")
    filename = "prod_test.txt"
    with open(filename, "w") as f:
        f.write("Hello production world! " * 1000)
    
    file_size = os.path.getsize(filename)
    
    data = {
        "filename": filename,
        "total_size": file_size,
        "content_type": "text/plain"
    }
    res = requests.post(f"{BASE_URL}/storage/upload/init/", json=data, headers=headers)
    print(f"Init status: {res.status_code}")
    if res.status_code != 201:
        print(res.text)
        return
    
    session_id = res.json()["session_id"]
    print(f"Session ID: {session_id}")
    
    # 2. Upload chunk
    print("Uploading chunk...")
    with open(filename, "rb") as f:
        chunk = f.read()
    
    # In my v2 script I used 'files={"chunk": ...}'
    res = requests.post(
        f"{BASE_URL}/storage/upload/{session_id}/chunk/",
        files={"chunk": (filename, chunk)},
        data={"chunk_index": 0, "offset": 0},
        headers=headers
    )
    print(f"Chunk status: {res.status_code}")
    if res.status_code != 200:
        print(res.text)
        return
    
    # 3. Complete
    print("Completing upload...")
    res = requests.post(f"{BASE_URL}/storage/upload/{session_id}/complete/", headers=headers)
    print(f"Complete status: {res.status_code}")
    if res.status_code == 201:
        print("Chunked upload SUCCESS")
        results = res.json()
        print(results)
        
        # 4. Test Download
        uuid = results.get('uuid')
        if uuid:
            print(f"Testing download for {uuid}...")
            res = requests.get(f"{BASE_URL}/storage/files/{uuid}/download/", headers=headers)
            print(f"Download status: {res.status_code}")
            if res.status_code == 200:
                print(f"Download URL: {res.json().get('download_url')}")
    else:
        print("Chunked upload FAILED")
        print(res.text)

if __name__ == "__main__":
    test_chunked_upload()
