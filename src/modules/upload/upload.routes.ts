import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../../middleware/auth.middleware';
import { AuthRequest } from '../../types';
import { ok, fail } from '../../utils/response';

const UPLOADS_DIR = path.join(__dirname, '../../../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const ALLOWED_MIME = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/ogg', 'audio/webm',
  'application/pdf',
  'text/plain',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

const router = Router();
router.use(authMiddleware);

/**
 * POST /api/upload  — загрузить файл, вернуть { url, type, name, size }
 */
router.post(
  '/',
  upload.single('file'),
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.file) {
        fail(res, 'No file provided', 400);
        return;
      }

      const mime = req.file.mimetype;
      let type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' = 'FILE';
      if (mime.startsWith('image/')) type = 'IMAGE';
      else if (mime.startsWith('video/')) type = 'VIDEO';
      else if (mime.startsWith('audio/')) type = 'AUDIO';

      ok(res, {
        url: `/uploads/${req.file.filename}`,
        type,
        name: req.file.originalname,
        size: req.file.size,
      }, 201);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
