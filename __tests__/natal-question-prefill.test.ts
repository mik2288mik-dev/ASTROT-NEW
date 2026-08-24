import fs from 'fs';
import path from 'path';
import { questionTextForOpenRequest } from '../lib/natalReading/questionOpenRequest';

const ROOT = path.resolve(__dirname, '..');
const read = (relativePath: string) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');

describe('suggested natal question prefill', () => {
  it('normalizes an optional suggestion without submitting it', () => {
    expect(questionTextForOpenRequest({ requestId: 1, text: 'Что значит моя Венера?' }))
      .toBe('Что значит моя Венера?');
    expect(questionTextForOpenRequest({ requestId: 2 })).toBe('');
    expect(questionTextForOpenRequest({ requestId: 3, text: 'x'.repeat(400) })).toHaveLength(300);
  });

  it('opens the existing Natal reading composer and leaves submit on the form', () => {
    const app = read('App.tsx');
    const magazine = read('views/v2/NatalMagazine.tsx');
    const report = read('components/NatalReading/HumanReport.tsx');

    expect(app).toContain("setNatalQuestionRequest({");
    expect(app).toContain("text,");
    expect(app).toContain("navigateTo('chart');");
    expect(magazine).toContain("setActiveTab('reading');");
    expect(magazine).toContain('setQuestionOpenRequest(openQuestionRequest);');
    expect(report).toContain('setQuestionText(questionTextForOpenRequest(openQuestionRequest));');
    expect(report).toContain('<form onSubmit={submitQuestion}');
    expect(report).toContain('onClick={openEmptyQuestions}');
    expect(report).not.toMatch(/setQuestionText\(questionTextForOpenRequest\(openQuestionRequest\)\);\s*void askNatalQuestion/);
  });
});
