let completion = {
	checkIfComplete: function(page, pageDelta) {
		const score = page.maxScore > 0 ? pageDelta.score / page.maxScore : 0;

		let quizzesSatisfied = true;

		if (page.completionRules.requireSubmission) {
			const quizComponents = (page.components || []).filter(c => c.type === "quiz");

			quizzesSatisfied = quizComponents.every(q => {
				const compState = pageDelta.components[q.id];
				return compState && compState.completed === true;
			});
		}

		return (
			pageDelta.watchTime >= page.completionRules.watchTime &&
			score >= page.completionRules.score &&
			(!page.completionRules.scrolled || pageDelta.scrolled) &&
			pageDelta.videoProgress >= page.completionRules.videoProgress &&
			quizzesSatisfied
		);
	},

	calculateOverallGrade: function(pages, pagesState) {
		const earnedScore = pagesState.reduce((acc, p) => acc + p.score, 0);
		const maxScore = pages.reduce((acc, p) => acc + p.maxScore, 0);
		if (maxScore === 0) {
			return {ratio: 0, earnedScore: 0, maxScore: 0};
		}
		return {ratio: earnedScore / maxScore, earnedScore: earnedScore, maxScore: maxScore};
	},

	checkCourseCompletion: function(courseRules, totalCourseSeconds, pages, pagesState) {
		const isTimeRequirementMet = (courseRules.minimumMinutes * 60) <= totalCourseSeconds;
		const isScoreMet = courseRules.minimumGrade <= completion.calculateOverallGrade(pages, pagesState).ratio;
		const studentsCanFail = courseRules.studentsCanFail;
		const isEveryPageComplete = pagesState.every(p => p.completed);
		return (isTimeRequirementMet && (isScoreMet || studentsCanFail) && isEveryPageComplete);
	},

	finalizeCourse: function(courseRules, totalCourseSeconds, pages, pagesState) {
		const isTimeRequirementMet = (courseRules.minimumMinutes * 60) <= totalCourseSeconds;
		const isScoreMet = courseRules.minimumGrade <= completion.calculateOverallGrade(pages, pagesState).ratio;
		const studentsCanFail = courseRules.studentsCanFail;
		if (isTimeRequirementMet && (isScoreMet || studentsCanFail) && pages.length > 0) {
			pagesState[pages.length - 1].completed = true;
		}
	},
};
