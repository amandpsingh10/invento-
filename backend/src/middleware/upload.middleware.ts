import multer from "multer";
import { ApiError } from "../lib/apiError";
import { env } from "../config/env";

const ALLOWED_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-excel", // .xls
  "application/octet-stream", // some browsers send this for .xlsx — extension check below covers it
]);
const ALLOWED_EXTENSIONS = [".xlsx", ".xls"];

export const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.slice(file.originalname.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return cb(ApiError.badRequest("Only .xlsx and .xls files are supported", "INVALID_FILE_TYPE"));
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(ApiError.badRequest("Unrecognized file type", "INVALID_MIME_TYPE"));
    }
    cb(null, true);
  },
});
