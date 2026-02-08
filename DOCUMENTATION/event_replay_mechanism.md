# Event Replay Mechanism Documentation

## Goal
Provide tools to replay buffered events that failed to deliver to target modules. When a module is unavailable, events are automatically buffered. This mechanism replays them when the module comes back online.

## Management Command

```bash
# Show buffer queue statistics
python manage.py replay_buffered_events --stats

# Replay ALL pending buffered requests
python manage.py replay_buffered_events

# Replay only for a specific module
python manage.py replay_buffered_events --module finance

# Replay for a specific module + organization
python manage.py replay_buffered_events --module finance --org 1

# Clean up expired buffers
python manage.py replay_buffered_events --cleanup
```

## How It Works

### Automatic Buffering (on failure)
When `ConnectorEngine.dispatch_event()` fails to deliver an event:
1. `_try_deliver_event()` catches the error
2. Calls `buffer_request()` to store the event in `BufferedRequest` table
3. Stores `method='EVENT'` and `payload={'event_name': ..., 'payload': ...}`
4. Sets 24h TTL by default

### Replay (on recovery)
When replaying:
1. Queries `BufferedRequest` for pending, non-expired records
2. For `method='EVENT'`: calls `_deliver_event()` (re-delivers the event)
3. For `method='POST/PUT/etc'`: calls `_forward_write_request()` (re-sends the API call)
4. Marks successfully replayed records as `'replayed'`
5. Increments `retry_count` on failure; marks as `'failed'` after `max_retries` (3)

### Cleanup
Expired buffered requests (past `expires_at`) are marked as `'expired'`.

## Data Flow

### From (READ)
- `BufferedRequest` table — queued events/writes

### To (WRITE)
- `BufferedRequest` table — status updates (pending → replayed/failed/expired)
- Target module's event handler — replayed events

### Variables
- `target_module` — module the event was meant for
- `organization_id` — tenant that owns the event
- `status` — pending, replayed, expired, failed
- `retry_count` / `max_retries` — retry tracking
- `expires_at` — TTL-based expiration

### Step-by-Step Workflow
1. Event delivery fails → auto-buffered in `BufferedRequest`
2. Admin runs `python manage.py replay_buffered_events`
3. Command groups pending buffers by module+org
4. Each group is replayed via `ConnectorEngine.replay_buffered()`
5. Results printed: replayed count + failed count

### How This Achieves Its Goal
No data is lost when a module is temporarily unavailable. Events are stored in the DB with TTLs and replayed automatically or on-demand via the management command.
