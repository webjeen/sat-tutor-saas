// Generate PDF sample files for all output profiles
// Run with: npx tsx scripts/generate-pdf-samples.ts

import { renderPdf } from "../src/lib/pdf-layout/pdfRenderer";
import { buildRenderDocument } from "../src/lib/pdf-layout/outputProfiles";
import type { WorksheetAssemblyResult } from "../src/lib/assembly/types";
import type { GeneratedQuestion } from "../src/lib/generation/types";
import * as fs from "fs";
import * as path from "path";

// -- Rich mock data with 8 questions (enough to test page breaks) --

function makeRWQuestion(num: number, overrides: Partial<GeneratedQuestion> = {}): GeneratedQuestion {
  const passages = [
    "In recent years, the debate over urban green spaces has intensified as cities expand. Proponents argue that parks improve air quality and mental health, while critics contend that land should be allocated for housing to address shortages. The tension between these priorities reflects a broader challenge in urban planning: balancing environmental benefits with the practical need for shelter.",
    "The concept of digital minimalism has gained traction as technology becomes increasingly pervasive. Advocates suggest that deliberate reduction in screen time leads to improved focus and deeper interpersonal connections. However, critics argue that such approaches overlook the reality that modern professional and social life demands constant digital engagement, making selective use more practical than outright reduction.",
    "Historical accounts of the Silk Road often emphasize the exchange of goods between East and West, but scholars now recognize that the transmission of ideas was equally significant. Religious beliefs, scientific knowledge, and artistic techniques traveled alongside spices and textiles, fundamentally shaping the cultures that received them. This intellectual exchange challenges the assumption that trade routes served solely economic purposes.",
    "The phenomenon of 'plant blindness' — the tendency to overlook flora in favor of fauna — has implications for conservation efforts. Research indicates that people are more likely to support the protection of animals than plants, despite plants forming the foundation of most ecosystems. Conservationists argue that addressing this cognitive bias is essential for maintaining biodiversity.",
  ];

  const questions = [
    "Which choice best describes the main tension discussed in the text?",
    "Based on the passage, which choice best supports the claim that digital minimalism may be impractical?",
    "The passage suggests that the Silk Road's significance was primarily what?",
    "According to the passage, what is 'plant blindness' and why does it matter?",
    "Which choice best describes the author's primary purpose in the passage?",
    "Based on the text, which statement would the author most likely agree with?",
    "The passage implies that conservation efforts are most likely to succeed when what happens?",
    "Which choice provides the best evidence for the claim that trade routes had cultural significance?",
  ];

  const choicesPool = [
    { A: "Between environmental conservation and economic development", B: "Between preserving green spaces and providing housing", C: "Between urban expansion and rural preservation", D: "Between public health and private property rights" },
    { A: "It ignores the benefits of technology", B: "It fails to account for professional demands of digital engagement", C: "It underestimates people's self-control", D: "It overstates the dangers of screen time" },
    { A: "Primarily economic, as goods were the main focus", B: "Equally cultural and economic, as ideas traveled alongside goods", C: "Primarily religious, as beliefs spread most widely", D: "Primarily artistic, as techniques were most valued" },
    { A: "A medical condition causing inability to see plants; it affects gardening", B: "A cognitive tendency to ignore plants; it undermines conservation support", C: "A visual impairment specific to green objects; it affects outdoor activities", D: "A philosophical stance against plant research; it limits scientific funding" },
    { A: "To argue that urban parks should be expanded", B: "To inform readers about a cognitive bias affecting conservation", C: "To criticize conservation organizations for their priorities", D: "To compare plant and animal biodiversity" },
    { A: "People should spend less time on digital devices", B: "Selective digital engagement is more realistic than complete reduction", C: "Technology has no place in modern professional life", D: "Screen time reduction always improves focus" },
    { A: "They focus on protecting animals rather than plants", B: "They address the public's tendency to overlook plants", C: "They receive adequate funding for plant conservation", D: "They prioritize economic concerns over biodiversity" },
    { A: "Spices were the most traded commodity", B: "Ideas and knowledge traveled alongside physical goods", C: "The Silk Road was primarily used by merchants", D: "Cultural exchange was limited to religious beliefs" },
  ];

  const correctChoices = ["B", "B", "B", "B", "B", "B", "B", "B"];

  return {
    id: `gq-rw-${num}-${Date.now()}`,
    template_id: `tpl-rw-${num}`,
    pattern_id: `pat-rw-${num}`,
    section: "RW" as const,
    category: ["Inference", "Evidence", "Inference", "Vocabulary", "Purpose", "Inference", "Evidence", "Evidence"][num - 1] || "Inference",
    question_type: "mcq",
    generated_passage: passages[(num - 1) % passages.length],
    generated_question: questions[num - 1],
    choice_a: choicesPool[num - 1].A,
    choice_b: choicesPool[num - 1].B,
    choice_c: choicesPool[num - 1].C,
    choice_d: choicesPool[num - 1].D,
    correct_choice: correctChoices[num - 1],
    tutor_explanation: `For Q${num}, the correct answer is ${correctChoices[num - 1]}. This requires careful analysis of the passage's central argument and the specific evidence provided. The passage establishes a contrast that directly supports this interpretation, and the other choices either misrepresent the scope or reverse the direction of the argument. Students should focus on identifying the exact nature of the tension described rather than a more general or related concept.`,
    student_explanation: `The answer is ${correctChoices[num - 1]} because the passage specifically describes the key tension or relationship. Look for the direct contrast the author sets up — the other choices describe related but different situations.`,
    difficulty_score: 35 + (num * 8),
    mapped_level: (num <= 3 ? "easy" : num <= 5 ? "medium" : "hard") as "easy" | "medium" | "hard",
    difficulty_factors: { complexity: 3, syntax: 2, reasoning: 4, distractor: 3, density: 2, time: 2, passageQuality: 4, explanationDepth: 3, satMarkers: 4 },
    distractor_analysis: { strategies: ["conceptual_overlap", "scope_shift", "opposite_direction"] },
    reasoning_trace: [
      { step: 1, name: "Identify Core Claim", description: "Find the main tension or relationship", guidance: "Look for contrasting viewpoints" },
      { step: 2, name: "Match to Choices", description: "Match to the correct answer choice", guidance: "Eliminate choices that describe different situations" },
    ],
    status: "validation_passed",
    processing_stage: "store",
    retry_count: 0,
    error_message: null,
    last_processed_at: new Date().toISOString(),
    fingerprint_text: `fp-txt-rw-${num}`,
    fingerprint_structure: `fp-str-rw-${num}`,
    fingerprint_choice: `fp-ch-rw-${num}`,
    pattern_signature: `RW-Inference-passage_tension_v${num}`,
    version: 1,
    is_active: true,
    approved_for_release: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeMathQuestion(num: number): GeneratedQuestion {
  const mathData = [
    { q: "A store sells notebooks for $3 each and pens for $2 each. If Maria spent exactly $22 on notebooks and pens, and she bought at least one of each, how many notebooks did she buy?", a: "2", b: "3", c: "4", d: "6", correct: "C", explanation: "Set up: 3n + 2p = 22 with n,p >= 1. Testing n=4: 12 + 2p = 22, p = 5. This works. Answer C." },
    { q: "If 5x - 3 = 12, what is the value of x?", a: "1", b: "2", c: "3", d: "4", correct: "C", explanation: "5x - 3 = 12 → 5x = 15 → x = 3. Answer C." },
    { q: "The ratio of boys to girls in a class is 3:5. If there are 40 students total, how many girls are in the class?", a: "15", b: "20", c: "24", d: "25", correct: "D", explanation: "3+5=8 parts. 40/8 = 5 per part. Girls = 5*5 = 25. Answer D." },
    { q: "A rectangle has a perimeter of 36 cm and a width of 8 cm. What is its length?", a: "10 cm", b: "14 cm", c: "20 cm", d: "28 cm", correct: "A", explanation: "P = 2(l+w), so 36 = 2(l+8), l+8 = 18, l = 10. Answer A." },
    { q: "If f(x) = 2x^2 - 3x + 1, what is f(2)?", a: "1", b: "3", c: "5", d: "7", correct: "B", explanation: "f(2) = 2(4) - 3(2) + 1 = 8 - 6 + 1 = 3. Answer B." },
    { q: "A train travels 240 miles in 4 hours. At the same rate, how far will it travel in 7 hours?", a: "360 miles", b: "400 miles", c: "420 miles", d: "480 miles", correct: "C", explanation: "Rate = 240/4 = 60 mph. Distance in 7h = 60*7 = 420. Answer C." },
    { q: "What is the slope of the line passing through points (2, 5) and (6, 13)?", a: "1/2", b: "2", c: "4", d: "8", correct: "B", explanation: "Slope = (13-5)/(6-2) = 8/4 = 2. Answer B." },
    { q: "If 3^x = 81, what is the value of x?", a: "2", b: "3", c: "4", d: "5", correct: "C", explanation: "81 = 3^4, so x = 4. Answer C." },
  ];

  const d = mathData[(num - 1) % mathData.length];
  return {
    id: `gq-math-${num}-${Date.now()}`,
    template_id: `tpl-math-${num}`,
    pattern_id: `pat-math-${num}`,
    section: "Math" as const,
    category: ["Linear", "Linear", "Ratio", "Geometry", "Functions", "Rate", "Linear", "Exponents"][num - 1] || "Linear",
    question_type: "mcq",
    generated_passage: null,
    generated_question: d.q,
    choice_a: d.a,
    choice_b: d.b,
    choice_c: d.c,
    choice_d: d.d,
    correct_choice: d.correct,
    tutor_explanation: d.explanation,
    student_explanation: d.explanation,
    difficulty_score: 30 + (num * 10),
    mapped_level: (num <= 3 ? "easy" : num <= 5 ? "medium" : "hard") as "easy" | "medium" | "hard",
    difficulty_factors: { complexity: 3, syntax: 2, reasoning: 4, distractor: 3, density: 2, time: 2, passageQuality: 0, explanationDepth: 3, satMarkers: 3 },
    distractor_analysis: { strategies: ["calculation_error", "misread_constraint", "partial_solution"] },
    reasoning_trace: [
      { step: 1, name: "Set Up", description: "Translate the problem into an equation or relationship", guidance: "Identify what's given and what's asked" },
      { step: 2, name: "Solve", description: "Solve the equation systematically", guidance: "Check work at each step" },
    ],
    status: "validation_passed",
    processing_stage: "store",
    retry_count: 0,
    error_message: null,
    last_processed_at: new Date().toISOString(),
    fingerprint_text: `fp-txt-math-${num}`,
    fingerprint_structure: `fp-str-math-${num}`,
    fingerprint_choice: `fp-ch-math-${num}`,
    pattern_signature: `Math-Linear-v${num}`,
    version: 1,
    is_active: true,
    approved_for_release: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function buildRWAssembly(): WorksheetAssemblyResult {
  const questions = Array.from({ length: 8 }, (_, i) => {
    const q = makeRWQuestion(i + 1);
    return {
      index: i,
      question: q,
      section: "RW" as const,
      category: q.category,
      difficultyLevel: q.mapped_level,
      correctChoice: q.correct_choice,
    };
  });

  return {
    worksheetId: `ws:pdf-inspect:rw:${Date.now()}`,
    config: {
      title: "SAT Practice — Reading & Writing",
      section: "RW",
      categories: ["Inference", "Evidence", "Vocabulary", "Purpose"],
      questionCount: 8,
      difficultyMode: "mixed",
      difficultyDistribution: { easy: 30, medium: 40, hard: 30 },
      purpose: "homework",
      outputProfile: "full_review_pack",
      timeConstraintMinutes: 25,
    },
    questions,
    studentWorksheet: {
      title: "SAT Practice — Reading & Writing",
      section: "RW",
      instructions: "Read each passage carefully. Choose the best answer for each question.",
      timeConstraintMinutes: 25,
      questions: questions.map((q, i) => ({
        number: i + 1,
        passage: q.question.generated_passage,
        question: q.question.generated_question,
        choices: {
          A: q.question.choice_a ?? "",
          B: q.question.choice_b ?? "",
          C: q.question.choice_c ?? "",
          D: q.question.choice_d ?? "",
        },
      })),
    },
    answerKey: {
      title: "SAT Practice — Reading & Writing — Answer Key",
      answers: questions.map((q, i) => ({
        number: i + 1,
        correctChoice: q.correctChoice,
        category: q.category,
        difficultyLevel: q.difficultyLevel,
      })),
    },
    explanationPack: {
      title: "SAT Practice — Reading & Writing — Explanation Pack",
      explanations: questions.map((q, i) => ({
        number: i + 1,
        correctChoice: q.correctChoice,
        category: q.category,
        tutorExplanation: q.question.tutor_explanation ?? "",
        studentExplanation: q.question.student_explanation ?? "",
        distractorAnalysis: q.question.distractor_analysis,
        reasoningTrace: q.question.reasoning_trace,
        wrongChoiceAnalysis: ["A", "B", "C", "D"]
          .filter((c) => c !== q.correctChoice)
          .map((c) => ({
            choice: c,
            text: `Choice ${c} is incorrect because it does not match the reasoning in the passage. This distractor uses a common SAT strategy to mislead students.`,
            strategy: "distractor_analysis",
          })),
      })),
    },
    validation: {
      difficultyProgression: "pass",
      answerDistribution: "pass",
      categoryDiversity: "pass",
      patternDiversity: "pass",
      duplicateCheck: "pass",
      allPassed: true,
      failedChecks: [],
      issues: [],
    },
    metadata: {
      totalQuestions: 8,
      section: "RW",
      categories: ["Inference", "Evidence", "Vocabulary", "Purpose"],
      difficultyDistribution: { easy: 2, medium: 3, hard: 3 },
      answerDistribution: { B: 6, C: 2 },
      assembledAt: new Date().toISOString(),
      version: 1,
    },
  };
}

function buildMathAssembly(): WorksheetAssemblyResult {
  const questions = Array.from({ length: 8 }, (_, i) => {
    const q = makeMathQuestion(i + 1);
    return {
      index: i,
      question: q,
      section: "Math" as const,
      category: q.category,
      difficultyLevel: q.mapped_level,
      correctChoice: q.correct_choice,
    };
  });

  return {
    worksheetId: `ws:pdf-inspect:math:${Date.now()}`,
    config: {
      title: "SAT Practice — Math",
      section: "Math",
      categories: ["Linear", "Ratio", "Geometry", "Functions", "Rate", "Exponents"],
      questionCount: 8,
      difficultyMode: "mixed",
      difficultyDistribution: { easy: 30, medium: 40, hard: 30 },
      purpose: "homework",
      outputProfile: "full_review_pack",
      timeConstraintMinutes: 25,
    },
    questions,
    studentWorksheet: {
      title: "SAT Practice — Math",
      section: "Math",
      instructions: "Solve each problem and choose the best answer.",
      timeConstraintMinutes: 25,
      questions: questions.map((q, i) => ({
        number: i + 1,
        passage: q.question.generated_passage,
        question: q.question.generated_question,
        choices: {
          A: q.question.choice_a ?? "",
          B: q.question.choice_b ?? "",
          C: q.question.choice_c ?? "",
          D: q.question.choice_d ?? "",
        },
      })),
    },
    answerKey: {
      title: "SAT Practice — Math — Answer Key",
      answers: questions.map((q, i) => ({
        number: i + 1,
        correctChoice: q.correctChoice,
        category: q.category,
        difficultyLevel: q.difficultyLevel,
      })),
    },
    explanationPack: {
      title: "SAT Practice — Math — Explanation Pack",
      explanations: questions.map((q, i) => ({
        number: i + 1,
        correctChoice: q.correctChoice,
        category: q.category,
        tutorExplanation: q.question.tutor_explanation ?? "",
        studentExplanation: q.question.student_explanation ?? "",
        distractorAnalysis: q.question.distractor_analysis,
        reasoningTrace: q.question.reasoning_trace,
        wrongChoiceAnalysis: ["A", "B", "C", "D"]
          .filter((c) => c !== q.correctChoice)
          .map((c) => ({
            choice: c,
            text: `Choice ${c} results from a common calculation error or misreading of the problem constraints.`,
            strategy: "calculation_error",
          })),
      })),
    },
    validation: {
      difficultyProgression: "pass",
      answerDistribution: "pass",
      categoryDiversity: "pass",
      patternDiversity: "pass",
      duplicateCheck: "pass",
      allPassed: true,
      failedChecks: [],
      issues: [],
    },
    metadata: {
      totalQuestions: 8,
      section: "Math",
      categories: ["Linear", "Ratio", "Geometry", "Functions", "Rate", "Exponents"],
      difficultyDistribution: { easy: 2, medium: 3, hard: 3 },
      answerDistribution: { C: 4, A: 1, B: 1, D: 1 },
      assembledAt: new Date().toISOString(),
      version: 1,
    },
  };
}

async function main() {
  const outDir = path.join(__dirname, "..", "pdf-samples");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const profiles: Array<import("../src/lib/assembly/types").OutputProfile> = [
    "student_clean",
    "homework_with_key",
    "tutor_compact",
    "full_review_pack",
  ];

  for (const section of ["RW", "Math"] as const) {
    const assembly = section === "RW" ? buildRWAssembly() : buildMathAssembly();

    for (const profile of profiles) {
      const profileAssembly = { ...assembly, config: { ...assembly.config, outputProfile: profile } };
      const renderDoc = buildRenderDocument(profileAssembly, null);
      const pdfBuffer = await renderPdf(renderDoc);

      const filename = `${section.toLowerCase()}_${profile}.pdf`;
      const filepath = path.join(outDir, filename);
      fs.writeFileSync(filepath, pdfBuffer);

      // Count pages by scanning for /Type /Page (rough)
      const pdfStr = pdfBuffer.toString("latin1");
      const pageMatches = pdfStr.match(/\/Type\s*\/Page[^s]/g);
      const pageCount = pageMatches ? pageMatches.length : 1;

      console.log(`  ${filename}: ${(pdfBuffer.length / 1024).toFixed(1)}KB, ~${pageCount} pages`);
    }
  }

  console.log(`\nPDFs written to ${outDir}`);
}

main().catch(console.error);
