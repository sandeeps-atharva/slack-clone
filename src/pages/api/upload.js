import multer from "multer";
import { Readable } from "stream";
import { v2 as cloudinary } from "cloudinary";

const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
  "image/tiff",
  "image/x-icon",

  // Documents / Text
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.text",
  "application/epub+zip",
  "application/rtf",
  "application/vnd.latex",

  // Spreadsheets
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.oasis.opendocument.spreadsheet",
  "text/csv",
  "text/tab-separated-values",

  // Presentations
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.apple.keynote",

  // Audio
  "audio/mpeg", // mp3
  "audio/wav",
  "audio/ogg",
  "audio/webm",
  "audio/aac",
  "audio/mp4",
  "audio/x-flac",
  "audio/x-wma",
  "audio/x-m4a",

  // Video
  "video/mp4",
  "video/mpeg",
  "video/quicktime", // mov
  "video/x-msvideo", // avi
  "video/x-matroska", // mkv
  "video/x-ms-wmv",
  "video/x-flv",
  "video/webm",

  // Archives
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/x-tar",
  "application/gzip",
  "application/x-bzip2",

  // Code / Programming
  "application/javascript",
  "application/typescript",
  "application/json",
  "text/html",
  "text/css",
  "application/xml",
  "text/x-python",
  "text/x-java-source",
  "text/x-c",
  "text/x-c++",
  "application/x-httpd-php",
  "application/x-shellscript",
  "text/x-ruby",
  "text/x-go",
  "text/x-perl",
  "text/x-swift",
  "text/x-rust",

  // Database
  "application/x-sqlite3",
  "application/sql",
  "application/vnd.ms-access",
  "application/dbf",
  "application/x-parquet",

  // Executables / System
  "application/vnd.microsoft.portable-executable",
  "application/x-msdownload",
  "application/x-msinstaller",
  "application/x-deb",
  "application/x-rpm",
  "application/octet-stream",
  "application/x-sh",
  "application/x-bat",

  // 3D / Design files
  "application/vnd.adobe.photoshop",
  "application/vnd.adobe.illustrator",
  "application/x-sketch",
  "application/x-figma",
  "model/stl",
  "model/obj",
  "model/fbx",
  "model/gltf+json",
  "model/gltf-binary",

  // Web / Misc
  "application/manifest+json"
]);


const storage = multer.memoryStorage();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const { mimetype } = file;
    const isAllowedCategory =
      mimetype.startsWith("image/") || mimetype.startsWith("audio/");
    if (ALLOWED_MIME_TYPES.has(mimetype) || isAllowedCategory) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
});

function uploadBufferToCloudinary(file) {
  return new Promise((resolve, reject) => {
    const uploadOptions = {
      folder: process.env.CLOUDINARY_FOLDER || "chat-uploads",
      resource_type: "auto",
      use_filename: true,
      unique_filename: false,
      filename_override: file.originalname,
      overwrite: false,
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          return reject(error);
        }
        return resolve(result);
      }
    );

    Readable.from(file.buffer).pipe(uploadStream);
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};

async function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      throw new Error("Cloudinary is not configured");
    }

    await runMiddleware(req, res, upload.single("file"));

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const uploadResult = await uploadBufferToCloudinary(file);

    const resourceType = uploadResult.resource_type || "image";
    let accessibleUrl = uploadResult.secure_url;

    if (resourceType === "raw") {
      const deliveryOptions = {
        resource_type: resourceType,
        secure: true,
        version: uploadResult.version,
        flags: "attachment",
      };

      if (uploadResult.format) {
        deliveryOptions.format = uploadResult.format;
      }

      accessibleUrl = cloudinary.url(uploadResult.public_id, deliveryOptions);
    }

    return res.status(200).json({
      fileUrl: accessibleUrl,
      mimeType: file.mimetype,
      fileName: file.originalname,
      size: file.size,
      publicId: uploadResult.public_id,
      resourceType,
      format: uploadResult.format,
    });
  } catch (error) {
    console.error("Upload error:", error);

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "File too large (max 10MB)" });
      }
      return res.status(400).json({ error: error.message || "Upload failed" });
    }

    if (error instanceof Error && error.message === "Unsupported file type") {
      return res.status(400).json({ error: error.message });
    }

    return res.status(500).json({ error: "Internal server error" });
  }
}

