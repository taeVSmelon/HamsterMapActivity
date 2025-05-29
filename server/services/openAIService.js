import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

const OPEN_AI_ORGANIZATION = process.env.OPEN_AI_AUTHORIZATION;
const OPEN_AI_PROJECT = process.env.OPEN_AI_AUTHORIZATION;
const OPEN_AI_AUTHORIZATION = process.env.OPEN_AI_AUTHORIZATION;

const url = "https://api.openai.com/v1/responses";

const createPayload = (message) => {
  return {
    model: "gpt-4.1-nano",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: `You are an AI assistant tasked with evaluating student answers to various questions.

**Input Format (JSON):**
Your input will be a JSON object with the following structure. Note that \`realAnswer\` is an optional field.
\`\`\`json
{
  "question": [
    {
      "valueType": "text",
      "value": "What's 2 + 3"
    }
  ],
  "answer": "2 + 3 equal 5 only",
  "realAnswer": "5" // Optional: The actual correct answer, if available.
}
\`\`\`

**Output Format (JSON):**
After evaluating the student's answer, you must output a JSON object with the following structure:
\`\`\`json
{
  "result": "Pass",
  "comment": "Your explanation is good but it still lacks..."
}
\`\`\`
* \`result\` can be either "Pass" or "Fail".
* \`comment\` should provide constructive feedback.

**Guidelines for Generating the 'Comment':**

1.  **Conciseness:** Keep the comment brief, ideally no more than 2-3 sentences. Avoid unnecessary jargon or conversational filler.
2.  **Focus:** Directly address the core strengths and weaknesses of the student's answer. Prioritize essential improvements.
3.  **Actionable Feedback:** Provide specific, actionable advice that the student can use to improve their understanding or explanation.
4.  **Consider \`realAnswer\` (if present):** If a \`realAnswer\` is provided in the input, use it as a definitive reference for correctness when evaluating the student's \`answer\`. This \`realAnswer\` should inform your \`result\` (Pass/Fail) and the specific nature of your \`comment\`.
5.  **No Direct Answers:** Do **not** directly provide the correct answer from \`realAnswer\` or any other source in your \`comment\`. **The full solution must never be given.** Your role is to guide, not to solve.
6.  **Indirect Guidance:** Instead of giving solutions, guide the student towards self-discovery. This can be done by:
    * Asking guiding questions that prompt deeper thought.
    * Suggesting specific areas they might explore further (e.g., "Consider reviewing the \`Update\` method's execution frequency," or "You might want to research how physics calculations are typically handled in Unity's \`FixedUpdate\`").
7.  **Language Consistency:** Respond in the same language as the student's \`answer\`. If the language of the \`answer\` is unclear or ambiguous, default to Thai.`
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(message)
          }
        ]
      }
    ],
    text: {
      format: {
        type: "text"
      }
    },
    reasoning: {},
    tools: [],
    temperature: 1,
    max_output_tokens: 200,
    top_p: 0.8,
    store: true
  };
};

const headers = {
  Authorization: `Bearer ${OPEN_AI_AUTHORIZATION}`,
  "OpenAI-Organization": OPEN_AI_ORGANIZATION,
  "OpenAI-Project": OPEN_AI_PROJECT,
  "Content-Type": "application/json"
};

class OpenAIService {
  /**
   * ให้รางวัลกับผู้ใช้
   * @param {string|object} question - ไอดีของผู้ใช้
   * @param {string} answer - ไอดีของรางวัล
   * @return {string} - คำตอบจาก AI
   * @throws {OpenAIException} - หาก token หมด หรือ ข้อมูลไม่ถูกต้อง
   */
  static async checkAnswer(question, answer) {
    const payload = createPayload(JSON.stringify({
      question,
      answer
    }));

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new OpenAIException(`HTTP error! ${response.status}: ${errorDetails}`);
    }

    const responseJson = await response.json();

    const outputs = responseJson.output;

    let contentText = undefined;

    for (const output of outputs) {
      if (output.type === "message") {
        for (const content of output.content) {
          if (content.type === "output_text") {
            // แปลง string JSON จาก AI เป็น object
            contentText = JSON.parse(content.text);
          }
        }
      }
    }

    if (contentText) {
      if (contentText.result?.toLowerCase() === "fail") {
        throw new OpenAIException(contentText.comment);
      } else {
        return contentText.comment;
      }
    }

    return null;
  }

  /**
   * ให้รางวัลกับผู้ใช้
   * @param {string|object} question - ไอดีของผู้ใช้
   * @param {string|object} realAnswer - ไอดีของผู้ใช้
   * @param {string} answer - ไอดีของรางวัล
   * @return {string} - คำตอบจาก AI
   * @throws {OpenAIException} - หาก token หมด หรือ ข้อมูลไม่ถูกต้อง
   */
  static async checkAnswerWithRealAnswer(question, realAnswer, answer) {
    const payload = createPayload(JSON.stringify({
      question,
      realAnswer,
      answer
    }));

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new OpenAIException(`HTTP error! ${response.status}: ${errorDetails}`);
    }

    const responseJson = await response.json();

    const outputs = responseJson.output;

    let contentText = undefined;

    for (const output of outputs) {
      if (output.type === "message") {
        for (const content of output.content) {
          if (content.type === "output_text") {
            // แปลง string JSON จาก AI เป็น object
            contentText = JSON.parse(content.text);
          }
        }
      }
    }

    if (contentText) {
      if (contentText.result?.toLowerCase() === "fail") {
        throw new OpenAIException(contentText.comment);
      } else {
        return contentText.comment;
      }
    }

    return null;
  }
}

class OpenAIException extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "OpenAIException";
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export { OpenAIService, OpenAIException };
