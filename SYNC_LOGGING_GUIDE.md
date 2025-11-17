# Sync Logging Guide

## Overview

This system stores all sync logs in the database, making it easy to view sync history and debug issues without needing to access log files.

## How to View Sync Logs

### Method 1: Management Command (Recommended)

View the most recent sync logs directly from the terminal:

```bash
cd backend
python manage.py view_sync_logs
```

**Options:**
- `--last N` - Show last N logs (default: 10)
- `--errors` - Show only error logs

**Examples:**
```bash
# View last 5 syncs
python manage.py view_sync_logs --last 5

# View only errors
python manage.py view_sync_logs --errors

# View last 20 syncs
python manage.py view_sync_logs --last 20
```

### Method 2: Django Admin Panel

1. Go to `/admin/api/synclog/` in your browser
2. View detailed sync history with filters
3. Click on any sync to see full details

### Method 3: Database Query

```bash
python manage.py shell
```

Then run:
```python
from api.models import SyncLog

# View latest sync
latest = SyncLog.objects.latest('started_at')
print(f"Status: {latest.status}")
print(f"Orders fetched: {latest.orders_fetched}")
print(f"Orders created: {latest.orders_created}")
print(f"Orders updated: {latest.orders_updated}")
print(f"Error: {latest.error_message}")

# View all recent syncs
for log in SyncLog.objects.all().order_by('-started_at')[:5]:
    print(f"{log.started_at} - {log.status} - {log.orders_fetched} orders")
```

## Understanding Sync Statistics

### Normal Sync (Fresh Database):
```
Orders fetched: 522      ← Unique orders from API
Orders created: 522      ← All new
Orders updated: 0        ← None existed
Products created: 1156   ← New products
Order items created: 2178 ← Order line items
```

### Subsequent Sync (Existing Data):
```
Orders fetched: 522      ← Unique orders from API
Orders created: 20       ← New orders since last sync
Orders updated: 502      ← Existing orders updated
Products updated: 1156   ← Existing products
Order items updated: 2178 ← Existing items
```

## Common Issues & Solutions

### Issue 1: Orders Fetched > Orders Created

**This is NORMAL!** The same order appears multiple times in the API (once per product).
- orders_fetched = unique order count
- orders_created = new orders not in database

### Issue 2: Missing Orders/Items

Check the sync log for errors:
```bash
python manage.py view_sync_logs --errors
```

Look for:
- Database constraint violations
- Missing required fields
- API data format issues

### Issue 3: Sync Appears Stuck

Check if sync is still running:
```python
from api.models import SyncLog
in_progress = SyncLog.objects.filter(status='in_progress')
for sync in in_progress:
    print(f"Started: {sync.started_at}")
    # If started > 10 minutes ago, may be stuck
```

## Sync Process Flow

1. **Fetch Data** - API call to external system
2. **Parse Structure** - Categories → Subcategories → Items → Orders
3. **Upsert Products** - Create or update products
4. **Upsert Orders** - Create or update orders
5. **Upsert Order Items** - Create or update line items
6. **Auto-Pack** - Mark orders no longer in API as packed
7. **Save Stats** - Store results in SyncLog

## Error Handling

The sync service has robust error handling:
- **Individual product errors** - Logged but don't stop sync
- **Individual order errors** - Logged but don't stop sync
- **Overall sync errors** - Logged and reported

Errors are stored in:
- `SyncLog.error_message` - Main error for failed syncs
- Application logs - Detailed per-item errors

## Monitoring in Production

### Check Sync Health:
```bash
# View recent syncs
python manage.py view_sync_logs --last 5

# Check for errors
python manage.py view_sync_logs --errors
```

### Monitor via Admin Panel:
1. Go to Admin → Sync Logs
2. Filter by status (error, success)
3. Sort by date
4. Review statistics

### Automated Monitoring:
The system tracks:
- Last sync time (in APIConfiguration)
- Last sync status (success/error)
- Sync duration
- Items processed

## Debugging Tips

1. **Check Latest Sync:**
   ```bash
   python manage.py view_sync_logs --last 1
   ```

2. **Count Database Records:**
   ```bash
   python manage.py shell
   ```
   ```python
   from api.models import Order, OrderItem, Product
   print(f"Orders: {Order.objects.count()}")
   print(f"Order Items: {OrderItem.objects.count()}")
   print(f"Products: {Product.objects.count()}")
   ```

3. **Compare with API:**
   - API summary shows: 522 orders, 2178 items
   - Database should match (after successful sync)

4. **Check for Stuck Syncs:**
   ```python
   from api.models import SyncLog
   from django.utils import timezone
   from datetime import timedelta
   
   old_syncs = SyncLog.objects.filter(
       status='in_progress',
       started_at__lt=timezone.now() - timedelta(minutes=10)
   )
   if old_syncs.exists():
       print("WARNING: Found stuck syncs!")
       for sync in old_syncs:
           print(f"  ID {sync.id}: Started {sync.started_at}")
   ```

## Performance

- Typical sync time: 5-30 seconds (depends on API response time)
- Database transactions are atomic
- Error in one item doesn't affect others
- Sync can be triggered manually or via Celery

## Celery Integration

If using Celery for scheduled syncs:

```bash
# Check Celery logs
journalctl -u celery -f

# Or check Celery worker logs
tail -f /path/to/celery/logs/worker.log
```

The sync task is defined in `backend/api/tasks.py`

## Support

If you encounter issues:
1. Run `python manage.py view_sync_logs --errors`
2. Check the error message
3. Review the statistics
4. Check database counts vs API summary
