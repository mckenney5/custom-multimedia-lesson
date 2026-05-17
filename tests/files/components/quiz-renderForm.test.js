const { test, expect } = require('@playwright/test');
const { setupPage } = require('../../helpers/page-setup.js');

test.describe('CourseQuiz renderForm()', () => {
  let page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await setupPage(page);
    await page.addScriptTag({ path: '../src/internal/components.js' });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should clear previous content before rendering', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.innerHTML = '<div class="quiz-container">old content</div>';
      quiz.options = [];
      quiz.renderForm([], {});
      const container = quiz.querySelector('.quiz-container');
      const oldContent = container && container.textContent;
      return { hasOldContent: oldContent && oldContent.includes('old content'), hasNewContent: container && container.textContent.length > 0 };
    });
    expect(result.hasOldContent).toBe(false);
  });

  test('should create quiz container', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      quiz.renderForm([], {});
      return quiz.querySelector('.quiz-container') !== null;
    });
    expect(result).toBe(true);
  });

  test('should render multiple choice question with options', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      const questions = [
        { id: 'q1', type: 'multiple-choice', text: 'Which is fruit?', possibleAnswers: ['Apple', 'Banana', 'Car'] }
      ];
      quiz.renderForm(questions, {});
      const fieldset = quiz.querySelector('.question-block');
      return fieldset !== null;
    });
    expect(result).toBe(true);
  });

  test('should render short answer input', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      const questions = [
        { id: 'q1', type: 'short-answer', text: 'What is 2+2?' }
      ];
      quiz.renderForm(questions, {});
      const input = quiz.querySelector('input[type="text"]');
      return input !== null;
    });
    expect(result).toBe(true);
  });

  test('should render submit button', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      quiz.renderForm([], {});
      const btn = quiz.querySelector('.btn-submit');
      return btn !== null && btn.textContent === 'Submit Answers';
    });
    expect(result).toBe(true);
  });

  test('should restore saved short answer value', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      const questions = [{ id: 'q1', type: 'short-answer', text: 'Name?' }];
      const savedAnswers = { q1: ['John'] };
      quiz.renderForm(questions, savedAnswers);
      const input = quiz.querySelector('input[name="q1"]');
      return input.value;
    });
    expect(result).toBe('John');
  });

  test('should restore saved checkbox selections', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      const questions = [{ id: 'q1', type: 'select-all-that-apply', text: 'Select', possibleAnswers: ['A', 'B'] }];
      const savedAnswers = { q1: ['A'] };
      quiz.renderForm(questions, savedAnswers);
      const input = quiz.querySelector('input[value="A"]');
      return input.checked;
    });
    expect(result).toBe(true);
  });

  test('should show No Attempts Left text and disabled button when hasAttempted and no attempts left', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      quiz.hasAttempted = true;
      quiz.attemptsLeft = 0;
      quiz.renderForm([], {});
      const btn = quiz.querySelector('.btn-submit');
      return { text: btn ? btn.textContent : null, disabled: btn ? btn.disabled : null };
    });
    expect(result.text).toContain('No Attempts Left');
    expect(result.disabled).toBe(true);
  });

	test('should show Resubmit when hasAttempted and attempts remain', async () => {
		const result = await page.evaluate(() => {
			const quiz = document.createElement('course-quiz');
			quiz.options = [];
			quiz.hasAttempted = true;
			quiz.attemptsLeft = 2;
			quiz.renderForm([], {});
			const btn = quiz.querySelector('.btn-submit');
			return { text: btn ? btn.textContent : null, disabled: btn ? btn.disabled : null };
		});
		expect(result.text).toBe('Resubmit');
		expect(result.disabled).toBe(false);
	});

  test('should disable submit button and inputs when no attempts left', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      quiz.attemptsLeft = 0;
      quiz.renderForm(
        [{ id: 'q1', type: 'multiple-choice', text: 'Test', possibleAnswers: ['A', 'B'] }],
        {}
      );
      const btn = quiz.querySelector('.btn-submit');
      const inputs = quiz.querySelectorAll('input');
      return {
        btnDisabled: btn.disabled,
        btnText: btn.textContent,
        inputsDisabled: Array.from(inputs).every(inp => inp.disabled),
      };
    });
    expect(result.btnDisabled).toBe(true);
    expect(result.btnText).toContain('No Attempts Left');
    expect(result.inputsDisabled).toBe(true);
  });

	test('handleQuizData → renderForm should show Resubmit when hasAttempted is true and attempts remain', async () => {
		const result = await page.evaluate(() => {
			const quiz = document.createElement('course-quiz');
			quiz.setAttribute('id', 'quiz1');
			quiz.options = [];
			const event = {
				detail: {
					id: 'quiz1',
					value: {
						attemptsLeft: 2,
						hasAttempted: true,
						options: [],
						questions: [{ id: 'q1', type: 'multiple-choice', text: 'Test', possibleAnswers: ['A', 'B'], correctAnswers: ['A'], pointValue: 1 }],
						userAnswers: { q1: ['A'] },
					},
				},
			};
			quiz.handleQuizData(event);
			const btn = quiz.querySelector('.btn-submit');
			return { text: btn ? btn.textContent : null, disabled: btn ? btn.disabled : null };
		});
		expect(result.text).toBe('Resubmit');
		expect(result.disabled).toBe(false);
	});

	test('handleQuizData → renderForm should keep Submit Answers when hasAttempted is false', async () => {
		const result = await page.evaluate(() => {
			const quiz = document.createElement('course-quiz');
			quiz.setAttribute('id', 'quiz1');
			quiz.options = [];
			const event = {
				detail: {
					id: 'quiz1',
					value: {
						attemptsLeft: 3,
						hasAttempted: false,
						options: [],
						questions: [{ id: 'q1', type: 'multiple-choice', text: 'Test', possibleAnswers: ['A', 'B'], correctAnswers: ['A'], pointValue: 1 }],
						userAnswers: {},
					},
				},
			};
			quiz.handleQuizData(event);
			const btn = quiz.querySelector('.btn-submit');
			return { text: btn ? btn.textContent : null, disabled: btn ? btn.disabled : null };
		});
		expect(result.text).toBe('Submit Answers');
		expect(result.disabled).toBe(false);
	});

	test('should disable inputs for short answer when no attempts left', async () => {
    const result = await page.evaluate(() => {
      const quiz = document.createElement('course-quiz');
      quiz.options = [];
      quiz.attemptsLeft = 0;
      quiz.renderForm(
        [{ id: 'q1', type: 'short-answer', text: 'Test' }],
        {}
      );
      const inputs = quiz.querySelectorAll('input');
      return Array.from(inputs).every(inp => inp.disabled);
    });
    expect(result).toBe(true);
  });
});