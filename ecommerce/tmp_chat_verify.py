import urllib.request
import json

session_req = urllib.request.Request(
    'http://localhost:4000/api/chat/session',
    data=json.dumps({}).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(session_req, timeout=30) as resp:
    session_data = json.loads(resp.read().decode())
    print('SESSION_TOKEN', session_data.get('session_token'))

msg_req = urllib.request.Request(
    'http://localhost:4000/api/chat/message',
    data=json.dumps({
        'session_token': session_data.get('session_token'),
        'message': 'Hi',
        'cart_context': [],
        'user_context': {}
    }).encode('utf-8'),
    headers={'Content-Type': 'application/json'}
)
try:
    with urllib.request.urlopen(msg_req, timeout=60) as resp:
        print('STATUS', resp.status)
        print(resp.read().decode())
except urllib.error.HTTPError as e:
    print('HTTP ERROR', e.code)
    print(e.read().decode())
except Exception as e:
    print('ERROR', type(e).__name__, str(e))
