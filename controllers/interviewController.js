const pool = require('../config/db');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const { Ollama } = require('ollama');

const ollama = new Ollama();

const startInterview = async (req, res) => {
  try {
    const { job_title, company, jd_text } = req.body;
    const userId = req.user.id;

    const cvFile = req.file;
    if (!cvFile) {
      return res.status(400).json({ message: 'CV PDF required!' });
    }

    const pdfBuffer = fs.readFileSync(cvFile.path);
    const pdfData = await pdfParse(pdfBuffer);
    const cvText = pdfData.text;

    const prompt = `
You are an expert technical interviewer.
Based on this CV and Job Description, generate exactly 5 interview questions.

CV:
${cvText.substring(0, 2000)}

Job Description:
${jd_text.substring(0, 1000)}

Return ONLY a JSON array of 5 questions like this:
["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]
No extra text, just the JSON array.
`;

    const response = await ollama.chat({
      model: 'llama3.2',
      messages: [{ role: 'user', content: prompt }]
    });

    let questions;
    try {
      const content = response.message.content;
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      questions = JSON.parse(jsonMatch[0]);
    } catch (e) {
      questions = [
        "Tell me about yourself and your background.",
        "What are your strongest technical skills?",
        "Describe a challenging project you worked on.",
        "Why are you interested in this role?",
        "Where do you see yourself in 5 years?"
      ];
    }

    const result = await pool.query(
      `INSERT INTO interviews 
       (user_id, job_title, company, jd_text, cv_text) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [userId, job_title, company, jd_text, cvText]
    );

    fs.unlinkSync(cvFile.path);

    res.json({
      message: '✅ Interview started!',
      interview: result.rows[0],
      questions
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const submitAnswer = async (req, res) => {
  try {
    const { interview_id, question, user_answer } = req.body;

    const interview = await pool.query(
      'SELECT * FROM interviews WHERE id = $1',
      [interview_id]
    );

    if (interview.rows.length === 0) {
      return res.status(404).json({ message: 'Interview not found!' });
    }

    const { job_title, company } = interview.rows[0];

    const prompt = `
You are an expert interviewer for ${company} hiring for ${job_title}.

Question: ${question}
Candidate's Answer: ${user_answer}

Evaluate this answer and provide:
1. Score out of 10
2. What was good
3. What needs improvement
4. A better sample answer

Return ONLY JSON in this format:
{
  "score": 7,
  "good": "What was good about the answer",
  "improve": "What needs improvement",
  "sample": "A better sample answer"
}
`;

    const response = await ollama.chat({
      model: 'llama3.2',
      messages: [{ role: 'user', content: prompt }]
    });

    let feedback;
    try {
      const content = response.message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      feedback = JSON.parse(jsonMatch[0]);
    } catch (e) {
      feedback = {
        score: 7,
        good: "Good attempt at answering the question.",
        improve: "Try to be more specific with examples.",
        sample: "Provide a more structured answer using the STAR method."
      };
    }

    const result = await pool.query(
      `INSERT INTO answers 
       (interview_id, question, user_answer, ai_feedback, score)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [interview_id, question, user_answer, JSON.stringify(feedback), feedback.score]
    );

    res.json({
      message: '✅ Answer submitted!',
      answer: result.rows[0],
      feedback
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getReport = async (req, res) => {
  try {
    const { interview_id } = req.params;

    const answers = await pool.query(
      'SELECT * FROM answers WHERE interview_id = $1',
      [interview_id]
    );

    if (answers.rows.length === 0) {
      return res.status(404).json({ message: 'No answers found!' });
    }

    const totalScore = answers.rows.reduce((sum, a) => sum + a.score, 0);
    const overallScore = Math.round(totalScore / answers.rows.length);

    await pool.query(
      `INSERT INTO reports (interview_id, overall_score)
       VALUES ($1, $2)`,
      [interview_id, overallScore]
    );

    res.json({
      interview_id,
      overall_score: overallScore,
      total_questions: answers.rows.length,
      answers: answers.rows
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { startInterview, submitAnswer, getReport };