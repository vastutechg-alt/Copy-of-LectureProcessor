import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI, Type } from '@google/genai';
import cors from 'cors';

// Set ffmpeg path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '2gb' }));
app.use(express.urlencoded({ limit: '2gb', extended: true }));

// Ensure directories exist
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const VIDEOS_DIR = path.join(UPLOADS_DIR, 'videos');
const AUDIO_DIR = path.join(UPLOADS_DIR, 'audio');
const SPLITS_DIR = path.join(UPLOADS_DIR, 'splits');
const CHUNKS_DIR = path.join(UPLOADS_DIR, 'chunks');

[UPLOADS_DIR, VIDEOS_DIR, AUDIO_DIR, SPLITS_DIR, CHUNKS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve static files from uploads
app.use('/uploads', express.static(UPLOADS_DIR));

// Multer setup for video upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, VIDEOS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const id = uuidv4();
    cb(null, `${id}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 } // 2GB limit
});

import ytdl from '@distube/ytdl-core';

// In-memory status tracking for async processing
const processingStatus = new Map<string, any>();

// API Routes

// 1. Upload Video Chunk
app.post('/api/upload-chunk', upload.single('chunk'), (req, res) => {
  try {
    const { fileId, chunkIndex } = req.body;
    const chunkFile = req.file;
    
    if (!chunkFile) {
      return res.status(400).json({ error: 'No chunk uploaded' });
    }

    const chunkDir = path.join(CHUNKS_DIR, fileId);
    if (!fs.existsSync(chunkDir)) {
      fs.mkdirSync(chunkDir, { recursive: true });
    }

    const chunkPath = path.join(chunkDir, chunkIndex);
    fs.renameSync(chunkFile.path, chunkPath);

    res.json({ status: 'success' });
  } catch (error) {
    console.error('Chunk upload error:', error);
    res.status(500).json({ error: 'Failed to upload chunk' });
  }
});

// 2. Start Async Processing
app.post('/api/start-processing', async (req, res) => {
  const { fileId, originalName, totalChunks, bitrate } = req.body;
  
  if (!fileId || !originalName || !totalChunks) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Initialize status
  processingStatus.set(fileId, { status: 'merging', progress: 0 });
  res.json({ status: 'started', fileId });

  // Process in background
  try {
    const ext = path.extname(originalName);
    const finalVideoPath = path.join(VIDEOS_DIR, `${fileId}${ext}`);
    const chunkDir = path.join(CHUNKS_DIR, fileId);

    // Merge chunks using streams for better memory management
    const writeStream = fs.createWriteStream(finalVideoPath);
    for (let i = 0; i < totalChunks; i++) {
      const chunkPath = path.join(chunkDir, String(i));
      if (!fs.existsSync(chunkPath)) {
        throw new Error(`Missing chunk ${i}`);
      }
      
      await new Promise<void>((resolve, reject) => {
        const readStream = fs.createReadStream(chunkPath);
        readStream.pipe(writeStream, { end: false });
        readStream.on('end', () => {
          fs.unlinkSync(chunkPath);
          resolve();
        });
        readStream.on('error', reject);
      });
    }
    
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      writeStream.end();
    });
    
    // Ensure file is fully flushed to disk
    await new Promise(resolve => setTimeout(resolve, 500));
    
    if (fs.existsSync(chunkDir)) {
      fs.rmdirSync(chunkDir);
    }

    processingStatus.set(fileId, { status: 'extracting', progress: 0 });

    const audioFileName = `${fileId}.mp3`;
    const audioPath = path.join(AUDIO_DIR, audioFileName);

    const command = ffmpeg(finalVideoPath)
      .inputOptions([
        '-analyzeduration', '100M',
        '-probesize', '100M'
      ])
      .outputOptions([
        '-vn' // Disable video
      ])
      .toFormat('mp3')
      .audioBitrate(bitrate || '128k')
      .on('start', (commandLine) => {
        console.log('Spawned Ffmpeg with command: ' + commandLine);
      })
      .on('progress', (progress) => {
        // progress.percent might be undefined or NaN for some formats (like .VOB or .TS)
        // We can pass the current timemark to show it's still working
        let percent = 0;
        if (typeof progress.percent === 'number' && !isNaN(progress.percent)) {
          percent = Math.round(progress.percent);
        }
        
        processingStatus.set(fileId, { 
          status: 'extracting', 
          progress: percent,
          timemark: progress.timemark
        });
      })
      .on('end', () => {
        if (timeoutId) clearTimeout(timeoutId);
        processingStatus.set(fileId, {
          status: 'completed',
          result: {
            id: fileId,
            originalName,
            audioUrl: `/uploads/audio/${audioFileName}`,
            audioFileName
          }
        });
      })
      .on('error', (err, stdout, stderr) => {
        if (timeoutId) clearTimeout(timeoutId);
        console.error('FFmpeg error:', err.message);
        console.error('FFmpeg stderr:', stderr);
        processingStatus.set(fileId, { status: 'error', error: err.message || 'Failed to extract audio. The file might be corrupted or unsupported.' });
      });

    command.save(audioPath);

    // Add a 10-minute timeout to prevent hanging on corrupted files
    const timeoutId = setTimeout(() => {
      console.error('FFmpeg processing timed out for file:', fileId);
      command.kill('SIGKILL');
      processingStatus.set(fileId, { status: 'error', error: 'Processing timed out. The file might be corrupted, unsupported, or missing an audio track.' });
    }, 10 * 60 * 1000);

  } catch (error: any) {
    console.error('Merge/Process error:', error);
    processingStatus.set(fileId, { status: 'error', error: error.message || 'Failed to process video' });
  }
});

// 2.5 Process Video URL
app.post('/api/process-url', async (req, res) => {
  const { url, bitrate } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing URL' });
  }

  const fileId = uuidv4();
  let originalName = 'video_from_url';
  const isYouTube = ytdl.validateURL(url);

  try {
    if (isYouTube) {
      const info = await ytdl.getInfo(url);
      originalName = info.videoDetails.title.replace(/[^\w\s-]/gi, '') || 'youtube_video';
    } else {
      try {
        const urlParts = new URL(url).pathname.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        if (lastPart) {
          originalName = lastPart.split('.')[0] || 'video_from_url';
        }
      } catch (e) {
        // Ignore invalid URL parsing for name
      }
    }
  } catch (e: any) {
    console.error('Error getting info:', e);
    if (isYouTube) {
      const isBotError = e.message.includes('Sign in to confirm') || e.message.includes('bot');
      return res.status(400).json({ 
        error: isBotError 
          ? 'YouTube is blocking downloads from this server (Bot Protection). Please download the video locally and use the "Upload Local File" option instead.' 
          : `Failed to fetch YouTube video info: ${e.message}`
      });
    }
    // Ignore other errors for non-YouTube URLs, use default name
  }

  processingStatus.set(fileId, { status: 'downloading', progress: 0 });
  res.json({ status: 'started', fileId, originalName });

  // Process in background
  try {
    const audioFileName = `${fileId}.mp3`;
    const audioPath = path.join(AUDIO_DIR, audioFileName);

    const input = isYouTube ? ytdl(url, { quality: 'highestaudio' }) : url;

    if (isYouTube && typeof input !== 'string') {
      input.on('error', (err) => {
        console.error('ytdl stream error:', err);
        processingStatus.set(fileId, { status: 'error', error: `YouTube download error: ${err.message}` });
      });
    }

    const command = ffmpeg(input)
      .inputOptions([
        '-analyzeduration', '100M',
        '-probesize', '100M'
      ])
      .outputOptions([
        '-vn'
      ])
      .toFormat('mp3')
      .audioBitrate(bitrate || '128k')
      .on('start', (commandLine) => {
        console.log('Spawned Ffmpeg with command: ' + commandLine);
      })
      .on('progress', (progress) => {
        let percent = 0;
        if (typeof progress.percent === 'number' && !isNaN(progress.percent)) {
          percent = Math.round(progress.percent);
        }
        
        processingStatus.set(fileId, { 
          status: 'extracting', 
          progress: percent,
          timemark: progress.timemark
        });
      })
      .on('end', () => {
        if (timeoutId) clearTimeout(timeoutId);
        processingStatus.set(fileId, {
          status: 'completed',
          result: {
            id: fileId,
            originalName,
            audioUrl: `/uploads/audio/${audioFileName}`,
            audioFileName
          }
        });
      })
      .on('error', (err) => {
        if (timeoutId) clearTimeout(timeoutId);
        console.error('FFmpeg error:', err);
        processingStatus.set(fileId, { status: 'error', error: `FFmpeg error: ${err.message}` });
      });

    command.save(audioPath);

    // Add a 10-minute timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      console.error('FFmpeg processing timed out for URL:', fileId);
      command.kill('SIGKILL');
      processingStatus.set(fileId, { status: 'error', error: 'Processing timed out. The URL stream might be corrupted or unsupported.' });
    }, 10 * 60 * 1000);
  } catch (error: any) {
    console.error('URL Process error:', error);
    processingStatus.set(fileId, { status: 'error', error: error.message || 'Failed to process URL' });
  }
});

// 3. Check Processing Status
app.get('/api/processing-status/:fileId', (req, res) => {
  const { fileId } = req.params;
  const status = processingStatus.get(fileId);
  
  if (!status) {
    return res.status(404).json({ error: 'Status not found' });
  }
  
  res.json(status);
});

// 4. Split Audio
app.post('/api/split-audio', (req, res) => {
  const { id, audioFileName } = req.body;
  if (!id || !audioFileName) {
    return res.status(400).json({ error: 'Missing id or audioFileName' });
  }

  const audioPath = path.join(AUDIO_DIR, audioFileName);
  if (!fs.existsSync(audioPath)) {
    return res.status(404).json({ error: 'Audio file not found' });
  }

  // We want parts under 20MB. 
  // 128 kbps = 16 KB/s = ~0.96 MB/min. 
  // 18 MB = ~18.75 minutes. Let's split by 15 minutes to be safe.
  const segmentTime = 15 * 60; // 15 minutes in seconds

  const outputPattern = path.join(SPLITS_DIR, `${id}_part_%03d.mp3`);

  ffmpeg(audioPath)
    .outputOptions([
      '-f', 'segment',
      '-segment_time', String(segmentTime),
      '-c', 'copy'
    ])
    .on('end', () => {
      // Read generated files
      const files = fs.readdirSync(SPLITS_DIR)
        .filter(f => f.startsWith(`${id}_part_`))
        .sort();
      
      const parts = files.map(f => ({
        fileName: f,
        url: `/uploads/splits/${f}`,
        size: fs.statSync(path.join(SPLITS_DIR, f)).size
      }));

      res.json({ parts, status: 'success' });
    })
    .on('error', (err) => {
      console.error('FFmpeg split error:', err);
      res.status(500).json({ error: 'Failed to split audio' });
    })
    .save(outputPattern);
});

// Get GenAI instance safely
const getGenAI = (apiKey?: string) => {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error('Gemini API Key is missing. Please configure it in Settings.');
  }
  return new GoogleGenAI({ apiKey: key });
};

// 3. Transcribe Audio Part
app.post('/api/transcribe', async (req, res) => {
  const { fileName, apiKey } = req.body;
  if (!fileName) {
    return res.status(400).json({ error: 'Missing fileName' });
  }

  const filePath = path.join(SPLITS_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    const ai = getGenAI(apiKey);
    const fileData = fs.readFileSync(filePath);
    const base64Data = fileData.toString('base64');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'audio/mp3',
            data: base64Data
          }
        },
        {
          text: 'Please transcribe this audio accurately. It may contain English and Sinhala. Preserve names, technical terms, and lecture-specific vocabulary. Output only the transcript.'
        }
      ]
    });

    res.json({ transcript: response.text, status: 'success' });
  } catch (error: any) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: error.message || 'Failed to transcribe audio' });
  }
});

// 4. Generate Q&A
app.post('/api/generate-qa', async (req, res) => {
  const { transcript, style, count, language, apiKey } = req.body;
  if (!transcript) {
    return res.status(400).json({ error: 'Missing transcript' });
  }

  try {
    const ai = getGenAI(apiKey);
    
    let stylePrompt = '';
    switch (style) {
      case 'interview': stylePrompt = 'Interview style Q&A'; break;
      case 'teaching': stylePrompt = 'Teaching / lesson style Q&A'; break;
      case 'faq': stylePrompt = 'FAQ style summary'; break;
      default: stylePrompt = 'Simple Q&A'; break;
    }

    const langPrompt = language === 'sinhala' ? 'Sinhala (සිංහල)' : 'English';

    const prompt = `Analyze the following transcript and generate ${count || 10} Questions and Answers from the spoken content.
Style: ${stylePrompt}.
Language: Please output the questions and answers strictly in ${langPrompt}.
Keep the meaning faithful to the transcript. Do not invent facts that are not in the video.
Make the Q&A easy to read and useful for students and readers.

Transcript:
${transcript}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              answer: { type: Type.STRING }
            },
            required: ['question', 'answer']
          }
        }
      }
    });

    const qaList = JSON.parse(response.text || '[]');
    res.json({ qaList, status: 'success' });
  } catch (error: any) {
    console.error('Q&A generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate Q&A' });
  }
});

// 5. Test API Key
app.post('/api/test-key', async (req, res) => {
  const { apiKey } = req.body;
  try {
    const ai = getGenAI(apiKey);
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Say "OK" if you can read this.'
    });
    
    if (response.text) {
      res.json({ status: 'success', message: 'API Key is valid and working' });
    } else {
      res.status(500).json({ error: 'Model access error' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Invalid API Key or Network error' });
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  
  // Disable timeouts for large uploads
  server.setTimeout(0);
  server.keepAliveTimeout = 0;
}

startServer();
