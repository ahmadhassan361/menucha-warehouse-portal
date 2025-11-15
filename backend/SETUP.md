# Backend Setup Guide

## Prerequisites

- Python 3.10 or higher
- PostgreSQL (optional, SQLite works for development)
- Redis (for Celery background tasks)

## Step 1: Create Virtual Environment

```bash
cd backend
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate
```

## Step 2: Install Dependencies

```bash
pip install -r requirements.txt
```

## Step 3: Configure Environment Variables

Copy the example environment file and update it:

```bash
cp .env.example .env
```

Edit `.env` and configure:

```env
# For development, you can use SQLite (default)
# Or configure PostgreSQL:
DB_ENGINE=django.db.backends.postgresql
DB_NAME=warehouse_portal
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432

# External API URL (already configured)
EXTERNAL_API_URL=https://www.1800eichlers.com/api/picking/items/f8e2a1c9-4b7d-4e3f-9a2c-8d5e6f7a8b9c
```

## Step 4: Run Migrations

```bash
python manage.py makemigrations
python manage.py migrate
```

## Step 5: Create Superuser (Admin)

```bash
python manage.py createsuperuser
```

Follow the prompts to create an admin user:
- Username: admin
- Email: admin@example.com
- Password: (your secure password)
- Role will be set to 'admin' by default

## Step 6: Start Redis (for Celery)

Make sure Redis is running:

```bash
# On macOS (using Homebrew):
brew services start redis

# Or run directly:
redis-server

# On Ubuntu/Debian:
sudo service redis-server start
```

## Step 7: Start Django Development Server

```bash
python manage.py runserver
```

The API will be available at: `http://localhost:8000`

## Step 8: Start Celery Worker (Optional, for background tasks)

In a new terminal (with venv activated):

```bash
cd backend
celery -A backend worker --loglevel=info
```

## Step 9: Start Celery Beat (Optional, for periodic tasks)

In another terminal (with venv activated):

```bash
cd backend
celery -A backend beat --loglevel=info
```

## Step 10: Access API Documentation

Open your browser and visit:
- Swagger UI: http://localhost:8000/api/docs/
- Django Admin: http://localhost:8000/admin/

## Testing the Setup

### 1. Login via API

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your_password"}'
```

This will return JWT tokens.

### 2. Test Order Sync

```bash
# Using the access token from login
curl -X POST http://localhost:8000/api/admin/sync \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### 3. View Pick List

```bash
curl http://localhost:8000/api/picklist \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Common Issues

### Issue: Port 8000 already in use
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9
```

### Issue: Redis connection error
```bash
# Check if Redis is running
redis-cli ping
# Should return: PONG
```

### Issue: Database migrations fail
```bash
# Reset migrations (CAUTION: This will delete all data)
python manage.py migrate --run-syncdb
```

## Development Workflow

1. **Make code changes**
2. **Create migrations** (if models changed):
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```
3. **Test the API** using Swagger UI or curl
4. **Check Celery logs** for background task status

## Production Deployment Notes

- Use PostgreSQL instead of SQLite
- Set `DEBUG=False` in production
- Use proper SECRET_KEY (generate new one)
- Set up proper CORS_ALLOWED_ORIGINS
- Use Gunicorn or uWSGI for serving Django
- Use nginx as reverse proxy
- Set up SSL certificates
- Configure proper logging
- Set up monitoring (e.g., Sentry)

## API Endpoints Summary

### Authentication
- POST `/api/auth/login` - Login
- POST `/api/auth/logout` - Logout
- GET `/api/auth/me` - Current user
- POST `/api/auth/refresh` - Refresh token

### Pick List
- GET `/api/picklist` - Get pick list
- GET `/api/picklist/stats` - Get statistics
- POST `/api/pick` - Pick items
- POST `/api/not-in-stock` - Mark not in stock

### Ready to Pack
- GET `/api/orders/ready-to-pack` - List ready orders
- GET `/api/orders/{id}` - Order details
- POST `/api/orders/{id}/mark-packed` - Mark as packed

### Out of Stock
- GET `/api/out-of-stock` - List exceptions
- GET `/api/out-of-stock/export` - Export CSV
- POST `/api/out-of-stock/send` - Send notification

### Admin
- POST `/api/admin/sync` - Manual sync
- GET `/api/admin/sync-status` - Sync status
- GET/PUT `/api/admin/settings` - API configuration
- GET/PUT `/api/admin/email-sms-settings` - Notification settings

## Need Help?

Check the main PROJECT_PLAN.md for overall project architecture and planning.
