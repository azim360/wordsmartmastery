import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy Supabase client initialization
let supabaseAdmin = null;
function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    return null;
  }
  supabaseAdmin = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
  return supabaseAdmin;
}

// Prevent stale caching for Service Worker and SPA entrypoint so users get updates instantly
app.use((req, res, next) => {
  if (req.path === '/sw.js') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else if (req.path === '/' || req.path === '/index.html') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
  next();
});

// Serve static assets from root and handle icons alias
app.use(express.static(__dirname));
app.use('/icons', express.static(__dirname));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    app: 'wordsmartmastery',
    ws1DriveFolderId: '1Ksu-Ek_ooG8VgZ3tsKw7_G5vBl7k77dI',
    ws2DriveFolderId: '1xACdZuFoDJb-8YyQMa5GO9oraUkpjWzB',
    supabaseConfigured: !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY))
  });
});

// Firebase / OAuth config endpoint for client-side Google Drive authentication
app.get('/api/firebase-config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      res.json(config);
    } else {
      res.status(404).json({ error: 'Firebase config not found' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Drive folder mirror config
app.get('/api/drive/config', (req, res) => {
  res.json({
    ws1FolderId: '1Ksu-Ek_ooG8VgZ3tsKw7_G5vBl7k77dI',
    ws1FolderUrl: 'https://drive.google.com/drive/folders/1Ksu-Ek_ooG8VgZ3tsKw7_G5vBl7k77dI?usp=sharing',
    ws2FolderId: '1xACdZuFoDJb-8YyQMa5GO9oraUkpjWzB',
    ws2FolderUrl: 'https://drive.google.com/drive/folders/1xACdZuFoDJb-8YyQMa5GO9oraUkpjWzB?usp=sharing',
    folderId: '1Ksu-Ek_ooG8VgZ3tsKw7_G5vBl7k77dI',
    folderUrl: 'https://drive.google.com/drive/folders/1Ksu-Ek_ooG8VgZ3tsKw7_G5vBl7k77dI?usp=sharing',
    scope: 'https://www.googleapis.com/auth/drive.readonly'
  });
});

// Helper function to recursively fetch files from a folder and its subfolders
async function fetchDriveFolderRecursive(folderId, token, depth = 0, maxDepth = 3) {
  if (depth > maxDepth) return [];
  const driveUrl = `https://www.googleapis.com/drive/v3/files?q='${encodeURIComponent(folderId)}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,thumbnailLink,webContentLink,size,createdTime)&pageSize=1000&orderBy=name`;
  const driveRes = await fetch(driveUrl, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });

  if (!driveRes.ok) {
    const errText = await driveRes.text();
    throw new Error(`Drive API error (${driveRes.status}): ${errText}`);
  }

  const data = await driveRes.json();
  const items = data.files || [];
  let allFiles = [];

  for (const item of items) {
    if (item.mimeType === 'application/vnd.google-apps.folder') {
      const subItems = await fetchDriveFolderRecursive(item.id, token, depth + 1, maxDepth);
      allFiles.push(...subItems);
    } else {
      allFiles.push(item);
    }
  }

  return allFiles;
}

// Mirror and interrogate Google Drive folder with user's access token
app.post('/api/drive/mirror-folder', async (req, res) => {
  try {
    const { folderId = '1Ksu-Ek_ooG8VgZ3tsKw7_G5vBl7k77dI' } = req.body;
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Google OAuth Bearer token required to interrogate Google Drive folder.' });
    }

    const rawFiles = await fetchDriveFolderRecursive(folderId, token);

    // Sort files naturally by filename/sequence
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    const sortedFiles = [...rawFiles].sort((a, b) => collator.compare(a.name || '', b.name || ''));

    return res.json({
      success: true,
      folderId,
      totalFiles: sortedFiles.length,
      files: sortedFiles
    });
  } catch (err) {
    console.error('Drive mirror error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Public Supabase configuration for client if available
app.get('/api/supabase/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || null,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null,
    isConfigured: !!(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY))
  });
});

// Supabase login / sign up / sync endpoint
app.post('/api/supabase/auth/login', async (req, res) => {
  try {
    const { email, password, action } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const sb = getSupabaseAdmin();
    if (!sb) {
      return res.status(503).json({ 
        error: 'Supabase server configuration missing. Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are configured in Settings.' 
      });
    }

    if (action === 'signup') {
      const { data, error } = await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { app: 'wordsmartmastery' }
      });
      if (error) {
        return res.status(400).json({ error: error.message });
      }

      // Record login event in user_logins table if exists, or profile table
      try {
        await sb.from('user_logins').insert([
          { 
            user_id: data.user.id, 
            email: data.user.email, 
            login_time: new Date().toISOString(),
            user_agent: req.headers['user-agent'] || 'unknown',
            ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown'
          }
        ]);
      } catch (logErr) {
        console.warn('Could not insert login record to user_logins table:', logErr.message);
      }

      return res.json({ 
        success: true, 
        message: 'Account created successfully!', 
        user: { id: data.user.id, email: data.user.email } 
      });
    } else {
      // Normal sign in: verify credentials via signInWithPassword using client
      const tempClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
      const { data, error } = await tempClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return res.status(401).json({ error: error.message });
      }

      // Record login event with admin client
      try {
        await sb.from('user_logins').insert([
          { 
            user_id: data.user.id, 
            email: data.user.email, 
            login_time: new Date().toISOString(),
            user_agent: req.headers['user-agent'] || 'unknown',
            ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown'
          }
        ]);
      } catch (logErr) {
        console.warn('Could not record login event:', logErr.message);
      }

      return res.json({
        success: true,
        user: { id: data.user.id, email: data.user.email },
        session: { access_token: data.session.access_token }
      });
    }
  } catch (err) {
    console.error('Auth error:', err);
    res.status(500).json({ error: err.message || 'Internal server authentication error' });
  }
});

// Sync user study progress to Supabase
app.post('/api/supabase/sync', async (req, res) => {
  try {
    const { userId, email, progressData } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required.' });
    }

    const sb = getSupabaseAdmin();
    if (!sb) {
      return res.status(503).json({ error: 'Supabase is not configured on the server.' });
    }

    const { data, error } = await sb.from('user_progress').upsert({
      user_id: userId,
      email: email || '',
      progress: progressData,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ success: true, message: 'Progress synchronized to Supabase!' });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Fetch user progress from Supabase
app.get('/api/supabase/progress/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const sb = getSupabaseAdmin();
    if (!sb) {
      return res.status(503).json({ error: 'Supabase not configured' });
    }

    const { data, error } = await sb.from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is row not found
      return res.status(400).json({ error: error.message });
    }

    return res.json({ progress: data ? data.progress : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPA / static fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

