import requests
import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

def create_test_user():
    username = 'testuser'
    password = 'testpassword123'
    email = 'test@example.com'
    
    if not User.objects.filter(username=username).exists():
        User.objects.create_user(username=username, password=password, email=email)
        print(f"Created user: {username}")
    else:
        print(f"User {username} already exists")
    return username, password

def test_login(username, password):
    url = 'http://localhost:8000/api/auth/login/'
    data = {'username': username, 'password': password}
    
    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            print("Login Successful!")
            print("Token:", response.json().get('token'))
            return response.json().get('token')
        else:
            print(f"Login Failed: {response.status_code}")
            print(response.text)
            return None
    except Exception as e:
        print(f"Request failed: {e}")
        return None

def test_me(token):
    url = 'http://localhost:8000/api/auth/me/'
    headers = {'Authorization': f'Token {token}'}
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            print("Me Endpoint Successful!")
            print("User:", response.json())
        else:
            print(f"Me Endpoint Failed: {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == '__main__':
    u, p = create_test_user()
    token = test_login(u, p)
    if token:
        test_me(token)
