import { google } from 'googleapis';

/**
 * Google Drive backup helper.
 *
 * Setup (one-time, see README section "Google Drive Auto-Backup"):
 *   1. Create a Google Cloud project + enable Drive API.
 *   2. Create a Service Account + download JSON key.
 *   3. Create a folder in your own Google Drive.
 *   4. Share that folder with the service account's email
 *      (something@your-project.iam.gserviceaccount.com) — give it Editor.
 *   5. Copy the folder ID from the share URL
 *      (https://drive.google.com/drive/folders/<FOLDER_ID>).
 *   6. Set these env vars on Vercel:
 *        GOOGLE_DRIVE_FOLDER_ID     = <FOLDER_ID>
 *        GOOGLE_SERVICE_ACCOUNT_EMAIL = service-account@project.iam.gserviceaccount.com
 *        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 *          (the FULL key including the BEGIN/END lines; Vercel handles \n correctly)
 *
 * If env vars are not set, the helper no-ops (returns { uploaded: false, reason: 'not-configured' })
 * — so the backup endpoint continues to work without Drive, just keeps DB-only backup.
 */

interface DriveUploadResult {
  uploaded: boolean;
  fileId?: string;
  fileUrl?: string;
  fileName?: string;
  sizeBytes?: number;
  reason?: string;
  error?: string;
}

function getAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // Private key comes in with literal \n sequences — convert to real newlines
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!email || !privateKey) {
    return null;
  }

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
}

/**
 * Upload a backup JSON string to Google Drive.
 *
 * @param jsonStr the full backup JSON content
 * @param backupId used to make the filename unique
 * @returns upload result with fileId + view URL
 */
export async function uploadBackupToDrive(
  jsonStr: string,
  backupId: string,
): Promise<DriveUploadResult> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    return { uploaded: false, reason: 'GOOGLE_DRIVE_FOLDER_ID not set' };
  }

  const auth = getAuthClient();
  if (!auth) {
    return { uploaded: false, reason: 'GOOGLE_SERVICE_ACCOUNT_EMAIL / PRIVATE_KEY not set' };
  }

  try {
    const drive = google.drive({ version: 'v3', auth });

    // Filename: dfcl-backup-YYYY-MM-DD-HHMMSS-bk_xxx.json
    const now = new Date();
    const stamp = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}-${String(now.getUTCHours()).padStart(2, '0')}${String(now.getUTCMinutes()).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}`;
    const fileName = `dfcl-backup-${stamp}-${backupId}.json`;

    const res = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
        mimeType: 'application/json',
      },
      media: {
        mimeType: 'application/json',
        body: jsonStr,
      },
      fields: 'id, name, size, webViewLink',
    });

    return {
      uploaded: true,
      fileId: res.data.id || undefined,
      fileName: res.data.name || fileName,
      fileUrl: res.data.webViewLink || undefined,
      sizeBytes: res.data.size ? parseInt(res.data.size, 10) : jsonStr.length,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { uploaded: false, error: msg };
  }
}

/**
 * List recent Drive backups (max 10). Useful for a Settings → Backup status page.
 */
export async function listDriveBackups(): Promise<{ ok: boolean; files?: unknown[]; error?: string }> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    return { ok: false, error: 'GOOGLE_DRIVE_FOLDER_ID not set' };
  }
  const auth = getAuthClient();
  if (!auth) {
    return { ok: false, error: 'Service account credentials not set' };
  }
  try {
    const drive = google.drive({ version: 'v3', auth });
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      orderBy: 'createdTime desc',
      pageSize: 10,
      fields: 'files(id, name, size, createdTime, webViewLink)',
    });
    return { ok: true, files: res.data.files || [] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Quick connectivity check — used by the status endpoint.
 */
export async function driveStatus(): Promise<{ configured: boolean; canConnect?: boolean; error?: string }> {
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!folderId || !email || !privateKey) {
    return { configured: false };
  }
  const auth = getAuthClient();
  if (!auth) {
    return { configured: false };
  }
  try {
    const drive = google.drive({ version: 'v3', auth });
    // Just fetch the folder metadata — cheap and proves auth + folder access work
    await drive.files.get({ fileId: folderId, fields: 'id, name' });
    return { configured: true, canConnect: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { configured: true, canConnect: false, error: msg };
  }
}
