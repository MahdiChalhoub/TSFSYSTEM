
import requests
import os

URL = 'http://127.0.0.1:8000/api/saas/modules/upload_module/'
FILE_PATH = r'c:\tsfci\demo_module_1.0.0.modpkg.zip'
TOKEN = '5672f...' # I need to get a valid token, effectively bypassing auth for this test or assuming I can get one. 
# Actually, the view requires IsAdminUser. I should run this via manage.py shell using Client to bypass auth or use a valid token.
# Let's use requests but with a dummy token if I can, or better: use Django Test Client via shell.

pass
