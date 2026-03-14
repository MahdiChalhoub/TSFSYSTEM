# Console Test Instructions

## Step 1: Open Browser Console
Press `F12` then click "Console" tab

## Step 2: Make Sure Filter is Set to "All levels"
Look for a dropdown that says "Default levels" or filter buttons. Make sure ALL messages are visible:
- ✅ Verbose
- ✅ Info
- ✅ Warnings
- ✅ Errors

## Step 3: Clear Console
Click the 🚫 icon or press `Ctrl+L` to clear all messages

## Step 4: Refresh Page
Press `Ctrl+R` (normal refresh, not hard refresh)

## Step 5: Look for These EXACT Messages

### If Provider Is Working:
```
🎨 [ThemeEngine] Provider initializing with defaults: {defaultTheme: "finance-pro", defaultColorMode: "dark"}
🎨 [ThemeEngine] Current state: {currentTheme: null, colorMode: "dark", systemThemesCount: 0, ...}
🎨 [Theme] Loading themes from backend...
```

### If Provider Is NOT Working:
You will see NOTHING with 🎨 emoji

### If Themes Fail to Load:
```
❌ [Theme] Failed to load themes: ...
❌ [ThemeSwitcher] NO THEMES LOADED!
```

### If Console Shows Nothing:
This means:
1. Provider is not mounted (UnifiedThemeWrapper missing from layout)
2. Console filter is hiding messages
3. JavaScript is blocked/not running

## Step 6: Type This in Console

If you see nothing, type this command directly in console:
```javascript
console.log('TEST MESSAGE - If you see this, console works!')
```

If you DON'T see "TEST MESSAGE", then your browser console is broken or filtered.

## Step 7: Check Network Tab

1. Click "Network" tab in DevTools (F12)
2. Refresh the page
3. Look for a request to: `/api/themes/`
4. Click on it
5. Check the "Response" tab

### If Request Succeeds (Status 200):
You should see JSON with theme data:
```json
{
  "system": [...],
  "custom": [],
  "current": {...}
}
```

### If Request Fails (Status 401, 403, 404, 500):
This is your problem! The backend API is not working.

---

## Report Back

Tell me EXACTLY what you see:

**Option A:** "I see 🎨 logs in console"
→ Copy and paste ALL logs

**Option B:** "I see NO 🎨 logs at all"
→ Type `console.log('TEST')` and tell me if you see it

**Option C:** "Console doesn't work / shows nothing"
→ Take screenshot of console tab

**Option D:** "I see error logs with ❌"
→ Copy and paste the error

**Option E:** "Network tab shows /api/themes/ failed with status XXX"
→ Tell me the status code and response
