#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'lib/natalReading/reportCatalogGeneration.ts'
source = path.read_text(encoding='utf-8')

bad_category = """    if (validationIssues.length === 0) validationIssues = ['SEMANTIC_CONTRACT_INVALID'];
    console.warn('[natal/catalog-validation]', JSON.stringify({
      kind: 'answer',
      answerKey: input.answerKey,
      semanticAttempt: attempt,
      responseId: result.responseId,
      validationIssues,
    }));
    console.warn('[natal/catalog-validation]', JSON.stringify({
      kind: 'category',
      categoryKey: input.categoryKey,
      semanticAttempt: attempt,
      responseId: result.responseId,
      validationIssues,
    }));
"""
category_only = """    if (validationIssues.length === 0) validationIssues = ['SEMANTIC_CONTRACT_INVALID'];
    console.warn('[natal/catalog-validation]', JSON.stringify({
      kind: 'category',
      categoryKey: input.categoryKey,
      semanticAttempt: attempt,
      responseId: result.responseId,
      validationIssues,
    }));
"""
if source.count(bad_category) != 1:
    raise RuntimeError(f'expected one bad category logging block, found {source.count(bad_category)}')
source = source.replace(bad_category, category_only, 1)

answer_start = source.index('export async function generateNatalReportAnswer(')
needle = "    if (validationIssues.length === 0) validationIssues = ['SEMANTIC_CONTRACT_INVALID'];\n"
insert_at = source.index(needle, answer_start) + len(needle)
answer_log = """    console.warn('[natal/catalog-validation]', JSON.stringify({
      kind: 'answer',
      answerKey: input.answerKey,
      semanticAttempt: attempt,
      responseId: result.responseId,
      validationIssues,
    }));
"""
source = source[:insert_at] + answer_log + source[insert_at:]
path.write_text(source, encoding='utf-8')
print('Natal validation logging placement fixed.')
