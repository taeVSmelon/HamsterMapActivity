import requests

TOKEN = ''
CHAT_ID = '7707122181'  # 🔁 แทนที่ด้วย chat id ของคุณ
MESSAGE = '🚀 แจ้งเตือนจากบอทของคุณมาแล้ว!'

url = f'https://api.telegram.org/bot{TOKEN}/sendMessage'
payload = {
    'chat_id': CHAT_ID,
    'text': MESSAGE
}

response = requests.post(url, data=payload)
print(response.json())  # ดูผลลัพธ์ว่า ok หรือมี error
