# 政大遺失物管理與整合平台

## 技術架構

- Frontend: HTML, CSS, JavaScript
- Backend: Python Flask
- Database: MySQL

## 第一版功能

- 使用者登入 / 建立使用者
- 新增遺失物或拾獲物通報
- 依照關鍵字、類別、地點、狀態篩選
- 校園地圖圖標顯示
- 通知機制 API 預留
- MySQL 串接位置預留

## 前端直接開啟

直接開啟：

frontend/index.html

後端未啟動時，前端會自動使用假資料。

## 啟動後端

進入 backend 資料夾：

```bash
cd backend
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
copy .env.example .env
python app.py
```

打開：

```text
http://127.0.0.1:5000
```

## MySQL 串接

等同學完成資料庫後，把 `.env` 裡面的：

```env
USE_MOCK_DB=false
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=nccu_lostfound
```

改成正式設定。
