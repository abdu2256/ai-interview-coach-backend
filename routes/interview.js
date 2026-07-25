const express = require('express');
const router = express.Router();
const multer = require('multer');
const verifyToken = require('../middleware/auth');
const { startInterview, submitAnswer, getReport } = require('../controllers/interviewController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});

const upload = multer({ storage });

router.post('/start', verifyToken, upload.single('cv'), startInterview);
router.post('/answer', verifyToken, submitAnswer);
router.get('/report/:interview_id', verifyToken, getReport);

module.exports = router;