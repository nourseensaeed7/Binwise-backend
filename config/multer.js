import multer from "multer";
import path from "path";

// تحديد مكان التخزين واسم الملف
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // فولدر لحفظ الصور
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${file.fieldname}-${Date.now()}${ext}`;
    cb(null, filename);
  },
});

// فلترة الملفات بحيث تكون صور فقط
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

const upload = multer({ storage, fileFilter });

export default upload;

