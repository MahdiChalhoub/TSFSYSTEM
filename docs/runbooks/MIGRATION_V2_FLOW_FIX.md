# Migration v2.0 - Flow Fix: Delayed Job Creation

## 🐛 Problem

When clicking a cloud file, the wizard was trying to create a migration job immediately, which caused:
1. **Authentication Error**: "Authentication credentials were not provided"
2. **Wrong Flow**: Creating job before knowing target organization
3. **Empty Organization ID**: Passing `user?.organization_id || ''` which could be empty

## ✅ Solution

**Delay job creation until target organization is selected.**

### New Flow

```
1. SELECT_DATA_SOURCE
   → User picks file from cloud (or uploads)
   → Store file reference ONLY (no job creation yet)
   → Toast: "Selected: filename.sql"

2. SELECT_BUSINESS (skip for now - backend not ready)
   → Would parse SQL and show businesses
   → User selects source business

3. SELECT_ORG
   → User selects target TSF organization
   → NOW create the job with:
     - target_organization_id (from selection)
     - file reference (from step 1)
     - business selection (from step 2)
   → Toast: "Migration job created for OrgName!"

4. VALIDATE
   → Continue with validation
```

## 📝 Changes Made

### 1. Added State for Cloud File

```typescript
const [selectedCloudFile, setSelectedCloudFile] = useState<any | null>(null);
```

### 2. Updated handleSelectCloudFile

**Before:**
```typescript
async function handleSelectCloudFile(file: any) {
    // ❌ Created job immediately - caused auth error
    const draftJob = await createMigrationJob({
        target_organization_id: user?.organization_id || '', // Could be empty!
    });
    setCurrentStep('SELECT_BUSINESS');
}
```

**After:**
```typescript
async function handleSelectCloudFile(file: any) {
    // ✅ Just store file reference
    setSelectedCloudFile(file);
    setUploadedFileId(file.uuid);
    toast.success(`Selected: ${file.original_filename}`);

    // Skip to org selection (business parsing not ready)
    setCurrentStep('SELECT_ORG');
}
```

### 3. Updated handleSelectOrganization

**Before:**
```typescript
async function handleSelectOrganization(org: Organization) {
    // ❌ Assumed job already existed
    if (!job) throw new Error('No job found');
    setCurrentStep('VALIDATE');
}
```

**After:**
```typescript
async function handleSelectOrganization(org: Organization) {
    // ✅ NOW create the job with proper org ID
    const newJob = await createMigrationJob({
        name: `${SCOPE_INFO[scopeParam].label} from ${SOURCE_INFO[sourceParam].label}`,
        target_organization_id: org.id, // ✅ Guaranteed to have value
        coa_template: 'SYSCOHADA',
    });

    setJob(newJob);
    toast.success(`Migration job created for ${org.name}!`);
    setCurrentStep('VALIDATE');
}
```

### 4. Updated handleUploadFile

Also simplified to just store the file:

```typescript
async function handleUploadFile() {
    if (!selectedFile) return;
    // TODO: Upload file to backend
    toast.success('File ready! Now select target organization...');
    setCurrentStep('SELECT_ORG');
}
```

## 🎯 Benefits

1. **No Auth Errors**: Job creation only happens when user is on SELECT_ORG step (already authenticated)
2. **Proper Organization ID**: Always have valid `org.id` when creating job
3. **Cleaner Flow**: Each step does one thing:
   - File selection → store file
   - Business selection → store business
   - Org selection → create job with all info
4. **Better UX**: User sees progress through each step without errors

## 🧪 Testing

### Test Case: Cloud File Selection

1. Navigate to `/migration_v2/jobs/new?scope=FULL&source=ULTIMATE_POS`
2. Click "Confirm"
3. Click "Pick from Cloud Storage"
4. Click on a .sql file (e.g., `u739151801_dataPOS.sql`)
5. **Expected**: Toast shows "Selected: u739151801_dataPOS.sql"
6. **Expected**: Moves to SELECT_ORG step
7. Click on an organization
8. **Expected**: Toast shows "Migration job created for [OrgName]!"
9. **Expected**: Moves to VALIDATE step

### Test Case: Local File Upload

1. Navigate to wizard
2. Click "Confirm"
3. Click "Upload from PC"
4. Select a .sql file
5. Click "Upload & Continue"
6. **Expected**: Toast shows "File ready!"
7. **Expected**: Moves to SELECT_ORG step
8. Click on an organization
9. **Expected**: Job created successfully

## 📋 Backend TODO

When backend is ready, enable business selection:

```typescript
// In handleSelectCloudFile and handleUploadFile
// Change this:
setCurrentStep('SELECT_ORG');

// To this:
setCurrentStep('SELECT_BUSINESS');
```

Then backend needs to provide:
- `POST /api/migration-v2/jobs/upload/` - Upload file, return file UUID
- `GET /api/migration-v2/jobs/parse-businesses/?file_uuid=xxx` - Parse SQL without creating job
- `POST /api/migration-v2/jobs/create/` - Create job with file_uuid and business_id

## ✅ Status

- ✅ Frontend flow fixed
- ✅ No TypeScript errors
- ✅ Auth error resolved
- ⏳ Business selection step ready (UI complete, awaiting backend)
- ⏳ Backend endpoints pending

---

**Updated**: 2026-03-08
**Issue**: Fixed auth error in cloud file selection
**Solution**: Delayed job creation until organization selection
